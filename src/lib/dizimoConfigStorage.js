/**
 * Preferências de dedutibilidade do Dízimo por competência (localStorage).
 */

import { shiftCompetencia } from '@/lib/budgetCalculos';
import {
  criarConfigDedutivelPadrao,
  normalizarConfigDedutivelDizimo,
  normalizarConfigItemDizimo,
  resolverConfigItensDizimo,
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
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(mapa || {}));
    return true;
  } catch (error) {
    console.error('[dizimoConfigStorage] falha ao gravar localStorage:', error);
    return false;
  }
}

/**
 * Carrega configuração resolvida para a competência.
 * @param {string} competencia — YYYY-MM
 * @param {{ recorrentes?: string[], ocasionais?: string[] }} contextoItens
 */
export function carregarConfigDedutivelDizimo(competencia, contextoItens = {}) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return criarConfigDedutivelPadrao();

  const mapa = lerMapa(STORAGE_KEY);
  let configExplicita = mapa[comp] ? normalizarConfigDedutivelDizimo(mapa[comp]) : null;

  if (!configExplicita) {
    const legado = lerMapa(STORAGE_KEY_LEGADO);
    const migrado = migrarConfigLegado(legado[comp]);
    if (Object.keys(migrado).length) {
      configExplicita = migrado;
    }
  }

  const mesAnterior = shiftCompetencia(comp, -1);
  const configMesAnterior = mapa[mesAnterior] ? normalizarConfigDedutivelDizimo(mapa[mesAnterior]) : {};

  const { recorrentes = [], ocasionais = [] } = contextoItens;
  if (!recorrentes.length && !ocasionais.length) {
    return configExplicita || criarConfigDedutivelPadrao();
  }

  return resolverConfigItensDizimo({
    configExplicita: configExplicita || {},
    configMesAnterior,
    recorrentes,
    ocasionais,
  });
}

export function salvarConfigDedutivelDizimo(competencia, config) {
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return false;
  const mapa = lerMapa(STORAGE_KEY);
  const atual = mapa[comp] ? normalizarConfigDedutivelDizimo(mapa[comp]) : {};
  mapa[comp] = normalizarConfigDedutivelDizimo({ ...atual, ...config });
  return gravarMapa(mapa, STORAGE_KEY);
}

/** Persiste um único item (merge no mês) — usado ao alterar dedutibilidade na UI. */
export function salvarItemConfigDedutivelDizimo(competencia, itemId, config) {
  const comp = String(competencia || '').slice(0, 7);
  const id = String(itemId || '').trim();
  if (!comp || !id) return false;
  const mapa = lerMapa(STORAGE_KEY);
  const atual = mapa[comp] ? normalizarConfigDedutivelDizimo(mapa[comp]) : {};
  atual[id] = normalizarConfigItemDizimo(config);
  mapa[comp] = atual;
  return gravarMapa(mapa, STORAGE_KEY);
}
