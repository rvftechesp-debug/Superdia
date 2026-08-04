// config.js
const SUPABASE_URL = "https://pqyzzixcpqregwlrexsn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxeXp6aXhjcHFyZWd3bHJleHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDI5OTcsImV4cCI6MjEwMDM3ODk5N30.wi23KrmhsrjoG2oDchT31IDfMiqf-h8Rm6Y0R2-7kKE";

// Opcional: validação básica para evitar erro silencioso
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Erro: SUPABASE_URL ou SUPABASE_ANON_KEY não definidos.");
}
