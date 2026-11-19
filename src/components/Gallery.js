import { useEffect, useRef, useState } from "react";
import { PHOTOS } from "./Backdrop";
import { useBackButton } from "./Modal";

/** Προβολή μόνο των φωτογραφιών: ολόκληρη η εικόνα, χωρίς τίποτα από πάνω. */
export default function Gallery({ index, setIndex, onClose }) {
    useBackButton(onClose);
    const [ui, setUi] = useState(true); // πατώντας στη φωτογραφία κρύβονται/φαίνονται τα κουμπιά
    const touch = useRef(null);
    const photo = PHOTOS[index];
    const go = (d) => setIndex((i) => (i + d + PHOTOS.length) % PHOTOS.length);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    });

    return (
        <div
            className="fixed inset-0 z-[1050] bg-black animate-fade-in select-none"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
                if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}
            onClick={() => setUi((v) => !v)}
            role="dialog"
            aria-label="Φωτογραφίες"
        >
            {PHOTOS.map((p, i) => (
                <div key={p.key} className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`} aria-hidden={i !== index}>
                    {/* θολό φόντο που γεμίζει την οθόνη + η φωτογραφία ολόκληρη από πάνω */}
                    <img src={`/bg/${p.key}-small.jpg`} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-60" />
                    {Math.abs(i - index) <= 1 || (index === 0 && i === PHOTOS.length - 1) || (index === PHOTOS.length - 1 && i === 0) ? (
                        <img
                            src={`/bg/${p.key}.jpg`}
                            alt={p.place}
                            className="absolute inset-0 h-full w-full object-contain"
                            decoding="async"
                        />
                    ) : null}
                </div>
            ))}

            <div className={`transition-opacity duration-300 ${ui ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur ring-1 ring-white/20 hover:bg-black/70"
                    aria-label="Κλείσιμο"
                >
                    ✕
                </button>
                {[[-1, "‹", "left-3", "Προηγούμενη"], [1, "›", "right-3", "Επόμενη"]].map(([d, sym, pos, label]) => (
                    <button
                        key={d}
                        onClick={(e) => { e.stopPropagation(); go(d); }}
                        className={`absolute ${pos} top-1/2 hidden sm:flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-4xl text-white backdrop-blur ring-1 ring-white/20 hover:bg-black/60`}
                        aria-label={label}
                    >
                        {sym}
                    </button>
                ))}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-16 text-center text-white">
                    <p key={photo.key} className="font-display text-3xl animate-fade-in-up">{photo.place}</p>
                    <p className="mt-1 text-xs text-white/70">
                        Φωτογραφία: <a href={photo.url} target="_blank" rel="noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>{photo.author}</a> · {photo.license}
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                        {PHOTOS.map((p, i) => (
                            <button
                                key={p.key}
                                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/40"}`}
                                aria-label={p.place}
                            />
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-white/50 sm:hidden">Σύρετε για την επόμενη · πατήστε για να κρυφτούν τα κουμπιά</p>
                </div>
            </div>
        </div>
    );
}
