import { useState } from "react";
import Modal from "./Modal";
import { googleEnabled, linkEmail, sendLoginEmail, signInAsGuest, signInWithGoogle, verifyLoginCode } from "../lib/useAuth";

function GoogleLogo() {
    return (
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
    );
}

const friendly = (err) => {
    const m = err?.message || "";
    if (err?.status === 429 || /rate limit/i.test(m)) return "Πολλές προσπάθειες σε λίγο χρόνο. Δοκιμάστε ξανά σε λίγα λεπτά.";
    if (/anonymous sign-ins are disabled/i.test(m)) return "Η είσοδος ως επισκέπτης δεν έχει ενεργοποιηθεί ακόμα στη βάση.";
    if (/provider is not enabled/i.test(m)) return "Η σύνδεση με Google δεν έχει ενεργοποιηθεί ακόμα. Χρησιμοποιήστε το email σας.";
    if (/already (been )?registered|already exists/i.test(m)) return "Αυτό το email χρησιμοποιείται ήδη. Αποσυνδεθείτε και μπείτε με «Σύνδεση με email».";
    return m || "Κάτι πήγε στραβά.";
};

/**
 * Φόρμα σύνδεσης: email (σύνδεσμος ή 6ψήφιος κωδικός) ή είσοδος ως επισκέπτης.
 * mode="link": ο επισκέπτης προσθέτει email στον λογαριασμό του (κρατά ό,τι έχει καταχωρήσει).
 */
export function AuthForm({ onDone, allowGuest = true, mode = "login" }) {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState("email"); // email → sent
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const linking = mode === "link";

    const run = async (fn) => {
        setBusy(true);
        setError("");
        try {
            await fn();
        } catch (err) {
            setError(friendly(err));
        } finally {
            setBusy(false);
        }
    };

    const guest = () => run(async () => {
        await signInAsGuest();
        onDone?.();
    });

    const send = (e) => {
        e.preventDefault();
        run(async () => {
            if (linking) await linkEmail(email.trim());
            else await sendLoginEmail(email.trim());
            setStep("sent");
        });
    };

    const verify = (e) => {
        e.preventDefault();
        run(async () => {
            try {
                await verifyLoginCode(email.trim(), code.trim(), linking ? "email_change" : "email");
            } catch {
                throw new Error("Ο κωδικός δεν είναι σωστός ή έληξε.");
            }
            onDone?.();
        });
    };

    if (step === "sent") {
        return (
            <form onSubmit={verify} className="space-y-4 animate-fade-in-up">
                <div className="text-center py-1">
                    <div className="text-5xl mb-2 animate-float">✉️</div>
                    <p className="text-stone-700 dark:text-stone-200">Στείλαμε email στο <strong>{email}</strong>.</p>
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
                    {busy ? "Έλεγχος…" : "Επιβεβαίωση κωδικού"}
                </button>
                <button
                    type="button"
                    onClick={() => { setStep("email"); setCode(""); setError(""); }}
                    className="w-full text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                    Άλλο email
                </button>
            </form>
        );
    }

    return (
        <div className="space-y-4">
            {googleEnabled && !linking && (
                <button
                    type="button"
                    onClick={() => run(signInWithGoogle)}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-3 rounded-full border border-stone-300 bg-white px-5 py-3 font-semibold text-stone-800
                        shadow-sm transition hover:bg-stone-50 hover:shadow active:scale-[0.98] disabled:opacity-60
                        dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
                >
                    <GoogleLogo /> Συνέχεια με Google
                </button>
            )}

            <form onSubmit={send} className="space-y-3">
                <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="το-email-σας@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                    aria-label="Email"
                />
                <button type="submit" disabled={busy} className="btn-primary w-full">
                    {busy ? "Μισό λεπτό…" : linking ? "Προσθήκη email" : "✉️ Σύνδεση με email"}
                </button>
            </form>

            {allowGuest && !linking && (
                <>
                    <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-stone-400">
                        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" /> ή <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
                    </div>
                    <button type="button" onClick={guest} disabled={busy} className="btn-ghost w-full border border-stone-300 dark:border-stone-600">
                        👋 Συνέχεια ως επισκέπτης
                    </button>
                    <p className="text-center text-xs text-stone-500 dark:text-stone-400">
                        Ως επισκέπτης βλέπετε τα πάντα, παίρνετε ειδοποιήσεις και προτείνετε εκδηλώσεις. Μπορείτε να προσθέσετε email αργότερα.
                    </p>
                </>
            )}
            {linking && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                    Θα λάβετε email επιβεβαίωσης. Οι εκδηλώσεις και οι ειδοποιήσεις σας μένουν στον λογαριασμό.
                </p>
            )}
            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        </div>
    );
}

export default function AuthModal({ onClose, reason, mode = "login" }) {
    return (
        <Modal title={mode === "link" ? "Προσθήκη email" : "Σύνδεση"} onClose={onClose}>
            {reason && (
                <p className="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{reason}</p>
            )}
            <AuthForm onDone={onClose} mode={mode} />
        </Modal>
    );
}
