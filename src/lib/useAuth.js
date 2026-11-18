import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/** Παρακολουθεί τον συνδεδεμένο χρήστη (null αν δεν είναι συνδεδεμένος). */
export function useAuth() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (!supabase) return;
        supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    return user;
}

/** Στέλνει email με σύνδεσμο (και 6ψήφιο κωδικό, αν το template το περιέχει). */
export async function sendLoginEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
}

export async function verifyLoginCode(email, token) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
}

export async function signOut() {
    await supabase.auth.signOut();
}
