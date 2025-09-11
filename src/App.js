import { useEffect, useState, useRef } from "react";
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

    // Φόρτωσε δεδομένα από Supabase
    useEffect(() => {
        const fetchVillages = async () => {
            let { data, error } = await supabase
                .from("Villages")
                .select("village_name, village_lat, village_lon, id");
            if (error) {
                console.error(error);
            } else {
                console.log(data); // δες τι επιστρέφει η βάση
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
                        key={v.id}
                        className="mb-4 border-b pb-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                        onClick={() =>
                            setSelectedPosition([v.village_lat, v.village_lon])
                        }
                    >
                        <h2 className="font-semibold">{v.village_name}</h2>
                        <p>📍 Συντεταγμένες: {v.village_lat}, {v.village_lon}</p>
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
                            key={v.id}
                            position={[v.village_lat, v.village_lon]}
                            icon={musicIcon}
                        >
                            <Popup>
                                <strong>{v.village_name}</strong>
                            </Popup>
                        </Marker>
                    ))}
                    {selectedPosition && <MapMover position={selectedPosition} />}
                </MapContainer>
            </div>
        </div>
    );
}
