import { useMemo, useRef, useState } from "react";

const norm = (s) => (s || "").toLocaleLowerCase("el").normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Επιλογή χωριού με αναζήτηση (χιλιάδες χωριά — μια απλή λίστα δεν βολεύει).
 * Δείχνει «Χωριό · Δήμος, Νομός» ώστε να ξεχωρίζουν χωριά με ίδιο όνομα.
 */
export default function VillagePicker({ villages, value, onChange, required }) {
    const selected = villages.find((v) => String(v.id) === String(value));
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);

    const matches = useMemo(() => {
        const q = norm(query.trim());
        if (q.length < 2) return [];
        const starts = [];
        const contains = [];
        for (const v of villages) {
            const n = norm(v.name);
            if (n.startsWith(q)) starts.push(v);
            else if (n.includes(q) || norm(v.region).includes(q)) contains.push(v);
            if (starts.length > 40) break;
        }
        return [...starts, ...contains].slice(0, 40);
    }, [villages, query]);

    const choose = (v) => {
        onChange(String(v.id));
        setQuery("");
        setOpen(false);
    };

    if (selected && !open) {
        return (
            <div className="field flex items-center justify-between gap-2">
                <span className="min-w-0">
                    <strong>{selected.name}</strong>
                    <span className="text-stone-500 dark:text-stone-400 text-sm"> · {[selected.region?.replace(/^Δήμος /, "Δ. "), selected.prefecture].filter(Boolean).join(", ")}</span>
                </span>
                <button
                    type="button"
                    onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                    Αλλαγή
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <input
                ref={inputRef}
                className="field"
                placeholder="Γράψτε το όνομα του χωριού…"
                value={query}
                required={required && !selected}
                autoComplete="off"
                onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                    if (e.key === "Enter" && matches[active]) { e.preventDefault(); choose(matches[active]); }
                }}
                role="combobox"
                aria-expanded={open && matches.length > 0}
                aria-controls="village-options"
            />
            {open && query.trim().length >= 2 && (
                <ul
                    id="village-options"
                    role="listbox"
                    className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
                >
                    {matches.length === 0 && <li className="px-3 py-2 text-sm text-stone-500">Δεν βρέθηκε χωριό</li>}
                    {matches.map((v, i) => (
                        <li
                            key={v.id}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={(e) => { e.preventDefault(); choose(v); }}
                            className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-amber-50 dark:bg-amber-500/10" : "hover:bg-stone-50 dark:hover:bg-stone-800"}`}
                        >
                            <strong>{v.name}</strong>
                            <span className="text-stone-500 dark:text-stone-400"> · {[v.region?.replace(/^Δήμος /, "Δ. "), v.prefecture].filter(Boolean).join(", ")}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
