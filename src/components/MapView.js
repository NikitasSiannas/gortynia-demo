import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { CELEBRATION_TYPES, daysFromToday, formatDate, formatTime, styleFor } from "../lib/celebrations";

const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const iconCache = new Map();
function markerIcon(type, { soon, active, empty }) {
    const key = `${type}|${soon}|${active}|${empty}`;
    if (iconCache.has(key)) return iconCache.get(key);
    let icon;
    if (empty) {
        icon = L.divIcon({ className: "", html: `<div class="village-dot"></div>`, iconSize: [12, 12], iconAnchor: [6, 6], popupAnchor: [0, -6] });
    } else {
        const s = styleFor(type);
        const size = active ? 46 : 36;
        icon = L.divIcon({
            className: "",
            html: `<div class="event-marker ${active ? "is-active" : ""}" style="--c:${s.color}; width:${size}px; height:${size}px;">
                ${soon ? `<span class="event-marker-ring"></span>` : ""}
                ${s.icon ? `<img src="${s.icon}" alt="" />` : "📍"}
            </div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2],
        });
    }
    iconCache.set(key, icon);
    return icon;
}

// Ομάδα σημαδιών: αριθμός + δακτύλιος με την αναλογία των τύπων εκδήλωσης
function clusterIcon(cluster) {
    const counts = Object.fromEntries(CELEBRATION_TYPES.map((t) => [t, 0]));
    let total = 0;
    cluster.getAllChildMarkers().forEach((m) => {
        if (m.options.ctype && counts[m.options.ctype] != null) {
            counts[m.options.ctype]++;
            total++;
        }
    });
    let acc = 0;
    const stops = total
        ? CELEBRATION_TYPES.filter((t) => counts[t]).map((t) => {
              const from = (acc / total) * 360;
              acc += counts[t];
              return `${styleFor(t).color} ${from}deg ${(acc / total) * 360}deg`;
          }).join(", ")
        : "#a8a29e 0deg 360deg";
    const n = cluster.getChildCount();
    const size = n < 10 ? 40 : n < 30 ? 48 : 56;
    return L.divIcon({
        className: "",
        html: `<div class="event-cluster" style="width:${size}px;height:${size}px;background:conic-gradient(${stops})"><span>${n}</span></div>`,
        iconSize: [size, size],
    });
}

function popupHtml(village, events) {
    const rows = events.length
        ? events.map((c) => {
              const s = styleFor(c.celebration_type);
              return `<button type="button" class="popup-event" data-event-id="${esc(c.id)}" style="border-color:${s.color}">
                  <span class="popup-type" style="color:${s.color}">${esc(s.label || c.celebration_type)}</span>
                  <span class="popup-date">📅 ${esc(formatDate(c.celebration_date, { weekday: "short" }))}${c.start_time ? ` · ${esc(formatTime(c.start_time))}` : ""}</span>
                  ${c.status === "pending" ? `<span class="popup-pending">⏳ σε αναμονή</span>` : ""}
              </button>`;
          }).join("")
        : `<div class="popup-empty">Δεν υπάρχουν εκδηλώσεις</div>`;
    return `<div class="popup"><div class="popup-title">${esc(village.name)}</div>${village.region || village.prefecture ? `<div class="popup-region">${esc([village.region, village.prefecture].filter(Boolean).join(" · "))}</div>` : ""}${rows}</div>`;
}

function ClusterLayer({ villages, eventsByVillage, showEmptyVillages, selectedVillageId, onSelectVillage, onOpenEvent, visible }) {
    const map = useMap();
    const groupRef = useRef(null);
    const markersRef = useRef({});
    const handlers = useRef({ onSelectVillage, onOpenEvent });
    handlers.current = { onSelectVillage, onOpenEvent };

    useEffect(() => {
        const group = L.markerClusterGroup({
            iconCreateFunction: clusterIcon,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            disableClusteringAtZoom: 12,
            maxClusterRadius: 50,
        });
        group.on("popupopen", (e) => {
            const el = e.popup.getElement();
            el?.querySelectorAll("[data-event-id]").forEach((btn) =>
                btn.addEventListener("click", () => handlers.current.onOpenEvent(btn.dataset.eventId))
            );
        });
        map.addLayer(group);
        groupRef.current = group;
        return () => {
            map.removeLayer(group);
        };
    }, [map]);

    useEffect(() => {
        const group = groupRef.current;
        group.clearLayers();
        const markers = {};
        const list = [];
        villages.forEach((v) => {
            const events = eventsByVillage[v.id] || [];
            if (events.length === 0 && !showEmptyVillages) return;
            // Το εικονίδιο δείχνει την επόμενη εκδήλωση· αν όλες πέρασαν, την πιο πρόσφατη
            const next = events.find((c) => daysFromToday(c.celebration_date) >= 0) || events[events.length - 1];
            const d = next ? daysFromToday(next.celebration_date) : -1;
            const m = L.marker([v.lat, v.lon], {
                icon: markerIcon(next?.celebration_type, { soon: d >= 0 && d <= 7, active: v.id === selectedVillageId, empty: !next }),
                ctype: next?.celebration_type,
                zIndexOffset: v.id === selectedVillageId ? 1000 : next ? 100 : 0,
                keyboard: true,
                title: v.name,
            });
            m.bindPopup(popupHtml(v, events), { maxWidth: 260 });
            m.on("click", () => handlers.current.onSelectVillage(v.id));
            markers[v.id] = m;
            list.push(m);
        });
        group.addLayers(list);
        markersRef.current = markers;
    }, [villages, eventsByVillage, showEmptyVillages, selectedVillageId]);

    // Πτήση στο επιλεγμένο χωριό (ανοίγει και η ομάδα αν χρειάζεται).
    // Μόνο όταν ο χάρτης φαίνεται: κρυμμένος (κινητό, καρτέλα Λίστα) έχει μέγεθος 0 και η πτήση αποτυγχάνει.
    useEffect(() => {
        const m = markersRef.current[selectedVillageId];
        if (!m || !visible) return;
        const t = setTimeout(() => {
            map.invalidateSize();
            const size = map.getSize();
            if (!size.x || !size.y) return;
            map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 13), { duration: 1.1 });
            map.once("moveend", () => groupRef.current?.zoomToShowLayer(m, () => m.openPopup()));
        }, 80);
        return () => clearTimeout(t);
    }, [selectedVillageId, visible, map]);

    return null;
}

// Όταν ο χάρτης εμφανίζεται (αλλαγή καρτέλας σε κινητό) πρέπει να ξαναμετρήσει το μέγεθός του.
// Την πρώτη φορά ζουμάρει ώστε να χωράνε όλα τα χωριά.
function SizeAndFit({ villages, visible, hasTarget }) {
    const map = useMap();
    const fitted = useRef(false);
    useEffect(() => {
        if (!visible) return;
        const t = setTimeout(() => {
            map.invalidateSize();
            if (!map.getSize().x) return;
            if (!fitted.current && villages.length && !hasTarget) {
                map.fitBounds(villages.map((v) => [v.lat, v.lon]), { padding: [30, 30] });
            }
            if (villages.length) fitted.current = true;
        }, 80);
        return () => clearTimeout(t);
    }, [villages, visible, hasTarget, map]);
    return null;
}

// Όταν αλλάζει το φίλτρο νομού/δήμου, ζουμάρουμε στην περιοχή
function FitOnFilter({ villages, fitKey, visible }) {
    const map = useMap();
    const last = useRef(fitKey);
    useEffect(() => {
        if (!visible || last.current === fitKey || villages.length === 0) return;
        last.current = fitKey;
        map.flyToBounds(villages.map((v) => [v.lat, v.lon]), { padding: [30, 30], duration: 0.9 });
    }, [fitKey, villages, visible, map]);
    return null;
}

export default function MapView(props) {
    const { villages, visible, selectedVillageId, fitKey } = props;
    const hasTarget = useMemo(() => villages.some((v) => v.id === selectedVillageId), [villages, selectedVillageId]);

    return (
        <MapContainer center={[37.6, 22.2]} zoom={9} className="h-full w-full" zoomControl={false} zoomSnap={0.25}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            <SizeAndFit villages={villages} visible={visible} hasTarget={hasTarget} />
            <FitOnFilter villages={villages} fitKey={fitKey} visible={visible} />
            <ClusterLayer {...props} />
        </MapContainer>
    );
}
