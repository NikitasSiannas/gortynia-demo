-- =====================================================================
-- Πανηγύρια Γορτυνίας — σχήμα βάσης δεδομένων (Supabase / PostgreSQL)
-- Supabase → SQL Editor → New query → επικόλληση → Run.
-- Είναι ασφαλές να ξανατρέξει (π.χ. μετά από αναβάθμιση της εφαρμογής).
-- Μετά τρέξτε το seed.sql και ορίστε διαχειριστή (δείτε το τέλος του αρχείου).
-- =====================================================================

-- ---------- Χωριά ----------
create table if not exists public.villages (
    id      integer primary key,
    name    text not null unique,
    lat     double precision not null,
    lon     double precision not null
);
alter table public.villages add column if not exists region text not null default 'Γορτυνία';   -- δήμος / περιοχή
alter table public.villages add column if not exists prefecture text not null default 'Αρκαδία'; -- νομός
alter table public.villages add column if not exists osm_id bigint;                              -- κόμβος OpenStreetMap
-- Στην Πελοπόννησο υπάρχουν πολλά χωριά με το ίδιο όνομα (π.χ. «Άγιος Νικόλαος») — το όνομα δεν είναι μοναδικό
alter table public.villages drop constraint if exists villages_name_key;
create index if not exists villages_prefecture_idx on public.villages (prefecture);

-- ---------- Εκδηλώσεις ----------
create table if not exists public.celebrations (
    id               bigint generated always as identity primary key,
    village_id       integer not null references public.villages(id) on delete cascade,
    celebration_type text not null
                     check (celebration_type in ('Πανηγύρι', 'Λαική Βραδιά', 'Πάρτυ Νεολαίας')),
    celebration_date date not null,
    start_time       time,
    dj               text,
    front_singer     text,
    clarinet_player  text,
    violin_player    text,
    bouzouki_player  text,
    notes            text check (char_length(notes) <= 500),
    created_by       uuid references auth.users(id) on delete set null default auth.uid(),
    created_at       timestamptz not null default now()
);
-- Έγκριση πριν τη δημοσίευση
alter table public.celebrations add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected'));
-- Email αυτού που την καταχώρησε (για τον διαχειριστή)
alter table public.celebrations add column if not exists created_by_email text default (auth.jwt() ->> 'email');
-- Σχόλιο του χρήστη προς τον διαχειριστή (δεν εμφανίζεται δημόσια)
alter table public.celebrations add column if not exists submitter_comment text check (char_length(submitter_comment) <= 500);
-- Σημείωση του διαχειριστή (π.χ. λόγος απόρριψης)
alter table public.celebrations add column if not exists admin_note text check (char_length(admin_note) <= 500);
alter table public.celebrations add column if not exists reviewed_at timestamptz;
alter table public.celebrations add column if not exists updated_at timestamptz;

create index if not exists celebrations_date_idx    on public.celebrations (celebration_date);
create index if not exists celebrations_village_idx on public.celebrations (village_id);
create index if not exists celebrations_status_idx  on public.celebrations (status);

