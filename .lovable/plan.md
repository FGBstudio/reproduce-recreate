## Sostituzione logo LEED con icona Award nella sfera "Awards"

**File:** `src/components/auth/FloatingBentoPanel.tsx` (solo riga ~303, dentro l'hero con le 4 sfere sotto il titolo "Air. Water. Energy. Awards.")

### Modifica
Sostituire:
```tsx
<img src="/leed_logo.png" alt="LEED" className="w-[78px] h-[78px] object-contain" />
```
con l'icona `Award` di `lucide-react` (la stessa usata in `LEEDCertificationWidget.tsx` per le certificazioni), stilizzata coerentemente con le altre 3 sfere (Water = droplet, Air = cloud, Energy = zap):

```tsx
<Award className="w-[42px] h-[42px]" style={{ color: ACCENT, strokeWidth: 1.5 }} />
```

Dimensione e `strokeWidth` allineati alle altre icone della stessa riga (verranno letti dal codice esistente per mantenere identica proporzione). Il colore usa la variabile `ACCENT` già definita nel file (verde FGB), come per le altre sfere.

Aggiungere `Award` all'import esistente da `lucide-react` in cima al file.

### Fuori scope
- Nessuna modifica alle sfere Water/Air/Energy.
- Nessuna modifica al resto del pannello (sezione certificazioni più in basso continua a mostrare i loghi PNG LEED/BREEAM/WELL).
- Nessuna modifica al file `LEEDCertificationWidget.tsx` o ad altri componenti.
