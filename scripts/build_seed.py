"""Δημιουργεί το supabase/seed.sql από τα CSV.

Πηγές:  public/villages.csv · public/celebrations.csv · data/musicians.csv
Χρήση:  python scripts/build_seed.py
Μετά:   node scripts/setup_supabase.mjs   (ή επικόλληση του seed.sql στο Supabase → SQL Editor)

Το αρχείο χωρίζεται σε τμήματα με γραμμές "-- @@", ώστε να στέλνεται σε δόσεις.
"""
import csv
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # ελληνικά στο τερματικό των Windows

ROOT = Path(__file__).resolve().parent.parent
FIELDS = ["celebration_type", "celebration_date", "start_time", "dj", "front_singer",
          "clarinet_player", "violin_player", "bouzouki_player", "notes"]
CHUNK = 400


def q(value):
    value = (value or "").strip()
    return "null" if not value else "'" + value.replace("'", "''") + "'"


def num(value):
    value = (value or "").strip()
    return str(int(value)) if value.lstrip("-").isdigit() else "null"


def arr(value):
    items = [x.strip() for x in (value or "").split(";") if x.strip()]
    return "array[" + ", ".join(q(x) for x in items) + "]::text[]" if items else "'{}'::text[]"


def chunks(rows, n=CHUNK):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]


def main():
    read = lambda p: list(csv.DictReader(open(ROOT / p, encoding="utf-8-sig")))
    villages = [v for v in read("public/villages.csv") if v["village_name"].strip()]
    events = read("public/celebrations.csv")
    musicians = read("data/musicians.csv")
    ids = {v["id"] for v in villages}
    bad = [e for e in events if e["village_id"] not in ids]
    if bad:
        raise SystemExit(f"{len(bad)} εκδηλώσεις δείχνουν σε χωριό που δεν υπάρχει (π.χ. {bad[0]})")

    out = [
        "-- ΑΥΤΟΜΑΤΟ ΑΡΧΕΙΟ από scripts/build_seed.py — μην το αλλάζετε με το χέρι.",
        "-- Τρέξτε το ΜΕΤΑ το schema.sql. Είναι ασφαλές να ξανατρέξει: αντικαθιστά μόνο τα αρχικά/demo δεδομένα,",
        "-- όχι όσα πρόσθεσαν χρήστες.",
    ]
    for part in chunks(villages):
        out += [
            "-- @@ χωριά",
            "insert into public.villages (id, name, region, prefecture, lat, lon, osm_id) values",
            ",\n".join(
                f"    ({int(v['id'])}, {q(v['village_name'])}, {q(v['region'])}, {q(v['prefecture'])}, "
                f"{float(v['village_lat'])}, {float(v['village_lon'])}, {num(v.get('osm_id'))})"
                for v in part
            ),
            "on conflict (id) do update set name = excluded.name, region = excluded.region, prefecture = excluded.prefecture,",
            "    lat = excluded.lat, lon = excluded.lon, osm_id = excluded.osm_id;",
        ]

    out += ["-- @@ εκδηλώσεις", "delete from public.celebrations where created_by is null;"]
    for part in chunks(events):
        out += [
            "-- @@ εκδηλώσεις",
            "insert into public.celebrations (village_id, " + ", ".join(FIELDS) + ", status, created_by) values",
            ",\n".join(
                f"    ({int(e['village_id'])}, {q(e['celebration_type'])}, {q(e['celebration_date'])}::date, "
                f"{q(e['start_time'])}::time, " + ", ".join(q(e[f]) for f in FIELDS[3:]) + ", 'approved', null)"
                for e in part
            ) + ";",
        ]

    out += [
        "-- @@ μουσικοί",
        "-- Μόνο εν ζωή. Όσοι προήλθαν από παλαιότερη έκδοση του αρχείου και δεν υπάρχουν πια σε αυτό, σβήνονται.",
        "delete from public.musicians where created_by is null and name not in (",
        ",\n".join(f"    {q(m['name'])}" for m in musicians),
        ");",
    ]
    for part in chunks(musicians):
        out += [
            "-- @@ μουσικοί",
            "insert into public.musicians (name, roles, genres, birth_year, death_year, scene, source_url, source_note,",
            "    last_seen_year, wikipedia_url, description, status, created_by) values",
            ",\n".join(
                f"    ({q(m['name'])}, {arr(m['roles'])}, {arr(m['genres'])}, {num(m['birth_year'])}, {num(m['death_year'])}, "
                f"{q(m['scene'])}, {q(m['source_url'])}, {q(m['source_note'])}, {num(m['last_seen_year'])}, "
                f"{q(m['wikipedia_url'])}, {q(m['description'])}, 'approved', null)"
                for m in part
            ),
            "on conflict (name) do update set roles = excluded.roles, genres = excluded.genres, birth_year = excluded.birth_year,",
            "    death_year = excluded.death_year, scene = excluded.scene, source_url = excluded.source_url,",
            "    source_note = excluded.source_note, last_seen_year = excluded.last_seen_year,",
            "    wikipedia_url = excluded.wikipedia_url, description = excluded.description",
            "    where public.musicians.created_by is null;",
        ]

    with open(ROOT / "supabase/seed.sql", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out) + "\n")
    print(f"seed.sql: {len(villages)} χωριά, {len(events)} εκδηλώσεις, {len(musicians)} μουσικοί")


if __name__ == "__main__":
    main()
