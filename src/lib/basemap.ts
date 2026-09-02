/**
 * Basemap raster CARTO (Positron / Dark Matter).
 *
 * Da settembre 2026 CARTO richiede una API key sulle richieste a
 * basemaps.cartocdn.com: senza chiave i tile arrivano con la filigrana
 * "API key required". La chiave e' PUBBLICA per natura (viaggia nelle URL
 * dei tile, come la anon key di Supabase): la protezione va fatta sul
 * pannello CARTO con le restrizioni di dominio. Se va ruotata, si cambia
 * solo qui.
 */
const CARTO_API_KEY = 'cb1_2rp3_1_befb0e3aaf2dcd5441473beb';

/* Il parametro corretto e' "key" (verificato sui byte dei tile: con
   ?api_key il CDN ignora la query e la filigrana resta). */
export const cartoBasemapUrl = (theme: string) =>
  `https://{s}.basemaps.cartocdn.com/${theme === 'light' ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
