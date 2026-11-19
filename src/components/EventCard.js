import { ROLES, STATUS_LABEL, dateParts, daysFromToday, formatDate, formatTime, relativeLabel, styleFor } from "../lib/celebrations";

export function Roles({ celebration, compact = false }) {
    const present = ROLES.filter((r) => celebration[r.key]);
    if (present.length === 0) return null;
    return (
        <ul className={compact ? "space-y-1" : "mt-2 flex flex-wrap gap-1.5"}>
            {present.map((r) => (
                <li
                    key={r.key}
                    className={compact
                        ? "flex items-center gap-2"
                        : "flex items-center gap-1.5 rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-1 text-xs text-stone-700 dark:text-stone-300"}
                    title={r.label}
                >
                    {r.icon
                        ? <span className="icon-badge h-5 w-5"><img src={r.icon} alt="" className="w-4 h-4 object-contain" /></span>
                        : <span>{r.emoji}</span>}
                    <span>{compact ? <span className="text-stone-500 dark:text-stone-400">{r.label}: </span> : null}{celebration[r.key]}</span>
                </li>
            ))}
        </ul>
    );
}

export function StatusBadge({ status }) {
    if (!status || status === "approved") return null;
    const cls = status === "pending"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
            {status === "pending" ? "⏳" : "✕"} {STATUS_LABEL[status]}
        </span>
    );
}

export default function EventCard({ celebration, village, index, active, onSelect }) {
    const s = styleFor(celebration.celebration_type);
    const { day, month, weekday } = dateParts(celebration.celebration_date);
    const rel = relativeLabel(celebration.celebration_date);
    const past = daysFromToday(celebration.celebration_date) < 0;

    return (
        <article
            onClick={onSelect}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
            tabIndex={0}
            role="button"
            aria-label={`${village?.name}, ${s.label}, ${formatDate(celebration.celebration_date)}`}
            style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
            className={`group relative flex gap-3 rounded-2xl border p-3 cursor-pointer animate-fade-in-up outline-none
                bg-white/90 dark:bg-stone-900/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg
                focus-visible:ring-2 focus-visible:ring-amber-500
                ${active ? "ring-2 ring-amber-500 border-transparent shadow-lg" : "border-stone-200/80 dark:border-stone-700/60"}
                ${past ? "opacity-70" : ""} ${celebration.status === "pending" ? "border-dashed border-amber-400" : ""}`}
        >
            {/* Ημερομηνία */}
            <div
                className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-2 text-white shadow-inner"
                style={{ background: s.color }}
            >
                <span className="text-[10px] uppercase tracking-wider opacity-90">{weekday}</span>
                <span className="font-display text-2xl leading-none">{day}</span>
                <span className="text-[11px] uppercase tracking-wide opacity-90">{month}</span>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-stone-900 dark:text-stone-50 truncate">{village?.name ?? "—"}</h3>
                    {rel && (
                        <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 animate-pulse-soft">
                            {rel}
                        </span>
                    )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
                    <span className="flex items-center gap-1.5 font-medium" style={{ color: s.color }}>
                        {s.icon && <span className="icon-badge h-5 w-5"><img src={s.icon} alt="" className="w-4 h-4 object-contain" /></span>}
                        <span className="dark:brightness-150">{s.label || celebration.celebration_type}</span>
                    </span>
                    {celebration.start_time && (
                        <span className="text-stone-500 dark:text-stone-400">· {formatTime(celebration.start_time)}</span>
                    )}
                    {village?.prefecture && (
                        <span className="text-stone-400 dark:text-stone-500 text-xs">· {village.prefecture}</span>
                    )}
                </div>
                <StatusBadge status={celebration.status} />
                <Roles celebration={celebration} />
                {celebration.notes && <p className="mt-2 text-xs text-stone-500 dark:text-stone-400 italic">{celebration.notes}</p>}
            </div>
        </article>
    );
}
