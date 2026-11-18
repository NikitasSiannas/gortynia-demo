# Πανηγύρια Γορτυνίας

Χάρτης με τα πανηγύρια, τις λαϊκές βραδιές και τα πάρτυ νεολαίας στα χωριά της Γορτυνίας και της υπόλοιπης Αρκαδίας.
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

## Ρύθμιση — μία φορά

### 1. Supabase
1. [supabase.com](https://supabase.com) → *New project* (Free, *Central EU (Frankfurt)*).
2. *SQL Editor* → *New query* → επικόλληση του [supabase/schema.sql](supabase/schema.sql) → *Run*.
3. Νέο query με το [supabase/seed.sql](supabase/seed.sql) → *Run* (100 χωριά, 104 εκδηλώσεις).
4. **Ορισμός διαχειριστή** — νέο query με το δικό σας email:
   ```sql
   insert into public.admins (email) values ('to-email-sas@example.com');
   ```
5. *Authentication → URL Configuration*
   - Site URL: `https://gortynia-demo.vercel.app`
   - Redirect URLs: `http://localhost:3000/**`, `https://gortynia-demo.vercel.app/**` (και `http://<IP>:3000/**` για δοκιμές από κινητό)
6. *Authentication → Emails → Magic Link*: προσθέστε στο κείμενο `Κωδικός: {{ .Token }}` — έτσι στο κινητό
   μπορεί κανείς να γράψει τον 6ψήφιο κωδικό αντί να πατήσει τον σύνδεσμο (χρήσιμο όταν το email ανοίγει σε άλλο browser).

### 2. Μεταβλητές περιβάλλοντος
Αντιγράψτε το [.env.example](.env.example) ως `.env.local` (τοπικά) και βάλτε **τις ίδιες** στο *Vercel → Settings → Environment Variables*:

| Μεταβλητή | Από πού | Δημόσια; |
|---|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase → Project Settings → API | ναι |
| `REACT_APP_SUPABASE_ANON_KEY` | ίδιο σημείο, *anon / publishable* key | ναι |
| `REACT_APP_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` | ναι |
| `VAPID_PRIVATE_KEY` | ίδια εντολή | **ΟΧΙ** |
| `VAPID_SUBJECT` | `https://gortynia-demo.vercel.app` | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → *service_role / secret* | **ΟΧΙ** |
| `CRON_SECRET` | οποιοδήποτε μακρύ τυχαίο κείμενο | **ΟΧΙ** |

Μετά: *Vercel → Deployments → Redeploy*. Τοπικά: ξανατρέξτε `npm start`.

## Πώς δουλεύει

### Ρόλοι
| | Επισκέπτης | Συνδεδεμένος χρήστης | Διαχειριστής |
|---|---|---|---|
| Βλέπει εγκεκριμένες εκδηλώσεις | ✅ | ✅ | ✅ |
| Προτείνει εκδήλωση (+ σχόλιο προς διαχειριστή) | — | ✅ → *σε αναμονή* | ✅ → δημοσιεύεται αμέσως |
| Βλέπει τις δικές του σε αναμονή / απορριφθείσες | — | ✅ | ✅ |
| Αλλάζει / διαγράφει | — | μόνο δικές του (ξαναπάνε σε αναμονή) | όλες |
| Εγκρίνει / απορρίπτει, βλέπει email & σχόλιο | — | — | ✅ |
| Βλέπει λίστα χρηστών (email, τελευταία σύνδεση) | — | — | ✅ |

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

## Αλλαγή δεδομένων
Τα CSV στο `public/` είναι η «πηγή» των αρχικών δεδομένων. Αν τα αλλάξετε:
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
