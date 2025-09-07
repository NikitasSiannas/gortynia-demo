import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function App() {
    const [events, setEvents] = useState([
        {
            id: 1,
            village: "Βυτίνα",
            date: "2025-09-15",
            group: "Ορχήστρα Γορτυνίας",
            artists: ["Γιάννης Παπαδόπουλος", "Μαρία Κωνσταντίνου"],
            position: [37.6712, 22.1826],
        },
        {
            id: 2,
            village: "Δημητσάνα",
            date: "2025-09-20",
            group: "Παραδοσιακή Κομπανία",
            artists: ["Κώστας Νικολάου"],
            position: [37.5961, 22.0396],
        },
        {
            id: 3,
            village: "Ελληνικό",
            date: "2025-09-22",
            group: "Παραδοσιακή Ορχήστρα",
            artists: ["Γιώργος Παπαδόπουλος", "Ελένη Κωνσταντίνου"],
            position: [37.6788, 22.1270],
        },
        {
            id: 4,
            village: "Αράχωβα",
            date: "2025-09-25",
            group: "Λαϊκή Ορχήστρα",
            artists: ["Αλέξανδρος Νικολάου", "Μαρία Παπαδοπούλου"],
            position: [37.6115, 21.9888],
        },
        {
            id: 5,
            village: "Μαγούλιανα",
            date: "2025-09-28",
            group: "Ορχήστρα Παράδοσης",
            artists: ["Κώστας Παπαδόπουλος", "Αντωνία Κωνσταντίνου"],
            position: [37.6788, 22.1270],
        },
        {
            id: 6,
            village: "Στεμνίτσα",
            date: "2025-10-05",
            group: "Παραδοσιακή Μουσική",
            artists: ["Γιάννης Νικολάου", "Ελένη Παπαδοπούλου"],
            position: [37.5564, 22.0828],
        },
    ]);

    const musicIcon = new L.Icon({
        iconUrl: "/mark.png", // από τον φάκελο public
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    });

    // Συνάρτηση για ενημέρωση συντεταγμένων στο state μετά το drag
    const handleDragEnd = (event, id) => {
        const marker = event.target;
        const newPos = marker.getLatLng();
        console.log(`Νέες συντεταγμένες για το marker ${id}:`, newPos.lat, newPos.lng);

        // Προαιρετικά: ενημέρωση state για να αποθηκευτούν οι νέες συντεταγμένες
        setEvents((prevEvents) =>
            prevEvents.map((e) =>
                e.id === id ? { ...e, position: [newPos.lat, newPos.lng] } : e
            )
        );
    };

    return (
        <div className="flex flex-col md:flex-row h-screen">
            {/* Sidebar με λίστα εκδηλώσεων */}
            <div className="w-full md:w-1/3 bg-white shadow-lg p-4 overflow-y-auto">
                <h1 className="text-xl font-bold mb-4">Πανηγύρια Γορτυνίας</h1>
                {events.map((e) => (
                    <div key={e.id} className="mb-4 border-b pb-2">
                        <h2 className="font-semibold">{e.village}</h2>
                        <p>📅 {e.date}</p>
                        <p>🎶 {e.group}</p>
                        <p>👤 {e.artists.join(", ")}</p>
                        <p>📍 Συντεταγμένες: {e.position[0].toFixed(4)}, {e.position[1].toFixed(4)}</p>
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
                    {events.map((e) => (
                        <Marker
                            key={e.id}
                            position={e.position}
                            icon={musicIcon}
                            draggable={true}
                            eventHandlers={{
                                dragend: (event) => handleDragEnd(event, e.id),
                            }}
                        >
                            <Popup>
                                <strong>{e.village}</strong>
                                <br />📅 {e.date}
                                <br />🎶 {e.group}
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
