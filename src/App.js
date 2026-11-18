import { useCallback, useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import EventCard from "./components/EventCard";
import EventForm from "./components/EventForm";
import EventDetail from "./components/EventDetail";
import AuthModal from "./components/AuthModal";
import AdminPanel from "./components/AdminPanel";
import NotificationsModal from "./components/NotificationsModal";
import InstallModal from "./components/InstallModal";
import Menu from "./components/Menu";
import Backdrop, { PHOTOS, useBackdropIndex } from "./components/Backdrop";
import { CELEBRATION_TYPES, REGIONS, styleFor, todayIso } from "./lib/celebrations";
import {
    checkIsAdmin, createCelebration, deleteCelebration, isDatabaseEnabled, loadAll,
    reviewCelebration, updateCelebration,
} from "./lib/data";
import { signOut, useAuth } from "./lib/useAuth";
import { useTheme } from "./lib/theme";
import { isIos, useInstallPrompt } from "./lib/pwa";

// Σε οθόνες ≥768px (md) λίστα και χάρτης φαίνονται μαζί
function useIsDesktop() {
    const query = "(min-width: 768px)";
    const [match, setMatch] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const onChange = () => setMatch(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);
    return match;
}

const normalize = (s) => (s || "").toLocaleLowerCase("el").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Εκδήλωση από τη διεύθυνση: /?e=123 ή /e/123 */
function linkedEventId() {
    const fromQuery = new URLSearchParams(window.location.search).get("e");
    const fromPath = window.location.pathname.match(/^\/e\/([\w-]+)/)?.[1];
    return fromQuery || fromPath || null;
}

function setUrlEvent(id) {
    const url = id ? `/?e=${encodeURIComponent(id)}` : "/";
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
}

const readFlag = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const writeFlag = (k) => { try { localStorage.setItem(k, "1"); } catch {} };

export default function App() {
    const user = useAuth();
    const theme = useTheme();
    const isDesktop = useIsDesktop();
    const bgIndex = useBackdropIndex();
    const installer = useInstallPrompt();

    const [villages, setVillages] = useState([]);
    const [celebrations, setCelebrations] = useState([]);
    const [source, setSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Φίλτρα
    const [mode, setMode] = useState(null); // "upcoming" | "all"
    const [search, setSearch] = useState("");
    const [types, setTypes] = useState(() => new Set(CELEBRATION_TYPES));
    const [region, setRegion] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showEmptyVillages, setShowEmptyVillages] = useState(false);

    // UI
    const [selectedVillageId, setSelectedVillageId] = useState(null);
    const [mobileView, setMobileView] = useState("list");
    const [detailId, setDetailId] = useState(null);
    const [auth, setAuth] = useState(null); // null | { reason }
    const [formFor, setFormFor] = useState(null); // null | {} (νέα) | celebration
    const [adminOpen, setAdminOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [installOpen, setInstallOpen] = useState(false);
    const [installDismissed, setInstallDismissed] = useState(() => readFlag("install_dismissed"));
    const [toast, setToast] = useState(null);

    const notify = useCallback((text) => {
        setToast({ text, key: Date.now() });
        setTimeout(() => setToast(null), 3400);
    }, []);

    const reload = useCallback(async () => {
        const result = await loadAll();
        setVillages(result.villages);
        setCelebrations(result.celebrations);
        setSource(result.source);
        setLoading(false);
        return result;
    }, []);

    // Πρώτη φόρτωση + άνοιγμα συνδέσμου εκδήλωσης
    useEffect(() => {
        reload().then(({ celebrations }) => {
            const today = todayIso();
            setMode((m) => m ?? (celebrations.some((c) => c.celebration_date >= today && c.status === "approved") ? "upcoming" : "all"));
            const linked = linkedEventId();
            const found = linked ? celebrations.find((c) => String(c.id) === linked) : null;
            if (found) {
                setDetailId(String(found.id));
                setSelectedVillageId(found.village_id);
                if (found.celebration_date < today) setMode("all");
            } else if (linked) {
                setTimeout(() => notify("Η εκδήλωση δεν βρέθηκε (ίσως διαγράφηκε)"), 300);
            }
            // Καθαρή διεύθυνση (π.χ. /e/12 → /?e=12, ή / αν δεν βρέθηκε). Το ?admin=1 μένει μέχρι να ελεγχθεί.
            if (!new URLSearchParams(window.location.search).get("admin")) setUrlEvent(found ? found.id : null);
        });
    }, [reload, notify]);

    // Μετά τη σύνδεση/αποσύνδεση: ξαναφορτώνουμε (για να φαίνονται οι δικές μας σε αναμονή) και ελέγχουμε αν είμαστε διαχειριστής
    useEffect(() => {
        if (!isDatabaseEnabled) return;
        checkIsAdmin(user).then((admin) => {
            setIsAdmin(admin);
            // Από ειδοποίηση "για έγκριση" (/?admin=1)
            if (user && new URLSearchParams(window.location.search).get("admin")) {
                if (admin) setAdminOpen(true);
                setUrlEvent(null);
            }
        });
        reload();
    }, [user, reload]);

    const villageById = useMemo(() => Object.fromEntries(villages.map((v) => [v.id, v])), [villages]);

    // Ποιες εκδηλώσεις βλέπει ο καθένας στη λίστα
    const visible = useMemo(
        () =>
            celebrations.filter((c) => {
                if (!c.status || c.status === "approved") return true;
                const mine = user && c.created_by === user.id;
                if (c.status === "pending") return mine || isAdmin;
                return mine; // απορριφθείσες: μόνο ο δημιουργός
            }),
        [celebrations, user, isAdmin]
    );

    // "Από" μόνο ή "Έως" μόνο = συγκεκριμένη ημέρα. Και τα δύο = εύρος ημερομηνιών.
    const [rangeStart, rangeEnd] = useMemo(() => {
        const from = dateFrom || dateTo;
        const to = dateTo || dateFrom;
        return from && to && from > to ? [to, from] : [from, to];
    }, [dateFrom, dateTo]);
    const hasDateFilter = Boolean(rangeStart);

    const filtered = useMemo(() => {
        const today = todayIso();
        const q = normalize(search.trim());
        return visible
            .filter((c) => {
                const d = c.celebration_date;
                const v = villageById[c.village_id];
                if (mode === "upcoming" && !hasDateFilter && d < today) return false;
                if (rangeStart && d < rangeStart) return false;
                if (rangeEnd && d > rangeEnd) return false;
                if (!types.has(c.celebration_type)) return false;
                if (region && v?.region !== region) return false;
                if (q) {
                    const hay = normalize([v?.name, c.dj, c.front_singer, c.clarinet_player, c.violin_player, c.bouzouki_player].filter(Boolean).join(" "));
                    if (!hay.includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) =>
                a.celebration_date.localeCompare(b.celebration_date) ||
                (villageById[a.village_id]?.name || "").localeCompare(villageById[b.village_id]?.name || "", "el")
            );
    }, [visible, mode, hasDateFilter, rangeStart, rangeEnd, types, region, search, villageById]);

    const eventsByVillage = useMemo(() => {
        const map = {};
        filtered.forEach((c) => (map[c.village_id] ||= []).push(c));
        return map;
    }, [filtered]);

    const mapVillages = useMemo(() => (region ? villages.filter((v) => v.region === region) : villages), [villages, region]);

    const upcomingCount = useMemo(() => {
        const today = todayIso();
        return celebrations.filter((c) => c.celebration_date >= today && (c.status ?? "approved") === "approved").length;
    }, [celebrations]);
    const pendingCount = useMemo(() => celebrations.filter((c) => c.status === "pending").length, [celebrations]);

    const toggleType = (t) =>
        setTypes((prev) => {
            const next = new Set(prev);
            next.has(t) ? next.delete(t) : next.add(t);
            return next.size === 0 ? new Set(CELEBRATION_TYPES) : next;
        });

    const clearFilters = () => {
        setSearch("");
        setDateFrom("");
        setDateTo("");
        setRegion("");
        setTypes(new Set(CELEBRATION_TYPES));
    };
    const filtersActive = Boolean(search || hasDateFilter || region || types.size !== CELEBRATION_TYPES.length);

    const canWrite = isDatabaseEnabled && source === "db";
    const detail = detailId ? celebrations.find((c) => String(c.id) === detailId) : null;

    const openDetail = (id) => {
        const c = celebrations.find((x) => String(x.id) === String(id));
        if (!c) return;
        setDetailId(String(c.id));
        setSelectedVillageId(c.village_id);
        setUrlEvent(c.id);
    };
    const closeDetail = () => {
        setDetailId(null);
        setUrlEvent(null);
    };

    const openNewEvent = () => {
        if (!user) {
            setAuth({ reason: "Για να προσθέσετε εκδήλωση, συνδεθείτε πρώτα με το email σας." });
            return;
        }
        setFormFor({});
    };

    const saveEvent = async (values) => {
        const editing = Boolean(formFor?.id);
        const saved = editing ? await updateCelebration(formFor.id, values) : await createCelebration(values);
        await reload();
        setFormFor(null);
        setMode("all");
        openDetail(saved.id);
        notify(
            saved.status === "pending"
                ? "Υποβλήθηκε ✓ Θα εμφανιστεί μόλις εγκριθεί."
                : editing ? "Η εκδήλωση ενημερώθηκε ✓" : "Η εκδήλωση δημοσιεύτηκε ✓"
        );
    };

    const removeEvent = async () => {
        await deleteCelebration(formFor.id);
        await reload();
        setFormFor(null);
        closeDetail();
        notify("Η εκδήλωση διαγράφηκε");
    };

    const review = async (c, status, note) => {
        await reviewCelebration(c.id, status, note);
        await reload();
        notify(status === "approved" ? "Εγκρίθηκε ✓ — στάλθηκαν ειδοποιήσεις" : "Απορρίφθηκε");
    };

    const install = async () => {
        if (installer.canPrompt) {
            if (await installer.install()) notify("Η εφαρμογή εγκαταστάθηκε 🎉");
        } else {
            setInstallOpen(true);
        }
    };
    const canInstall = !installer.installed && (installer.canPrompt || isIos() || !isDesktop);
    const showInstallBanner = !isDesktop && canInstall && !installDismissed && (installer.canPrompt || isIos());

    const photo = PHOTOS[bgIndex];

    return (
        <div className="relative h-[100dvh] overflow-hidden text-stone-800 dark:text-stone-100">
            <Backdrop index={bgIndex} />

            <div className="relative z-10 flex h-full flex-col pt-[env(safe-area-inset-top)]">
                {/* ---------- Κεφαλίδα ---------- */}
                <header className="relative z-20 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3 text-white">
                    <div className="animate-fade-in-down min-w-0">
                        <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-amber-200/90 truncate">
                            Αρκαδία · <span key={photo.key} className="animate-fade-in">{photo.place}</span>
                        </p>
                        <h1 className="font-display text-3xl sm:text-4xl leading-tight drop-shadow-lg truncate">Πανηγύρια Γορτυνίας</h1>
                        <p className="hidden sm:block text-sm text-white/80 mt-0.5">
                            {loading ? "Φόρτωση…" : `${upcomingCount} επερχόμενες εκδηλώσεις σε ${villages.length} χωριά`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 animate-fade-in-down" style={{ animationDelay: "120ms" }}>
                        {canWrite && (
                            <button onClick={openNewEvent} className="btn-accent" aria-label="Νέα εκδήλωση">
                                <span className="text-lg leading-none">＋</span>
                                <span className="hidden sm:inline">Νέα εκδήλωση</span>
                            </button>
                        )}
                        <button
                            onClick={() => setNotifOpen(true)}
                            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/40 hover:bg-white/30 transition"
                            aria-label="Ειδοποιήσεις"
                        >
                            🔔
                        </button>
                        <Menu
                            user={user}
                            isAdmin={isAdmin}
                            pendingCount={pendingCount}
                            dbEnabled={isDatabaseEnabled}
                            theme={theme.pref}
                            onTheme={theme.setPref}
                            canInstall={canInstall}
                            onInstall={install}
                            onNotifications={() => setNotifOpen(true)}
                            onAdmin={() => setAdminOpen(true)}
                            onSignIn={() => setAuth({})}
                            onSignOut={async () => { await signOut(); setIsAdmin(false); notify("Αποσυνδεθήκατε"); }}
                        />
                    </div>
                </header>

                {/* ---------- Κυρίως περιεχόμενο ---------- */}
                <main className="flex min-h-0 flex-1 gap-4 px-2 sm:px-4 pb-2 sm:pb-4 md:flex-row">
                    {/* Λίστα */}
                    <section
                        className={`${mobileView === "list" ? "flex" : "hidden"} md:flex w-full md:w-[420px] lg:w-[460px] shrink-0 flex-col
                            rounded-3xl bg-white/80 dark:bg-stone-950/75 backdrop-blur-xl shadow-2xl ring-1 ring-white/60 dark:ring-white/10 overflow-hidden animate-fade-in-up`}
                    >
                        <div className="space-y-3 border-b border-stone-200/70 dark:border-stone-800 p-4">
                            <div className="flex items-center gap-2">
                                <div className="relative grid flex-1 grid-cols-2 rounded-full bg-stone-200/70 dark:bg-stone-800 p-1 text-sm font-medium">
                                    <span
                                        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-stone-600 shadow transition-transform duration-300 ease-out"
                                        style={{ transform: mode === "all" ? "translateX(100%)" : "translateX(0)" }}
                                    />
                                    {[["upcoming", "Επερχόμενες"], ["all", "Όλες"]].map(([m, label]) => (
                                        <button
                                            key={m}
                                            onClick={() => setMode(m)}
                                            className={`relative z-10 rounded-full py-1.5 transition ${mode === m ? "text-stone-900 dark:text-white" : "text-stone-500 dark:text-stone-400"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowFilters((s) => !s)}
                                    className={`relative rounded-full px-3 py-2 text-sm transition ${showFilters ? "bg-stone-900 text-white dark:bg-amber-500 dark:text-stone-900" : "bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300/70"}`}
                                    aria-expanded={showFilters}
                                >
                                    Φίλτρα
                                    {filtersActive && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-stone-900" />}
                                </button>
                            </div>

                            <input
                                type="search"
                                placeholder="🔍  Χωριό ή μουσικός…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="field bg-white/90"
                            />

                            {/* Τύποι εκδήλωσης (λειτουργούν και ως υπόμνημα) */}
                            <div className="flex flex-wrap gap-1.5">
                                {CELEBRATION_TYPES.map((t) => {
                                    const s = styleFor(t);
                                    const on = types.has(t);
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => toggleType(t)}
                                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition
                                                ${on ? "text-white" : "border-stone-300 text-stone-500 bg-white dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400"}`}
                                            style={on ? { background: s.color, borderColor: s.color } : undefined}
                                            aria-pressed={on}
                                        >
                                            <span className="icon-badge h-5 w-5">
                                                <img src={s.icon} alt="" className={`w-4 h-4 object-contain ${on ? "" : "opacity-50 grayscale"}`} />
                                            </span>
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {showFilters && (
                                <div className="space-y-3 rounded-2xl bg-stone-100/80 dark:bg-stone-900 p-3 text-sm animate-fade-in-up">
                                    <label className="block">
                                        <span className="label">Περιοχή</span>
                                        <select value={region} onChange={(e) => setRegion(e.target.value)} className="field py-1.5">
                                            <option value="">Όλες οι περιοχές</option>
                                            {REGIONS.filter((r) => villages.some((v) => v.region === r)).map((r) => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="flex flex-wrap items-end gap-2">
                                        <label className="flex flex-col">
                                            <span className="label">Από</span>
                                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field py-1.5" />
                                        </label>
                                        <label className="flex flex-col">
                                            <span className="label">Έως</span>
                                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field py-1.5" />
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                                        <input
                                            type="checkbox"
                                            checked={showEmptyVillages}
                                            onChange={(e) => setShowEmptyVillages(e.target.checked)}
                                            className="h-4 w-4 accent-stone-800"
                                        />
                                        Δείξε στον χάρτη και χωριά χωρίς εκδηλώσεις
                                    </label>
                                    {filtersActive && (
                                        <button onClick={clearFilters} className="text-xs text-stone-600 dark:text-stone-400 underline">Καθαρισμός φίλτρων</button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Κάρτες */}
                        <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3 pb-24 md:pb-3">
                            {showInstallBanner && (
                                <div className="flex items-center gap-3 rounded-2xl bg-stone-900 dark:bg-stone-800 p-3 text-white animate-fade-in-up">
                                    <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
                                    <button onClick={install} className="flex-1 text-left text-sm">
                                        <strong className="block">Εγκατάσταση στο κινητό</strong>
                                        <span className="text-white/70 text-xs">Ανοίγει σαν εφαρμογή · ειδοποιήσεις</span>
                                    </button>
                                    <button
                                        onClick={() => { writeFlag("install_dismissed"); setInstallDismissed(true); }}
                                        className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10"
                                        aria-label="Απόκρυψη"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {loading && Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-24 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
                            ))}

                            {!loading && filtered.length === 0 && (
                                <div className="py-12 text-center text-stone-500 dark:text-stone-400 animate-fade-in-up">
                                    <div className="text-5xl mb-3 animate-float">🎻</div>
                                    <p className="font-medium text-stone-700 dark:text-stone-200">
                                        {mode === "upcoming" && !filtersActive ? "Δεν υπάρχουν επερχόμενες εκδηλώσεις" : "Καμία εκδήλωση με αυτά τα φίλτρα"}
                                    </p>
                                    <div className="mt-3 flex justify-center gap-2">
                                        {mode === "upcoming" && <button onClick={() => setMode("all")} className="btn-ghost text-sm">Δείξε όλες</button>}
                                        {canWrite && <button onClick={openNewEvent} className="btn-primary text-sm">＋ Προσθήκη</button>}
                                    </div>
                                </div>
                            )}

                            {!loading && filtered.map((c, i) => (
                                <EventCard
                                    key={`${c.id}-${mode}`}
                                    celebration={c}
                                    village={villageById[c.village_id]}
                                    index={i}
                                    active={c.village_id === selectedVillageId}
                                    onSelect={() => openDetail(c.id)}
                                />
                            ))}
                        </div>

                        <footer className="hidden md:block border-t border-stone-200/70 dark:border-stone-800 px-4 py-2 text-[10px] text-stone-500">
                            {source === "csv" && isDatabaseEnabled && <span className="text-amber-700">Η βάση δεν είναι διαθέσιμη — εμφανίζονται τα αρχικά δεδομένα. · </span>}
                            Φωτογραφία: {photo.place},{" "}
                            <a className="underline" href={photo.url} target="_blank" rel="noreferrer">{photo.author}</a>, {photo.license}
                        </footer>
                    </section>

                    {/* Χάρτης */}
                    <section
                        className={`${mobileView === "map" ? "block" : "hidden"} md:block relative min-h-0 flex-1 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/60 dark:ring-white/10 animate-fade-in-up`}
                        style={{ animationDelay: "150ms" }}
                    >
                        <MapView
                            villages={mapVillages}
                            eventsByVillage={eventsByVillage}
                            showEmptyVillages={showEmptyVillages}
                            selectedVillageId={selectedVillageId}
                            onSelectVillage={setSelectedVillageId}
                            onOpenEvent={openDetail}
                            visible={mobileView === "map" || isDesktop}
                        />
                    </section>
                </main>
            </div>

            {/* Εναλλαγή Λίστα/Χάρτης σε κινητό */}
            <nav className="md:hidden pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[900] flex justify-center animate-fade-in-up">
                <div className="pointer-events-auto relative grid grid-cols-2 rounded-full bg-stone-900/85 p-1 text-sm font-medium text-white shadow-2xl backdrop-blur-md ring-1 ring-white/10">
                    <span
                        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300 ease-out"
                        style={{ transform: mobileView === "map" ? "translateX(100%)" : "translateX(0)" }}
                    />
                    {[["list", "☰  Λίστα"], ["map", "🗺  Χάρτης"]].map(([v, label]) => (
                        <button
                            key={v}
                            onClick={() => setMobileView(v)}
                            className={`relative z-10 w-28 rounded-full py-2 transition ${mobileView === v ? "text-stone-900" : "text-white/80"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </nav>

            {toast && (
                <div key={toast.key} className="fixed left-1/2 top-5 z-[1200] max-w-[90vw] -translate-x-1/2 rounded-full bg-stone-900 dark:bg-white dark:text-stone-900 px-5 py-2.5 text-center text-sm text-white shadow-2xl animate-toast">
                    {toast.text}
                </div>
            )}

            {detail && (
                <EventDetail
                    celebration={detail}
                    village={villageById[detail.village_id]}
                    isAdmin={isAdmin}
                    canEdit={canWrite && user && (detail.created_by === user.id || isAdmin)}
                    onEdit={() => { setFormFor(detail); closeDetail(); }}
                    onShowOnMap={() => { const v = detail.village_id; closeDetail(); setMobileView("map"); setSelectedVillageId(null); setTimeout(() => setSelectedVillageId(v), 0); }}
                    onReview={review}
                    onClose={closeDetail}
                    notify={notify}
                />
            )}
            {auth && <AuthModal reason={auth.reason} onClose={() => setAuth(null)} />}
            {formFor && (
                <EventForm
                    villages={villages}
                    initial={formFor}
                    isAdmin={isAdmin}
                    onSubmit={saveEvent}
                    onDelete={removeEvent}
                    onClose={() => setFormFor(null)}
                />
            )}
            {adminOpen && (
                <AdminPanel
                    celebrations={celebrations}
                    villageById={villageById}
                    onReview={review}
                    onOpen={(c) => { setAdminOpen(false); openDetail(c.id); }}
                    onClose={() => setAdminOpen(false)}
                />
            )}
            {notifOpen && (
                <NotificationsModal
                    villages={villages}
                    preselectVillageId={detail?.village_id}
                    onClose={() => setNotifOpen(false)}
                    notify={notify}
                />
            )}
            {installOpen && <InstallModal onClose={() => setInstallOpen(false)} />}
        </div>
    );
}
