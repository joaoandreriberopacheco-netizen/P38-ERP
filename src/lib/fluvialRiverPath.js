import { FLUVIAL_SOLIMOES_WAYPOINTS } from '@/lib/fluvialGeoCoords';

function segmentLengths(waypoints) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const [lat1, lng1] = waypoints[i];
    const [lat2, lng2] = waypoints[i + 1];
    const len = Math.hypot(lat2 - lat1, lng2 - lng1);
    segments.push({ from: waypoints[i], to: waypoints[i + 1], len });
    total += len;
  }
  return { segments, total };
}

/** Posição normalizada (0 = Tabatinga, 1 = Manaus) ao longo do traçado do rio. */
export function pointOnSolimoesPath(t, laneOffset = 0) {
  const clamped = Math.max(0, Math.min(1, t));
  const { segments, total } = segmentLengths(FLUVIAL_SOLIMOES_WAYPOINTS);
  if (total <= 0) return FLUVIAL_SOLIMOES_WAYPOINTS[0];

  let remaining = clamped * total;
  for (const seg of segments) {
    if (remaining <= seg.len || seg === segments[segments.length - 1]) {
      const ratio = seg.len > 0 ? remaining / seg.len : 0;
      const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * ratio;
      const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * ratio;
      return [lat + laneOffset, lng + laneOffset * 0.35];
    }
    remaining -= seg.len;
  }

  return FLUVIAL_SOLIMOES_WAYPOINTS[FLUVIAL_SOLIMOES_WAYPOINTS.length - 1];
}

/** Distância normalizada de uma cidade ao longo do rio (0–1). */
export function cityProgressOnRiver(lat, lng) {
  const { segments, total } = segmentLengths(FLUVIAL_SOLIMOES_WAYPOINTS);
  if (total <= 0) return 0;

  let bestT = 0;
  let bestDist = Infinity;
  let walked = 0;

  for (const seg of segments) {
    const [lat1, lng1] = seg.from;
    const [lat2, lng2] = seg.to;
    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const lenSq = dx * dx + dy * dy;
    const ratio = lenSq > 0
      ? Math.max(0, Math.min(1, ((lat - lat1) * dx + (lng - lng1) * dy) / lenSq))
      : 0;
    const plat = lat1 + dx * ratio;
    const plng = lng1 + dy * ratio;
    const dist = Math.hypot(lat - plat, lng - plng);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = (walked + seg.len * ratio) / total;
    }
    walked += seg.len;
  }

  return bestT;
}

function laneFromRouteBucket(routeBucket) {
  if (!routeBucket) return 0;
  const match = String(routeBucket).match(/:(\d+)$/);
  if (!match) return 0;
  const bucket = Number(match[1]) || 0;
  return ((bucket % 5) - 2) * 0.012;
}

/** Converte projeção operacional para lat/lng no traçado do Solimões. */
export function projectBoatToLatLng(projection) {
  if (!projection) return FLUVIAL_SOLIMOES_WAYPOINTS[0];

  const { state, segmentProgress = 0, routeBucket, x, y } = projection;
  const lane = laneFromRouteBucket(routeBucket);

  if (state === 'viagem_ida') {
    return pointOnSolimoesPath(1 - segmentProgress, lane);
  }
  if (state === 'viagem_retorno') {
    return pointOnSolimoesPath(segmentProgress, lane);
  }

  // Fallback legado (docas / estados sem rio)
  const t = Math.max(0, Math.min(1, (x - 12) / 76));
  return pointOnSolimoesPath(t, (y - 47) * 0.008);
}

/** Gera traços paralelos ao rio para efeito de corrente (offsets em graus). */
export function parallelRiverPaths(offsets = [-0.035, 0, 0.035]) {
  return offsets.map((offset) => FLUVIAL_SOLIMOES_WAYPOINTS.map(([lat, lng]) => [lat + offset * 0.15, lng + offset]));
}
