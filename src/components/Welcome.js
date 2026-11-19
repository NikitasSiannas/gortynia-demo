import { AuthForm } from "./AuthModal";
import { dateParts, formatDate, formatTime, styleFor } from "../lib/celebrations";

/**
 * Αρχική οθόνη: μεγάλη φωτογραφία χωριού, οι επόμενες εκδηλώσεις και σύνδεση (Google / email).
 * Αν ο επισκέπτης ήρθε από κοινοποιημένο σύνδεσμο, του δείχνουμε ποια εκδήλωση του έστειλαν.
 */
export default function Welcome({ photo, upcoming, villageById, linked, stats, dbEnabled, onGuest, onGallery }) {
    const linkedVillage = linked ? villageById[linked.village_id] : null;
    const linkedStyle = linked ? styleFor(linked.celebration_type) : null;

    return (
        <div className="relative z-10 h-full overflow-y-auto overscroll-contain">
            {/* Πού είναι η φωτογραφία του φόντου — διακριτικά, πάνω δεξιά */}
            <p className="pointer-events-none absolute right-4 top-[calc(0.6rem+env(safe-area-inset-top))] max-w-[60%] truncate text-right text-[10px] uppercase tracking-[0.2em] text-white/45 drop-shadow sm:right-6">
                <span key={photo.key} className="animate-fade-in">📷 {photo.place} · {photo.region}</span>
            </p>
            <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] md:flex-row md:items-center md:gap-14 md:px-10 short:!gap-6 short:!pt-[calc(1.5rem+env(safe-area-inset-top))] short:!pb-6">
                {/* Αριστερά: τίτλος & επόμενες εκδηλώσεις */}
                <div className="min-w-0 flex-1 text-white">
                    <div className="mt-6 flex items-center gap-4 sm:gap-5 animate-fade-in-up">
                        <img src="/icon-192.png" alt="" className="h-20 w-20 shrink-0 rounded-3xl shadow-xl ring-1 ring-white/30 sm:h-24 sm:w-24 lg:h-28 lg:w-28 short:!h-16 short:!w-16" />
                        <h1 className="font-display text-5xl leading-[1.0] drop-shadow-xl sm:text-7xl lg:text-8xl short:!text-5xl">
                            Πάμε<br />Πανηγύρι
                        </h1>
                    </div>
                    <p className="mt-4 max-w-md text-lg text-white/85 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                        Πανηγύρια, λαϊκές βραδιές και πάρτυ σε όλη την Πελοπόννησο — σε έναν χάρτη.
                    </p>
                    {stats && (
                        <div className="mt-5 flex flex-wrap gap-2 text-sm animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                            <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur ring-1 ring-white/25">🎉 {stats.upcoming} επερχόμενες</span>
                            <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur ring-1 ring-white/25">📍 {stats.villages} χωριά</span>
                            <button onClick={onGallery} className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur ring-1 ring-white/25 hover:bg-white/25 transition">
                                🖼️ Φωτογραφίες
                            </button>
                        </div>
                    )}

                    {upcoming.length > 0 && (
                        <div className="mt-6 md:mt-8 animate-fade-in-up" style={{ animationDelay: "280ms" }}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">Έρχονται σύντομα</p>
                            <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 scrollbar-none md:mx-0 md:px-0">
                                {upcoming.slice(0, 3).map((c, i) => {
                                    const s = styleFor(c.celebration_type);
                                    const p = dateParts(c.celebration_date);
                                    return (
                                        <div key={c.id} className="w-40 shrink-0 snap-start rounded-2xl bg-black/30 p-3 md:w-44 backdrop-blur-md ring-1 ring-white/15 animate-fade-in-up" style={{ animationDelay: `${350 + i * 90}ms` }}>
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-lg px-2 py-1 text-center text-xs font-bold leading-tight" style={{ background: s.color }}>
                                                    {p.day}<br />{p.month}
                                                </span>
                                                <span className="icon-badge h-7 w-7"><img src={s.icon} alt="" className="h-5 w-5 object-contain" /></span>
                                            </div>
                                            <p className="mt-2 truncate font-semibold">{villageById[c.village_id]?.name}</p>
                                            <p className="text-xs text-white/70">{s.label}{c.start_time ? ` · ${formatTime(c.start_time)}` : ""}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Δεξιά: σύνδεση */}
                <div className="w-full md:w-[400px] md:shrink-0 short:md:!w-[360px] animate-pop-in" style={{ animationDelay: "150ms" }}>
                    {linked && (
                        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-xl backdrop-blur dark:bg-stone-900/90 dark:text-stone-100">
                            <span className="icon-badge h-11 w-11 border-[3px]" style={{ borderColor: linkedStyle.color }}>
                                <img src={linkedStyle.icon} alt="" className="h-7 w-7 object-contain" />
                            </span>
                            <div className="min-w-0 text-sm">
                                <p className="text-xs text-stone-500">Σας έστειλαν:</p>
                                <p className="truncate font-semibold">{linkedStyle.label} · {linkedVillage?.name}</p>
                                <p className="text-stone-600 dark:text-stone-300">{formatDate(linked.celebration_date, { year: undefined })}</p>
                            </div>
                        </div>
                    )}
                    <div className="rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:bg-stone-900/95 dark:text-stone-100">
                        <h2 className="font-display text-2xl text-stone-900 dark:text-white">Καλώς ήρθατε</h2>
                        <p className="mb-5 mt-1 text-sm text-stone-600 dark:text-stone-300">
                            {linked ? "Μπείτε με email ή ως επισκέπτης για να δείτε την εκδήλωση." : "Μπείτε με το email σας ή ως επισκέπτης."}
                        </p>
                        {dbEnabled ? (
                            <AuthForm />
                        ) : (
                            <div className="space-y-3">
                                <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                                    Δοκιμαστική λειτουργία: η σύνδεση θα ενεργοποιηθεί μόλις ρυθμιστεί η βάση δεδομένων.
                                </p>
                                <button onClick={onGuest} className="btn-primary w-full">👋 Συνέχεια ως επισκέπτης (demo)</button>
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-center text-[11px] text-white/60">
                        Φωτογραφία: {photo.place}, {photo.author} · {photo.license}
                    </p>
                </div>
            </div>
        </div>
    );
}
