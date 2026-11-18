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
alter table public.villages add column if not exists region text not null default 'Γορτυνία';

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
create or replace function public.admin_list_users()
returns table (email text, created_at timestamptz, last_sign_in_at timestamptz, events_count bigint)
language plpgsql stable security definer set search_path = public, auth
as $$
begin
    if not public.is_admin() then
        raise exception 'Μόνο για διαχειριστές';
    end if;
    return query
        select u.email::text, u.created_at, u.last_sign_in_at,
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
    to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

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

-- ---------------------------------------------------------------------
-- ΟΡΙΣΜΟΣ ΔΙΑΧΕΙΡΙΣΤΗ — τρέξτε ξεχωριστά, με το δικό σας email:
--   insert into public.admins (email) values ('to-email-sas@example.com');
-- ---------------------------------------------------------------------
