import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CELEBRATION_STYLE = {
    "Πανηγύρι": { icon: "/clarinet.png", color: "#2f6b3a", label: "Πανηγύρι" },
    "Λαική Βραδιά": { icon: "/bouzouki.png", color: "#a15c1f", label: "Λαική Βραδιά" },
    "Πάρτυ Νεολαίας": { icon: "/discoball.png", color: "#5b3fa8", label: "Πάρτυ Νεολαίας" },
};
const DEFAULT_STYLE = { emoji: "📍", color: "#555", label: "" };

function celebrationIcon(type) {
    const style = CELEBRATION_STYLE[type] || DEFAULT_STYLE;
    const content = style.icon
        ? `<img src="${style.icon}" style="width: 22px; height: 22px; object-fit: contain;" alt="" />`
        : style.emoji;
    return L.divIcon({
        className: "",
        html: `<div style="
            width: 34px; height: 34px; border-radius: 50%;
            background: ${style.color}; border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; line-height: 1;
        ">${content}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
    });
}

function formatDate(isoDate) {
    if (!isoDate) return "";
    return new Date(isoDate).toLocaleDateString("el-GR", {
        day: "numeric", month: "long", year: "numeric",
    });
}

// Ελάχιστος CSV parser: αρκετός για τα δικά μας αρχεία (χωρίς κόμματα μέσα σε πεδία)
function parseCsv(text) {
    const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
        const cells = line.split(",");
        const row = {};
        headers.forEach((h, i) => {
            row[h.trim()] = (cells[i] || "").trim();
        });
        return row;
    });
}

function MapMover({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.setView(position, 13, { animate: true });
        }
    }, [position, map]);
    return null;
}

export default function App() {
    const [villages, setVillages] = useState([]);
    const [selectedPosition, setSelectedPosition] = useState(null);

    useEffect(() => {
        const load = async () => {
            const [villagesRes, celebrationsRes] = await Promise.all([
                fetch("/gortynia_villages_with_coords2.csv"),
                fetch("/gortynia_celebrations.csv"),
            ]);
            const [villagesRows, celebrationRows] = await Promise.all([
                villagesRes.text().then(parseCsv),
                celebrationsRes.text().then(parseCsv),
            ]);

            const celebrationsByVillage = {};
            celebrationRows.forEach((c) => {
                celebrationsByVillage[c.village_name] = c;
            });

            const merged = villagesRows
                .filter((v) => v.village_name && v.village_lat && v.village_lon)
                .map((v) => ({
                    id: v.id,
                    name: v.village_name,
                    lat: parseFloat(v.village_lat),
                    lon: parseFloat(v.village_lon),
                    celebration: celebrationsByVillage[v.village_name] || null,
                }));

            setVillages(merged);
        };
        load();
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-screen">
            {/* Sidebar */}
            <div className="w-full md:w-1/3 bg-white shadow-lg p-4 overflow-y-auto">
                <h1 className="text-xl font-bold mb-4">Χωριά Γορτυνίας</h1>
                {villages.map((v) => {
                    const style = v.celebration
                        ? CELEBRATION_STYLE[v.celebration.celebration_type] || DEFAULT_STYLE
                        : DEFAULT_STYLE;
                    return (
                        <div
                            key={v.id}
                            className="mb-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:shadow transition"
                            onClick={() => setSelectedPosition([v.lat, v.lon])}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-gray-800">{v.name}</h2>
                                {v.celebration && (
                                    <span
                                        className="text-xs font-medium text-white px-2 py-1 rounded-full flex items-center gap-1"
                                        style={{ backgroundColor: style.color }}
                                    >
                                        {style.icon ? (
                                            <img src={style.icon} alt="" className="w-4 h-4 object-contain" />
                                        ) : (
                                            <span>{style.emoji}</span>
                                        )}
                                        {style.label}
                                    </span>
                                )}
                            </div>
                            {v.celebration ? (
                                <div className="mt-2 text-sm text-gray-600 space-y-0.5">
                                    <p>📅 {formatDate(v.celebration.celebration_date)}</p>
                                    <p>🎤 Τραγουδιστής: {v.celebration.front_singer}</p>
                                    <p className="flex items-center gap-1">
                                        <img src="/clarinet.png" alt="Κλαρίνο" className="w-4 h-4 object-contain" />
                                        Κλαρίνο: {v.celebration.clarinet_player}
                                    </p>
                                    <p className="flex items-center gap-1">
                                        <img src="/violin.png" alt="Βιολί" className="w-4 h-4 object-contain" />
                                        Βιολί: {v.celebration.violin_player}
                                    </p>
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-gray-400">Δεν υπάρχουν εκδηλώσεις</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Χάρτης */}
            <div className="flex-1">
                <MapContainer center={[37.65, 22.1]} zoom={10} className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {villages.map((v) => (
                        <Marker
                            key={v.id}
                            position={[v.lat, v.lon]}
                            icon={celebrationIcon(v.celebration?.celebration_type)}
                            eventHandlers={{
                                mouseover: (e) => e.target.openPopup(),
                                mouseout: (e) => e.target.closePopup(),
                            }}
                        >
                            <Popup>
                                <strong>{v.name}</strong>
                                {v.celebration ? (
                                    <div className="text-sm mt-1">
                                        <div className="flex items-center gap-1">
                                            {CELEBRATION_STYLE[v.celebration.celebration_type]?.icon ? (
                                                <img
                                                    src={CELEBRATION_STYLE[v.celebration.celebration_type].icon}
                                                    alt=""
                                                    className="w-4 h-4 object-contain"
                                                />
                                            ) : (
                                                <span>{CELEBRATION_STYLE[v.celebration.celebration_type]?.emoji}</span>
                                            )}
                                            {v.celebration.celebration_type}
                                        </div>
                                        <div>📅 {formatDate(v.celebration.celebration_date)}</div>
                                        <div>🎤 {v.celebration.front_singer}</div>
                                        <div className="flex items-center gap-1">
                                            <img src="/clarinet.png" alt="Κλαρίνο" className="w-4 h-4 object-contain" />
                                            Κλαρίνο: {v.celebration.clarinet_player}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <img src="/violin.png" alt="Βιολί" className="w-4 h-4 object-contain" />
                                            Βιολί: {v.celebration.violin_player}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm mt-1">Δεν υπάρχουν εκδηλώσεις</div>
                                )}
                            </Popup>
                        </Marker>
                    ))}

                    {selectedPosition && <MapMover position={selectedPosition} />}
                </MapContainer>
            </div>
        </div>
    );
}
