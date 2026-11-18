import Modal from "./Modal";
import { isIos } from "../lib/pwa";

export default function InstallModal({ onClose }) {
    return (
        <Modal title="Εγκατάσταση εφαρμογής" onClose={onClose}>
            <div className="space-y-4 text-sm text-stone-700 dark:text-stone-200">
                <div className="flex items-center gap-3">
                    <img src="/icon-192.png" alt="" className="h-14 w-14 rounded-2xl shadow" />
                    <p>Βάλτε τα Πανηγύρια στην αρχική οθόνη του κινητού — ανοίγει σαν κανονική εφαρμογή, σε πλήρη οθόνη.</p>
                </div>
                {isIos() ? (
                    <ol className="list-decimal pl-5 space-y-1.5">
                        <li>Ανοίξτε τη σελίδα στο <strong>Safari</strong></li>
                        <li>Πατήστε <strong>Κοινοποίηση</strong> (το τετράγωνο με το βέλος ⬆️)</li>
                        <li>Επιλέξτε <strong>Προσθήκη στην οθόνη Αφετηρίας</strong></li>
                    </ol>
                ) : (
                    <ol className="list-decimal pl-5 space-y-1.5">
                        <li>Ανοίξτε το μενού του browser (⋮ πάνω δεξιά)</li>
                        <li>Επιλέξτε <strong>Εγκατάσταση εφαρμογής</strong> ή <strong>Προσθήκη στην αρχική οθόνη</strong></li>
                    </ol>
                )}
                <button onClick={onClose} className="btn-primary w-full">Εντάξει</button>
            </div>
        </Modal>
    );
}
