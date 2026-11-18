// Καλείται κάθε πρωί από το Vercel Cron (vercel.json): υπενθύμιση για τις αυριανές εκδηλώσεις.
const { TYPE_LABEL, adminClient, sendPush, subscribersForVillage } = require("./_lib");

function athensDate(offsetDays) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(d); // YYYY-MM-DD
}

module.exports = async (req, res) => {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "unauthorized" });
    }
    try {
        const db = adminClient();
        const tomorrow = athensDate(1);
        const { data: events, error } = await db
            .from("celebrations")
            .select("id, village_id, celebration_type, start_time, villages(name)")
            .eq("status", "approved")
            .eq("celebration_date", tomorrow);
        if (error) throw error;

        let sent = 0;
        for (const c of events) {
            const subs = await subscribersForVillage(db, c.village_id);
            sent += await sendPush(db, subs, {
                title: `Αύριο: ${TYPE_LABEL[c.celebration_type] || c.celebration_type} · ${c.villages?.name || ""}`,
                body: c.start_time ? `Ξεκινά στις ${c.start_time.slice(0, 5)}` : "Μην το χάσετε!",
                url: `/?e=${c.id}`,
                tag: `reminder-${c.id}`,
            });
        }
        return res.json({ date: tomorrow, events: events.length, sent });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
