import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oysvhglgsquxewmqfdyk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c3ZoZ2xnc3F1eGV3bXFmZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTA5OTMsImV4cCI6MjA3MzE4Njk5M30.DB0t-ej7setK0fPacySDwFm5PokDeDjXidqCJp9pPjI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);