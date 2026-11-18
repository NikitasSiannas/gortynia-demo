import { useEffect } from "react";

export default function Modal({ title, onClose, children, wide = false, header = null }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-stone-900/50 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] overflow-y-auto overscroll-contain
                    bg-white dark:bg-stone-900 dark:text-stone-100 rounded-t-3xl sm:rounded-3xl shadow-2xl
                    animate-sheet-up sm:animate-pop-in pb-[env(safe-area-inset-bottom)]`}
            >
                {header}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 pt-5 pb-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
                    <h2 className="font-display text-2xl text-stone-900 dark:text-stone-50">{title}</h2>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 shrink-0 rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-white transition"
                        aria-label="Κλείσιμο"
                    >
                        ✕
                    </button>
                </div>
                <div className="px-6 pb-6">{children}</div>
            </div>
        </div>
    );
}
