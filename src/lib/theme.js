import { useEffect, useState } from "react";

// Θέμα: "auto" (σκοτεινό μετά τη δύση του ηλίου), "light" ή "dark".
// Η δύση/ανατολή υπολογίζεται για το κέντρο της Αρκαδίας.
const LAT = 37.6;
const LON = 22.1;

/** Ώρα ανατολής & δύσης (Date) για τη συγκεκριμένη μέρα — προσέγγιση NOAA, ακρίβεια ~1-2 λεπτά. */
export function sunTimes(date = new Date()) {
    const rad = Math.PI / 180;
    const start = Date.UTC(date.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
    const g = ((2 * Math.PI) / 365) * (dayOfYear - 1);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(decl)) - Math.tan(LAT * rad) * Math.tan(decl)) / rad;
    const toDate = (minutesUtc) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) + minutesUtc * 60000);
    return {
        sunrise: toDate(720 - 4 * (LON + ha) - eqTime),
        sunset: toDate(720 - 4 * (LON - ha) - eqTime),
    };
}

function isNight(now = new Date()) {
    const { sunrise, sunset } = sunTimes(now);
    return now < sunrise || now > sunset;
}

function readPref() {
    try {
        return localStorage.getItem("theme") || "auto";
    } catch {
        return "auto";
    }
}

export function useTheme() {
    const [pref, setPref] = useState(readPref);
    const [night, setNight] = useState(() => isNight());

    useEffect(() => {
        const t = setInterval(() => setNight(isNight()), 60 * 1000);
        return () => clearInterval(t);
    }, []);

    const dark = pref === "dark" || (pref === "auto" && night);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c0a09" : "#1c1917");
    }, [dark]);

    const choose = (p) => {
        setPref(p);
        try {
            localStorage.setItem("theme", p);
        } catch {}
    };

    return { pref, dark, setPref: choose };
}
