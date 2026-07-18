# Eliminazione account utente

Al momento non esiste una funzionalità con cui l'utente può eliminare da solo il proprio account. Esiste solo l'eliminazione di membership da admin (`ClientUsersManager`). Vado ad implementarla.

## Cosa costruire

1. **Edge Function `delete-account`** (`supabase/functions/delete-account/index.ts`)
   - Autentica l'utente dal JWT (`Authorization` header).
   - Usa il `SUPABASE_SERVICE_ROLE_KEY` internamente per chiamare `supabase.auth.admin.deleteUser(user.id)`.
   - La cascade elimina `profiles`, `user_roles`, `user_memberships` (già configurate con `ON DELETE CASCADE` su `auth.users`).
   - CORS + validazione + risposta JSON.

2. **UI nel profilo utente** (`src/components/dashboard/UserAccountDropdown.tsx`, tab "profile")
   - Nuova sezione "Danger zone" in fondo con pulsante rosso "Elimina account".
   - `AlertDialog` di conferma che richiede di digitare la parola `DELETE` (o l'email) prima di abilitare il pulsante finale.
   - Al conferma: `supabase.functions.invoke('delete-account')` → `logout()` → redirect a `/auth` con toast di conferma.

3. **Traduzioni** in `src/contexts/LanguageContext.tsx` per le nuove stringhe (IT/EN): titolo sezione, warning irreversibile, pulsante, dialog di conferma.

## Note tecniche

- Nessuna migrazione DB necessaria: le FK esistenti su `auth.users(id) ON DELETE CASCADE` già puliscono i dati collegati.
- L'edge function verrà deployata automaticamente; `verify_jwt` resta al default e la validazione del JWT viene fatta in-code estraendo l'utente da `supabase.auth.getUser(token)`.
- Nessuna modifica alle policy RLS.
