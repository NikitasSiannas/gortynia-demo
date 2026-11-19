// GET /e/:id  (μέσω vercel.json → /api/share?id=:id)
// Σελίδα για κοινοποίηση: το Facebook/Viber διαβάζουν τα og: tags για την προεπισκόπηση,
// ενώ ο άνθρωπος μεταφέρεται αμέσως στην εφαρμογή με ανοιχτή την εκδήλωση.
const { SITE, TYPE_LABEL, publicClient, formatDateEl, escapeHtml } = require("./_lib");

module.exports = async (req, res) => {
    const id = String(req.query.id || "").replace(/\D/g, "");
    const appUrl = id ? `/?e=${id}` : "/";
    let title = "Πάμε Πανηγύρι";
    let description = "Πανηγύρια, λαϊκές βραδιές & πάρτυ στα χωριά της Πελοποννήσου.";

    try {
        const db = publicClient();
        if (db && id) {
            const { data } = await db
                .from("celebrations")
                .select("celebration_type, celebration_date, start_time, front_singer, clarinet_player, violin_player, bouzouki_player, dj, villages(name)")
                .eq("id", id)
                .maybeSingle();
            if (data) {
                title = `${TYPE_LABEL[data.celebration_type] || data.celebration_type} · ${data.villages?.name || ""}`;
                const who = [
                    data.front_singer && `🎤 ${data.front_singer}`,
                    data.clarinet_player && `Κλαρίνο: ${data.clarinet_player}`,
                    data.violin_player && `Βιολί: ${data.violin_player}`,
                    data.bouzouki_player && `Μπουζούκι: ${data.bouzouki_player}`,
                    data.dj && `DJ ${data.dj}`,
                ].filter(Boolean).join(" · ");
                description = `📅 ${formatDateEl(data.celebration_date)}${data.start_time ? `, ${data.start_time.slice(0, 5)}` : ""}${who ? ` — ${who}` : ""}`;
            }
        }
    } catch (err) {
        console.error(err);
    }

    const shareUrl = `${SITE}/e/${id}`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(`<!doctype html>
<html lang="el"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Πάμε Πανηγύρι">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:locale" content="el_GR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
<script>location.replace(${JSON.stringify(appUrl)});</script>
</head><body style="font-family:system-ui;background:#1c1917;color:#fff;text-align:center;padding:3rem">
<p>${escapeHtml(title)}</p><p><a style="color:#fbbf24" href="${appUrl}">Άνοιγμα στην εφαρμογή</a></p>
</body></html>`);
};
