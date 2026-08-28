/**
 * Interruttori di funzionalita' reversibili.
 *
 * CERTIFICATIONS_OVERVIEW: vista "Certifications" a livello Group/Brand
 * (switch Monitoring | Certifications nel pannello laterale di BrandOverlay).
 * A false l'app torna ESATTAMENTE com'era: nessuno switch, solo monitoraggio.
 */
export const CERTIFICATIONS_OVERVIEW = true;

/**
 * LANDING_SCROLL: nuova landing desktop "scroll-telling" (design dal PDF
 * SITO MONITORAGGIO 2026): mondo che si rimpicciolisce, numeri, zoom sul
 * marker di Monte-Carlo, certificazioni, fasce monitoring, Free/Custom.
 * A false torna la landing precedente (FloatingBentoPanel classico).
 * La versione mobile (LandingMobile) non e' toccata in entrambi i casi.
 */
export const LANDING_SCROLL = true;
