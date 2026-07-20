Nell'immagine di riferimento il pattern `white.png` non è centrato: appare zoomato (~1.8×) e traslato in basso-destra, così il cerchio mostra le curve del logo asimmetricamente invece del pittogramma intero.

## Modifica

File: `src/components/dashboard/MapView.tsx` (riga 164, `iconCreateFunction` del cluster)

Sostituire `<img>` con un `<div>` che usa `white.png` come `background-image`, in modo da poter controllare scala e posizionamento indipendentemente:

- `background-image: url('/white.png')`
- `background-size: 180%` (zoom del pattern per riempire e ritagliare)
- `background-position: 65% 65%` (offset verso basso-destra, come nel reference)
- `background-repeat: no-repeat`
- `opacity: 0.4`
- `position: absolute; inset: 0;`
- `pointer-events: none;`

Il resto (cerchio bianco 40%, bordo 0.5px, numero bianco 700 centrato) resta invariato.

Nessun'altra modifica ai marker singoli o alla logica cluster.