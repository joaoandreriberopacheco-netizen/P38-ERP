import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_CORTE_PADRAO = '2026-11-06';

export function normNome(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Abertura 06/11/2026 — nomes na BD podem variar; combina flags + nome. */
export function classificarContaCorte(row) {
  const nome = normNome(row.nome);
  const tipo = normNome(row.tipo || '');
  const isGeral = row.is_caixa_geral === true;
  const isPdv = row.is_caixa_pdv === true;

  if (isGeral || (nome.includes('geral') && nome.includes('caixa'))) {
    return { alvo: 0, ocultar: false };
  }
  if (isPdv || nome.includes('gaveta') || (nome.includes('pdv') && nome.includes('caixa')) || nome === 'caixa pdv') {
    return { alvo: 0, ocultar: false };
  }
  if (nome.includes('brasil') || (nome.includes('banco') && nome.includes('brasil'))) {
    return { alvo: 0, ocultar: false };
  }
  if (tipo.includes('poup') || nome.includes('poupanca') || (nome.includes('poup') && nome.includes('caixa'))) {
    return { alvo: 5997, ocultar: true };
  }
  if (nome.includes('pj') && nome.includes('caixa')) {
    return { alvo: 8.55, ocultar: true };
  }
  return null;
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
