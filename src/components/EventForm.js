import { useMemo, useState } from "react";
import Modal from "./Modal";
import { CELEBRATION_TYPES, REGIONS, ROLES, styleFor, todayIso } from "../lib/celebrations";

const EMPTY = {
    village_id: "",
    celebration_type: "Πανηγύρι",
    celebration_date: "",
    start_time: "",
    dj: "",
    front_singer: "",
    clarinet_player: "",
    violin_player: "",
    bouzouki_player: "",
    notes: "",
    submitter_comment: "",
};

export default function EventForm({ villages, initial, isAdmin, onSubmit, onDelete, onClose }) {
    const editing = Boolean(initial?.id);
    const [values, setValues] = useState(() => {
        const base = { ...EMPTY };
        Object.keys(EMPTY).forEach((k) => {
            if (initial?.[k] != null) base[k] = String(initial[k]);
        });
        if (base.start_time) base.start_time = base.start_time.slice(0, 5);
        return base;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    // Χωριά ομαδοποιημένα ανά περιοχή
    const groups = useMemo(() => {
        const byRegion = {};
        villages.forEach((v) => (byRegion[v.region || "Άλλα"] ||= []).push(v));
        Object.values(byRegion).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name, "el")));
        const order = [...REGIONS, ...Object.keys(byRegion).filter((r) => !REGIONS.includes(r))];
        return order.filter((r) => byRegion[r]).map((r) => [r, byRegion[r]]);
    }, [villages]);

    const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await onSubmit(values);
        } catch (err) {
            setError(err.message || "Η αποθήκευση απέτυχε.");
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm("Σίγουρα θέλετε να διαγράψετε αυτή την εκδήλωση;")) return;
        setBusy(true);
        try {
            await onDelete();
        } catch (err) {
            setError(err.message || "Η διαγραφή απέτυχε.");
            setBusy(false);
        }
    };

    return (
        <Modal title={editing ? "Επεξεργασία εκδήλωσης" : "Νέα εκδήλωση"} onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-5">
                {!isAdmin && (
                    <p className="rounded-2xl bg-sky-50 dark:bg-sky-500/10 p-3 text-sm text-sky-900 dark:text-sky-200">
                        ℹ️ {editing ? "Μετά την αλλαγή, η εκδήλωση" : "Η εκδήλωση"} θα εμφανιστεί δημόσια μόλις την εγκρίνει ο διαχειριστής.
                    </p>
                )}

                {/* Τύπος */}
                <fieldset>
                    <legend className="label">Τύπος</legend>
                    <div className="grid grid-cols-3 gap-2">
                        {CELEBRATION_TYPES.map((t) => {
                            const s = styleFor(t);
                            const active = values.celebration_type === t;
                            return (
                                <label
                                    key={t}
                                    className={`cursor-pointer rounded-2xl border-2 p-3 text-center text-sm font-medium transition
                                        ${active ? "scale-[1.03] shadow-md" : "border-stone-200 dark:border-stone-700 hover:border-stone-300"}`}
                                    style={active ? { borderColor: s.color, background: s.soft, color: s.color } : undefined}
                                >
                                    <input type="radio" name="type" value={t} checked={active} onChange={set("celebration_type")} className="sr-only" />
                                    <span className="icon-badge mx-auto mb-1.5 h-11 w-11 border-[3px]" style={{ borderColor: s.color }}>
                                        <img src={s.icon} alt="" className="h-7 w-7 object-contain" />
                                    </span>
                                    {s.label}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="grid sm:grid-cols-3 gap-3">
                    <label className="block sm:col-span-3">
                        <span className="label">Χωριό *</span>
                        <select required value={values.village_id} onChange={set("village_id")} className="field">
                            <option value="">— Επιλέξτε χωριό —</option>
                            {groups.map(([region, list]) => (
                                <optgroup key={region} label={region}>
                                    {list.map((v) => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="label">Ημερομηνία *</span>
                        <input
                            type="date"
                            required
                            min={editing ? undefined : todayIso()}
                            value={values.celebration_date}
                            onChange={set("celebration_date")}
                            className="field"
                        />
                    </label>
                    <label className="block">
                        <span className="label">Ώρα έναρξης</span>
                        <input type="time" value={values.start_time} onChange={set("start_time")} className="field" />
                    </label>
                </div>

                <fieldset>
                    <legend className="label">Ποιοι παίζουν (προαιρετικά)</legend>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {ROLES.map((r) => (
                            <label key={r.key} className="relative block">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 flex w-5 justify-center">
                                    {r.icon ? <img src={r.icon} alt="" className="w-5 h-5 object-contain" /> : r.emoji}
                                </span>
                                <input
                                    placeholder={r.label}
                                    aria-label={r.label}
                                    maxLength={80}
                                    value={values[r.key]}
                                    onChange={set(r.key)}
                                    className="field pl-10"
                                />
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="block">
                    <span className="label">Σημειώσεις (δημόσιες)</span>
                    <textarea
                        rows={2}
                        maxLength={500}
                        placeholder="π.χ. στην πλατεία, μετά τον εσπερινό"
                        value={values.notes}
                        onChange={set("notes")}
                        className="field resize-none"
                    />
                </label>

                {!isAdmin && (
                    <label className="block">
                        <span className="label">💬 Σχόλιο προς τον διαχειριστή (προαιρετικό — δεν δημοσιεύεται)</span>
                        <textarea
                            rows={2}
                            maxLength={500}
                            placeholder="π.χ. είμαι από τον πολιτιστικό σύλλογο του χωριού· η πηγή είναι η αφίσα του συλλόγου"
                            value={values.submitter_comment}
                            onChange={set("submitter_comment")}
                            className="field resize-none"
                        />
                    </label>
                )}

                {error && <p className="rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-1">
                    {editing ? (
                        <button type="button" onClick={remove} disabled={busy} className="btn-ghost text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                            Διαγραφή
                        </button>
                    ) : <span />}
                    <div className="flex flex-col-reverse sm:flex-row gap-2">
                        <button type="button" onClick={onClose} className="btn-ghost">Άκυρο</button>
                        <button type="submit" disabled={busy} className="btn-primary">
                            {busy ? "Αποθήκευση…" : editing ? "Αποθήκευση" : isAdmin ? "Δημοσίευση" : "Υποβολή για έγκριση"}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
