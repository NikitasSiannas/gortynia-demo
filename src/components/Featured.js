import { dateParts, formatTime, relativeLabel, styleFor } from "../lib/celebrations";

/** Ταινία "Έρχονται σύντομα": οριζόντιες κάρτες πάνω στη φωτογραφία του εξωφύλλου. */
export default function Featured({ events, villageById, onOpen, compact = false }) {
    if (events.length === 0) return null;
    return (
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">Έρχονται σύντομα</p>
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scrollbar-none">
                {events.map((c, i) => {
                    const s = styleFor(c.celebration_type);
                    const p = dateParts(c.celebration_date);
                    const rel = relativeLabel(c.celebration_date);
                    return (
                        <button
                            key={c.id}
                            onClick={() => onOpen(c.id)}
                            style={{ animationDelay: `${250 + i * 70}ms` }}
                            className={`group snap-start shrink-0 ${compact ? "w-[72vw] max-w-[260px]" : "w-60"} rounded-2xl bg-black/35 p-3 text-left text-white
                                ring-1 ring-white/20 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-black/45 animate-fade-in-up`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl shadow-lg" style={{ background: s.color }}>
                                    <span className="font-display text-xl leading-none">{p.day}</span>
                                    <span className="text-[10px] uppercase">{p.month}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-[15px]">{villageById[c.village_id]?.name}</p>
                                    <p className="flex items-center gap-1.5 text-xs text-white/80">
                                        <span className="icon-badge h-4 w-4"><img src={s.icon} alt="" className="h-3 w-3 object-contain" /></span>
                                        {s.label}{c.start_time ? ` · ${formatTime(c.start_time)}` : ""}
                                    </p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-amber-300">{rel || p.weekday}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
