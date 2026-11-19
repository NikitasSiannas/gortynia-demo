import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/** Παρακολουθεί τον συνδεδεμένο χρήστη. ready = false μέχρι να ελεγχθεί η αποθηκευμένη σύνδεση. */
export function useAuth() {
    const [state, setState] = useState({ user: null, ready: !supabase });

    useEffect(() => {
        if (!supabase) return;
        supabase.auth.getSession().then(({ data }) => setState({ user: data.session?.user ?? null, ready: true }));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setState({ user: session?.user ?? null, ready: true });
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    return state;
}

// Μετά τη σύνδεση επιστρέφουμε εκεί που ήταν ο χρήστης (π.χ. σε κοινοποιημένη εκδήλωση /?e=12)
const returnUrl = () => window.location.origin + window.location.pathname + window.location.search;

/** Στέλνει email με σύνδεσμο (και 6ψήφιο κωδικό, αν το template το περιέχει). */
export async function sendLoginEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: returnUrl() },
    });
    if (error) throw error;
}

/** type: "email" για σύνδεση, "email_change" όταν ο επισκέπτης προσθέτει email */
export async function verifyLoginCode(email, token, type = "email") {
    const { error } = await supabase.auth.verifyOtp({ email, token, type });
    if (error) throw error;
}

/** Είσοδος ως επισκέπτης (ανώνυμος λογαριασμός Supabase): δεν χρειάζεται email. */
export async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
}

/** Ο επισκέπτης προσθέτει email: ο ίδιος λογαριασμός γίνεται κανονικός (κρατά τις καταχωρήσεις του). */
export async function linkEmail(email) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: returnUrl() });
    if (error) throw error;
}

export const isGuestUser = (user) => Boolean(user?.is_anonymous);

// Η σύνδεση με Google εμφανίζεται μόνο αν ενεργοποιηθεί (REACT_APP_GOOGLE_LOGIN=1 και ρύθμιση στο Supabase)
export const googleEnabled = process.env.REACT_APP_GOOGLE_LOGIN === "1";

export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: returnUrl(), queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
}

export async function signOut() {
    await supabase.auth.signOut();
}
