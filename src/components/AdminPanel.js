import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { Roles } from "./EventCard";
import { formatDate, formatTime, styleFor } from "../lib/celebrations";
import { listUsers } from "../lib/data";

const fmtDateTime = (iso) =>
    iso ? new Date(iso).toLocaleString("el-GR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminPanel({ celebrations, villageById, onReview, onOpen, onClose }) {
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
            <div className="mb-4 flex gap-1 rounded-full bg-stone-100 dark:bg-stone-800 p-1 text-sm font-medium">
                {[
                    ["pending", `Για έγκριση${pending.length ? ` (${pending.length})` : ""}`],
                    ["rejected", `Απορριφθείσες${rejected.length ? ` (${rejected.length})` : ""}`],
                    ["users", "Χρήστες"],
                ].map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`flex-1 rounded-full px-3 py-1.5 transition ${tab === k ? "bg-white dark:bg-stone-600 shadow text-stone-900 dark:text-white" : "text-stone-500 dark:text-stone-400"}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab !== "users" && (
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
                                    <p>👤 <strong>{c.created_by_email || "άγνωστος"}</strong></p>
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
                                        <tr key={u.email}>
                                            <td className="py-2 pr-3 font-medium break-all">{u.email}</td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(u.last_sign_in_at)}</td>
                                            <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(u.created_at)}</td>
                                            <td className="py-2 text-right">{u.events_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="mt-3 text-xs text-stone-500">{users.length} χρήστες συνολικά</p>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
