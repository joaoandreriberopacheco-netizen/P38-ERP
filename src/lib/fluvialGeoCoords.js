/** Coordenadas do corredor fluvial Tabatinga → Manaus (Rio Solimões). */
export const FLUVIAL_TABATINGA = { lat: -4.2317, lng: -69.9389 };
export const FLUVIAL_MANAUS = { lat: -3.119, lng: -60.0217 };

/** Trecho aproximado do Solimões para desenhar a rota no mapa. */
export const FLUVIAL_SOLIMOES_WAYPOINTS = [
  [FLUVIAL_TABATINGA.lat, FLUVIAL_TABATINGA.lng],
  [-4.28, -68.2],
  [-4.12, -66.4],
  [-3.98, -64.5],
  [-3.72, -62.4],
  [-3.45, -61.0],
  [FLUVIAL_MANAUS.lat, FLUVIAL_MANAUS.lng],
];

export const FLUVIAL_MAP_BOUNDS = [
  [FLUVIAL_TABATINGA.lat - 0.35, FLUVIAL_TABATINGA.lng - 0.45],
  [FLUVIAL_MANAUS.lat + 0.35, FLUVIAL_MANAUS.lng + 0.45],
];

export const FLUVIAL_TILE_URLS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
};

/** Converte posição projetada (0–100) para lat/lng no corredor. */
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
