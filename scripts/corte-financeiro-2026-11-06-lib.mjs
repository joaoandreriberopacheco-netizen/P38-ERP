import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_CORTE_FINANCEIRO_ABERTURA,
  classificarContaCorteFinanceiro,
  normNomeContaCorte,
} from '../src/lib/corteFinanceiroAbertura.js';

export const DATA_CORTE_PADRAO = DATA_CORTE_FINANCEIRO_ABERTURA;
export const normNome = normNomeContaCorte;

export function classificarContaCorte(row) {
  return classificarContaCorteFinanceiro(row);
}

export function loadDatabaseUrlFromEnvFiles() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', '.env.local'),
    'C:\\dev\\a29-erp\\legacy\\varejosync\\.env.local',
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}
