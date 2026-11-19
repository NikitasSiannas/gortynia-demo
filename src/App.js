import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView";
import EventCard from "./components/EventCard";
import EventForm from "./components/EventForm";
import EventDetail from "./components/EventDetail";
import AuthModal from "./components/AuthModal";
import AdminPanel from "./components/AdminPanel";
import NotificationsModal from "./components/NotificationsModal";
import InstallModal from "./components/InstallModal";
import QrModal from "./components/QrModal";
import Menu from "./components/Menu";
import Welcome from "./components/Welcome";
import Featured from "./components/Featured";
import Gallery from "./components/Gallery";
import Backdrop, { PHOTOS, useBackdropIndex } from "./components/Backdrop";
import { CELEBRATION_TYPES, PREFECTURES, styleFor, todayIso } from "./lib/celebrations";
import {
    checkIsAdmin, createCelebration, deleteCelebration, isDatabaseEnabled, loadAll, loadMusicians,
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
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Παρασκευή–Κυριακή αυτής της εβδομάδας (ή από σήμερα, αν είμαστε ήδη στο Σαββατοκύριακο). */
function weekendRange() {
    const now = new Date();
    const dow = now.getDay(); // 0 = Κυριακή
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dow >= 1 && dow <= 4) start.setDate(start.getDate() + (5 - dow));
    const end = new Date(start);
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
    return [iso(start), iso(end)];
}

/** Εκδήλωση από τη διεύθυνση: /?e=123 ή /e/123 */
function linkedEventId() {
    const fromQuery = new URLSearchParams(window.location.search).get("e");
    const fromPath = window.location.pathname.match(/^\/e\/([\w-]+)/)?.[1];
    return fromQuery || fromPath || null;
}

function setUrlEvent(id) {
    const url = id ? `/?e=${encodeURIComponent(id)}` : "/";
    // Κρατάμε το state του ιστορικού (π.χ. "ανοιχτό παράθυρο"), αλλάζουμε μόνο τη διεύθυνση
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
}

const readFlag = (k, store = localStorage) => { try { return store.getItem(k) === "1"; } catch { return false; } };
const writeFlag = (k, store = localStorage) => { try { store.setItem(k, "1"); } catch {} };

