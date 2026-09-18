import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FLUVIAL_MAP_BOUNDS,
  FLUVIAL_SOLIMOES_WAYPOINTS,
  FLUVIAL_TABATINGA,
  FLUVIAL_MANAUS,
  FLUVIAL_TILE_URLS,
  projectFluvialXYToLatLng,
} from '@/lib/fluvialGeoCoords';
import { getEmbarcacaoDisplayName } from '@/lib/fluvialDisplayUtils';
import { isDockedState } from '@/lib/fluvialGeoCoords';

function boatDivIcon(initials, active, vinculoAtivo) {
  const border = active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.55)';
  const glow = active ? 'box-shadow:0 0 12px rgba(255,255,255,0.45);' : '';
  const fill = vinculoAtivo ? '#fff' : 'rgba(255,255,255,0.85)';
  return L.divIcon({
    className: 'fluvial-leaflet-marker',
    html: `<div class="fluvial-leaflet-marker__chip" style="border:${border};${glow}">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="${fill}" d="M12 2.5c3.2 0 5.8 1.1 7.4 2.8-.5 4.8-2.4 9.2-5.1 12.1-.8.8-1.9 1.3-3.1 1.3s-2.3-.5-3.1-1.3C5.4 14.5 3.5 10.1 3 5.3 4.6 3.6 7.2 2.5 12 2.5Z"/>
      </svg>
      <span>${initials}</span>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
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
  const markersRef = useRef([]);
  const routeRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    map.fitBounds(FLUVIAL_MAP_BOUNDS, { padding: [24, 24] });

    const tile = FLUVIAL_TILE_URLS[mapTheme] || FLUVIAL_TILE_URLS.dark;
    layerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 12,
      subdomains: 'abcd',
    }).addTo(map);

    routeRef.current = L.polyline(FLUVIAL_SOLIMOES_WAYPOINTS, {
      color: mapTheme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)',
      weight: 2.5,
      opacity: 0.85,
      dashArray: '6 8',
    }).addTo(map);

    L.circleMarker([FLUVIAL_TABATINGA.lat, FLUVIAL_TABATINGA.lng], {
      radius: 5,
      color: '#fff',
      weight: 1,
      fillColor: mapTheme === 'dark' ? '#111' : '#fff',
      fillOpacity: 0.9,
    }).bindTooltip('Tabatinga', { permanent: false, direction: 'top' }).addTo(map);

    L.circleMarker([FLUVIAL_MANAUS.lat, FLUVIAL_MANAUS.lng], {
      radius: 5,
      color: '#fff',
      weight: 1,
      fillColor: mapTheme === 'dark' ? '#111' : '#fff',
      fillOpacity: 0.9,
    }).bindTooltip('Manaus', { permanent: false, direction: 'top' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current = [];
      routeRef.current = null;
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
      subdomains: 'abcd',
    }).addTo(map);

    if (routeRef.current) {
      routeRef.current.setStyle({
        color: mapTheme === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)',
      });
    }

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

      const latlng = projectFluvialXYToLatLng(projection.x, projection.y);
      const fleetKey = evento.fleetKey || evento.id;
      const active = selectedFleetKey === fleetKey;
      const marker = L.marker(latlng, {
        icon: boatDivIcon(projection.initials || '—', active, projection.temVinculoAtivo),
        zIndexOffset: active ? 1000 : 0,
      });
      marker.on('click', () => onSelect?.(evento));
      marker.bindTooltip(getEmbarcacaoDisplayName(evento), { direction: 'top', opacity: 0.92 });
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [eventos, selectedFleetKey, onSelect]);

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
