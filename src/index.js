import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Service worker: εγκατάσταση σαν εφαρμογή + ειδοποιήσεις.
// Μόνο στην έκδοση παραγωγής, για να μη μπερδεύει την cache όσο γράφουμε κώδικα.
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker:", err));
    });
}
