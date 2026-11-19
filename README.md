# Πάμε Πανηγύρι

Χάρτης με τα πανηγύρια, τις λαϊκές βραδιές και τα πάρτυ νεολαίας σε όλη την Πελοπόννησο
(Αρκαδία, Αργολίδα, Κορινθία, Λακωνία, Μεσσηνία, Ηλεία, Αχαΐα).
Εγκαθίσταται στο κινητό σαν εφαρμογή (PWA), στέλνει ειδοποιήσεις, και οι χρήστες προτείνουν εκδηλώσεις που εγκρίνει ο διαχειριστής.

Ζωντανά: https://gortynia-demo.vercel.app

**Τεχνολογίες:** React · Leaflet (+ markercluster) · Tailwind · [Supabase](https://supabase.com) (βάση & σύνδεση, δωρεάν) · Vercel (φιλοξενία & serverless)

## Τοπική εκτέλεση

```
npm install      # μόνο την πρώτη φορά
npm start        # http://localhost:3000  (από κινητό στο ίδιο Wi-Fi: http://<IP-υπολογιστή>:3000)
```

Χωρίς ρυθμισμένο Supabase η εφαρμογή δουλεύει **μόνο για ανάγνωση**, με τα `public/villages.csv` και `public/celebrations.csv`.
Η εγκατάσταση ως εφαρμογή και οι ειδοποιήσεις δουλεύουν μόνο στη δημοσιευμένη έκδοση (https).

## Ρύθμιση βάσης δεδομένων — μία φορά (≈5 λεπτά)

Όλη η ρύθμιση γίνεται **αυτόματα** από το `scripts/setup_supabase.mjs`. Χρειάζεστε μόνο δύο πράγματα:

1. **Νέο project** στο [supabase.com](https://supabase.com) → *New project* (Free, περιοχή *Central EU (Frankfurt)*).
   Από τη διεύθυνσή του (`https://ΑΥΤΟ.supabase.co`) κρατήστε το **project ref**.
2. **Access token**: supabase.com → εικονίδιο λογαριασμού → *Account preferences* → *Access Tokens* → *Generate new token*.

Βάλτε τα στο `.env.local` (δεν ανεβαίνει ποτέ στο GitHub):
```
SUPABASE_PROJECT_REF=abcdefghijklmnop
SUPABASE_ACCESS_TOKEN=sbp_...
```
και τρέξτε:
```
npm run setup:db      # βάση μόνο
npm run setup:all     # + μεταβλητές στο Vercel (χρειάζεται και VERCEL_TOKEN στο .env.local)
```
Το script:
- φτιάχνει πίνακες & κανόνες ασφαλείας (`supabase/schema.sql`) και περνά όλα τα δεδομένα (`supabase/seed.sql`),
- ορίζει διαχειριστή από το τοπικό `supabase/admins.local.sql`,
- ενεργοποιεί **είσοδο επισκεπτών**, διευθύνσεις σύνδεσης (υπολογιστής, κινητό στο Wi-Fi, Vercel) και ελληνικά email με 6ψήφιο κωδικό,
- γράφει τα κλειδιά (URL, anon, service role) στο `.env.local` — χωρίς να τα εμφανίσει.

Μετά: `npm start` τοπικά, και `git push` για το site (το Vercel ξαναχτίζει μόνο του).

Χωρίς βάση, η εφαρμογή δουλεύει μόνο για ανάγνωση με τα CSV (κουμπί «Συνέχεια ως επισκέπτης (demo)»).

### Σύνδεση με Google (προαιρετικό)
1. [console.cloud.google.com](https://console.cloud.google.com) → *APIs & Services → OAuth consent screen* (External, «Πάμε Πανηγύρι») → *Publish app*.
2. *Credentials → OAuth client ID → Web application*, redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Client ID/secret στο Supabase → *Authentication → Sign In / Providers → Google*.
4. `REACT_APP_GOOGLE_LOGIN=1` στο `.env.local` και στο Vercel.

### Μεταβλητές περιβάλλοντος
| Μεταβλητή | Από πού | Δημόσια; |
|---|---|---|
| `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` | το script (ή Supabase → API) | ναι |
| `REACT_APP_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | ναι / **ΟΧΙ** |
| `VAPID_SUBJECT` | `https://gortynia-demo.vercel.app` | — |
| `SUPABASE_SERVICE_ROLE_KEY` | το script (ή Supabase → API → service_role) | **ΟΧΙ** |
| `CRON_SECRET` | τυχαίο κείμενο | **ΟΧΙ** |
| `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN` | μόνο τοπικά, για το script | **ΟΧΙ** |

## Πώς δουλεύει

### Ρόλοι
Είσοδος: **με email** (σύνδεσμος ή 6ψήφιος κωδικός) ή **ως επισκέπτης** (χωρίς στοιχεία). Ο επισκέπτης μπορεί
αργότερα να προσθέσει email από το μενού — ο λογαριασμός του κρατά ό,τι έχει καταχωρήσει.

| | Επισκέπτης | Με email | Διαχειριστής |
|---|---|---|---|
| Βλέπει εγκεκριμένες εκδηλώσεις, ειδοποιήσεις 🔔 | ✅ | ✅ | ✅ |
| Προτείνει εκδήλωση (+ σχόλιο προς διαχειριστή) | ✅ → *σε αναμονή* | ✅ → *σε αναμονή* | ✅ → δημοσιεύεται αμέσως |
| Βλέπει τις δικές του σε αναμονή / απορριφθείσες | ✅ | ✅ | ✅ |
| Αλλάζει / διαγράφει | δικές του | δικές του (ξαναπάνε σε αναμονή) | όλες |
| Εγκρίνει / απορρίπτει, βλέπει ποιος την πρότεινε | — | — | ✅ |
| Βλέπει λίστα χρηστών (email ή «επισκέπτης», τελευταία σύνδεση) | — | — | ✅ |

Οι κανόνες επιβάλλονται **από τη βάση** (Row Level Security + trigger στο `schema.sql`), όχι μόνο από το UI.

### Κοινοποίηση
Κάθε εκδήλωση έχει σύνδεσμο `https://gortynia-demo.vercel.app/e/<id>`. Το Facebook/Viber/WhatsApp δείχνουν
προεπισκόπηση με τίτλο, ημερομηνία και μουσικούς ([api/share.js](api/share.js))· ο επισκέπτης ανοίγει την εφαρμογή με την εκδήλωση.

### Ειδοποιήσεις (Web Push)
- Ο χρήστης διαλέγει *όλα τα χωριά* ή *συγκεκριμένα* (🔔).
- Όταν ο διαχειριστής **εγκρίνει** εκδήλωση → ειδοποίηση σε όσους ακολουθούν το χωριό ([api/notify.js](api/notify.js)).
- Όταν χρήστης **υποβάλει** εκδήλωση → ειδοποίηση στους διαχειριστές («Για έγκριση»).
- Κάθε πρωί 10:00 → **υπενθύμιση** για τις αυριανές εκδηλώσεις ([api/reminders.js](api/reminders.js), Vercel Cron).
- iPhone: χρειάζεται iOS 16.4+ και η εφαρμογή να είναι εγκατεστημένη στην οθόνη Αφετηρίας.

### Θέμα
Αυτόματα σκοτεινό από τη δύση ως την ανατολή του ηλίου (υπολογίζεται για την Αρκαδία). Αλλάζει από το μενού.

### Είσοδος
Με ρυθμισμένη βάση, η εφαρμογή ζητά σύνδεση (Google ή email) πριν δείξει τον χάρτη. Όποιος ανοίγει κοινοποιημένο
σύνδεσμο βλέπει ποια εκδήλωση του έστειλαν, συνδέεται, και μεταφέρεται κατευθείαν σε αυτήν.
Χωρίς βάση (π.χ. τοπικά χωρίς `.env.local`) εμφανίζεται κουμπί «Είσοδος (demo)».

### Μουσικοί
Η φόρμα εκδήλωσης προτείνει ονόματα ανά όργανο από τον κατάλογο μουσικών. Νέο όνομα που δεν υπάρχει
προστίθεται αυτόματα ως πρόταση και εγκρίνεται από *Διαχείριση → Μουσικοί*.
Ο αρχικός κατάλογος (`data/musicians.csv`) περιέχει **μόνο εν ζωή** καλλιτέχνες:
- **Μουσικοί πανηγυριών** (`scene = panigyri`): από προγράμματα πανηγυριών της Αρκαδίας (Kalimera Arkadia,
  e-gortynia, Arcadia Portal, panigiria.gr, Leonidio24), την εκπομπή «Το Αλάτι της Γης» κ.ά. — με πηγή και
  χρονιά τελευταίας αναφοράς για τον καθένα. Εμφανίζονται πρώτοι στις προτάσεις.
- **Γνωστοί καλλιτέχνες** (`scene = known`): δημοτικό/λαϊκό/ρεμπέτικο από τη Wikipedia.

## Αλλαγή δεδομένων
Μόλις ρυθμιστεί η βάση, **η εφαρμογή διαβάζει αυτόματα από τη βάση** — τα CSV μένουν μόνο ως εφεδρεία
(αν η βάση δεν απαντά) και ως πηγή για το αρχικό γέμισμα. Οι καθημερινές αλλαγές γίνονται από την εφαρμογή
ή από το *Supabase → Table Editor*, όχι από τα CSV.

Τα CSV (`public/villages.csv`, `public/celebrations.csv`, `data/musicians.csv`) χρησιμεύουν για μαζικές αλλαγές:
```
python scripts/build_seed.py      # ξαναφτιάχνει το supabase/seed.sql
```
και τρέξτε το `seed.sql` στο Supabase. Αντικαθιστά μόνο τις αρχικές/demo εκδηλώσεις — όχι όσες πρόσθεσαν χρήστες.

## Όρια δωρεάν πλάνων
- **Supabase**: 500 MB βάση, 50.000 χρήστες/μήνα. Τα email σύνδεσης του ενσωματωμένου server είναι λίγα ανά ώρα —
  για πραγματική χρήση συνδέστε δωρεάν SMTP (Resend, Brevo) στο *Authentication → Emails → SMTP Settings*.
  Project χωρίς κίνηση για 7 ημέρες **παγώνει** (ξυπνάει από το dashboard).
- **Vercel Hobby**: 1 cron την ημέρα, υπεραρκετά serverless calls.

## Αρχεία
- `src/App.js` — κύρια οθόνη · `src/components/` — χάρτης, κάρτες, λεπτομέρειες, φόρμα, διαχείριση, ειδοποιήσεις
- `src/lib/` — δεδομένα, σύνδεση, θέμα, PWA/ειδοποιήσεις, ημερολόγιο
- `api/` — serverless functions (κοινοποίηση, ειδοποιήσεις, υπενθυμίσεις) · `vercel.json` — διαδρομές & cron
- `public/sw.js` — service worker · `public/manifest.json` — εγκατάσταση σαν εφαρμογή
- `supabase/` — σχήμα βάσης & αρχικά δεδομένα · `scripts/build_seed.py` · `generate_qr.py` — QR code

## Φωτογραφίες
Wikimedia Commons, με άδεια CC BY-SA: Δημητσάνα (Ulrich Still), Καρύταινα (FilipposTrains), Λαγκάδια (Glorious 93),
Βυτίνα (C messier), Φαράγγι Λούσιου (Napoleon Vier). Χάρτης © OpenStreetMap contributors.