-- ---------- Διαχειριστές (με βάση το email) ----------
create table if not exists public.admins (
    email      text primary key,
    created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
    select exists (
        select 1 from public.admins
        where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- Ο κανονικός χρήστης δεν μπορεί να εγκρίνει μόνος του: κάθε καταχώρηση/αλλαγή του πάει σε αναμονή.
create or replace function public.celebrations_before_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if tg_op = 'UPDATE' then
        new.updated_at := now();
        new.created_by := old.created_by;          -- ο δημιουργός δεν αλλάζει
        new.created_by_email := old.created_by_email;
    end if;

    -- Οι κανόνες ισχύουν μόνο για αιτήματα από την εφαρμογή. Το SQL Editor (postgres)
    -- και ο server (service_role) περνούν ελεύθερα — π.χ. για το seed.sql.
    if current_user not in ('authenticated', 'anon') then
        return new;
    end if;

    if public.is_admin() then
        if tg_op = 'UPDATE' and new.status is distinct from old.status then new.reviewed_at := now(); end if;
        if tg_op = 'INSERT' and new.status = 'approved' then new.reviewed_at := now(); end if;
    else
        new.status := 'pending';
        new.admin_note := case when tg_op = 'UPDATE' then old.admin_note else null end;
        new.reviewed_at := null;
        if tg_op = 'INSERT' then
            new.created_by := auth.uid();
            new.created_by_email := auth.jwt() ->> 'email';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists celebrations_before_write on public.celebrations;
create trigger celebrations_before_write
    before insert or update on public.celebrations
    for each row execute function public.celebrations_before_write();

-- ---------- Λίστα χρηστών για τον διαχειριστή ----------
-- (drop: άλλαξε ο τύπος επιστροφής σε σχέση με την πρώτη έκδοση)
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (id uuid, email text, is_anonymous boolean, created_at timestamptz, last_sign_in_at timestamptz, events_count bigint)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
    if not public.is_admin() then
        raise exception 'Μόνο για διαχειριστές';
    end if;
    return query
        select u.id, u.email::text, coalesce(u.is_anonymous, false), u.created_at, u.last_sign_in_at,
               (select count(*) from public.celebrations c where c.created_by = u.id)
        from auth.users u
        order by u.last_sign_in_at desc nulls last;
end;
$$;

-- ---------- Συνδρομές ειδοποιήσεων (Web Push) ----------
create table if not exists public.push_subscriptions (
    endpoint    text primary key,
    p256dh      text not null,
    auth        text not null,
    village_ids integer[],               -- null = όλα τα χωριά
    user_id     uuid references auth.users(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
-- Καμία πρόσβαση απευθείας· μόνο μέσω των παρακάτω συναρτήσεων και του server (service role).

create or replace function public.save_push_subscription(
    p_endpoint text, p_p256dh text, p_auth text, p_village_ids integer[]
) returns void
language sql security definer set search_path = public
as $$
    insert into public.push_subscriptions (endpoint, p256dh, auth, village_ids, user_id)
    values (p_endpoint, p_p256dh, p_auth, p_village_ids, auth.uid())
    on conflict (endpoint) do update
        set p256dh = excluded.p256dh, auth = excluded.auth,
            village_ids = excluded.village_ids, user_id = coalesce(excluded.user_id, push_subscriptions.user_id),
            updated_at = now();
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = public
as $$
    delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function public.save_push_subscription(text, text, text, integer[]) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;
grant execute on function public.admin_list_users() to authenticated;

-- ---------- Ασφάλεια (Row Level Security) ----------
alter table public.villages     enable row level security;
alter table public.celebrations enable row level security;
alter table public.admins       enable row level security;

drop policy if exists "villages: όλοι διαβάζουν" on public.villages;
create policy "villages: όλοι διαβάζουν" on public.villages for select using (true);

drop policy if exists "villages: διαχειριστές αλλάζουν" on public.villages;
create policy "villages: διαχειριστές αλλάζουν" on public.villages for all
    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins: ο ίδιος βλέπει τον εαυτό του" on public.admins;
create policy "admins: ο ίδιος βλέπει τον εαυτό του" on public.admins for select
    to authenticated using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());

-- Οι διαχειριστές προσθέτουν/αφαιρούν άλλους διαχειριστές από την εφαρμογή
drop policy if exists "admins: διαχειριστές προσθέτουν" on public.admins;
create policy "admins: διαχειριστές προσθέτουν" on public.admins for insert
    to authenticated with check (public.is_admin());
drop policy if exists "admins: διαχειριστές αφαιρούν" on public.admins;
create policy "admins: διαχειριστές αφαιρούν" on public.admins for delete
    to authenticated using (public.is_admin() and (select count(*) from public.admins) > 1);

-- Παλιές πολιτικές (από την πρώτη έκδοση)
drop policy if exists "celebrations: όλοι διαβάζουν" on public.celebrations;
drop policy if exists "celebrations: συνδεδεμένοι προσθέτουν" on public.celebrations;
drop policy if exists "celebrations: ο δημιουργός αλλάζει" on public.celebrations;
drop policy if exists "celebrations: ο δημιουργός διαγράφει" on public.celebrations;

-- Δημόσια φαίνονται μόνο οι εγκεκριμένες. Ο δημιουργός βλέπει και τις δικές του σε αναμονή.
drop policy if exists "celebrations: ανάγνωση" on public.celebrations;
create policy "celebrations: ανάγνωση" on public.celebrations for select
    using (status = 'approved' or created_by = auth.uid() or public.is_admin());

drop policy if exists "celebrations: προσθήκη" on public.celebrations;
create policy "celebrations: προσθήκη" on public.celebrations for insert
    to authenticated with check (true);   -- ο trigger ορίζει δημιουργό και status

drop policy if exists "celebrations: αλλαγή" on public.celebrations;
create policy "celebrations: αλλαγή" on public.celebrations for update
    to authenticated
    using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "celebrations: διαγραφή" on public.celebrations;
create policy "celebrations: διαγραφή" on public.celebrations for delete
    to authenticated using (created_by = auth.uid() or public.is_admin());

-- ---------- Μουσικοί (οργανοπαίκτες & τραγουδιστές) ----------
create table if not exists public.musicians (
    id            bigint generated always as identity primary key,
    name          text not null unique check (char_length(name) between 2 and 80),
    roles         text[] not null default '{}',   -- singer, clarinet, violin, bouzouki, laouto, santouri, oud, dj
    genres        text[] not null default '{}',   -- δημοτικό, νησιώτικο, λαϊκό, ρεμπέτικο
    birth_year    integer,
    death_year    integer,
    wikipedia_url text,
    description   text,
    status        text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
    created_by    uuid references auth.users(id) on delete set null default auth.uid(),
    created_at    timestamptz not null default now()
);
create index if not exists musicians_roles_idx on public.musicians using gin (roles);
-- Πού αναφέρεται ο μουσικός (δεν χρειάζεται Wikipedia: αρκεί ένα πρόγραμμα πανηγυριού, άρθρο, βίντεο)
alter table public.musicians add column if not exists scene text not null default 'panigyri'
    check (scene in ('panigyri', 'known'));           -- panigyri = μουσικός πανηγυριών, known = γνωστός καλλιτέχνης
alter table public.musicians add column if not exists source_url text;
alter table public.musicians add column if not exists source_note text;
alter table public.musicians add column if not exists last_seen_year integer;

-- Νέοι μουσικοί από χρήστες (π.χ. γράφοντας ένα όνομα στη φόρμα εκδήλωσης) πάνε σε αναμονή έγκρισης
create or replace function public.musicians_before_write()
returns trigger
language plpgsql set search_path = public
as $$
begin
    if current_user not in ('authenticated', 'anon') then
        return new;
    end if;
    if not public.is_admin() then
        new.status := 'pending';
        new.created_by := auth.uid();
    end if;
    return new;
end;
$$;
drop trigger if exists musicians_before_write on public.musicians;
create trigger musicians_before_write
    before insert or update on public.musicians
    for each row execute function public.musicians_before_write();

alter table public.musicians enable row level security;
drop policy if exists "musicians: ανάγνωση" on public.musicians;
create policy "musicians: ανάγνωση" on public.musicians for select
    using (status = 'approved' or created_by = auth.uid() or public.is_admin());
drop policy if exists "musicians: πρόταση" on public.musicians;
create policy "musicians: πρόταση" on public.musicians for insert
    to authenticated with check (true);
drop policy if exists "musicians: διαχειριστές αλλάζουν" on public.musicians;
create policy "musicians: διαχειριστές αλλάζουν" on public.musicians for update
    to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "musicians: διαχειριστές διαγράφουν" on public.musicians;
create policy "musicians: διαχειριστές διαγράφουν" on public.musicians for delete
    to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- ΟΡΙΣΜΟΣ ΔΙΑΧΕΙΡΙΣΤΗ — τρέξτε ξεχωριστά, με το δικό σας email:
--   insert into public.admins (email) values ('to-email-sas@example.com');
-- ---------------------------------------------------------------------
