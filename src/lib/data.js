import { supabase } from "../supabaseClient";

// Μορφή που χρησιμοποιεί όλο το UI:
//   village:     { id, name, region (δήμος), prefecture (νομός), lat, lon }
//   celebration: { id, village_id, celebration_type, celebration_date, start_time,
//                  dj, front_singer, clarinet_player, violin_player, bouzouki_player, notes,
//                  status, created_by, created_by_email, submitter_comment, admin_note }

export const isDatabaseEnabled = Boolean(supabase);

// Ελάχιστος CSV parser: αρκετός για τα δικά μας αρχεία (χωρίς κόμματα μέσα σε πεδία)
function parseCsv(text) {
    const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cells = line.split(",");
        const row = {};
        headers.forEach((h, i) => {
            row[h] = (cells[i] || "").trim();
        });
        return row;
    });
}

async function loadFromCsv() {
    const [vText, cText] = await Promise.all([
        fetch("/villages.csv").then((r) => r.text()),
        fetch("/celebrations.csv").then((r) => r.text()),
    ]);
    const villages = parseCsv(vText)
        .filter((v) => v.village_name && v.village_lat && v.village_lon)
        .map((v) => ({
            id: Number(v.id),
            name: v.village_name,
            region: v.region || "",
            prefecture: v.prefecture || "Αρκαδία",
            lat: parseFloat(v.village_lat),
            lon: parseFloat(v.village_lon),
        }));
    const ids = new Set(villages.map((v) => v.id));
    const celebrations = parseCsv(cText)
        .filter((c) => ids.has(Number(c.village_id)) && c.celebration_date)
        .map((c, i) => ({
            id: `csv-${i}`,
            village_id: Number(c.village_id),
            celebration_type: c.celebration_type,
            celebration_date: c.celebration_date,
            start_time: c.start_time || null,
            dj: c.dj || null,
            front_singer: c.front_singer || null,
            clarinet_player: c.clarinet_player || null,
            violin_player: c.violin_player || null,
            bouzouki_player: c.bouzouki_player || null,
            notes: c.notes || null,
            status: "approved",
            created_by: null,
        }));
    return { villages, celebrations, source: "csv" };
}

/** Το Supabase επιστρέφει έως 1000 γραμμές ανά αίτημα — φέρνουμε σε σελίδες. */
async function fetchAll(table, columns, orderBy) {
    const PAGE = 1000;
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from(table).select(columns).order(orderBy).order("id").range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) return rows;
    }
}

async function loadFromDatabase() {
    const [villages, celebrations] = await Promise.all([
        fetchAll("villages", "id, name, region, prefecture, lat, lon", "name"),
        fetchAll("celebrations", "*", "celebration_date"),
    ]);
    return { villages, celebrations, source: "db" };
}

/** Φορτώνει από τη βάση· αν δεν υπάρχει ή αποτύχει, πέφτει πίσω στα CSV. */
export async function loadAll() {
    if (supabase) {
        try {
            const result = await loadFromDatabase();
            if (result.villages.length > 0) return result;
            console.warn("Η βάση δεν έχει χωριά ακόμα — χρησιμοποιούνται τα CSV.");
        } catch (err) {
            console.error("Σφάλμα βάσης, χρησιμοποιούνται τα CSV:", err);
        }
    }
    return loadFromCsv();
}

const EDITABLE_FIELDS = [
    "village_id", "celebration_type", "celebration_date", "start_time",
    "dj", "front_singer", "clarinet_player", "violin_player", "bouzouki_player", "notes",
    "submitter_comment",
];

function clean(values) {
    const out = {};
    EDITABLE_FIELDS.forEach((f) => {
        const v = values[f];
        out[f] = typeof v === "string" ? v.trim() || null : v ?? null;
    });
    out.village_id = Number(out.village_id);
    return out;
}

export async function createCelebration(values, musicians) {
    const { data, error } = await supabase.from("celebrations").insert(clean(values)).select().single();
    if (error) throw error;
    await proposeNewMusicians(values, musicians);
    if (data.status === "pending") notifyServer(data.id, "pending");
    return data;
}

