import { useState } from "react";
import Modal from "./Modal";
import { sendLoginEmail, verifyLoginCode } from "../lib/useAuth";

export default function AuthModal({ onClose, reason }) {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState("email"); // email → sent
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const send = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await sendLoginEmail(email.trim());
            setStep("sent");
        } catch (err) {
            setError(
                err.status === 429
                    ? "Στάλθηκαν πολλά email σε λίγο χρόνο. Δοκιμάστε ξανά σε λίγα λεπτά."
                    : err.message || "Κάτι πήγε στραβά."
            );
        } finally {
            setBusy(false);
        }
    };

    const verify = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await verifyLoginCode(email.trim(), code.trim());
            onClose();
        } catch (err) {
            setError("Ο κωδικός δεν είναι σωστός ή έληξε.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="Σύνδεση" onClose={onClose}>
            {step === "email" ? (
                <form onSubmit={send} className="space-y-4">
                    {reason && (
                        <p className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{reason}</p>
                    )}
                    <p className="text-stone-600 dark:text-stone-300 text-sm">
                        Γράψτε το email σας και θα σας στείλουμε σύνδεσμο για να μπείτε. Χωρίς κωδικό πρόσβασης.
                    </p>
                    <input
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        placeholder="το-email-σας@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="field"
                    />
                    {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
                    <button type="submit" disabled={busy} className="btn-primary w-full">
                        {busy ? "Αποστολή…" : "Στείλε μου σύνδεσμο"}
                    </button>
                </form>
            ) : (
                <form onSubmit={verify} className="space-y-4 animate-fade-in-up">
                    <div className="text-center py-2">
                        <div className="text-5xl mb-2 animate-float">✉️</div>
                        <p className="text-stone-700 dark:text-stone-200">
                            Στείλαμε email στο <strong>{email}</strong>.
                        </p>
                        <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                            Πατήστε τον σύνδεσμο από αυτή τη συσκευή — ή γράψτε εδώ τον 6ψήφιο κωδικό του email:
                        </p>
                    </div>
                    <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        maxLength={10}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        className="field text-center tracking-[0.5em] text-lg"
                    />
                    {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
                    <button type="submit" disabled={busy || code.length < 6} className="btn-primary w-full">
                        {busy ? "Έλεγχος…" : "Σύνδεση με κωδικό"}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setStep("email"); setCode(""); setError(""); }}
                        className="w-full text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                    >
                        Άλλο email
                    </button>
                </form>
            )}
        </Modal>
    );
}
