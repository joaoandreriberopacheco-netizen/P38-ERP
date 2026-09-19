/**
 * Uso: npx vite-node scripts/verify-fluvial-river-path.mjs
 */
import { FLUVIAL_TABATINGA, FLUVIAL_MANAUS } from '../src/lib/fluvialGeoCoords.js';
import { cityProgressOnRiver, pointOnSolimoesPath, projectBoatToLatLng } from '../src/lib/fluvialRiverPath.js';

function assertNear(label, actual, expectedLat, expectedLng, tolerance = 0.5) {
  const dLat = Math.abs(actual[0] - expectedLat);
  const dLng = Math.abs(actual[1] - expectedLng);
  const ok = dLat < tolerance && dLng < tolerance;
  console.log(`${ok ? '✓' : '✗'} ${label}: [${actual[0].toFixed(3)}, ${actual[1].toFixed(3)}]`);
  if (!ok) process.exitCode = 1;
}

assertNear('t=0 Tabatinga', pointOnSolimoesPath(0), FLUVIAL_TABATINGA.lat, FLUVIAL_TABATINGA.lng, 0.01);
assertNear('t=1 Manaus', pointOnSolimoesPath(1), FLUVIAL_MANAUS.lat, FLUVIAL_MANAUS.lng, 0.01);

const idaMid = projectBoatToLatLng({ state: 'viagem_ida', segmentProgress: 0.5, routeBucket: 'ida:10' });
const retMid = projectBoatToLatLng({ state: 'viagem_retorno', segmentProgress: 0.5, routeBucket: 'ret:10' });
console.log(`✓ viagem_ida 50%: [${idaMid[0].toFixed(3)}, ${idaMid[1].toFixed(3)}]`);
console.log(`✓ viagem_retorno 50%: [${retMid[0].toFixed(3)}, ${retMid[1].toFixed(3)}]`);

const tabProgress = cityProgressOnRiver(FLUVIAL_TABATINGA.lat, FLUVIAL_TABATINGA.lng);
const manProgress = cityProgressOnRiver(FLUVIAL_MANAUS.lat, FLUVIAL_MANAUS.lng);
console.log(`${tabProgress < 0.05 ? '✓' : '✗'} Tabatinga progress ~0 (${tabProgress.toFixed(3)})`);
console.log(`${manProgress > 0.95 ? '✓' : '✗'} Manaus progress ~1 (${manProgress.toFixed(3)})`);

if (!process.exitCode) console.log('\nRiver path OK.');
