"""Δημιουργεί το supabase/seed.sql από τα public/villages.csv και public/celebrations.csv.

Χρήση:  python scripts/build_seed.py
Τρέξτε το ξανά όποτε αλλάζετε τα CSV, και μετά τρέξτε το seed.sql στο Supabase.
"""
import csv
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # ελληνικά στο τερματικό των Windows

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ["celebration_type", "celebration_date", "start_time", "dj", "front_singer",
          "clarinet_player", "violin_player", "bouzouki_player", "notes"]


def q(value):
    value = (value or "").strip()
    return "null" if not value else "'" + value.replace("'", "''") + "'"


def main():
    villages = list(csv.DictReader(open(ROOT / "public/villages.csv", encoding="utf-8-sig")))
    events = list(csv.DictReader(open(ROOT / "public/celebrations.csv", encoding="utf-8-sig")))
    villages = [v for v in villages if v["village_name"].strip()]

    out = [
        "-- ΑΥΤΟΜΑΤΟ ΑΡΧΕΙΟ από scripts/build_seed.py — μην το αλλάζετε με το χέρι.",
        "-- Τρέξτε το ΜΕΤΑ το schema.sql. Είναι ασφαλές να ξανατρέξει:",
        "-- αντικαθιστά μόνο τις αρχικές/demo εκδηλώσεις (χωρίς δημιουργό), όχι όσες πρόσθεσαν χρήστες.",
        "",
        "insert into public.villages (id, name, region, lat, lon) values",
        ",\n".join(
            f"    ({int(v['id'])}, {q(v['village_name'])}, {q(v['region'])}, {float(v['village_lat'])}, {float(v['village_lon'])})"
            for v in villages
        ),
        "on conflict (id) do update set name = excluded.name, region = excluded.region, lat = excluded.lat, lon = excluded.lon;",
        "",
        "delete from public.celebrations where created_by is null;",
        "",
        "insert into public.celebrations (village_id, " + ", ".join(FIELDS) + ", status, created_by)",
        "select v.id, s.celebration_type, s.celebration_date::date, s.start_time::time, s.dj, s.front_singer,",
        "       s.clarinet_player, s.violin_player, s.bouzouki_player, s.notes, 'approved', null",
        "from (values",
        ",\n".join(
            "    (" + ", ".join([q(e["village_name"])] + [q(e[f]) for f in FIELDS]) + ")" for e in events
        ),
        ") as s (village_name, " + ", ".join(FIELDS) + ")",
        "join public.villages v on v.name = s.village_name;",
        "",
    ]
    with open(ROOT / "supabase/seed.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))
    print(f"seed.sql: {len(villages)} χωριά, {len(events)} εκδηλώσεις")


if __name__ == "__main__":
    main()
