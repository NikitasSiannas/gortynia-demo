/* Service worker: λειτουργία χωρίς σύνδεση (βασική) και ειδοποιήσεις push. */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(PAGES_CACHE).then((c) => c.addAll(["/", "/manifest.json", "/icon-192.png"])).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // Supabase, χάρτες κ.λπ. πάνε κατευθείαν στο δίκτυο
    if (url.pathname.startsWith("/api/")) return;

    // Σελίδες: πρώτα δίκτυο (για να βλέπουμε πάντα την τελευταία έκδοση), αλλιώς από την cache
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(PAGES_CACHE).then((c) => c.put("/", copy));
                    return res;
                })
                .catch(() => caches.match("/"))
        );
        return;
    }

    // Αρχεία της εφαρμογής (JS/CSS με hash, εικόνες): πρώτα cache
    if (url.pathname.startsWith("/static/") || /\.(png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then(
                (hit) =>
                    hit ||
                    fetch(req).then((res) => {
                        if (res.ok) {
                            const copy = res.clone();
                            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
                        }
                        return res;
                    })
            )
        );
        return;
    }

    // Δεδομένα (CSV): πρώτα δίκτυο, αλλιώς cache
    if (url.pathname.endsWith(".csv")) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req))
        );
    }
});

// ---------- Ειδοποιήσεις ----------
self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: "Πανηγύρια Γορτυνίας", body: event.data && event.data.text() };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || "Πανηγύρια Γορτυνίας", {
            body: data.body || "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: data.tag,
            data: { url: data.url || "/" },
            lang: "el",
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
            const open = wins.find((w) => w.url.startsWith(self.location.origin));
            if (open) {
                open.navigate(target);
                return open.focus();
            }
            return self.clients.openWindow(target);
        })
    );
});
