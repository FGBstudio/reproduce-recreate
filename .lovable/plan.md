## Goal
Nascondere i selettori "All Groups" / "All Clients" in `RegionNav` quando l'utente non ha la facoltà di navigarli, in base al ruolo derivato da `useUserScope`.

## Regole di visibilità (desktop + mobile)

| Ruolo (`clientRole`) | Selettore Holding (Groups) | Selettore Brand (Clients) |
|---|---|---|
| `ADMIN_FGB` | visibile | visibile |
| `USER_FGB` | visibile | visibile |
| `ADMIN_HOLDING` | **nascosto** (auto-bloccato sul suo holding) | visibile (filtrato sui brand del suo holding) |
| `ADMIN_BRAND` | **nascosto** | **nascosto** |
| `STORE_USER` | **nascosto** | **nascosto** |

Se entrambi sono nascosti, l'intero contenitore glass-panel dei selettori non viene renderizzato (così non resta un riquadro vuoto). Stessa logica applicata anche per la versione mobile (attualmente i selettori sono solo desktop, ma manteniamo coerenza).

## Implementazione

**File modificato:** `src/components/dashboard/RegionNav.tsx`

1. Importare `useUserScope` e leggere `clientRole`.
2. Derivare due booleani:
   - `canSelectHolding = clientRole === 'ADMIN_FGB' || clientRole === 'USER_FGB'`
   - `canSelectBrand   = canSelectHolding || clientRole === 'ADMIN_HOLDING'`
3. Nel blocco desktop `Holding & Brand Filters`:
   - Render condizionale del `<Select>` Holding + relativo `Building2` + separatore.
   - Render condizionale del `<Select>` Brand + relativo `Tag`.
   - Se `!canSelectHolding && !canSelectBrand` → non renderizzare l'intero `glass-panel` contenitore.
   - Se solo uno dei due è visibile, rimuovere il separatore `w-px h-6`.
4. Nessuna modifica alla logica di filtraggio dati a monte (Index.tsx): lo scope è già applicato lato hook/RLS, qui si interviene solo sulla presentazione.

## Out of scope
- Nessuna modifica a `Index.tsx`, `useUserScope`, RLS o policies.
- I bottoni Region/Monitoring restano invariati (già filtrati da `allowedRegions`).
- Nessun cambiamento al comportamento di KPI / mobile command center oltre alla regola sopra.
