/**
 * Le 20 sedi strategiche FGB per il globo interattivo dell'intro (§4.2).
 * Config, non DB. Le immagini vivono in public/intro/locations/<slug>/ —
 * se un file manca il collage mostra il placeholder tintato, mai un 404 rotto.
 * Headquarters = Monte-Carlo (scelta del proprietario, 03/09).
 */

export interface IntroLocation {
  slug: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
  /** Sede principale: nel marquee appare in teal e piu' grande. */
  hub?: boolean;
  images: [string, string, string];
}

const imgs = (slug: string): [string, string, string] => [
  `/intro/locations/${slug}/01.jpg`,
  `/intro/locations/${slug}/02.jpg`,
  `/intro/locations/${slug}/03.jpg`,
];

export const INTRO_LOCATIONS: IntroLocation[] = [
  { slug: 'amsterdam', name: 'Amsterdam', lat: 52.37, lng: 4.9, images: imgs('amsterdam') },
  { slug: 'doha', name: 'Doha', lat: 25.29, lng: 51.53, images: imgs('doha') },
  { slug: 'dubai', name: 'Dubai', lat: 25.2, lng: 55.27, hub: true, images: imgs('dubai') },
  { slug: 'ho-chi-minh', name: 'Ho Chi Minh', lat: 10.82, lng: 106.63, images: imgs('ho-chi-minh') },
  { slug: 'loano', name: 'Loano', lat: 44.13, lng: 8.26, images: imgs('loano') },
  { slug: 'london', name: 'London', lat: 51.51, lng: -0.13, hub: true, images: imgs('london') },
  { slug: 'los-angeles', name: 'Los Angeles', lat: 34.05, lng: -118.24, hub: true, images: imgs('los-angeles') },
  { slug: 'miami', name: 'Miami', lat: 25.76, lng: -80.19, images: imgs('miami') },
  { slug: 'milan', name: 'Milan', lat: 45.46, lng: 9.19, hub: true, images: imgs('milan') },
  { slug: 'monte-carlo', name: 'Monte-Carlo', subtitle: 'Headquarters', lat: 43.74, lng: 7.42, hub: true, images: imgs('monte-carlo') },
  { slug: 'new-york', name: 'New York', lat: 40.71, lng: -74.01, images: imgs('new-york') },
  { slug: 'paris', name: 'Paris', lat: 48.86, lng: 2.35, images: imgs('paris') },
  { slug: 'rome', name: 'Rome', lat: 41.9, lng: 12.5, images: imgs('rome') },
  { slug: 'shanghai', name: 'Shanghai', lat: 31.23, lng: 121.47, hub: true, images: imgs('shanghai') },
  { slug: 'singapore', name: 'Singapore', lat: 1.35, lng: 103.82, images: imgs('singapore') },
  { slug: 'st-moritz', name: 'St. Moritz', lat: 46.5, lng: 9.84, images: imgs('st-moritz') },
  { slug: 'taichung', name: 'Taichung', lat: 24.15, lng: 120.67, images: imgs('taichung') },
  { slug: 'tokyo', name: 'Tokyo', lat: 35.68, lng: 139.69, images: imgs('tokyo') },
  { slug: 'torino', name: 'Torino', lat: 45.07, lng: 7.69, images: imgs('torino') },
  { slug: 'toronto', name: 'Toronto', lat: 43.65, lng: -79.38, images: imgs('toronto') },
];

export const INITIAL_LOCATION_SLUG = 'monte-carlo';
