import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "./supabaseClient";

// Custom icon για τα markers
const musicIcon = new L.Icon({
    iconUrl: "/mark.png",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

// Component για να κινείται ο χάρτης στις συντεταγμένες
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

    // Φόρτωσε δεδομένα από Supabase (Villages + Festivals)
    useEffect(() => {
        const fetchVillages = async () => {
            let { data, error } = await supabase
                .from("Villages")
                .select(`
          village_id,
          village_name,
          village_lat,
          village_lon,
          Festivals (
            festival_id,
            festival_type,
            festival_date
          )
        `);

            if (error) {
                console.error(error);
            } else {
                console.log("Villages + Festivals:", data);
                setVillages(data);
            }
        };
        fetchVillages();
    }, []);

    return (
        <div className="flex flex-col md:flex-row h-screen">
            {/* Sidebar */}
            <div className="w-full md:w-1/3 bg-white shadow-lg p-4 overflow-y-auto">
                <h1 className="text-xl font-bold mb-4">Χωριά Γορτυνίας</h1>
                {villages.map((v) => (
                    <div
                        key={v.village_id}
                        className="mb-4 border-b pb-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                        onClick={() =>
                            setSelectedPosition([v.village_lat, v.village_lon])
                        }
                    >
                        <h2 className="font-semibold">{v.village_name}</h2>
                        <p>📍 Συντεταγμένες: {v.village_lat}, {v.village_lon}</p>

                        {v.Festivals && v.Festivals.length > 0 ? (
                            v.Festivals.map((f) => (
                                <div key={f.festival_id} className="mt-2 text-sm text-gray-700">
                                    🎉 {f.festival_type} —{" "}
                                    {new Date(f.festival_date).toLocaleDateString("el-GR")}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500">Δεν υπάρχουν εκδηλώσεις</p>
                        )}
                    </div>
                ))}
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
                            key={v.village_id}
                            position={[v.village_lat, v.village_lon]}
                            icon={musicIcon}
                        >
                            <Popup>
                                <strong>{v.village_name}</strong>
                                <br />
                                📍 {v.village_lat}, {v.village_lon}
                                <br />
                                {v.Festivals && v.Festivals.length > 0 ? (
                                    v.Festivals.map((f) => (
                                        <div key={f.festival_id}>
                                            🎉 {f.festival_type} —{" "}
                                            {new Date(f.festival_date).toLocaleDateString("el-GR")}
                                        </div>
                                    ))
                                ) : (
                                    "Δεν υπάρχουν εκδηλώσεις"
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