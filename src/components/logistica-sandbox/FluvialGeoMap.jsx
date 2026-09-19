import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FLUVIAL_MAP_BOUNDS,
  FLUVIAL_RIVER_CITIES,
  FLUVIAL_TILE_URLS,
} from '@/lib/fluvialGeoCoords';
import { getEmbarcacaoDisplayName } from '@/lib/fluvialDisplayUtils';
import { isDockedState } from '@/lib/fluvialGeoCoords';
import { parallelRiverPaths, projectBoatToLatLng } from '@/lib/fluvialRiverPath';

const RIVER_STYLES = {
  dark: {
    aura: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.09)', 'rgba(255,255,255,0.06)'],
    main: 'rgba(255,255,255,0.62)',
    flow: 'rgba(255,255,255,0.28)',
    city: 'rgba(255,255,255,0.88)',
    citySub: 'rgba(255,255,255,0.38)',
    markerBg: 'rgba(12,12,12,0.88)',
    markerText: '#fff',
    markerBorder: 'rgba(255,255,255,0.55)',
    markerActive: '#fff',
    boatFill: '#fff',
  },
  light: {
    aura: ['rgba(30,30,30,0.08)', 'rgba(30,30,30,0.14)', 'rgba(30,30,30,0.08)'],
    main: 'rgba(28,28,28,0.58)',
    flow: 'rgba(28,28,28,0.22)',
    city: 'rgba(18,18,18,0.9)',
    citySub: 'rgba(18,18,18,0.42)',
    markerBg: 'rgba(255,255,255,0.94)',
    markerText: '#111',
    markerBorder: 'rgba(0,0,0,0.18)',
    markerActive: '#111',
    boatFill: '#111',
  },
};

function boatDivIcon(initials, active, vinculoAtivo, theme) {
  const palette = RIVER_STYLES[theme] || RIVER_STYLES.dark;
  const border = active ? `2px solid ${palette.markerActive}` : `1px solid ${palette.markerBorder}`;
  const glow = active ? 'box-shadow:0 0 14px rgba(255,255,255,0.35);' : '';
  const fill = vinculoAtivo ? palette.boatFill : (theme === 'dark' ? 'rgba(255,255,255,0.82)' : 'rgba(18,18,18,0.75)');
  return L.divIcon({
    className: 'fluvial-leaflet-marker',
    html: `<div class="fluvial-leaflet-marker__chip" style="border:${border};background:${palette.markerBg};color:${palette.markerText};${glow}">
      <svg viewBox="0 0 32 16" width="18" height="9" aria-hidden="true">
        <path fill="${fill}" d="M2 11h3l2-4 2 4h3l1.5-6h2.5l-1 6H2zm20-2h6l-1.5 4h-4.5l1-4z"/>
      </svg>
      <span>${initials}</span>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function buildRiverLayers(map, theme) {
  const palette = RIVER_STYLES[theme] || RIVER_STYLES.dark;
  const group = L.layerGroup();

  parallelRiverPaths([-0.04, -0.02, 0, 0.02, 0.04]).forEach((path, index) => {
    const isMain = index === 2;
    L.polyline(path, {
      color: isMain ? palette.main : palette.aura[index < 2 ? index : index - 2],
      weight: isMain ? 3.2 : 1.4,
      opacity: isMain ? 0.95 : 0.7,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(group);
  });

  L.polyline(parallelRiverPaths([0])[0], {
    color: palette.flow,
    weight: 1.2,
    opacity: 0.85,
    dashArray: '4 10',
  }).addTo(group);

  FLUVIAL_RIVER_CITIES.forEach((city) => {
    const marker = L.circleMarker([city.lat, city.lng], {
      radius: 4,
      color: palette.city,
      weight: 1,
      fillColor: theme === 'dark' ? '#0a0a0a' : '#fff',
      fillOpacity: 0.95,
    });
    const label = city.sublabel
      ? `<strong>${city.label}</strong><br/><span style="opacity:0.65;font-size:10px">${city.sublabel}</span>`
      : `<strong>${city.label}</strong>`;
    marker.bindTooltip(label, {
      permanent: true,
      direction: 'top',
      className: `fluvial-city-label fluvial-city-label--${theme}`,
      offset: [0, -6],
    });
    marker.addTo(group);
  });

  group.addTo(map);
  return group;
}

export default function FluvialGeoMap({
  eventos = [],
  selectedFleetKey,
  onSelect,
  mapTheme = 'dark',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const riverRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    map.fitBounds(FLUVIAL_MAP_BOUNDS, { padding: [48, 32, 88, 32] });

    const tile = FLUVIAL_TILE_URLS[mapTheme] || FLUVIAL_TILE_URLS.dark;
    layerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 12,
      subdomains: tile.subdomains || 'abc',
      className: tile.darkFilter ? 'fluvial-osm-tiles--dark' : 'fluvial-osm-tiles--light',
    }).addTo(map);

    riverRef.current = buildRiverLayers(map, mapTheme);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      riverRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layerRef.current) return;

    const tile = FLUVIAL_TILE_URLS[mapTheme] || FLUVIAL_TILE_URLS.dark;
    map.removeLayer(layerRef.current);
    layerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 12,
      subdomains: tile.subdomains || 'abc',
      className: tile.darkFilter ? 'fluvial-osm-tiles--dark' : 'fluvial-osm-tiles--light',
    }).addTo(map);

    if (riverRef.current) {
      map.removeLayer(riverRef.current);
    }
    riverRef.current = buildRiverLayers(map, mapTheme);

    map.getContainer().setAttribute('data-fluvial-theme', mapTheme);
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    eventos.forEach((evento) => {
      const projection = evento.riverProjection;
      if (!projection) return;
      if (isDockedState(projection.state)) return;

      const latlng = projectBoatToLatLng(projection);
      const fleetKey = evento.fleetKey || evento.id;
      const active = selectedFleetKey === fleetKey;
      const marker = L.marker(latlng, {
        icon: boatDivIcon(projection.initials || '—', active, projection.temVinculoAtivo, mapTheme),
        zIndexOffset: active ? 1000 : 0,
      });
      marker.on('click', () => onSelect?.(evento));
      marker.bindTooltip(getEmbarcacaoDisplayName(evento), {
        direction: 'top',
        opacity: 0.92,
        className: `fluvial-vessel-tooltip fluvial-vessel-tooltip--${mapTheme}`,
      });
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [eventos, selectedFleetKey, onSelect, mapTheme]);

  return (
    <div
      ref={containerRef}
      className="fluvial-geo-map"
      data-fluvial-theme={mapTheme}
      role="img"
      aria-label="Mapa do Rio Solimões entre Tabatinga e Manaus"
    />
  );
}
