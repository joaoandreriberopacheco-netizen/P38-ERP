/**
 * Macro-blocos A (Edificações) e B (Instalações: hidráulica + elétrica) — estudo Excel.
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

function findSubBHidraulica(codigo) {
  return load().sub_blocos_b_hidraulica.find((s) => s.codigo === codigo);
}

function findSubBEletrica(codigo) {
  return load().sub_blocos_b_eletrica.find((s) => s.codigo === codigo);
}

/** Classifica SKU hidráulico em B01–B05. */
export function subBlocoHidraulica(row = {}) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);

  if (core === 'AGUA_FRIA_SOLDAVEL' || linha === 'SOLDÁVEL') {
    return findSubBHidraulica('B01');
  }

  if (pcMatch(row, ['TUBO OCRE', 'POCO', 'POÇO', 'CAIXA D AGUA', "CAIXA D'ÁGUA", 'ADAPTADOR CAIXA'])) {
    return findSubBHidraulica('B04');
  }

  if (core === 'ESGOTO' || linha === 'ESGOTO') {
    return findSubBHidraulica('B02');
  }

  if (core === 'AGUA_FRIA_ROSCAVEL' || linha === 'ROSCÁVEL') {
    return findSubBHidraulica('B03');
  }

  if (core === 'HIDRAULICA_GERAL' || linha === 'HIDRÁULICA') {
    if (pcMatch(row, ['REGULADOR P/GAS', 'REGULADOR P GAS'])) return null;
    if (pcMatch(row, ['CAIXA D', 'ADAPTADOR CAIXA', 'VALVULA', 'VÁLVULA', 'POCO', 'POÇO'])) {
      const isPoco = pcMatch(row, ['POCO', 'POÇO']);
      const isCaixa = pcMatch(row, ["CAIXA D'ÁGUA", 'CAIXA D AGUA', 'ADAPTADOR CAIXA']);
      if (isPoco || isCaixa) return findSubBHidraulica('B04');
    }
    return findSubBHidraulica('B05');
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

/** SKU elétrico candidato (com ou sem core). */
export function isEletricaCandidata(row = {}) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  const etapa = String(row.etapa ?? '');
  if (load().cores_eletrica.includes(core)) return true;
  if (etapa.includes('Instalação elétrica')) return true;
  if (etapa.includes('Instalações brutas') && ['ELETRODUTO', 'FIOS ELÉTRICOS', 'MATERIAL ELÉTRICO', 'ILUMINAÇÃO'].includes(linha)) {
    return true;
  }
  if (linha === 'MATERIAL ELÉTRICO' && (etapa.includes('Instalações') || etapa.includes('elétrica'))) return true;
  return false;
}

/** Parte visível → acabamentos (tomada, lâmpada, etc.). */
export function isEletricaAcabamentos(row = {}) {
  const cfg = load();
  if (pcMatch(row, ['RESISTÊNCIA', 'RESISTENCIA']) && pcMatch(row, ['AQUECEDOR', 'SHOWER', 'VERSATIL'])) return true;
  if (pcMatch(row, cfg.acabamentos_eletrica_pc)) return true;
  if (pcMatch(row, cfg.acabamentos_eletrica_sku)) return true;
  const core = String(row.core ?? '').trim();
  if (core === 'ILUMINACAO' && !pcMatch(row, cfg.caixas_espera_pc)) return true;
  if (core === 'PONTOS_ELETRICOS' && !pcMatch(row, cfg.caixas_espera_pc)) return true;
  return false;
}

/** Instalação elétrica = candidato elétrico que não é acabamento visível. */
export function isEletricaInstalacao(row = {}) {
  if (!isEletricaCandidata(row)) return false;
  if (isEletricaAcabamentos(row)) return false;
  if (pcMatch(row, ['REGULADOR P/GAS', 'REGULADOR P GAS'])) return false;
  return true;
}

/** Classifica elétrica de instalação em B06–B09. */
export function subBlocoEletrica(row = {}) {
  const core = String(row.core ?? '').trim();
  const linha = linhaBase(row.linha);
  const cfg = load();

  if (core === 'PADRAO_ELETRICO' || pcMatch(row, ['PONTALETE', 'ATERRAMENTO', 'ROLDANA', 'BENJAMIN PADRAO', 'BENJAMIN PADRÃO', 'ARMAÇÃO NUCLEAR', 'CONTADOR'])) {
    return findSubBEletrica('B06');
  }

  if (core === 'QUADRO_ELETRICO' || pcMatch(row, ['DISJUNTOR', 'QUADRO DE DISTRIBUI'])) {
    return findSubBEletrica('B08');
  }

  if (
    core === 'INFRA_ELETRICA'
    || linha === 'ELETRODUTO'
    || linha === 'FIOS ELÉTRICOS'
    || pcMatch(row, ['ELETRODUTO', 'FIO ELÉTRICO', 'FIO PARALELO', 'CONDUITE', 'GRAMPO P/ FIO', 'CANALETA'])
  ) {
    return findSubBEletrica('B07');
  }

  if (pcMatch(row, ['CAIXINHA DE LUZ', 'PLACA CEGA', 'TAPA-FURO', 'CAIXA DE STOP'])) {
    return findSubBEletrica('B09');
  }

  if (pcMatch(row, ['CAIXA DE LUZ']) && !pcMatch(row, ['CONTADOR'])) {
    return findSubBEletrica('B09');
  }

  if (core === 'PONTOS_ELETRICOS') {
    return findSubBEletrica('B09');
  }

  return findSubBEletrica('B07');
}

export function pathwayDestino(row = {}) {
  if (isEletricaAcabamentos(row)) return 'acabamentos';
  if (isEletricaInstalacao(row)) return 'instalacao';
  if (isHidraulica(row)) return 'instalacao';
  return '';
}
