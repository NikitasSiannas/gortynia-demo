import { supabase } from "../supabaseClient";

// Μορφή που χρησιμοποιεί όλο το UI:
//   village:     { id, name, region, lat, lon }
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
            region: v.region || "Γορτυνία",
            lat: parseFloat(v.village_lat),
            lon: parseFloat(v.village_lon),
        }));
    const idByName = Object.fromEntries(villages.map((v) => [v.name, v.id]));
    const celebrations = parseCsv(cText)
        .filter((c) => idByName[c.village_name] && c.celebration_date)
        .map((c, i) => ({
            id: `csv-${i}`,
            village_id: idByName[c.village_name],
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

async function loadFromDatabase() {
    const [vRes, cRes] = await Promise.all([
        supabase.from("villages").select("id, name, region, lat, lon").order("name"),
        supabase.from("celebrations").select("*").order("celebration_date"),
    ]);
    if (vRes.error) throw vRes.error;
    if (cRes.error) throw cRes.error;
    return { villages: vRes.data, celebrations: cRes.data, source: "db" };
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

export async function createCelebration(values) {
    const { data, error } = await supabase.from("celebrations").insert(clean(values)).select().single();
    if (error) throw error;
    if (data.status === "pending") notifyServer(data.id, "pending");
    return data;
}

export async function updateCelebration(id, values) {
    const { data, error } = await supabase.from("celebrations").update(clean(values)).eq("id", id).select().single();
    if (error) throw error;
    if (data.status === "pending") notifyServer(data.id, "pending");
    return data;
}

export async function deleteCelebration(id) {
    const { error } = await supabase.from("celebrations").delete().eq("id", id);
    if (error) throw error;
}

// ---------- Διαχείριση ----------

export async function checkIsAdmin(user) {
    if (!supabase || !user?.email) return false;
    const { data } = await supabase.from("admins").select("email").maybeSingle();
    return Boolean(data);
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
