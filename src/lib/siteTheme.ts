/**
 * Interruttore della veste "Material" per la dashboard di sito
 * (overview + energia + aria + acqua in ProjectDetail, solo desktop).
 *
 * true  -> sfondo a pattern organico chiaro (#EDF5F2) e card opache bianche
 *          a raggio 24, come da mockup approvato
 *          (fgb_google_pattern_sfondo_card.html, trattamento "A - Opaca").
 * false -> ripristina ESATTAMENTE l'aspetto precedente (sfondo scuro con
 *          overlay cinematico e pattern loghi): il vecchio codice resta
 *          intatto dietro questo flag.
 *
 * La vista mobile dell'overview non e' toccata in nessun caso: ha un design
 * proprio gia' approvato.
 */
export const SITE_MATERIAL_SKIN = true;
