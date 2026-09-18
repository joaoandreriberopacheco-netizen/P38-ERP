/**
 * Uso: npx vite-node scripts/verify-fluvial-initials.mjs
 */
import { getEmbarcacaoInitials } from '../src/lib/fluvialRiverProjection.js';

const CASES = [
  { name: 'Vitória Regia', expected: 'VIT' },
  { name: 'Banzeiro', expected: 'BAN' },
  { name: 'M. Monteiro 2', expected: 'MM2' },
  { name: 'Solimões', expected: 'SOL' },
  { name: 'Rio Negro', expected: 'RNG' },
  { name: 'F/B Vitória Regia', expected: 'VIT' },
  { name: 'N/M Banzeiro', expected: 'BAN' },
];

let failed = 0;
for (const { name, expected } of CASES) {
  const got = getEmbarcacaoInitials({ embarcacao_nome: name });
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${name} → ${got} (esperado ${expected})`);
}

if (failed > 0) {
  console.error(`\n${failed} caso(s) falharam.`);
  process.exit(1);
}

console.log(`\n${CASES.length} casos OK.`);
