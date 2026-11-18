// POST /api/notify   { celebration_id, kind: "approved" | "pending" }
// "approved": ο διαχειριστής ενέκρινε → ειδοποίηση σε όσους ακολουθούν το χωριό.
// "pending":  ένας χρήστης πρόσθεσε εκδήλωση → ειδοποίηση στους διαχειριστές.
const { TYPE_LABEL, adminClient, userFromRequest, isAdminEmail, formatDateEl, sendPush, subscribersForVillage } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "POST μόνο" });
    try {
        const user = await userFromRequest(req);
        if (!user) return res.status(401).json({ error: "Χρειάζεται σύνδεση" });

        const { celebration_id, kind } = req.body || {};
        const db = adminClient();
        const { data: c, error } = await db
            .from("celebrations")
            .select("id, village_id, celebration_type, celebration_date, start_time, status, created_by, created_by_email, submitter_comment, villages(name)")
            .eq("id", celebration_id)
            .single();
        if (error || !c) return res.status(404).json({ error: "Δεν βρέθηκε" });

        const label = TYPE_LABEL[c.celebration_type] || c.celebration_type;
        const village = c.villages?.name || "";
        const when = `${formatDateEl(c.celebration_date)}${c.start_time ? `, ${c.start_time.slice(0, 5)}` : ""}`;

        if (kind === "approved") {
            if (!(await isAdminEmail(db, user.email))) return res.status(403).json({ error: "Μόνο διαχειριστές" });
            if (c.status !== "approved") return res.status(400).json({ error: "Η εκδήλωση δεν είναι εγκεκριμένη" });
            const subs = await subscribersForVillage(db, c.village_id);
            const sent = await sendPush(db, subs, {
                title: `Νέο: ${label} · ${village}`,
                body: `📅 ${when}`,
                url: `/?e=${c.id}`,
                tag: `event-${c.id}`,
            });
            return res.json({ sent });
        }

        if (kind === "pending") {
            if (c.created_by !== user.id || c.status !== "pending") return res.status(403).json({ error: "Όχι" });
            const { data: admins } = await db.from("admins").select("email");
            const emails = (admins || []).map((a) => a.email.toLowerCase());
            if (emails.length === 0) return res.json({ sent: 0 });
            const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
            const adminIds = (users?.users || []).filter((u) => emails.includes((u.email || "").toLowerCase())).map((u) => u.id);
            if (adminIds.length === 0) return res.json({ sent: 0 });
            const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", adminIds);
            const sent = await sendPush(db, subs || [], {
                title: `Για έγκριση: ${label} · ${village}`,
                body: `${c.created_by_email || ""} — ${when}${c.submitter_comment ? `\n💬 ${c.submitter_comment}` : ""}`,
                url: "/?admin=1",
                tag: `pending-${c.id}`,
            });
            return res.json({ sent });
        }

        return res.status(400).json({ error: "Άγνωστο kind" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
