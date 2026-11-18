import { useEffect, useState } from "react";

// Φωτογραφίες φόντου (Wikimedia Commons, ελεύθερη άδεια με αναφορά δημιουργού)
export const PHOTOS = [
    { key: "dimitsana", place: "Δημητσάνα", author: "Ulrich Still", license: "CC BY-SA 2.0 DE", url: "https://commons.wikimedia.org/wiki/File:Dimitsana-Panorama.jpg" },
    { key: "karytaina", place: "Καρύταινα", author: "FilipposTrains", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Karytaina_overview.jpg" },
    { key: "lagkadia", place: "Λαγκάδια", author: "Glorious 93", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Λαγκάδια_Αρκαδίας_(πανοραμική_άποψη)-2.jpg" },
    { key: "vytina", place: "Βυτίνα", author: "C messier", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Βυτίνα_3879.jpg" },
    { key: "lousios", place: "Φαράγγι του Λούσιου", author: "Napoleon Vier", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Lousios-kloof.jpg" },
];

const INTERVAL = 14000;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useBackdropIndex() {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (reducedMotion()) return;
        const t = setInterval(() => {
            if (!document.hidden) setIndex((i) => (i + 1) % PHOTOS.length);
        }, INTERVAL);
        return () => clearInterval(t);
    }, []);
    return index;
}

export default function Backdrop({ index }) {
    // Φορτώνουμε μόνο όσες φωτογραφίες έχουν ήδη εμφανιστεί + την επόμενη
    const [loaded, setLoaded] = useState(() => new Set([0, 1]));
    useEffect(() => {
        setLoaded((s) => (s.has((index + 1) % PHOTOS.length) ? s : new Set([...s, (index + 1) % PHOTOS.length])));
    }, [index]);

    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {PHOTOS.map((p, i) =>
                loaded.has(i) ? (
                    <img
                        key={p.key}
                        className={`hero-bg transition-opacity duration-[2000ms] ${i === index ? "opacity-100" : "opacity-0"}`}
                        src={`/bg/${p.key}-small.jpg`}
                        srcSet={`/bg/${p.key}-small.jpg 900w, /bg/${p.key}.jpg 1800w`}
                        sizes="100vw"
                        alt=""
                        decoding="async"
                    />
                ) : null
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-900/55 via-stone-900/25 to-stone-900/60 dark:from-black/75 dark:via-black/55 dark:to-black/80 transition-colors duration-700" />
        </div>
    );
}
