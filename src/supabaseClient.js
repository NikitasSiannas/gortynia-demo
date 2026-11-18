import { createClient } from "@supabase/supabase-js";

// Τα στοιχεία μπαίνουν στο αρχείο .env.local (τοπικά) και στο Vercel → Settings → Environment Variables.
// Το "anon"/"publishable" key είναι δημόσιο από τη φύση του — η ασφάλεια γίνεται με τα RLS policies (supabase/schema.sql).
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Αν δεν έχει ρυθμιστεί Supabase, η εφαρμογή δουλεύει μόνο για ανάγνωση από τα CSV.
export const supabase =
    supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
