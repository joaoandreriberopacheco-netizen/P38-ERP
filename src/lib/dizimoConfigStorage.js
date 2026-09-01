/**
 * Preferências de dedutibilidade do Dízimo por competência (localStorage).
 */

import {
  criarConfigDedutivelPadrao,
  normalizarConfigDedutivelDizimo,
} from '@/lib/dizimoCalculos';

const STORAGE_KEY = 'p38_dizimo_dedutivel_por_competencia';

function lerMapa() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function gravarMapa(mapa) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa || {}));
  } catch {
    /* quota / modo privado */
  }
}

export function carregarConfigDedutivelDizimo(competencia) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return criarConfigDedutivelPadrao();
  const mapa = lerMapa();
  return normalizarConfigDedutivelDizimo(mapa[comp] || criarConfigDedutivelPadrao());
}

export function salvarConfigDedutivelDizimo(competencia, config) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return;
  const mapa = lerMapa();
  mapa[comp] = normalizarConfigDedutivelDizimo(config);
  gravarMapa(mapa);
}
