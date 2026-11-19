#!/usr/bin/env node
/**
 * Δοκιμή ασφαλείας της βάσης, όπως θα τη χρησιμοποιούσαν πραγματικοί επισκέπτες.
 * Δημιουργεί δύο προσωρινούς επισκέπτες και μία δοκιμαστική εκδήλωση, και στο τέλος τα σβήνει όλα.
 *   node scripts/test_supabase.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")]));
const URL_ = env.REACT_APP_SUPABASE_URL;
const ANON = env.REACT_APP_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const client = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const check = (label, ok, extra = "") => {
    ok ? pass++ : fail++;
    console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
};
const cleanup = { users: [], events: [] };

try {
    // 1. Ανώνυμος επισκέπτης (χωρίς σύνδεση) βλέπει δεδομένα
    const pub = client();
    const { count: vCount } = await pub.from("villages").select("id", { count: "exact", head: true });
    check("Δημόσια ανάγνωση χωριών", vCount === 1618, `${vCount} χωριά`);
    const { data: pubEvents } = await pub.from("celebrations").select("id, status");
    check("Δημόσια: μόνο εγκεκριμένες εκδηλώσεις", pubEvents.length > 0 && pubEvents.every((e) => e.status === "approved"), `${pubEvents.length} ορατές`);
    const { error: pubInsert } = await pub.from("celebrations").insert({ village_id: 1, celebration_type: "Πανηγύρι", celebration_date: "2027-08-15" });
    check("Χωρίς είσοδο δεν γίνεται καταχώρηση", Boolean(pubInsert));

    // 2. Είσοδος ως επισκέπτης
    const g1 = client();
    const { data: s1, error: e1 } = await g1.auth.signInAnonymously();
    check("Είσοδος ως επισκέπτης", !e1 && s1.user?.is_anonymous, e1?.message);
    if (s1?.user) cleanup.users.push(s1.user.id);

    // 3. Ο επισκέπτης προτείνει εκδήλωση — ακόμα κι αν ζητήσει "approved", πάει σε αναμονή
    const { data: ev, error: e2 } = await g1.from("celebrations")
        .insert({ village_id: 1000, celebration_type: "Πανηγύρι", celebration_date: "2027-08-15", notes: "ΔΟΚΙΜΗ", submitter_comment: "δοκιμή ασφαλείας", status: "approved" })
        .select().single();
    if (ev) cleanup.events.push(ev.id);
    check("Ο επισκέπτης προτείνει εκδήλωση", !e2 && Boolean(ev), e2?.message);
    check("…και πάει σε αναμονή έγκρισης (όχι δημοσίευση)", ev?.status === "pending", ev?.status);
    check("…με δημιουργό τον επισκέπτη", ev?.created_by === s1?.user?.id);

    // 4. Δεν μπορεί να την εγκρίνει μόνος του
    await g1.from("celebrations").update({ status: "approved" }).eq("id", ev.id);
    const { data: after } = await admin.from("celebrations").select("status").eq("id", ev.id).single();
    check("Δεν μπορεί να εγκρίνει μόνος του", after?.status === "pending", after?.status);

    // 5. Τη βλέπει ο ίδιος, όχι οι άλλοι
    const { data: mine } = await g1.from("celebrations").select("id").eq("id", ev.id);
    check("Ο δημιουργός βλέπει τη δική του σε αναμονή", mine?.length === 1);
    const { data: others } = await pub.from("celebrations").select("id").eq("id", ev.id);
    check("Οι άλλοι ΔΕΝ τη βλέπουν πριν την έγκριση", others?.length === 0);

    const g2 = client();
    const { data: s2 } = await g2.auth.signInAnonymously();
    if (s2?.user) cleanup.users.push(s2.user.id);
    const { data: g2see } = await g2.from("celebrations").select("id").eq("id", ev.id);
    check("Άλλος επισκέπτης ΔΕΝ τη βλέπει", g2see?.length === 0);
    await g2.from("celebrations").delete().eq("id", ev.id);
    const { data: still } = await admin.from("celebrations").select("id").eq("id", ev.id);
    check("Άλλος επισκέπτης ΔΕΝ μπορεί να τη σβήσει", still?.length === 1);

    // 6. Ο επισκέπτης δεν έχει πρόσβαση διαχειριστή
    const { error: e3 } = await g1.rpc("admin_list_users");
    check("Ο επισκέπτης ΔΕΝ βλέπει τη λίστα χρηστών", Boolean(e3));
    const { error: e4 } = await g1.from("admins").insert({ email: "hacker@example.com" });
    check("Ο επισκέπτης ΔΕΝ μπορεί να γίνει διαχειριστής", Boolean(e4));

    // 7. Ειδοποιήσεις: εγγραφή και διαγραφή συνδρομής
    const endpoint = `https://example.invalid/test-${Date.now()}`;
    const { error: e5 } = await g1.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: "x", p_auth: "y", p_village_ids: [1, 2] });
    check("Εγγραφή σε ειδοποιήσεις", !e5, e5?.message);
    const { data: direct } = await g1.from("push_subscriptions").select("endpoint");
    check("Οι συνδρομές ΔΕΝ διαβάζονται από χρήστες", (direct || []).length === 0);
    await g1.rpc("delete_push_subscription", { p_endpoint: endpoint });
    const { data: gone } = await admin.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint);
    check("Διαγραφή συνδρομής", gone?.length === 0);

    // 8. Μουσικοί: ο κατάλογος διαβάζεται, νέα πρόταση πάει σε αναμονή
    const { count: mCount } = await pub.from("musicians").select("id", { count: "exact", head: true });
    check("Κατάλογος μουσικών", mCount >= 227, `${mCount}`);
    const { data: mus, error: e6 } = await g1.from("musicians").insert({ name: "Δοκιμαστικός Μουσικός Χ", roles: ["clarinet"] }).select().single();
    check("Πρόταση νέου μουσικού → σε αναμονή", !e6 && mus?.status === "pending", e6?.message || mus?.status);
    if (mus) await admin.from("musicians").delete().eq("id", mus.id);
} catch (err) {
    fail++;
    console.error("✗ Απρόσμενο σφάλμα:", err.message);
} finally {
    for (const id of cleanup.events) await admin.from("celebrations").delete().eq("id", id);
    for (const id of cleanup.users) await admin.auth.admin.deleteUser(id);
    console.log(`\nΚαθαρισμός: ${cleanup.events.length} δοκιμαστικές εκδηλώσεις, ${cleanup.users.length} επισκέπτες σβήστηκαν.`);
    console.log(`Αποτέλεσμα: ${pass} πέτυχαν, ${fail} απέτυχαν.`);
    process.exit(fail ? 1 : 0);
}
