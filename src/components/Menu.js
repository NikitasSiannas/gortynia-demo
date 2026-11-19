import { useEffect, useRef, useState } from "react";

function Item({ onClick, icon, children, badge }) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        >
            <span className="w-5 text-center">{icon}</span>
            <span className="flex-1">{children}</span>
            {badge ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-stone-900">{badge}</span> : null}
        </button>
    );
}

export default function Menu({
    user, isAdmin, pendingCount, dbEnabled, theme, onTheme, canInstall, onInstall,
    onNotifications, onAdmin, onSignIn, onSignOut, onQr, onHome, onGallery, onLinkEmail,
}) {
    const guest = Boolean(user?.is_anonymous);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    const run = (fn) => () => {
        setOpen(false);
        fn();
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/20 font-semibold uppercase text-white backdrop-blur-md ring-1 ring-white/40 hover:bg-white/30 transition"
                aria-label="Μενού"
                aria-expanded={open}
            >
                {user ? (guest ? "👋" : user.email?.[0]) : "☰"}
                {isAdmin && pendingCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-stone-900 ring-2 ring-stone-900/30">
                        {pendingCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-stone-900 p-2 text-sm text-stone-700 dark:text-stone-200 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-pop-in z-[1100] origin-top-right">
                    {user && (
                        <div className="px-3 pt-2 pb-3 border-b border-stone-100 dark:border-stone-800 mb-1">
                            <p className="text-xs text-stone-500">Συνδεδεμένος ως{isAdmin ? " · διαχειριστής" : ""}</p>
                            <p className="font-medium truncate">{guest ? "👋 Επισκέπτης" : user.email}</p>
                        </div>
                    )}

                    <Item onClick={run(onHome)} icon="🏠">Αρχική</Item>
                    <Item onClick={run(onGallery)} icon="🖼️">Φωτογραφίες χωριών</Item>
                    {isAdmin && <Item onClick={run(onAdmin)} icon="🛡️" badge={pendingCount}>Διαχείριση</Item>}
                    <Item onClick={run(onNotifications)} icon="🔔">Ειδοποιήσεις</Item>
                    {canInstall && <Item onClick={run(onInstall)} icon="📲">Εγκατάσταση εφαρμογής</Item>}
                    <Item onClick={run(onQr)} icon="▦">QR · Μοιραστείτε την εφαρμογή</Item>

                    <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Εμφάνιση</div>
                    <div className="mx-2 mb-2 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
                        {[["auto", "🌗 Αυτόματο"], ["light", "☀️ Ημέρα"], ["dark", "🌙 Νύχτα"]].map(([k, label]) => (
                            <button
                                key={k}
                                onClick={() => onTheme(k)}
                                className={`rounded-lg px-1 py-1.5 text-xs transition ${theme === k ? "bg-white dark:bg-stone-600 shadow font-semibold" : "text-stone-500 dark:text-stone-400"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {theme === "auto" && <p className="px-3 pb-2 text-[11px] text-stone-400">Σκοτεινό από τη δύση ως την ανατολή του ηλίου.</p>}

                    {dbEnabled && (
                        <div className="border-t border-stone-100 dark:border-stone-800 mt-1 pt-1">
                            {guest && <Item onClick={run(onLinkEmail)} icon="✉️">Προσθήκη email στον λογαριασμό</Item>}
                            {user
                                ? <Item onClick={run(onSignOut)} icon="↩︎">{guest ? "Έξοδος επισκέπτη" : "Αποσύνδεση"}</Item>
                                : <Item onClick={run(onSignIn)} icon="✉️">Σύνδεση με email</Item>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
