/** Coordenadas do corredor fluvial Tabatinga → Manaus (Rio Solimões). */
export const FLUVIAL_TABATINGA = { lat: -4.2317, lng: -69.9389, label: 'Tabatinga' };
export const FLUVIAL_MANAUS = { lat: -3.119, lng: -60.0217, label: 'Manaus' };

/** Cidades de referência ao longo do Solimões (oeste → leste). */
export const FLUVIAL_RIVER_CITIES = [
  { id: 'tabatinga', label: 'Tabatinga', lat: FLUVIAL_TABATINGA.lat, lng: FLUVIAL_TABATINGA.lng, sublabel: 'Porto Voyager' },
  { id: 'fonte-boa', label: 'Fonte Boa', lat: -2.52, lng: -66.08 },
  { id: 'tefe', label: 'Tefé', lat: -3.35, lng: -64.71 },
  { id: 'coari', label: 'Coari', lat: -4.08, lng: -63.14 },
  { id: 'manaus', label: 'Manaus', lat: FLUVIAL_MANAUS.lat, lng: FLUVIAL_MANAUS.lng, sublabel: 'Terminal leste' },
];

/** Trecho do Solimões — segue o meandro do rio (Tabatinga → Manaus). */
export const FLUVIAL_SOLIMOES_WAYPOINTS = [
  [FLUVIAL_TABATINGA.lat, FLUVIAL_TABATINGA.lng],
  [-4.18, -69.15],
  [-4.05, -68.35],
  [-3.72, -67.55],
  [-3.35, -66.85],
  [-2.52, -66.08],
  [-2.78, -65.45],
  [-3.35, -64.71],
  [-3.72, -64.05],
  [-4.08, -63.14],
  [-3.92, -62.15],
  [-3.55, -61.25],
  [-3.28, -60.55],
  [FLUVIAL_MANAUS.lat, FLUVIAL_MANAUS.lng],
];

export const FLUVIAL_MAP_BOUNDS = [
  [FLUVIAL_TABATINGA.lat - 0.35, FLUVIAL_TABATINGA.lng - 0.45],
  [FLUVIAL_MANAUS.lat + 0.35, FLUVIAL_MANAUS.lng + 0.45],
];

/** Tiles OSM raster — sem API key (opção B). */
export const FLUVIAL_TILE_URLS = {
  dark: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    darkFilter: true,
  },
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
    darkFilter: false,
  },
};

/** @deprecated Preferir projectBoatToLatLng — mantido para compatibilidade. */
export function projectFluvialXYToLatLng(x, y) {
  const t = Math.max(0, Math.min(1, (x - 12) / 76));
  const lat = FLUVIAL_TABATINGA.lat + (FLUVIAL_MANAUS.lat - FLUVIAL_TABATINGA.lat) * t;
  const lng = FLUVIAL_TABATINGA.lng + (FLUVIAL_MANAUS.lng - FLUVIAL_TABATINGA.lng) * t;
  const lane = (y - 47) * 0.04;
  return [lat + lane, lng];
}

export function isDockedState(state) {
  return ['doca_manaus', 'doca_manaus_final', 'doca_tabatinga', 'aguardando'].includes(state);
}

export function isTabatingaDock(state) {
  return state === 'doca_tabatinga';
}

export function isManausDock(state) {
  return ['doca_manaus', 'doca_manaus_final', 'aguardando'].includes(state);
}
