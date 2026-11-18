// Κοινές ρυθμίσεις & βοηθητικές συναρτήσεις για τις εκδηλώσεις

export const SITE_URL = "https://gortynia-demo.vercel.app";

export const CELEBRATION_TYPES = ["Πανηγύρι", "Λαική Βραδιά", "Πάρτυ Νεολαίας"];

export const CELEBRATION_STYLE = {
    "Πανηγύρι": { icon: "/clarinet.png", color: "#2f6b3a", soft: "#e4f0e6", label: "Πανηγύρι" },
    "Λαική Βραδιά": { icon: "/bouzouki.png", color: "#a15c1f", soft: "#f6ebdf", label: "Λαϊκή Βραδιά" },
    "Πάρτυ Νεολαίας": { icon: "/discoball.png", color: "#5b3fa8", soft: "#ebe6f7", label: "Πάρτυ Νεολαίας" },
};
export const DEFAULT_STYLE = { icon: null, color: "#6b7280", soft: "#f3f4f6", label: "" };

export const styleFor = (type) => CELEBRATION_STYLE[type] || DEFAULT_STYLE;
export const typeLabel = (type) => styleFor(type).label || type;

export const REGIONS = ["Γορτυνία", "Τρίπολη", "Μεγαλόπολη", "Βόρεια Κυνουρία", "Νότια Κυνουρία", "Ηλεία"];

export const STATUS_LABEL = {
    pending: "Σε αναμονή έγκρισης",
    approved: "Εγκεκριμένη",
    rejected: "Απορρίφθηκε",
};

export const ROLES = [
    { key: "dj", label: "DJ", emoji: "🎧" },
    { key: "front_singer", label: "Τραγουδιστής", emoji: "🎤" },
    { key: "clarinet_player", label: "Κλαρίνο", icon: "/clarinet.png" },
    { key: "violin_player", label: "Βιολί", icon: "/violin.png" },
    { key: "bouzouki_player", label: "Μπουζούκι", icon: "/bouzouki.png" },
];

const pad = (n) => String(n).padStart(2, "0");

/** Σημερινή ημερομηνία σε μορφή YYYY-MM-DD (τοπική ώρα). */
export function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/** Ημέρες από σήμερα μέχρι την ημερομηνία (αρνητικό = πέρασε). */
export function daysFromToday(isoDate) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((parseIso(isoDate) - today) / 86400000);
}

export function relativeLabel(isoDate) {
    const n = daysFromToday(isoDate);
    if (n === 0) return "Σήμερα";
    if (n === 1) return "Αύριο";
    if (n > 1 && n <= 14) return `σε ${n} ημέρες`;
    return null;
}

export function formatDate(isoDate, opts = {}) {
    if (!isoDate) return "";
    return parseIso(isoDate).toLocaleDateString("el-GR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", ...opts,
    });
}

export function dateParts(isoDate) {
    const date = parseIso(isoDate);
    return {
        day: date.getDate(),
        month: date.toLocaleDateString("el-GR", { month: "short" }).replace(".", ""),
        weekday: date.toLocaleDateString("el-GR", { weekday: "short" }),
    };
}

export const formatTime = (t) => (t ? t.slice(0, 5) : "");

// ---------- Κοινοποίηση ----------

/** Σύνδεσμος για κοινοποίηση. Οι εκδηλώσεις της βάσης έχουν σελίδα με προεπισκόπηση (/e/:id). */
export function shareUrl(celebration) {
    const origin = window.location.origin.includes("localhost") || /^\d/.test(window.location.hostname)
        ? window.location.origin
        : SITE_URL;
    return /^\d+$/.test(String(celebration.id))
        ? `${origin}/e/${celebration.id}`
        : `${origin}/?e=${encodeURIComponent(celebration.id)}`;
}

export function shareText(celebration, village) {
    return `${typeLabel(celebration.celebration_type)} · ${village?.name || ""} — ${formatDate(celebration.celebration_date, { year: undefined })}${celebration.start_time ? `, ${formatTime(celebration.start_time)}` : ""}`;
}

export function directionsUrl(village) {
    return `https://www.google.com/maps/dir/?api=1&destination=${village.lat},${village.lon}`;
}

// ---------- Ημερολόγιο ----------

function eventTimes(c) {
    const ymd = c.celebration_date.replace(/-/g, "");
    if (!c.start_time) {
        const next = parseIso(c.celebration_date);
        next.setDate(next.getDate() + 1);
        return { allDay: true, start: ymd, end: `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}` };
    }
    const [h, m] = c.start_time.split(":").map(Number);
    const start = parseIso(c.celebration_date);
    start.setHours(h, m);
    const end = new Date(start.getTime() + 4 * 3600 * 1000); // διάρκεια 4 ώρες
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    return { allDay: false, start: fmt(start), end: fmt(end) };
}

function calendarDescription(c) {
    const who = ROLES.filter((r) => c[r.key]).map((r) => `${r.label}: ${c[r.key]}`);
    return [...who, c.notes, shareUrl(c)].filter(Boolean).join("\n");
}

export function googleCalendarUrl(c, village) {
    const t = eventTimes(c);
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: `${typeLabel(c.celebration_type)} · ${village?.name || ""}`,
        dates: `${t.start}/${t.end}`,
        details: calendarDescription(c),
        location: `${village?.name || ""}, Αρκαδία`,
        ctz: "Europe/Athens",
    });
    return `https://calendar.google.com/calendar/render?${params}`;
}

/** Κατεβάζει αρχείο .ics (iPhone, Outlook, Android). */
export function downloadIcs(c, village) {
    const t = eventTimes(c);
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Panigyria Gortynias//EL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${c.id}@panigyria-gortynias`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
        t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART;TZID=Europe/Athens:${t.start}`,
        t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND;TZID=Europe/Athens:${t.end}`,
        `SUMMARY:${esc(`${typeLabel(c.celebration_type)} · ${village?.name || ""}`)}`,
        `LOCATION:${esc(`${village?.name || ""}, Αρκαδία`)}`,
        village ? `GEO:${village.lat};${village.lon}` : null,
        `DESCRIPTION:${esc(calendarDescription(c))}`,
        "BEGIN:VALARM", "TRIGGER:-PT3H", "ACTION:DISPLAY", "DESCRIPTION:Υπενθύμιση", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${village?.name || "ekdilosi"}-${c.celebration_date}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
