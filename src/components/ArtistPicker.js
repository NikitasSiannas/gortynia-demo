import { useMemo, useState } from "react";
import { ROLE_LABEL } from "../lib/celebrations";

const norm = (s) => (s || "").toLocaleLowerCase("el").normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Φίλτρο «Καλλιτέχνες»: διαλέγετε έναν ή περισσότερους και βλέπετε σε ποιες εκδηλώσεις θα βρίσκονται.
 *   artists:  [{ name, count, roles: Set<role> }]: όσοι εμφανίζονται στις εκδηλώσεις (με τα υπόλοιπα φίλτρα)
 *   catalog:  [{ name, roles }]: όλος ο κατάλογος μουσικών (για αναζήτηση και όσων δεν έχουν ακόμα εκδήλωση)
 */
export default function ArtistPicker({ artists, catalog = [], selected, onChange }) {
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);

    const list = useMemo(() => {
        const q = norm(query.trim());
        const byName = new Map(artists.map((a) => [a.name, a]));
        // + όσοι είναι στον κατάλογο χωρίς εκδήλωση (εμφανίζονται μόνο όταν ψάχνει κανείς)
        if (q) for (const m of catalog) if (!byName.has(m.name)) byName.set(m.name, { name: m.name, count: 0, roles: new Set(m.roles || []) });
        let all = [...byName.values()];
        if (q) all = all.filter((a) => norm(a.name).includes(q));
        all.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "el"));
        return all;
    }, [artists, catalog, query]);

    const toggle = (name) => onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
    const shown = query || showAll ? list.slice(0, 60) : list.slice(0, 8);
    const roleText = (roles) => [...(roles || [])].map((r) => ROLE_LABEL[r] || r).join(", ");

    return (
        <div className="space-y-2">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selected.map((n) => (
                        <button
                            key={n}
                            onClick={() => toggle(n)}
                            className="flex items-center gap-1 rounded-full bg-amber-500 py-1 pl-2.5 pr-2 text-xs font-semibold text-stone-900"
                            aria-label={`Αφαίρεση ${n}`}
                        >
                            🎤 {n} <span className="text-stone-900/60">✕</span>
                        </button>
                    ))}
                    <button onClick={() => onChange([])} className="px-1 text-xs text-stone-500 underline">καθαρισμός</button>
                </div>
            )}
            <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Όνομα τραγουδιστή, κλαρίνου, βιολιού…"
                className="field py-1.5 text-sm"
            />
            <ul className="max-h-[45dvh] divide-y divide-stone-200/70 overflow-y-auto overscroll-contain rounded-xl bg-white dark:divide-stone-800 dark:bg-stone-950">
                {shown.map((a) => {
                    const on = selected.includes(a.name);
                    return (
                        <li key={a.name}>
                            <button
                                onClick={() => toggle(a.name)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${on ? "bg-amber-50 dark:bg-amber-500/10" : "hover:bg-stone-50 dark:hover:bg-stone-900"}`}
                                aria-pressed={on}
                            >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${on ? "border-amber-500 bg-amber-500 text-stone-900" : "border-stone-300 dark:border-stone-600"}`}>
                                    {on ? "✓" : ""}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-stone-800 dark:text-stone-100">{a.name}</span>
                                    {a.roles?.size > 0 && <span className="block truncate text-[11px] text-stone-500">{roleText(a.roles)}</span>}
                                </span>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.count ? "bg-stone-900 text-white dark:bg-stone-700" : "bg-stone-100 text-stone-400 dark:bg-stone-800"}`}>
                                    {a.count ? `${a.count} ${a.count === 1 ? "εκδήλωση" : "εκδηλώσεις"}` : "καμία"}
                                </span>
                            </button>
                        </li>
                    );
                })}
                {shown.length === 0 && <li className="px-3 py-3 text-center text-xs text-stone-500">Δεν βρέθηκε καλλιτέχνης</li>}
            </ul>
            {!query && list.length > 8 && (
                <button onClick={() => setShowAll((s) => !s)} className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {showAll ? "Λιγότεροι" : `Όλοι οι καλλιτέχνες (${list.length})`}
                </button>
            )}
        </div>
    );
}
