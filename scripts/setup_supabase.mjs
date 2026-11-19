#!/usr/bin/env node
/**
 * Αυτόματη ρύθμιση της βάσης (Supabase) και —προαιρετικά— του Vercel.
 *
 *   node scripts/setup_supabase.mjs            # βάση: πίνακες, δεδομένα, διαχειριστής, ρυθμίσεις σύνδεσης, κλειδιά
 *   node scripts/setup_supabase.mjs --vercel   # + μεταβλητές περιβάλλοντος στο Vercel
 *
 * Χρειάζεται στο .env.local (ΔΕΝ ανεβαίνει στο GitHub):
 *   SUPABASE_PROJECT_REF=abcdefghijklmnop          ← από τη διεύθυνση του project: https://abcdefghijklmnop.supabase.co
 *   SUPABASE_ACCESS_TOKEN=sbp_...                  ← supabase.com → Account → Access Tokens → Generate new token
 *   VERCEL_TOKEN=...                               ← (μόνο για --vercel) vercel.com → Account Settings → Tokens
 *
 * Τα κλειδιά ΠΟΤΕ δεν τυπώνονται στην οθόνη.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");
const SITE = "https://gortynia-demo.vercel.app";
const VERCEL_PROJECT = "gortynia-demo";

// ---------- .env.local ----------
function readEnv() {
    if (!existsSync(ENV_FILE)) return {};
    return Object.fromEntries(
        readFileSync(ENV_FILE, "utf8").split(/\r?\n/)
            .filter((l) => /^[A-Z0-9_]+=/.test(l))
            // αφαιρούμε εισαγωγικά, αν κάποιος γράψει KEY="τιμή"
            .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")])
    );
}
function writeEnv(updates) {
    let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    for (const [k, v] of Object.entries(updates)) {
        const re = new RegExp(`^${k}=.*$`, "m");
        text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.replace(/\n?$/, "\n")}${k}=${v}\n`;
    }
    writeFileSync(ENV_FILE, text);
}

const env = readEnv();
const REF = env.SUPABASE_PROJECT_REF;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) {
    console.error("✗ Λείπουν SUPABASE_PROJECT_REF και/ή SUPABASE_ACCESS_TOKEN στο .env.local (δείτε τις οδηγίες στην αρχή του αρχείου).");
    process.exit(1);
}

const api = async (method, path, body) => {
    const res = await fetch(`https://api.supabase.com${path}`, {
        method,
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
    return text ? JSON.parse(text) : null;
};
const sql = (query) => api("POST", `/v1/projects/${REF}/database/query`, { query });

const step = async (label, fn) => {
    process.stdout.write(`• ${label}… `);
    try {
        const r = await fn();
        console.log("✓" + (r ? ` ${r}` : ""));
        return true;
    } catch (err) {
        console.log("✗\n   " + err.message);
        return false;
    }
};

// Αρχεία SQL: χωρίζονται σε κομμάτια στη γραμμή "-- @@" (ώστε μεγάλα αρχεία να στέλνονται σε δόσεις)
const runFile = async (file) => {
    const parts = readFileSync(join(ROOT, file), "utf8").split(/^-- @@.*$/m).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) await sql(p);
    return `${parts.length} τμήματα`;
};

const localIp = () =>
    Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal && /^(192\.168|10\.|172\.)/.test(i.address))?.address;

console.log(`Supabase project: ${REF}\n`);
let ok = true;

ok &= await step("Πίνακες & κανόνες ασφαλείας (schema.sql)", () => runFile("supabase/schema.sql"));
ok &= await step("Χωριά, εκδηλώσεις, μουσικοί (seed.sql)", () => runFile("supabase/seed.sql"));
if (existsSync(join(ROOT, "supabase/admins.local.sql"))) {
    ok &= await step("Διαχειριστής (admins.local.sql)", () => runFile("supabase/admins.local.sql"));
}

ok &= await step("Ρυθμίσεις σύνδεσης (επισκέπτες, διευθύνσεις, ελληνικά email)", async () => {
    const ip = localIp();
    const allow = ["http://localhost:3000/**", `${SITE}/**`, ip && `http://${ip}:3000/**`].filter(Boolean).join(",");
    const mail = (title, action) => `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
<h2 style="color:#1c1917">Πάμε Πανηγύρι</h2>
<p>${title}</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#f59e0b;color:#1c1917;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${action}</a></p>
<p>Ή γράψτε στην εφαρμογή τον κωδικό: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
<p style="color:#78716c;font-size:12px">Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email.</p></div>`;
    await api("PATCH", `/v1/projects/${REF}/config/auth`, {
        site_url: SITE,
        uri_allow_list: allow,
        external_anonymous_users_enabled: true,
        mailer_subjects_magic_link: "Σύνδεση στο Πάμε Πανηγύρι",
        mailer_templates_magic_link_content: mail("Πατήστε για να συνδεθείτε:", "Σύνδεση"),
        mailer_subjects_confirmation: "Καλώς ήρθατε στο Πάμε Πανηγύρι",
        mailer_templates_confirmation_content: mail("Πατήστε για να επιβεβαιώσετε το email σας:", "Επιβεβαίωση"),
        mailer_subjects_email_change: "Επιβεβαίωση email — Πάμε Πανηγύρι",
        mailer_templates_email_change_content: mail("Πατήστε για να προσθέσετε αυτό το email στον λογαριασμό σας:", "Επιβεβαίωση"),
    });
    return ip ? `(και για το κινητό: http://${ip}:3000)` : "";
});

let keys = {};
ok &= await step("Κλειδιά API → .env.local", async () => {
    const list = await api("GET", `/v1/projects/${REF}/api-keys?reveal=true`);
    const pick = (...names) => list.find((k) => names.includes(k.name) || names.includes(k.type))?.api_key;
    keys = {
        REACT_APP_SUPABASE_URL: `https://${REF}.supabase.co`,
        REACT_APP_SUPABASE_ANON_KEY: pick("anon", "publishable"),
        SUPABASE_SERVICE_ROLE_KEY: pick("service_role", "secret"),
    };
    if (!keys.REACT_APP_SUPABASE_ANON_KEY || !keys.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Δεν βρέθηκαν τα κλειδιά anon/service_role");
    writeEnv(keys);
    return "(δεν εμφανίζονται για ασφάλεια)";
});

await step("Έλεγχος δεδομένων", async () => {
    const [r] = await sql(`select (select count(*) from public.villages) v, (select count(*) from public.celebrations) c,
        (select count(*) from public.musicians) m, (select count(*) from public.admins) a`);
    return `${r.v} χωριά · ${r.c} εκδηλώσεις · ${r.m} μουσικοί · ${r.a} διαχειριστές`;
});

// ---------- Vercel (προαιρετικό) ----------
if (process.argv.includes("--vercel")) {
    const VT = readEnv().VERCEL_TOKEN;
    if (!VT) {
        console.log("• Vercel: λείπει VERCEL_TOKEN στο .env.local — παραλείπεται.");
    } else {
        ok &= await step(`Μεταβλητές περιβάλλοντος στο Vercel (${VERCEL_PROJECT})`, async () => {
            const e = readEnv();
            const names = ["REACT_APP_SUPABASE_URL", "REACT_APP_SUPABASE_ANON_KEY", "REACT_APP_VAPID_PUBLIC_KEY",
                "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"];
            const missing = names.filter((n) => !e[n]);
            if (missing.length) throw new Error("Λείπουν από το .env.local: " + missing.join(", "));
            const body = names.map((key) => ({ key, value: e[key], type: "encrypted", target: ["production", "preview"] }));
            const res = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env?upsert=true`, {
                method: "POST",
                headers: { Authorization: `Bearer ${VT}`, "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
            return `${names.length} μεταβλητές — θα ισχύσουν στο επόμενο deploy (git push)`;
        });
    }
}

console.log(ok ? "\n✓ Έτοιμο. Ξανατρέξτε `npm start`." : "\n⚠ Κάποια βήματα απέτυχαν — δείτε τα μηνύματα παραπάνω.");
process.exit(ok ? 0 : 1);
