import { useState } from "react";
import Modal from "./Modal";
import { Roles, StatusBadge } from "./EventCard";
import {
    directionsUrl, downloadIcs, formatDate, formatTime, googleCalendarUrl, relativeLabel,
    shareText, shareUrl, styleFor,
} from "../lib/celebrations";

function ActionButton({ onClick, href, icon, children, primary = false }) {
    const cls = `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-semibold transition active:scale-95
        ${primary
            ? "bg-stone-900 text-white hover:bg-stone-700 dark:bg-amber-500 dark:text-stone-900 dark:hover:bg-amber-400"
            : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"}`;
    const body = (<><span className="text-xl leading-none">{icon}</span>{children}</>);
    return href
        ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>
        : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

export default function EventDetail({ celebration, village, canEdit, isAdmin, onEdit, onShowOnMap, onReview, onClose, notify }) {
    const s = styleFor(celebration.celebration_type);
    const [panel, setPanel] = useState(null); // null | "share" | "calendar"
    const [busy, setBusy] = useState(false);
    const rel = relativeLabel(celebration.celebration_date);
    const url = shareUrl(celebration);
    const text = shareText(celebration, village);

    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: text, text, url });
                return;
            } catch (err) {
                if (err.name === "AbortError") return;
            }
        }
        setPanel(panel === "share" ? null : "share");
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            notify("Ο σύνδεσμος αντιγράφηκε ✓");
        } catch {
            window.prompt("Αντιγράψτε τον σύνδεσμο:", url);
        }
    };

    const review = async (status) => {
        let note = null;
        if (status === "rejected") {
            note = window.prompt("Λόγος απόρριψης (προαιρετικό — θα τον δει ο χρήστης):", "");
            if (note === null) return;
        }
        setBusy(true);
        try {
            await onReview(celebration, status, note);
        } finally {
            setBusy(false);
        }
    };

    const header = (
        <div className="relative h-24 overflow-hidden rounded-t-3xl" style={{ background: `linear-gradient(135deg, ${s.color}, #1c1917)` }}>
            <img src={s.icon} alt="" className="absolute -right-4 -bottom-6 h-32 w-32 object-contain opacity-30 rotate-12" />
            <div className="absolute bottom-3 left-6 flex items-center gap-2 text-white">
                <span className="icon-badge h-9 w-9 border-2 border-white/70"><img src={s.icon} alt="" className="h-6 w-6 object-contain" /></span>
                <span className="font-semibold">{s.label}</span>
                {rel && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur">{rel}</span>}
            </div>
        </div>
    );

    return (
        <Modal title={village?.name || "Εκδήλωση"} onClose={onClose} header={header}>
            <div className="space-y-4">
                <div className="space-y-1 text-stone-700 dark:text-stone-200">
                    <p className="text-lg">📅 {formatDate(celebration.celebration_date)}</p>
                    {celebration.start_time && <p>🕘 Έναρξη {formatTime(celebration.start_time)}</p>}
                    {village?.region && <p className="text-sm text-stone-500 dark:text-stone-400">📍 {village.region}, Αρκαδία</p>}
                    <StatusBadge status={celebration.status} />
                    {celebration.status === "rejected" && celebration.admin_note && (
                        <p className="text-sm text-red-700 dark:text-red-300">Σημείωση διαχειριστή: {celebration.admin_note}</p>
                    )}
                </div>

                {celebration.notes && <p className="rounded-2xl bg-stone-50 dark:bg-stone-800/60 p-3 text-sm italic text-stone-600 dark:text-stone-300">{celebration.notes}</p>}

                <div className="text-sm text-stone-700 dark:text-stone-200"><Roles celebration={celebration} compact /></div>

                {isAdmin && (celebration.created_by_email || celebration.submitter_comment) && (
                    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 dark:bg-amber-500/10 p-3 text-sm">
                        {celebration.created_by_email && <p>👤 {celebration.created_by_email}</p>}
                        {celebration.submitter_comment && <p className="mt-1">💬 {celebration.submitter_comment}</p>}
                    </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                    <ActionButton onClick={share} icon="📤" primary>Κοινοποίηση</ActionButton>
                    <ActionButton onClick={() => setPanel(panel === "calendar" ? null : "calendar")} icon="🗓️">Ημερολόγιο</ActionButton>
                    {village && <ActionButton href={directionsUrl(village)} icon="🧭">Οδηγίες</ActionButton>}
                    <ActionButton onClick={onShowOnMap} icon="🗺️">Χάρτης</ActionButton>
                </div>

                {panel === "share" && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in-up">
                        <a className="btn-soft" target="_blank" rel="noreferrer" href={`viber://forward?text=${encodeURIComponent(`${text}\n${url}`)}`}>💜 Viber</a>
                        <a className="btn-soft" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}>💚 WhatsApp</a>
                        <a className="btn-soft" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>💙 Facebook</a>
                        <button type="button" className="btn-soft" onClick={copy}>🔗 Αντιγραφή</button>
                    </div>
                )}

                {panel === "calendar" && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in-up">
                        <a className="btn-soft" target="_blank" rel="noreferrer" href={googleCalendarUrl(celebration, village)}>Google Calendar</a>
                        <button type="button" className="btn-soft" onClick={() => downloadIcs(celebration, village)}>iPhone / Outlook</button>
                    </div>
                )}

                {(canEdit || (isAdmin && celebration.status !== "approved")) && (
                    <div className="flex flex-wrap gap-2 border-t border-stone-200 dark:border-stone-700 pt-4">
                        {isAdmin && celebration.status !== "approved" && (
                            <button disabled={busy} onClick={() => review("approved")} className="btn-primary bg-emerald-700 hover:bg-emerald-600">✓ Έγκριση</button>
                        )}
                        {isAdmin && celebration.status === "pending" && (
                            <button disabled={busy} onClick={() => review("rejected")} className="btn-ghost text-red-700 dark:text-red-400">✕ Απόρριψη</button>
                        )}
                        {canEdit && <button onClick={onEdit} className="btn-ghost ml-auto">✏️ Επεξεργασία</button>}
                    </div>
                )}
            </div>
        </Modal>
    );
}
