/**
 * Come si chiama un sito a schermo.
 *
 * L'etichetta e' la somma di tre campi — client, city, nome del sito — ma
 * sommarli e basta non funziona: su 1.104 siti in anagrafica, 530 hanno il
 * brand gia' dentro al nome e 370 la citta'. "Prada Houston Galleria", con
 * client PRADA e citta' HOUSTON, sarebbe diventato
 * "PRADA HOUSTON Prada Houston Galleria".
 *
 * Quindi dal nome si tolgono le parole che client e citta' gia' dicono, e
 * resta il pezzo che aggiunge informazione: "PRADA HOUSTON Galleria".
 *
 * Misurato sull'anagrafica di agosto 2026: 762 siti si accorciano, 300 restano
 * come sono, 42 si riducono a "client citta'" perche' il loro nome era solo la
 * ripetizione dei due campi.
 *
 * Questo cambia solo cio' che si legge. Il campo `name` resta quello del
 * database: ci si aggancia l'abbinamento dei moduli in useProjectModuleConfig,
 * e riscriverlo farebbe ricadere ogni sito nella configurazione di default.
 */

/**
 * Il separatore fra i tre pezzi. Uno spazio semplice, per scelta: l'etichetta
 * finisce anche nelle ricerche, nei nomi dei file PDF e negli appunti, e li' un
 * carattere tipografico si trasformerebbe in un ospite indesiderato. Il confine
 * fra i pezzi si legge lo stesso perche' client e citta' sono in maiuscolo.
 */
const SEPARATOR = " ";

/**
 * Il confine di parola e' la parte che conta.
 *
 * Senza, con citta' MILAN il nome "Fendi Milano Galleria" diventerebbe
 * "Fendi o Galleria": MILAN e' contenuto in MILANO. Le classi Unicode servono
 * per i nomi non latini e per le lettere accentate, e il fallback copre i
 * motori che non supportano il lookbehind.
 */
function wordPattern(token: string): RegExp | null {
  const escaped = token.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return null;
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  } catch {
    return new RegExp(`\\b${escaped}\\b`, "gi");
  }
}

/**
 * Rimette in ordine cio' che resta dopo i tagli: spazi doppi, virgole rimaste
 * appaiate, e la punteggiatura orfana in testa o in coda — "Sydney," senza
 * "Sydney" non deve diventare ",".
 */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*(,\s*)+/g, ", ")
    .replace(/^[\s,;:·\-–—]+|[\s,;:·\-–—]+$/g, "")
    .trim();
}

/**
 * Il pezzo di nome che client e citta' non dicono gia'.
 *
 * Stringa vuota quando il nome non aggiungeva niente: sono i 42 siti chiamati
 * come la somma dei due campi, e per loro l'etichetta si ferma a "client
 * citta'", che e' completa.
 */
export function siteNameRemainder(
  name: string | null | undefined,
  client: string | null | undefined,
  city: string | null | undefined,
): string {
  let rest = name ?? "";
  for (const token of [client, city]) {
    if (!token) continue;
    const pattern = wordPattern(token);
    if (pattern) rest = rest.replace(pattern, " ");
  }
  return tidy(rest);
}

/**
 * L'etichetta completa: "PRADA HOUSTON Galleria".
 *
 * I pezzi assenti spariscono senza lasciare separatori vuoti — cinque siti non
 * hanno citta' e devono leggersi "BALENCIAGA Rue Saint-Honoré", non
 * "BALENCIAGA  Rue Saint-Honoré".
 */
export function siteDisplayName(
  name: string | null | undefined,
  client: string | null | undefined,
  city: string | null | undefined,
): string {
  const parts = [
    (client ?? "").trim(),
    (city ?? "").trim(),
    siteNameRemainder(name, client, city),
  ].filter(Boolean);

  // Se non resta niente — nessun campo compilato — meglio il nome grezzo che
  // una cella vuota.
  return parts.length > 0 ? parts.join(SEPARATOR) : (name ?? "").trim();
}
