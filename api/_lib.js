// Κοινές συναρτήσεις για τα serverless functions του Vercel (ο φάκελος api/).
// Αρχεία που ξεκινούν με "_" δεν γίνονται διευθύνσεις.
const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");

const SITE = process.env.VAPID_SUBJECT || "https://gortynia-demo.vercel.app";
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TYPE_LABEL = { "Πανηγύρι": "Πανηγύρι", "Λαική Βραδιά": "Λαϊκή Βραδιά", "Πάρτυ Νεολαίας": "Πάρτυ Νεολαίας" };

function publicClient() {
    return SUPABASE_URL && ANON_KEY ? createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } }) : null;
}

function adminClient() {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Λείπει SUPABASE_SERVICE_ROLE_KEY στο Vercel");
    return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** Επιστρέφει τον χρήστη από το "Authorization: Bearer <token>" ή null. */
async function userFromRequest(req) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data, error } = await adminClient().auth.getUser(token);
    return error ? null : data.user;
}

async function isAdminEmail(db, email) {
    if (!email) return false;
    // Ακριβής σύγκριση (όχι ilike: το "_" εκεί είναι μπαλαντέρ)
    const { data } = await db.from("admins").select("email");
    return (data || []).some((a) => a.email.toLowerCase() === email.toLowerCase());
}

function formatDateEl(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("el-GR", {
        weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    });
}

/** Στέλνει push σε λίστα συνδρομών· σβήνει όσες έχουν λήξει. Επιστρέφει πόσες στάλθηκαν. */
async function sendPush(db, subs, payload) {
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.REACT_APP_VAPID_PUBLIC_KEY) {
        throw new Error("Λείπουν τα VAPID κλειδιά στο Vercel");
    }
    webpush.setVapidDetails(SITE, process.env.REACT_APP_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    let sent = 0;
    const expired = [];
    await Promise.all(
        subs.map(async (s) => {
            try {
                await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    JSON.stringify(payload),
                    { TTL: 60 * 60 * 24 }
                );
                sent++;
            } catch (err) {
                if (err.statusCode === 404 || err.statusCode === 410) expired.push(s.endpoint);
                else console.error("push error", err.statusCode, err.body);
            }
        })
    );
    if (expired.length) await db.from("push_subscriptions").delete().in("endpoint", expired);
    return sent;
}

/** Συνδρομές που ενδιαφέρονται για το χωριό (ή για όλα). */
async function subscribersForVillage(db, villageId) {
    const { data, error } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, village_ids")
        .or(`village_ids.is.null,village_ids.cs.{${Number(villageId)}}`);
    if (error) throw error;
    return data;
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

module.exports = {
    SITE, TYPE_LABEL, publicClient, adminClient, userFromRequest, isAdminEmail,
    formatDateEl, sendPush, subscribersForVillage, escapeHtml,
};
