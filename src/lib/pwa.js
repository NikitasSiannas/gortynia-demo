import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

/** Κουμπί "Εγκατάσταση": σε Android/Chrome χρησιμοποιεί το επίσημο παράθυρο του browser. */
export function useInstallPrompt() {
    const [deferred, setDeferred] = useState(null);
    const [installed, setInstalled] = useState(isStandalone());

    useEffect(() => {
        const onPrompt = (e) => {
            e.preventDefault();
            setDeferred(e);
        };
        const onInstalled = () => {
            setInstalled(true);
            setDeferred(null);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const install = async () => {
        if (!deferred) return false;
        deferred.prompt();
        const { outcome } = await deferred.userChoice;
        setDeferred(null);
        return outcome === "accepted";
    };

    return { canPrompt: Boolean(deferred), installed, install };
}

// ---------- Ειδοποιήσεις (Web Push) ----------

export function pushSupport() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return isIos() && !isStandalone() ? "ios-install" : "unsupported";
    }
    if (!VAPID_PUBLIC_KEY || !supabase) return "not-configured";
    if (process.env.NODE_ENV !== "production") return "dev";
    return "ok";
}

function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
    if (pushSupport() !== "ok") return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

export function savedVillageIds() {
    try {
        const v = JSON.parse(localStorage.getItem("push_villages") || "null");
        return Array.isArray(v) ? v : null;
    } catch {
        return null;
    }
}

/** villageIds: null = όλα τα χωριά */
export async function subscribePush(villageIds) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Δεν δόθηκε άδεια για ειδοποιήσεις.");
    const reg = await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_village_ids: villageIds && villageIds.length ? villageIds : null,
    });
    if (error) throw error;
    try {
        localStorage.setItem("push_villages", JSON.stringify(villageIds && villageIds.length ? villageIds : null));
    } catch {}
}

export async function unsubscribePush() {
    const sub = await currentSubscription();
    if (!sub) return;
    await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
    try {
        localStorage.removeItem("push_villages");
    } catch {}
}
