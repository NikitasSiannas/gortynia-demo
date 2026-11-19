import { useEffect, useRef } from "react";

// Το κουμπί "Πίσω" του κινητού/browser κλείνει το παράθυρο αντί να βγάζει από την εφαρμογή.
// Κάθε παράθυρο προσθέτει μια εγγραφή στο ιστορικό· όταν κλείνει με ✕, την αφαιρούμε (και αγνοούμε το popstate που προκαλεί αυτό).
// Αν ένα παράθυρο κλείσει και αμέσως ανοίξει άλλο (π.χ. Λεπτομέρειες → Επεξεργασία, ή το διπλό mount του
// React StrictMode), ξαναχρησιμοποιούμε την ίδια εγγραφή αντί να πάμε πίσω και να ξαναπροσθέσουμε.
let ignorePops = 0;
let pendingBack = null;
const stack = []; // ανοιχτά παράθυρα, το τελευταίο είναι από πάνω

// Ένας κεντρικός ακροατής: "Πίσω" → κλείνει το πάνω-πάνω παράθυρο.
// Τα "πίσω" που κάνουμε εμείς (όταν κλείνει παράθυρο με ✕) απλώς καταναλώνονται.
window.addEventListener("popstate", () => {
    if (ignorePops > 0) {
        ignorePops--;
        return;
    }
    const top = stack[stack.length - 1];
    if (top) top();
});

export function useBackButton(onClose) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        let closedByBack = false;
        if (pendingBack) {
            clearTimeout(pendingBack);
            pendingBack = null;
        } else {
            window.history.pushState({ modal: true }, "");
        }
        const entry = () => {
            closedByBack = true;
            closeRef.current();
        };
        stack.push(entry);
        return () => {
            stack.splice(stack.indexOf(entry), 1);
            if (!closedByBack && window.history.state?.modal) {
                pendingBack = setTimeout(() => {
                    pendingBack = null;
                    ignorePops++;
                    window.history.back();
                }, 0);
            }
        };
    }, []);
}

export default function Modal({ title, onClose, children, wide = false, header = null }) {
    useBackButton(onClose);

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
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 pb-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur">
                    <button
                        onClick={onClose}
                        className="sm:hidden -ml-1 flex items-center gap-0.5 rounded-full px-2 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                        aria-label="Πίσω"
                    >
                        <span className="text-xl leading-none">‹</span> Πίσω
                    </button>
                    <h2 className="flex-1 truncate font-display text-2xl text-stone-900 dark:text-stone-50 sm:pl-0">{title}</h2>
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
