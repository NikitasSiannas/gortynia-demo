import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { Roles } from "./EventCard";
import { ROLE_LABEL, formatDate, formatTime, styleFor } from "../lib/celebrations";
import { addAdmin, listAdmins, listUsers, removeAdmin, reviewMusician } from "../lib/data";

function MusiciansTab({ musicians, onChanged }) {
    const [busy, setBusy] = useState(null);
    const [q, setQ] = useState("");
    const pending = musicians.filter((m) => m.status === "pending");
    const approved = musicians.filter((m) => m.status === "approved");
    const shown = q.trim()
        ? approved.filter((m) => m.name.toLocaleLowerCase("el").includes(q.trim().toLocaleLowerCase("el")))
        : [];

    const act = async (m, status) => {
        setBusy(m.id);
        try {
            await reviewMusician(m.id, status);
            await onChanged();
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="label">Νέοι μουσικοί για έγκριση ({pending.length})</h3>
                {pending.length === 0 && <p className="text-sm text-stone-500">Κανένας.</p>}
                <ul className="space-y-2">
                    {pending.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 p-2.5 text-sm">
                            <span className="flex-1"><strong>{m.name}</strong> · {(m.roles || []).map((r) => ROLE_LABEL[r] || r).join(", ")}</span>
                            <button disabled={busy === m.id} onClick={() => act(m, "approved")} className="rounded-full bg-emerald-700 px-3 py-1 text-white">✓</button>
                            <button disabled={busy === m.id} onClick={() => act(m, "rejected")} className="rounded-full px-3 py-1 text-red-700 hover:bg-red-50 dark:text-red-400">✕</button>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h3 className="label">Κατάλογος ({approved.length})</h3>
                <input className="field" placeholder="🔍 Αναζήτηση μουσικού" value={q} onChange={(e) => setQ(e.target.value)} />
                <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 text-sm">
                    {shown.slice(0, 50).map((m) => (
                        <li key={m.id} className="py-2">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-stone-500"> · {(m.roles || []).map((r) => ROLE_LABEL[r] || r).join(", ")} · {(m.genres || []).join(", ")}</span>
                            {m.scene === "panigyri" && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">πανηγύρια</span>}
                            {m.source_url && (
                                <a href={m.source_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-amber-700 underline">
                                    {m.source_note || "πηγή"}{m.last_seen_year ? ` (${m.last_seen_year})` : ""}
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
                {!q && <p className="mt-1 text-xs text-stone-500">Γράψτε ένα όνομα για αναζήτηση.</p>}
            </div>
        </div>
    );
}

function AdminsTab({ currentEmail }) {
    const [admins, setAdmins] = useState(null);
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const load = useCallback(() => listAdmins().then(setAdmins).catch((e) => setError(e.message)), []);
    useEffect(() => { load(); }, [load]);

    const add = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await addAdmin(email);
            setEmail("");
            load();
        } catch (err) {
            setError(err.code === "23505" ? "Υπάρχει ήδη." : err.message);
        }
    };
    const remove = async (a) => {
        const self = a.email.toLowerCase() === currentEmail?.toLowerCase();
        if (!window.confirm(self ? "Θα αφαιρέσετε τον ΕΑΥΤΟ σας από τους διαχειριστές. Σίγουρα;" : `Αφαίρεση του ${a.email};`)) return;
        try {
            await removeAdmin(a.email);
            load();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="space-y-3 text-sm">
            <p className="text-stone-600 dark:text-stone-300">Οι διαχειριστές εγκρίνουν εκδηλώσεις και μουσικούς και βλέπουν τους χρήστες. Μπορείτε να έχετε περισσότερους από έναν.</p>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700">
                {(admins || []).map((a) => (
                    <li key={a.email} className="flex items-center gap-2 px-3 py-2.5">
                        <span className="flex-1 break-all font-medium">{a.email}{a.email.toLowerCase() === currentEmail?.toLowerCase() ? " (εσείς)" : ""}</span>
                        {admins.length > 1 && <button onClick={() => remove(a)} className="text-red-700 dark:text-red-400 hover:underline">Αφαίρεση</button>}
                    </li>
                ))}
            </ul>
            <form onSubmit={add} className="flex gap-2">
                <input type="email" required className="field" placeholder="νέος-διαχειριστής@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn-primary shrink-0">Προσθήκη</button>
            </form>
            {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
        </div>
    );
}

const fmtDateTime = (iso) =>
    iso ? new Date(iso).toLocaleString("el-GR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminPanel({ celebrations, villageById, musicians = [], onMusiciansChanged, currentEmail, onReview, onOpen, onClose }) {
    const [tab, setTab] = useState("pending");
    const [users, setUsers] = useState(null);
    const [usersError, setUsersError] = useState("");
    const [busyId, setBusyId] = useState(null);

    const pending = useMemo(
        () => celebrations.filter((c) => c.status === "pending").sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
        [celebrations]
    );
    const rejected = useMemo(() => celebrations.filter((c) => c.status === "rejected"), [celebrations]);

    useEffect(() => {
        if (tab !== "users" || users) return;
        listUsers().then(setUsers).catch((e) => setUsersError(e.message));
    }, [tab, users]);

    const review = async (c, status) => {
        let note = null;
        if (status === "rejected") {
            note = window.prompt("Λόγος απόρριψης (προαιρετικό — θα τον δει ο χρήστης):", "");
            if (note === null) return;
        }
        setBusyId(c.id);
        try {
            await onReview(c, status, note);
        } finally {
            setBusyId(null);
        }
    };

    const list = tab === "pending" ? pending : rejected;

    return (
        <Modal title="Διαχείριση" onClose={onClose} wide>
            <div className="mb-4 -mx-1 flex gap-1 overflow-x-auto scrollbar-none rounded-full bg-stone-100 dark:bg-stone-800 p-1 text-sm font-medium">
                {[
                    ["pending", `Για έγκριση${pending.length ? ` (${pending.length})` : ""}`],
                    ["rejected", "Απορριφθείσες"],
                    ["musicians", `Μουσικοί${musicians.some((m) => m.status === "pending") ? ` (${musicians.filter((m) => m.status === "pending").length})` : ""}`],
                    ["users", "Χρήστες"],
                    ["admins", "Διαχειριστές"],
                ].map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`shrink-0 flex-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${tab === k ? "bg-white dark:bg-stone-600 shadow text-stone-900 dark:text-white" : "text-stone-500 dark:text-stone-400"}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === "musicians" && <MusiciansTab musicians={musicians} onChanged={onMusiciansChanged} />}
            {tab === "admins" && <AdminsTab currentEmail={currentEmail} />}

            {(tab === "pending" || tab === "rejected") && (
                <div className="space-y-3">
                    {list.length === 0 && (
                        <p className="py-10 text-center text-stone-500 dark:text-stone-400">
                            {tab === "pending" ? "🎉 Δεν υπάρχει τίποτα για έγκριση." : "Καμία απορριφθείσα εκδήλωση."}
                        </p>
                    )}
                    {list.map((c) => {
                        const s = styleFor(c.celebration_type);
                        const v = villageById[c.village_id];
                        return (
                            <div key={c.id} className="rounded-2xl border border-stone-200 dark:border-stone-700 p-4 animate-fade-in-up">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <button onClick={() => onOpen(c)} className="font-semibold text-stone-900 dark:text-white hover:underline">
                                            {v?.name} · <span style={{ color: s.color }} className="dark:brightness-150">{s.label}</span>
                                        </button>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">
                                            📅 {formatDate(c.celebration_date)}{c.start_time ? ` · ${formatTime(c.start_time)}` : ""}
                                        </p>
                                    </div>
                                    <span className="text-xs text-stone-400">Υποβλήθηκε {fmtDateTime(c.updated_at || c.created_at)}</span>
                                </div>
                                <div className="mt-2 rounded-xl bg-stone-50 dark:bg-stone-800/70 p-3 text-sm space-y-1">
                                    <p>👤 <strong>{c.created_by_email || "👋 Επισκέπτης (χωρίς email)"}</strong></p>
                                    {c.submitter_comment
                                        ? <p>💬 {c.submitter_comment}</p>
                                        : <p className="text-stone-400">Χωρίς σχόλιο</p>}
                                    {c.admin_note && <p className="text-red-700 dark:text-red-300">Σημείωσή σας: {c.admin_note}</p>}
                                </div>
                                <div className="mt-2 text-sm"><Roles celebration={c} /></div>
                                {c.notes && <p className="mt-1 text-xs italic text-stone-500">{c.notes}</p>}
                                <div className="mt-3 flex gap-2">
                                    <button disabled={busyId === c.id} onClick={() => review(c, "approved")} className="btn-primary bg-emerald-700 hover:bg-emerald-600 py-2">
                                        ✓ Έγκριση
                                    </button>
                                    {c.status === "pending" && (
                                        <button disabled={busyId === c.id} onClick={() => review(c, "rejected")} className="btn-ghost py-2 text-red-700 dark:text-red-400">
                                            ✕ Απόρριψη
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "users" && (
                <div>
                    {usersError && <p className="text-sm text-red-700">{usersError}</p>}
                    {!users && !usersError && <p className="py-8 text-center text-stone-500">Φόρτωση…</p>}
                    {users && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                                    <tr>
                                        <th className="py-2 pr-3">Email</th>
                                        <th className="py-2 pr-3">Τελευταία σύνδεση</th>
                                        <th className="py-2 pr-3">Εγγραφή</th>
                                        <th className="py-2 text-right">Εκδηλ.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                                    {users.map((u) => (
                                        <tr key={u.id || u.email}>
                                            <td className="py-2 pr-3 font-medium break-all">{u.is_anonymous ? <span className="text-stone-500">👋 Επισκέπτης</span> : u.email}</td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(u.last_sign_in_at)}</td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(u.created_at)}</td>
                                            <td className="py-2 text-right">{u.events_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="mt-3 text-xs text-stone-500">{users.length} χρήστες συνολικά · {users.filter((u) => !u.is_anonymous).length} με email · {users.filter((u) => u.is_anonymous).length} επισκέπτες</p>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
