/**
 * Preferências de dedutibilidade do Dízimo por competência (localStorage).
 */

import {
  criarConfigDedutivelPadrao,
  normalizarConfigDedutivelDizimo,
} from '@/lib/dizimoCalculos';

const STORAGE_KEY = 'p38_dizimo_dedutivel_itens_por_competencia';
const STORAGE_KEY_LEGADO = 'p38_dizimo_dedutivel_por_competencia';

const CHAVES_BLOCO_LEGADO = new Set([
  'fixas_recorrentes',
  'folha',
  'budgets',
  'pontuais',
]);

function migrarConfigLegado(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const chaves = Object.keys(raw);
  if (!chaves.some((k) => CHAVES_BLOCO_LEGADO.has(k))) {
    return normalizarConfigDedutivelDizimo(raw);
  }
  return {};
}

function lerMapa(key = STORAGE_KEY) {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function gravarMapa(mapa, key = STORAGE_KEY) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(mapa || {}));
  } catch {
    /* quota / modo privado */
  }
}

export function carregarConfigDedutivelDizimo(competencia) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return criarConfigDedutivelPadrao();
  const mapa = lerMapa(STORAGE_KEY);
  if (mapa[comp]) {
    return normalizarConfigDedutivelDizimo(mapa[comp]);
  }
  const legado = lerMapa(STORAGE_KEY_LEGADO);
  return migrarConfigLegado(legado[comp]);
}

export function salvarConfigDedutivelDizimo(competencia, config) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return;
  const mapa = lerMapa(STORAGE_KEY);
  mapa[comp] = normalizarConfigDedutivelDizimo(config);
  gravarMapa(mapa, STORAGE_KEY);
}
