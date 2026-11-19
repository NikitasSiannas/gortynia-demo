import { useEffect, useState } from "react";

// Φωτογραφίες φόντου (Wikimedia Commons, ελεύθερη άδεια με αναφορά δημιουργού)
// region = νομός/περιοχή που εμφανίζεται στην κεφαλίδα μαζί με το μέρος (π.χ. «Λακωνία · Μονεμβασιά»)
export const PHOTOS = [
    { key: "dimitsana", region: "Γορτυνία", place: "Δημητσάνα", author: "Ulrich Still", license: "CC BY-SA 2.0 DE", url: "https://commons.wikimedia.org/wiki/File:Dimitsana-Panorama.jpg" },
    { key: "monemvasia", region: "Λακωνία", place: "Μονεμβασιά", author: "DimitrisP67", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Monemvasia_(photo_4).jpg" },
    { key: "kardamyli", region: "Μεσσηνία", place: "Καρδαμύλη", author: "Ppso", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Kardamili_view_from_south_on_village.jpg" },
    { key: "karytaina", region: "Γορτυνία", place: "Καρύταινα", author: "FilipposTrains", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Karytaina_overview.jpg" },
    { key: "nafplio", region: "Αργολίδα", place: "Ναύπλιο", author: "Annatsach", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:View_from_Palamidi_castle_-_1_(Bourtzi_castle_and_part_of_Nafplio).jpg" },
    { key: "andritsaina", region: "Ηλεία", place: "Ανδρίτσαινα", author: "FilipposTrains", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Andritsaina_overview.jpg" },
    { key: "lagkadia", region: "Γορτυνία", place: "Λαγκάδια", author: "Glorious 93", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Λαγκάδια_Αρκαδίας_(πανοραμική_άποψη)-2.jpg" },
    { key: "doxa", region: "Κορινθία", place: "Λίμνη Δόξα", author: "Nektarios Tsikis", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Λίμνη_Δόξα_-_Lake_Doxa_-_panoramio.jpg" },
    { key: "vathia", region: "Μάνη", place: "Βάθεια", author: "macrolepis", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Vathia_-_panoramio.jpg" },
    { key: "stemnitsa", region: "Γορτυνία", place: "Στεμνίτσα", author: "FilipposTrains", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Overview_of_Stemnitsa,_Arkadia.jpg" },
    { key: "tsivlou", region: "Αχαΐα", place: "Λίμνη Τσιβλού", author: "Giannis69", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Tsivlou_lake.jpg" },
    { key: "leonidio", region: "Κυνουρία", place: "Λεωνίδιο", author: "Natalia Mostova", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Orange_cliffs_Leonidio.jpg" },
    { key: "vytina", region: "Μαίναλο", place: "Βυτίνα", author: "C messier", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Βυτίνα_3879.jpg" },
    { key: "lousios", region: "Γορτυνία", place: "Φαράγγι του Λούσιου", author: "Napoleon Vier", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Lousios-kloof.jpg" },
];

const INTERVAL = 14000;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ποια φωτογραφία φαίνεται. Αλλάζει μόνη της· paused = σταματά (π.χ. όσο είναι ανοιχτή η γκαλερί). */
export function useBackdropIndex(paused = false) {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (reducedMotion() || paused) return;
        const t = setInterval(() => {
            if (!document.hidden) setIndex((i) => (i + 1) % PHOTOS.length);
        }, INTERVAL);
        return () => clearInterval(t);
    }, [paused]);
    return [index, setIndex];
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
            {/* Πιο ανοιχτό στη μέση, ώστε η φωτογραφία να φαίνεται· σκούρο πάνω/κάτω για να διαβάζονται τα γράμματα */}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-950/50 via-stone-950/0 to-stone-950/55 dark:from-black/70 dark:via-black/35 dark:to-black/75 transition-colors duration-700" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent" />
        </div>
    );
}
