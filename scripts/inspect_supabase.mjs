#!/usr/bin/env node
/** Έλεγχος ΜΟΝΟ ΓΙΑ ΑΝΑΓΝΩΣΗ: τι υπάρχει ήδη στη βάση (πίνακες, γραμμές, στήλες, χρήστες). Δεν αλλάζει τίποτα. */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(ROOT, ".env.local");
const env = existsSync(envFile)
    ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2")]))
    : {};
const { SUPABASE_PROJECT_REF: REF, SUPABASE_ACCESS_TOKEN: TOKEN } = env;
if (!REF || !TOKEN) { console.error("✗ Λείπουν SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const sql = async (query) => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, read_only: true }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
};

try {
    const tables = await sql(`
        select t.table_schema as schema, t.table_name as name,
               (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::int as rows
        from information_schema.tables t
        where t.table_schema in ('public', 'storage') and t.table_type = 'BASE TABLE'
        order by 1, 2`);
    console.log("ΠΙΝΑΚΕΣ:");
    for (const t of tables) console.log(`  ${t.schema}.${t.name}: ${t.rows} γραμμές`);
    if (!tables.some((t) => t.schema === "public")) console.log("  (κανένας πίνακας στο public — η βάση είναι άδεια)");

    const cols = await sql(`select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as cols
        from information_schema.columns where table_schema = 'public' group by table_name order by 1`);
    if (cols.length) {
        console.log("\nΣΤΗΛΕΣ (public):");
        for (const c of cols) console.log(`  ${c.table_name}: ${c.cols}`);
    }
    const [u] = await sql(`select count(*)::int as users, count(*) filter (where is_anonymous)::int as anon from auth.users`);
    console.log(`\nΧΡΗΣΤΕΣ (auth): ${u.users} (επισκέπτες: ${u.anon})`);
    const fns = await sql(`select routine_name from information_schema.routines where routine_schema = 'public' order by 1`);
    console.log("ΣΥΝΑΡΤΗΣΕΙΣ (public):", fns.map((f) => f.routine_name).join(", ") || "καμία");
} catch (err) {
    console.error("✗", err.message);
    process.exit(1);
}
