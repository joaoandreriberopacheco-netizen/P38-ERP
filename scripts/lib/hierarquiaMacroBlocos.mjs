/**
 * Macro-blocos A (Edificações) e B (Instalações / hidráulica) — estudo Excel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JSON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/hierarquiaMacroBlocos.json');

let _cache = null;

function load() {
  if (!_cache) _cache = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  return _cache;
}

export function getMacroConfig() {
  return load();
}

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function linhaBase(linha = '') {
  return String(linha ?? '').replace(/·[NRC]$/i, '').trim();
}

export function subBlocoEdificacoes(etapa = '') {
  const hit = load().sub_blocos_a.find((s) => s.etapa === String(etapa ?? '').trim());
  return hit ? { codigo: hit.codigo, nome: `${hit.codigo} ${hit.nome}` } : { codigo: 'A?', nome: etapa || '(sem etapa)' };
}

function pcMatch(row, patterns = []) {
  const pc = norm(row.produto_compra);
  const sku = norm(row.sku_atual);
  return patterns.some((p) => {
    const n = norm(p);
    return pc.includes(n) || sku.includes(n);
  });
}

/** Classifica SKU hidráulico em B01–B05. */
export function subBlocoHidraulica(row = {}) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  const cfg = load();

  if (core === 'AGUA_FRIA_SOLDAVEL' || linha === 'SOLDÁVEL') {
    return cfg.sub_blocos_b.find((s) => s.codigo === 'B01');
  }

  if (pcMatch(row, ['TUBO OCRE', 'POCO', 'POÇO', 'CAIXA D AGUA', "CAIXA D'ÁGUA", 'ADAPTADOR CAIXA'])) {
    return cfg.sub_blocos_b.find((s) => s.codigo === 'B04');
  }

  if (core === 'ESGOTO' || linha === 'ESGOTO') {
    return cfg.sub_blocos_b.find((s) => s.codigo === 'B02');
  }

  if (core === 'AGUA_FRIA_ROSCAVEL' || linha === 'ROSCÁVEL') {
    return cfg.sub_blocos_b.find((s) => s.codigo === 'B03');
  }

  if (core === 'HIDRAULICA_GERAL' || linha === 'HIDRÁULICA') {
    if (pcMatch(row, ['CAIXA D', 'ADAPTADOR CAIXA', 'VALVULA', 'VÁLVULA', 'POCO', 'POÇO'])) {
      const isPoco = pcMatch(row, ['POCO', 'POÇO']);
      const isCaixa = pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'ADAPTADOR CAIXA']);
      if (isPoco || isCaixa) return cfg.sub_blocos_b.find((s) => s.codigo === 'B04');
    }
    return cfg.sub_blocos_b.find((s) => s.codigo === 'B05');
  }

  return null;
}

export function isEtapaEdificacoes(etapa = '') {
  return load().etapas_a.includes(String(etapa ?? '').trim());
}

export function isHidraulica(row = {}) {
  const core = String(row.core ?? '').trim();
  return load().cores_hidraulica.includes(core);
}
