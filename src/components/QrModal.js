import Modal from "./Modal";
import { SITE_URL } from "../lib/celebrations";

/** QR & σύνδεσμος για να μοιραστεί κάποιος την εφαρμογή (π.χ. σε φίλο δίπλα του ή σε αφίσα). */
export default function QrModal({ onClose, notify }) {
    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: "Πάμε Πανηγύρι", text: "Όλα τα πανηγύρια της Πελοποννήσου σε έναν χάρτη", url: SITE_URL });
                return;
            } catch (e) {
                if (e.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(SITE_URL);
            notify("Ο σύνδεσμος αντιγράφηκε ✓");
        } catch {
            window.prompt("Αντιγράψτε τον σύνδεσμο:", SITE_URL);
        }
    };

    return (
        <Modal title="Μοιραστείτε την εφαρμογή" onClose={onClose}>
            <div className="space-y-4 text-center">
                <img src="/qr.png" alt={`QR code για ${SITE_URL}`} className="mx-auto w-64 rounded-2xl shadow-lg ring-1 ring-black/5" />
                <p className="text-sm text-stone-600 dark:text-stone-300">Σκανάρετε με την κάμερα του κινητού — ανοίγει πάντα την τελευταία έκδοση.</p>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={share} className="btn-primary">📤 Κοινοποίηση</button>
                    <a href="/qr.png" download="pame-panigyri-qr.png" className="btn-ghost">⬇️ Λήψη QR</a>
                </div>
            </div>
        </Modal>
    );
}
