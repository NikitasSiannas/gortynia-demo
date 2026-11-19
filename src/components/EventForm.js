import { useMemo, useState } from "react";
import Modal from "./Modal";
import { CELEBRATION_TYPES, FIELD_ROLE, ROLES, styleFor, todayIso } from "../lib/celebrations";
import VillagePicker from "./VillagePicker";

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

export default function EventForm({ villages, musicians = [], initial, isAdmin, isGuest, onSubmit, onDelete, onClose }) {
    const editing = Boolean(initial?.id);

    // Προτάσεις ονομάτων ανά ρόλο (μόνο εν ζωή μουσικοί)· ο χρήστης μπορεί πάντα να γράψει κάποιο νέο όνομα
    const suggestions = useMemo(() => {
        // Πρώτα οι μουσικοί των πανηγυριών, μετά οι γνωστοί καλλιτέχνες
        const byRole = {};
        [...musicians]
            .filter((m) => !m.death_year && m.status !== "rejected")
            .sort((a, b) => (a.scene === "known") - (b.scene === "known") || a.name.localeCompare(b.name, "el"))
            .forEach((m) => (m.roles || []).forEach((r) => (byRole[r] ||= []).push(m.name)));
        return byRole;
    }, [musicians]);
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


    const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!values.village_id) {
            setError("Επιλέξτε χωριό από τη λίστα.");
            return;
        }
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
                        {isGuest && " Είστε επισκέπτης: γράψτε στο σχόλιο πώς μπορούμε να σας βρούμε, ή προσθέστε email από το μενού."}
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
                    <div className="block sm:col-span-3">
                        <span className="label">Χωριό *</span>
                        <VillagePicker villages={villages} value={values.village_id} onChange={(id) => setValues((v) => ({ ...v, village_id: id }))} required />
                    </div>
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
                        {ROLES.map((r) => {
                            const list = suggestions[FIELD_ROLE[r.key]] || [];
                            return (
                                <label key={r.key} className="relative block">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 flex w-5 justify-center">
                                        {r.icon ? <img src={r.icon} alt="" className="w-5 h-5 object-contain" /> : r.emoji}
                                    </span>
                                    <input
                                        placeholder={list.length ? `${r.label} — γράψτε για προτάσεις` : r.label}
                                        aria-label={r.label}
                                        maxLength={80}
                                        list={list.length ? `musicians-${r.key}` : undefined}
                                        autoComplete="off"
                                        value={values[r.key]}
                                        onChange={set(r.key)}
                                        className="field pl-10"
                                    />
                                    {list.length > 0 && (
                                        <datalist id={`musicians-${r.key}`}>
                                            {list.map((n) => <option key={n} value={n} />)}
                                        </datalist>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                        Αν ο μουσικός δεν υπάρχει στη λίστα, γράψτε το όνομά του — θα προστεθεί μετά από έγκριση.
                    </p>
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