export default function App() {
    const { user, ready } = useAuth();
    const theme = useTheme();
    const isDesktop = useIsDesktop();
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [bgIndex, setBgIndex] = useBackdropIndex(galleryOpen);
    const installer = useInstallPrompt();
    const listScrollRef = useRef(null);

    const [villages, setVillages] = useState([]);
    const [celebrations, setCelebrations] = useState([]);
    const [musicians, setMusicians] = useState([]);
    const [source, setSource] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [guest, setGuest] = useState(() => readFlag("guest", sessionStorage));

    // Φίλτρα
    const [mode, setMode] = useState(null); // "upcoming" | "weekend" | "all"
    const [search, setSearch] = useState("");
    const [types, setTypes] = useState(() => new Set(CELEBRATION_TYPES));
    const [prefecture, setPrefecture] = useState("");
    const [region, setRegion] = useState(""); // δήμος
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
    const [qrOpen, setQrOpen] = useState(false);
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
    const reloadMusicians = useCallback(async () => setMusicians(await loadMusicians()), []);

    // Πρώτη φόρτωση + άνοιγμα συνδέσμου εκδήλωσης (μία φορά, ακόμα και με το διπλό mount του StrictMode)
    const initDone = useRef(false);
    useEffect(() => {
        if (initDone.current) return;
        initDone.current = true;
        reload().then(({ celebrations }) => {
            const today = todayIso();
            setMode((m) => m ?? (celebrations.some((c) => c.celebration_date >= today && (c.status ?? "approved") === "approved") ? "upcoming" : "all"));
            const linked = linkedEventId();
            const found = linked ? celebrations.find((c) => String(c.id) === linked) : null;
            if (found) {
                setDetailId(String(found.id));
                setSelectedVillageId(found.village_id);
                if (found.celebration_date < today) setMode("all");
            } else if (linked) {
                setTimeout(() => notify("Η εκδήλωση δεν βρέθηκε (ίσως διαγράφηκε)"), 300);
            }
            // Η αρχική εγγραφή του ιστορικού μένει "/"· το ?e=… μπαίνει στην εγγραφή της καρτέλας (βλ. παρακάτω),
            // ώστε το ✕ ή το "Πίσω" να επιστρέφουν σε καθαρή αρχική σελίδα.
            if (!new URLSearchParams(window.location.search).get("admin")) setUrlEvent(null);
        });
    }, [reload, notify]);

    // Η διεύθυνση δείχνει την ανοιχτή εκδήλωση (για αντιγραφή/ανανέωση). Τρέχει μετά το pushState της καρτέλας.
    useEffect(() => {
        if (detailId) setUrlEvent(detailId);
    }, [detailId]);

    // Μετά τη σύνδεση/αποσύνδεση: ξαναφόρτωση (για τις δικές μας σε αναμονή), μουσικοί, έλεγχος διαχειριστή
    useEffect(() => {
        if (!isDatabaseEnabled || !ready) return;
        checkIsAdmin(user).then((admin) => {
            setIsAdmin(admin);
            if (user && new URLSearchParams(window.location.search).get("admin")) {
                if (admin) setAdminOpen(true);
                setUrlEvent(null);
            }
        });
        if (user) {
            reload();
            reloadMusicians();
        }
    }, [user, ready, reload, reloadMusicians]);

    const villageById = useMemo(() => Object.fromEntries(villages.map((v) => [v.id, v])), [villages]);

    // Ποιες εκδηλώσεις βλέπει ο καθένας
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

    // "Από" μόνο ή "Έως" μόνο = συγκεκριμένη ημέρα. Και τα δύο = εύρος. Το "Σαββατοκύριακο" ορίζει δικό του εύρος.
    const [rangeStart, rangeEnd] = useMemo(() => {
        if (mode === "weekend") return weekendRange();
        const from = dateFrom || dateTo;
        const to = dateTo || dateFrom;
        return from && to && from > to ? [to, from] : [from, to];
    }, [dateFrom, dateTo, mode]);
    const hasDateFilter = Boolean(dateFrom || dateTo);

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
                if (prefecture && v?.prefecture !== prefecture) return false;
                if (region && v?.region !== region) return false;
                if (q) {
                    const hay = normalize([v?.name, v?.region, v?.prefecture, c.dj, c.front_singer, c.clarinet_player, c.violin_player, c.bouzouki_player].filter(Boolean).join(" "));
                    if (!hay.includes(q)) return false;
                }
                return true;
            })
            .sort((a, b) =>
                a.celebration_date.localeCompare(b.celebration_date) ||
                (villageById[a.village_id]?.name || "").localeCompare(villageById[b.village_id]?.name || "", "el")
            );
    }, [visible, mode, hasDateFilter, rangeStart, rangeEnd, types, prefecture, region, search, villageById]);

    const eventsByVillage = useMemo(() => {
        const map = {};
        filtered.forEach((c) => (map[c.village_id] ||= []).push(c));
        return map;
    }, [filtered]);

    const mapVillages = useMemo(
        () => villages.filter((v) => (!prefecture || v.prefecture === prefecture) && (!region || v.region === region)),
        [villages, prefecture, region]
    );
    // Δήμοι του επιλεγμένου νομού (για το φίλτρο)
    const municipalities = useMemo(
        () => [...new Set(villages.filter((v) => v.prefecture === prefecture && v.region).map((v) => v.region))].sort((a, b) => a.localeCompare(b, "el")),
        [villages, prefecture]
    );

    const upcoming = useMemo(() => {
        const today = todayIso();
        return visible
            .filter((c) => c.celebration_date >= today && (c.status ?? "approved") === "approved")
            .sort((a, b) => a.celebration_date.localeCompare(b.celebration_date));
    }, [visible]);
    const pendingCount = useMemo(
        () => celebrations.filter((c) => c.status === "pending").length + musicians.filter((m) => m.status === "pending").length,
        [celebrations, musicians]
    );

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
        setPrefecture("");
        setRegion("");
        setTypes(new Set(CELEBRATION_TYPES));
    };
    const filtersActive = Boolean(search || hasDateFilter || prefecture || region || types.size !== CELEBRATION_TYPES.length);

    const canWrite = isDatabaseEnabled && source === "db" && Boolean(user);
    const detail = detailId ? celebrations.find((c) => String(c.id) === detailId) : null;

    const openDetail = (id) => {
        const c = celebrations.find((x) => String(x.id) === String(id));
        if (!c) return;
        setDetailId(String(c.id));
        setSelectedVillageId(c.village_id);
    };
    const closeDetail = () => setDetailId(null);

    /** Επιστροφή στην αρχική: κλείνουν όλα, λίστα από την αρχή, αρχικά φίλτρα. */
    const goHome = () => {
        setDetailId(null);
        setFormFor(null);
        setAdminOpen(false);
        setNotifOpen(false);
        setQrOpen(false);
        setInstallOpen(false);
        setGalleryOpen(false);
        setAuth(null);
        setSelectedVillageId(null);
        setMobileView("list");
        setShowFilters(false);
        clearFilters();
        setMode(upcoming.length ? "upcoming" : "all");
        setUrlEvent(null);
        setTimeout(() => listScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 30);
    };

    const openNewEvent = () => {
        if (!user) {
            setAuth({ reason: "Για να προσθέσετε εκδήλωση, συνδεθείτε πρώτα." });
            return;
        }
        setFormFor({});
    };

    const saveEvent = async (values) => {
        const editing = Boolean(formFor?.id);
        const saved = editing ? await updateCelebration(formFor.id, values, musicians) : await createCelebration(values, musicians);
        await Promise.all([reload(), reloadMusicians()]);
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

    // ---------- Οθόνη υποδοχής / σύνδεσης ----------
    const splash = isDatabaseEnabled && !ready;
    const needsLogin = isDatabaseEnabled ? ready && !user : !guest;
    const gallery = galleryOpen && <Gallery index={bgIndex} setIndex={setBgIndex} onClose={() => setGalleryOpen(false)} />;

    if (splash || needsLogin) {
        return (
            <div className="relative h-[100dvh] overflow-hidden text-stone-800 dark:text-stone-100">
                <Backdrop index={bgIndex} />
                {gallery}
                {splash ? (
                    <div className="relative z-10 flex h-full items-center justify-center">
                        <img src="/icon-192.png" alt="" className="h-20 w-20 rounded-3xl shadow-2xl animate-pulse" />
                    </div>
                ) : (
                    <Welcome
                        photo={photo}
                        upcoming={upcoming}
                        villageById={villageById}
                        linked={detail}
                        stats={loading ? null : { upcoming: upcoming.length, villages: villages.length }}
                        dbEnabled={isDatabaseEnabled}
                        onGuest={() => { writeFlag("guest", sessionStorage); setGuest(true); }}
                        onGallery={() => setGalleryOpen(true)}
                    />
                )}
            </div>
        );
    }

    // ---------- Κομμάτια της κεντρικής οθόνης ----------
    const header = (
        <header className="relative z-20 flex items-center justify-between gap-2 px-4 sm:px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-2 text-white">
            {/* Logo + τίτλος = κουμπί "Αρχική" */}
            <button onClick={goHome} className="group flex min-w-0 items-center gap-2.5 text-left animate-fade-in-down" aria-label="Αρχική">
                <img src="/icon-192.png" alt="" className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-xl shadow-lg ring-1 ring-white/30 transition group-hover:scale-105 group-active:scale-95" />
                <div className="min-w-0">
                    <h1 className="font-display text-[1.6rem] sm:text-3xl leading-none drop-shadow-lg truncate">Πάμε Πανηγύρι</h1>
                    <p className="mt-1 text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-amber-200/90 truncate">
                        <span key={photo.key} className="animate-fade-in">{photo.region} · {photo.place}</span>
                    </p>
                </div>
            </button>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 animate-fade-in-down" style={{ animationDelay: "120ms" }}>
                {canWrite && (
                    <button onClick={openNewEvent} className="btn-accent px-3 sm:px-4" aria-label="Νέα εκδήλωση">
                        <span className="text-lg leading-none">＋</span>
                        <span className="hidden sm:inline">Νέα εκδήλωση</span>
                    </button>
                )}
                <button
                    onClick={() => setGalleryOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/40 hover:bg-white/30 transition"
                    aria-label="Φωτογραφίες"
                    title="Δείτε τις φωτογραφίες"
                >
                    🖼️
                </button>
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
                    onQr={() => setQrOpen(true)}
                    onHome={goHome}
                    onGallery={() => setGalleryOpen(true)}
                    onLinkEmail={() => setAuth({ mode: "link", reason: "Προσθέστε email για να μπαίνετε από οποιαδήποτε συσκευή. Ό,τι έχετε καταχωρήσει μένει στον λογαριασμό σας." })}
                    onSignIn={() => setAuth({})}
                    onSignOut={async () => { await signOut(); setIsAdmin(false); notify("Αποσυνδεθήκατε"); }}
                />
            </div>
        </header>
    );

    const heroText = (
        <p className="text-sm text-white/85 drop-shadow animate-fade-in-up">
            {loading ? "Φόρτωση…" : <>🎉 <strong>{upcoming.length}</strong> επερχόμενες εκδηλώσεις · 📍 <strong>{villages.length}</strong> χωριά</>}
        </p>
    );

    const filters = (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="relative grid flex-1 grid-cols-3 rounded-full bg-stone-200/80 dark:bg-stone-800 p-1 text-[13px] font-medium">
                    <span
                        className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-white dark:bg-stone-600 shadow transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(${({ upcoming: 0, weekend: 100, all: 200 })[mode] ?? 0}%)` }}
                    />
                    {[["upcoming", "Επερχόμενες"], ["weekend", "Σαβ/κο"], ["all", "Όλες"]].map(([m, label]) => (
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
                    className={`relative rounded-full px-3 py-2 text-sm transition ${showFilters ? "bg-stone-900 text-white dark:bg-amber-500 dark:text-stone-900" : "bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300/70"}`}
                    aria-expanded={showFilters}
                >
                    Φίλτρα
                    {filtersActive && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-stone-900" />}
                </button>
            </div>

            <input type="search" placeholder="🔍  Χωριό ή μουσικός…" value={search} onChange={(e) => setSearch(e.target.value)} className="field" />

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
                    <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                            <span className="label">Νομός</span>
                            <select value={prefecture} onChange={(e) => { setPrefecture(e.target.value); setRegion(""); }} className="field py-1.5">
                                <option value="">Όλη η Πελοπόννησος</option>
                                {PREFECTURES.filter((p) => villages.some((v) => v.prefecture === p)).map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="label">Δήμος</span>
                            <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={!prefecture} className="field py-1.5 disabled:opacity-50">
                                <option value="">{prefecture ? "Όλοι οι δήμοι" : "— επιλέξτε νομό —"}</option>
                                {municipalities.map((r) => <option key={r} value={r}>{r.replace(/^Δήμος /, "")}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col">
                            <span className="label">Από</span>
                            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (mode === "weekend") setMode("all"); }} className="field py-1.5" />
                        </label>
                        <label className="flex flex-col">
                            <span className="label">Έως</span>
                            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); if (mode === "weekend") setMode("all"); }} className="field py-1.5" />
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                        <input type="checkbox" checked={showEmptyVillages} onChange={(e) => setShowEmptyVillages(e.target.checked)} className="h-4 w-4 accent-stone-800" />
                        Δείξε στον χάρτη και χωριά χωρίς εκδηλώσεις
                    </label>
                    {filtersActive && <button onClick={clearFilters} className="text-xs text-stone-600 dark:text-stone-400 underline">Καθαρισμός φίλτρων</button>}
                </div>
            )}
        </div>
    );

    const cards = (
        <div className="space-y-2.5">
            {showInstallBanner && (
                <div className="flex items-center gap-3 rounded-2xl bg-stone-900 dark:bg-stone-800 p-3 text-white animate-fade-in-up">
                    <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
                    <button onClick={install} className="flex-1 text-left text-sm">
                        <strong className="block">Εγκατάσταση στο κινητό</strong>
                        <span className="text-white/70 text-xs">Ανοίγει σαν εφαρμογή · ειδοποιήσεις</span>
                    </button>
                    <button onClick={() => { writeFlag("install_dismissed"); setInstallDismissed(true); }} className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10" aria-label="Απόκρυψη">✕</button>
                </div>
            )}

            {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />)}

            {!loading && filtered.length === 0 && (
                <div className="py-12 text-center text-stone-500 dark:text-stone-400 animate-fade-in-up">
                    <div className="text-5xl mb-3 animate-float">🎻</div>
                    <p className="font-medium text-stone-700 dark:text-stone-200">
                        {mode === "weekend" ? "Τίποτα αυτό το Σαββατοκύριακο" : mode === "upcoming" && !filtersActive ? "Δεν υπάρχουν επερχόμενες εκδηλώσεις" : "Καμία εκδήλωση με αυτά τα φίλτρα"}
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                        {mode !== "all" && <button onClick={() => setMode("all")} className="btn-ghost text-sm">Δείξε όλες</button>}
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
    );

    const credit = (
        <span>
            {source === "csv" && isDatabaseEnabled && <span className="text-amber-700">Η βάση δεν είναι διαθέσιμη — εμφανίζονται τα αρχικά δεδομένα. · </span>}
            Φωτογραφία: {photo.place}, <a className="underline" href={photo.url} target="_blank" rel="noreferrer">{photo.author}</a>, {photo.license}
        </span>
    );

    const map = (
        <MapView
            villages={mapVillages}
            eventsByVillage={eventsByVillage}
            showEmptyVillages={showEmptyVillages}
            selectedVillageId={selectedVillageId}
            onSelectVillage={setSelectedVillageId}
            onOpenEvent={openDetail}
            fitKey={`${prefecture}|${region}`}
            visible
        />
    );

    return (
        <div className="relative h-[100dvh] overflow-hidden text-stone-800 dark:text-stone-100">
            <Backdrop index={bgIndex} />

            {isDesktop ? (
                // ---------- Υπολογιστής: εξώφυλλο με φωτογραφία, από κάτω λίστα + χάρτης ----------
                <div className="relative z-10 flex h-full flex-col">
                    {header}
                    <div className="px-6 pb-4 space-y-3">
                        {heroText}
                        <div className="hidden [@media(min-height:760px)]:block">
                            <Featured events={upcoming.slice(0, 8)} villageById={villageById} onOpen={openDetail} />
                        </div>
                    </div>
                    <main className="flex min-h-0 flex-1 gap-5 px-6 pb-6">
                        <section className="flex w-[430px] lg:w-[460px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] bg-white/80 dark:bg-stone-950/80 backdrop-blur-lg shadow-2xl ring-1 ring-white/50 dark:ring-white/10 animate-fade-in-up">
                            <div className="border-b border-stone-200/70 dark:border-stone-800 p-4">{filters}</div>
                            <div ref={listScrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3">{cards}</div>
                            <footer className="border-t border-stone-200/70 dark:border-stone-800 px-4 py-2 text-[10px] text-stone-500">{credit}</footer>
                        </section>
                        <section className="relative min-h-0 flex-1 overflow-hidden rounded-[1.75rem] shadow-2xl ring-4 ring-white/25 dark:ring-white/10 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
                            {map}
                        </section>
                    </main>
                </div>
            ) : mobileView === "list" ? (
                // ---------- Κινητό, λίστα: φωτογραφία πάνω, η λίστα ανεβαίνει σαν φύλλο ----------
                <div ref={listScrollRef} className="relative z-10 h-full overflow-y-auto overscroll-contain">
                    {header}
                    <div className="space-y-4 px-4 pb-6 pt-3">
                        {heroText}
                        <Featured events={upcoming.slice(0, 8)} villageById={villageById} onOpen={openDetail} compact />
                    </div>
                    <section className="min-h-[100dvh] rounded-t-[2rem] bg-white/90 dark:bg-stone-950/90 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.25)] animate-sheet-up">
                        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />
                        <div className="sticky top-0 z-10 rounded-t-[2rem] bg-white/95 dark:bg-stone-950/95 backdrop-blur px-4 pt-3 pb-3 border-b border-stone-200/60 dark:border-stone-800">
                            {filters}
                        </div>
                        <div className="p-3 pb-28">{cards}</div>
                        <p className="px-4 pb-24 -mt-20 text-center text-[10px] text-stone-500">{credit}</p>
                    </section>
                </div>
            ) : (
                // ---------- Κινητό, χάρτης ----------
                <div className="relative z-10 flex h-full flex-col">
                    {header}
                    <section className="relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/20 animate-fade-in">
                        {map}
                    </section>
                </div>
            )}

            {/* Εναλλαγή Λίστα/Χάρτης σε κινητό */}
            {!isDesktop && (
                <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[900] flex justify-center animate-fade-in-up">
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
            )}

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
                    canEdit={canWrite && (detail.created_by === user?.id || isAdmin)}
                    onEdit={() => { setFormFor(detail); closeDetail(); }}
                    onShowOnMap={() => { const v = detail.village_id; closeDetail(); setMobileView("map"); setSelectedVillageId(null); setTimeout(() => setSelectedVillageId(v), 0); }}
                    onReview={review}
                    onClose={closeDetail}
                    notify={notify}
                />
            )}
            {auth && <AuthModal reason={auth.reason} mode={auth.mode} onClose={() => setAuth(null)} />}
            {formFor && (
                <EventForm
                    villages={villages}
                    musicians={musicians}
                    initial={formFor}
                    isAdmin={isAdmin}
                    isGuest={Boolean(user?.is_anonymous)}
                    onSubmit={saveEvent}
                    onDelete={removeEvent}
                    onClose={() => setFormFor(null)}
                />
            )}
            {adminOpen && (
                <AdminPanel
                    celebrations={celebrations}
                    villageById={villageById}
                    musicians={musicians}
                    onMusiciansChanged={reloadMusicians}
                    currentEmail={user?.email}
                    onReview={review}
                    onOpen={(c) => { setAdminOpen(false); openDetail(c.id); }}
                    onClose={() => setAdminOpen(false)}
                />
            )}
            {notifOpen && <NotificationsModal villages={villages} preselectVillageId={detail?.village_id} onClose={() => setNotifOpen(false)} notify={notify} />}
            {installOpen && <InstallModal onClose={() => setInstallOpen(false)} />}
            {qrOpen && <QrModal onClose={() => setQrOpen(false)} notify={notify} />}
            {gallery}
        </div>
    );
}
