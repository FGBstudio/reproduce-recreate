# Hardening Sicurezza — IDOR + Over-fetching

## Contesto attuale (riscontri dall'audit)

**Buone notizie — la base è già solida:**
- RLS è attivo su tutte le tabelle sensibili (`profiles`, `user_roles`, `user_memberships`, `certifications`, `sites`, `devices`, `bills`, ecc.).
- Le edge function admin (`admin-roles`) **già** estraggono l'identità dal JWT via `userClient.auth.getUser(token)` e verificano il ruolo server-side con `has_role()`. Non si fidano di parametri client.
- Esistono `SECURITY DEFINER` functions (`has_role`, `is_admin`, `can_access_site`, `can_access_brand`, `is_cert_pm`, `is_project_pm`) usate dalle policy.

**Problemi reali da correggere:**

### A. Over-fetching (`SELECT *`) — 26 occorrenze
Tabelle critiche con `select('*')` lato client che espongono colonne più del necessario:
- `profiles` (3x) → espone `first_name`, `last_name`, `company`, `job_title`, `avatar_url`, `created_at`, ecc. anche quando serve solo `id`+`display_name`.
- `user_roles` → espone tutte le colonne quando serve solo `role`.
- `user_memberships` (5x) → espone `permission`, `allowed_regions`, timestamps.
- `certifications`, `certification_milestones`, `bills`, `sites`, `devices`, `access_requests`.

### B. Identità derivata da fonti deboli (potenziale IDOR)
- `useUserScope.ts` ha un **fallback su email matching** (`mockBrands.find(b => email.includes(b.id))`) che assegna scope basandosi sull'indirizzo email. Un utente con email tipo "user@brandX.com" eredita lo scope del brand. Da rimuovere — solo membership DB.
- `isAdmin` in `AuthContext` deriva da `user.role` recuperato lato client; va bene per UI hints ma **non deve mai** essere usato per decidere cosa mostrare di sensibile senza affidarsi alla RLS.

### C. Edge function `devices` accetta `site_id` da query param
Il filtro `site_id` arriva dal client senza verifica che l'utente abbia accesso a quel sito. La function usa `service_role` (bypassa RLS) → IDOR: chiunque può leggere device di qualsiasi sito cambiando l'UUID.

---

## Piano di intervento

### 1. Edge function `devices` — fix IDOR critico
File: `supabase/functions/devices/index.ts`
- Estrarre `userId` dal JWT (come fa `admin-roles`).
- Se viene passato `site_id`, verificare l'accesso con `rpc('can_access_site', { _user_id, _site_id })` prima di restituire dati.
- Se non viene passato `site_id`, restringere automaticamente ai siti accessibili all'utente (no più "tutti i device del mondo").
- Admin (`has_role(_user_id, 'admin')`) bypassa il filtro.

### 2. Rimuovere fallback email-based scope
File: `src/hooks/useUserScope.ts`
- Eliminare `checkEmailForBrandScope()` e tutte le sue chiamate.
- Se non ci sono membership → ruolo `USER_FGB` puro, nessuno scope ereditato.

### 3. Sostituire `SELECT *` con colonne esplicite

Tabelle prioritarie (sensibili):

| File | Tabella | Colonne necessarie |
|------|---------|-------------------|
| `src/contexts/AuthContext.tsx:31` | `profiles` | `id, display_name, first_name, last_name, avatar_url, company` |
| `src/contexts/AuthContext.tsx:175` | `profiles` | stesse di sopra |
| `src/components/admin/UsersManager.tsx:50` | `profiles` | `id, display_name, first_name, last_name, company, created_at` |
| `src/components/admin/UsersManager.tsx:58` | `user_roles` | `user_id, role` |
| `src/components/admin/AdminStats.tsx:23` | `profiles` (count) | rimuovere `*`, usare `head: true` con `count` |
| `src/components/admin/RolesManager.tsx:109` | `profiles` | `id, display_name, first_name, last_name` |
| `src/components/admin/UserAccessManager.tsx:60` | `profiles` | `id, display_name, first_name, last_name, company` |
| `src/components/admin/ClientUsersManager.tsx:62,86,195` | `user_memberships` / `profiles` | colonne mirate |
| `src/contexts/AdminDataContext.tsx:243,772,818,840` | `user_memberships` | `user_id, scope_type, scope_id, permission` |
| `src/hooks/useCertifications.ts:34,53` | `certifications`/`certification_milestones` | colonne mirate per UI |
| `src/hooks/useLeedCertification.ts:16,32` | `certification_milestones` | `id, requirement, category, status, score, max_score, due_date, completed_date, milestone_type, order_index, start_date, actual_date, notes` |
| `src/hooks/useSiteThresholds.ts:65` | `site_thresholds` | colonne usate dall'UI |
| `src/components/admin/AccessRequestsManager.tsx:43` | `access_requests` | `id, first_name, last_name, email, company, job_title, message, status, created_at` |
| `src/components/admin/CertificationsDialog.tsx:59,68` | `certifications` | colonne UI |
| `src/components/admin/LEEDCertificationsDialog.tsx:90,102,116,248` | come sopra |
| `src/components/dashboard/EnergyWeatherCorrelation.tsx:78` | `weather_data` | `ts, temp_c, humidity, ecc.` |
| `src/components/dashboard/BillAnalysisModule.tsx:180,195` | `bills`/`bill_data` | colonne UI |
| `src/lib/supabase.ts:126,142,183` | `sites`, `devices`, `site_kpis` | colonne usate dall'app |
| `src/lib/api.ts:1191,1210,1229` | da verificare in dettaglio durante l'implementazione |

### 4. Rafforzare `AuthContext`
- Documentare che `isAdmin` lato client serve **solo** per UI conditional rendering. La sicurezza vera resta sulle RLS + edge function checks.
- Nessuna chiamata sensibile (mutations su tabelle admin) deve passare per il client diretto: deve passare per edge function autenticata.

---

## Cosa NON cambia
- Le RLS policy esistenti vanno bene → non servono migration.
- Gli endpoint `admin-roles` sono già conformi → nessuna modifica.
- I JWT signing & validation sono gestiti da Supabase → nessuna riscrittura del flusso auth.

## Risultato atteso
- Un utente che intercetta una chiamata e modifica `site_id`/`user_id` riceve **403** dalla edge function o **0 righe** dalla RLS.
- Le risposte di rete contengono solo le colonne strettamente necessarie all'UI (riduzione superficie d'attacco + payload più leggeri).
- Nessuno scope di brand/site può essere ereditato basandosi sull'email — solo membership DB esplicite.

## Out of scope (per messaggi futuri se vuoi)
- Audit completo di `src/lib/api.ts` (1000+ righe) per altri pattern IDOR su filtri custom.
- Aggiunta di rate limiting sulle edge function.
- Logging/alerting su tentativi 403 ripetuti.