export async function updateCelebration(id, values, musicians) {
    const { data, error } = await supabase.from("celebrations").update(clean(values)).eq("id", id).select().single();
    if (error) throw error;
    await proposeNewMusicians(values, musicians);
    if (data.status === "pending") notifyServer(data.id, "pending");
    return data;
}

// ---------- Μουσικοί ----------

export async function loadMusicians() {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from("musicians")
        .select("id, name, roles, genres, birth_year, death_year, scene, source_url, source_note, last_seen_year, wikipedia_url, description, status, created_by, created_at")
        .order("name");
    if (error) {
        console.warn("Μουσικοί:", error.message);
        return [];
    }
    return data;
}

const ROLE_OF_FIELD = { dj: "dj", front_singer: "singer", clarinet_player: "clarinet", violin_player: "violin", bouzouki_player: "bouzouki" };

/** Ονόματα που γράφτηκαν στη φόρμα και δεν υπάρχουν στη λίστα → προτείνονται ως νέοι μουσικοί (σε αναμονή έγκρισης). */
async function proposeNewMusicians(values, musicians = []) {
    const known = new Set(musicians.map((m) => m.name.toLocaleLowerCase("el")));
    const rows = [];
    Object.entries(ROLE_OF_FIELD).forEach(([field, role]) => {
        const name = (values[field] || "").trim();
        if (name.length >= 2 && !known.has(name.toLocaleLowerCase("el"))) {
            known.add(name.toLocaleLowerCase("el"));
            rows.push({ name, roles: [role] });
        }
    });
    if (rows.length === 0) return;
    const { error } = await supabase.from("musicians").upsert(rows, { onConflict: "name", ignoreDuplicates: true });
    if (error) console.warn("Νέοι μουσικοί:", error.message);
}

export async function reviewMusician(id, status) {
    const { error } = status === "rejected"
        ? await supabase.from("musicians").delete().eq("id", id)
        : await supabase.from("musicians").update({ status }).eq("id", id);
    if (error) throw error;
}

// ---------- Διαχειριστές ----------

export async function listAdmins() {
    const { data, error } = await supabase.from("admins").select("email, created_at").order("created_at");
    if (error) throw error;
    return data;
}

export async function addAdmin(email) {
    const { error } = await supabase.from("admins").insert({ email: email.trim().toLowerCase() });
    if (error) throw error;
}

export async function removeAdmin(email) {
    const { error, count } = await supabase.from("admins").delete({ count: "exact" }).eq("email", email);
    if (error) throw error;
    if (count === 0) throw new Error("Δεν μπορεί να αφαιρεθεί ο τελευταίος διαχειριστής.");
}

export async function deleteCelebration(id) {
    const { error } = await supabase.from("celebrations").delete().eq("id", id);
    if (error) throw error;
}

// ---------- Διαχείριση ----------

export async function checkIsAdmin(user) {
    if (!supabase || !user?.email) return false;
    const { data } = await supabase.from("admins").select("email").ilike("email", user.email.replace(/[\\%_]/g, "\\$&"));
    return (data || []).some((a) => a.email.toLowerCase() === user.email.toLowerCase());
}

export async function reviewCelebration(id, status, adminNote) {
    const { data, error } = await supabase
        .from("celebrations")
        .update({ status, admin_note: adminNote?.trim() || null })
        .eq("id", id)
        .select()
        .single();
    if (error) throw error;
    if (status === "approved") notifyServer(id, "approved");
    return data;
}

export async function listUsers() {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) throw error;
    return data;
}

/** Ζητά από τον server να στείλει ειδοποιήσεις (δεν μπλοκάρει το UI αν αποτύχει). */
async function notifyServer(celebrationId, kind) {
    try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        await fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ celebration_id: celebrationId, kind }),
        });
    } catch (err) {
        console.warn("Οι ειδοποιήσεις δεν στάλθηκαν:", err);
    }
}
