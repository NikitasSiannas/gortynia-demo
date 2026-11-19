import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { currentSubscription, isIos, pushSupport, savedVillageIds, subscribePush, unsubscribePush } from "../lib/pwa";

export default function NotificationsModal({ villages, preselectVillageId, onClose, notify }) {
    const support = pushSupport();
    const [subscribed, setSubscribed] = useState(false);
    const [mode, setMode] = useState("all"); // all | some
    const [selected, setSelected] = useState(() => new Set());
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        currentSubscription().then((sub) => {
            setSubscribed(Boolean(sub));
            const ids = savedVillageIds();
            if (ids) {
                setMode("some");
                setSelected(new Set(ids));
            }
            if (preselectVillageId) {
                setMode("some");
                setSelected((s) => new Set([...s, preselectVillageId]));
            }
        });
    }, [preselectVillageId]);

    const shown = useMemo(() => {
        // Χιλιάδες χωριά: δείχνουμε τα επιλεγμένα + έως 60 αποτελέσματα αναζήτησης
        const q = query.trim().toLocaleLowerCase("el");
        const chosen = villages.filter((v) => selected.has(v.id));
        const found = q.length >= 2
            ? villages.filter((v) => !selected.has(v.id) && v.name.toLocaleLowerCase("el").includes(q)).slice(0, 60)
            : [];
        return [...chosen, ...found];
    }, [villages, query, selected]);

    const toggle = (id) =>
        setSelected((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    const save = async () => {
        setBusy(true);
        setError("");
        try {
            await subscribePush(mode === "all" ? null : [...selected]);
            setSubscribed(true);
            notify("Οι ειδοποιήσεις ενεργοποιήθηκαν 🔔");
            onClose();
        } catch (err) {
            setError(err.message || "Δεν ήταν δυνατή η ενεργοποίηση.");
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await unsubscribePush();
            setSubscribed(false);
            notify("Οι ειδοποιήσεις απενεργοποιήθηκαν");
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Ειδοποιήσεις" onClose={onClose}>
            {support === "ios-install" && (
                <div className="space-y-2 text-sm text-stone-700 dark:text-stone-200">
                    <p>Στο iPhone οι ειδοποιήσεις δουλεύουν όταν η εφαρμογή είναι εγκατεστημένη:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>Πατήστε <strong>Κοινοποίηση</strong> <span aria-hidden>⬆️</span> κάτω στο Safari</li>
                        <li><strong>Προσθήκη στην οθόνη Αφετηρίας</strong></li>
                        <li>Ανοίξτε την εφαρμογή από το εικονίδιο και ξαναπατήστε 🔔</li>
                    </ol>
                </div>
            )}
            {support === "unsupported" && <p className="text-sm">Αυτός ο browser δεν υποστηρίζει ειδοποιήσεις.</p>}
            {support === "not-configured" && <p className="text-sm">Οι ειδοποιήσεις δεν έχουν ρυθμιστεί ακόμα στον server.</p>}
            {support === "dev" && (
                <p className="text-sm">Οι ειδοποιήσεις δουλεύουν στη δημοσιευμένη έκδοση (gortynia-demo.vercel.app), όχι στο <code>npm start</code>.</p>
            )}

            {support === "ok" && (
                <div className="space-y-4">
                    <p className="text-sm text-stone-600 dark:text-stone-300">
                        Θα λαμβάνετε ειδοποίηση όταν δημοσιεύεται νέα εκδήλωση και <strong>υπενθύμιση την προηγούμενη μέρα</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm font-medium">
                        {[["all", "Όλα τα χωριά"], ["some", "Επιλεγμένα χωριά"]].map(([m, label]) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`rounded-2xl border-2 px-3 py-2.5 transition ${mode === m ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-stone-200 dark:border-stone-700"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {mode === "some" && (
                        <div className="animate-fade-in-up">
                            <input
                                type="search"
                                placeholder="🔍  Γράψτε χωριό (2+ γράμματα)"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="field mb-2"
                            />
                            <div className="max-h-56 overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-800">
                                {shown.map((v) => (
                                    <label key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                                        <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} className="h-4 w-4 accent-amber-600" />
                                        <span className="flex-1">{v.name}</span>
                                        <span className="text-xs text-stone-400">{[v.region?.replace(/^Δήμος /, "Δ. "), v.prefecture].filter(Boolean).join(", ")}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-1 text-xs text-stone-500">{selected.size} επιλεγμένα</p>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
                    <button onClick={save} disabled={busy || (mode === "some" && selected.size === 0)} className="btn-primary w-full">
                        {busy ? "Μισό λεπτό…" : subscribed ? "Αποθήκευση" : "🔔 Ενεργοποίηση"}
                    </button>
                    {subscribed && (
                        <button onClick={stop} disabled={busy} className="btn-ghost w-full text-sm">Απενεργοποίηση ειδοποιήσεων</button>
                    )}
                    {isIos() && <p className="text-xs text-stone-500">Στο iPhone χρειάζεται iOS 16.4 ή νεότερο.</p>}
                </div>
            )}
        </Modal>
    );
}
