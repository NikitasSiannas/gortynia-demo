#!/usr/bin/env node
/**
 * Εισαγωγή πραγματικών δεδομένων (Νοέμβριος 2026):
 *  - μουσικοί από το «Αλάτι της Γης» (ΕΡΤ) με Πελοποννησιακά επεισόδια + μουσικοί πανηγυριών με πηγή
 *  - πραγματικές επερχόμενες εκδηλώσεις, ΣΕ ΑΝΑΜΟΝΗ ΕΓΚΡΙΣΗΣ (τις εγκρίνει ο διαχειριστής)
 * Ασφαλές να ξανατρέξει: δεν δημιουργεί διπλότυπα.
 *   node scripts/import_real_2026_11.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const env = Object.fromEntries(readFileSync(new URL(".env.local", ROOT), "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")]));
const URL_ = env.REACT_APP_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (method, path, body, extra = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...extra }, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${t.slice(0, 300)}`);
    return t ? JSON.parse(t) : null;
};

// ---------- Μουσικοί ----------
const ERT = {
    kalamata: ["ΕΡΤ1 — Το Αλάτι της Γης: «Σαν πας στην Καλαμάτα!» (Μοριάς)", "https://www.ertnews.gr/ert-protaseis/to-alati-tis-gis-san-pas-stin-kalamata-stin-ert1/", 2016],
    korinthia: ["ΕΡΤ1 — Το Αλάτι της Γης: Κορινθία και Αργολίδα", "https://www.ertnews.gr/ert-protaseis/ert1-to-alati-tis-gis-taxidevi-stin-korinthia-ke-tin-argolida/", 2018],
    clarinet: ["ΕΡΤ1 — Το Αλάτι της Γης: Η τέχνη του λαϊκού κλαρίνου", "https://www.ertnews.gr/ert-protaseis/tileorasi-ert-protaseis/ert1-to-alati-tis-gis-i-techni-tou-laikou-klarinou-i-protomastores-tis-metapolemikis-genias/", 2017],
    georgopoulos: ["ΕΡΤ1 — Το Αλάτι της Γης: Η ορχήστρα του Θοδωρή Γεωργόπουλου", "https://www.ertnews.gr/ert-protaseis/1300-to-alati-tis-gis-me-tin-orchistra-toy-thodori-georgopoyloy-stin-ert1/", 2021],
};
const PANIGYRI = ["panigiria.gr — Πανηγύρι στο Ακριτοχώρι Μεσσηνίας (14/8/2026)", "https://panigiria.gr/events/panigyri-sto-akritochori-messinias-paraskevi-14-avgoustou-2026/", 2026];

const M = (name, roles, src, scene = "known") => ({ name, roles, src, scene });
const musicians = [
    M("Νίκος Παπαηλίου", ["clarinet"], ERT.kalamata),
    M("Κυριάκος Μαρκόγιαννης", ["laouto"], ERT.kalamata),
    M("Νίκος Παλαιολόγος", ["oud"], ERT.kalamata),
    M("Χρήστος Λαδάς", ["santouri"], ERT.kalamata),
    M("Γιώργος Κλάδης", ["percussion"], ERT.kalamata),
    M("Βαγγέλης Κώτσου", ["singer"], ERT.kalamata),
    M("Άννα Μαύρου", ["singer"], ERT.kalamata),
    M("Μαρία Αλεβίζου", ["singer"], ERT.kalamata),
    M("Εφηνίκη Ζαμπάρα", ["singer"], ERT.kalamata),
    M("Μαρία Χατζηκωνσταντόγλου", ["singer"], ERT.kalamata),
    M("Γιώργος Μπελεχρής", ["singer"], ERT.kalamata),
    M("Δημήτρης Θεοδωρόπουλος", ["singer"], ERT.kalamata),
    M("Ιωάννα Τζάννε", ["singer"], ERT.kalamata),
    M("Ευανθία Γκούζου", ["singer"], ERT.kalamata),
    M("Νίκος Φιλιππίδης", ["clarinet", "flute"], ERT.korinthia),
    M("Κώστας Φιλιππίδης", ["laouto"], ERT.korinthia),
    M("Στέλλα Βαλάση", ["santouri"], ERT.korinthia),
    M("Γιώργος Μαγγίνας", ["singer"], ERT.korinthia),
    M("Θωμάς Κωνσταντίνου", ["guitar"], ERT.clarinet),
    M("Κώστας Μερετάκης", ["percussion"], ERT.clarinet),
    M("Θοδωρής Γεωργόπουλος", ["clarinet", "flute"], ERT.georgopoulos),
    M("Μιχάλης Ζάμπας", ["singer", "laouto"], ERT.georgopoulos),
    M("Παναγιώτης Ξυδέας", ["violin"], ERT.georgopoulos),
    M("Θανάσης Κάκος", ["percussion"], ERT.georgopoulos),
    M("Αναστάσης Πυλιώτης", ["singer"], PANIGYRI, "panigyri"),
    M("Τατιάνα Μαρκοπούλου", ["singer"], PANIGYRI, "panigyri"),
    M("Θοδωρής Καλύβας", ["clarinet"], PANIGYRI, "panigyri"),
];

// ---------- Εκδηλώσεις (πηγή: kalimera-arkadia.gr, ημερολόγιο Αρκαδίας) ----------
const events = [
    {
        village_id: 2, celebration_type: "Πανηγύρι", celebration_date: "2026-11-28", start_time: "18:00",
        notes: "Γιορτή υποδοχής του Χειμώνα στην πλατεία — γλέντι με νταούλι και κλαρίνο. Διοργάνωση: Σύλλογος Απανταχού Αλωνιστιωτών & Κέντρο Ελληνικού Χορού Τρίπολης.",
        source: "https://www.kalimera-arkadia.gr/atzenta/item/194792-giorti-ypodoxis-tou-xeimona-stis-28-noemvriou-stin-alonistaina.html",
        remark: "Η ώρα δεν αναφέρεται: «με το νύχτωμα» (έβαλα 18:00).",
    },
    {
        village_id: 4, celebration_type: "Πανηγύρι", celebration_date: "2026-11-29", start_time: "12:00",
        notes: "Γιορτή λαδιού — παραδοσιακά εδέσματα και μουσική. Διοργάνωση: Πολιτιστικός Σύλλογος Αναβρυτού «Η Τσεμπερού».",
        source: "https://www.kalimera-arkadia.gr/atzenta/item/195339-giorti-ladioy-ston-anavryto-arkadias.html",
        remark: "Δεν αναφέρονται ονόματα μουσικών.",
    },
];

// 1) CSV (ώστε το seed.sql να μένει συγχρονισμένο)
const csvPath = new URL("data/musicians.csv", ROOT);
let csv = readFileSync(csvPath, "utf8");
const have = new Set(csv.split(/\r?\n/).slice(1).map((l) => l.split(",")[0]));
const q = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
let addedCsv = 0;
for (const m of musicians) {
    if (have.has(m.name)) continue;
    csv = csv.replace(/\n?$/, "\n") + [m.name, m.roles.join(";"), "δημοτικό", "", "", m.scene, q(m.src[0]), m.src[1], m.src[2], "", q("Παραδοσιακός μουσικός (Πελοπόννησος)")].join(",") + "\n";
    addedCsv++;
}
writeFileSync(csvPath, csv);
console.log(`✓ data/musicians.csv: +${addedCsv} μουσικοί`);

// 2) Βάση: μουσικοί (αγνοεί όσους υπάρχουν ήδη)
const ins = await rest("POST", "musicians?on_conflict=name", musicians.map((m) => ({
    name: m.name, roles: m.roles, genres: ["δημοτικό"], scene: m.scene, status: "approved",
    source_note: m.src[0], source_url: m.src[1], last_seen_year: m.src[2], description: "Παραδοσιακός μουσικός (Πελοπόννησος)",
})), { Prefer: "resolution=ignore-duplicates,return=representation" });
console.log(`✓ Βάση: +${ins.length} νέοι μουσικοί`);

// 3) Βάση: εκδηλώσεις σε αναμονή (χωρίς διπλότυπα)
let addedEv = 0;
for (const e of events) {
    const dup = await rest("GET", `celebrations?select=id&village_id=eq.${e.village_id}&celebration_date=eq.${e.celebration_date}`);
    if (dup.length) { console.log(`• υπάρχει ήδη: χωριό ${e.village_id}, ${e.celebration_date}`); continue; }
    await rest("POST", "celebrations", {
        village_id: e.village_id, celebration_type: e.celebration_type, celebration_date: e.celebration_date, start_time: e.start_time,
        notes: e.notes, status: "pending", created_by_email: null,
        submitter_comment: `Αυτόματη εισαγωγή από πραγματική ανακοίνωση. Πηγή: ${e.source} — ${e.remark}`.slice(0, 500),
    }, { Prefer: "return=minimal" });
    addedEv++;
}
console.log(`✓ Βάση: +${addedEv} πραγματικές εκδηλώσεις σε αναμονή έγκρισης`);
