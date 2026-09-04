/**
 * Simula render do formulário com dados reais problemáticos (sem browser).
 */
import assert from 'node:assert/strict';
import {
  buildProductSnapshotForPricing,
  buildSaleUnitOptions,
  normalizeAlternativeUnits,
} from '../src/lib/productUnits.js';
import { normalizeSigla } from '../src/lib/productUnitsCrud.js';
import { syncIsComercialOnAlternativas } from '../src/components/produtos/massa/embalagensPlanilhaUtils.js';
import { formatProductCode } from '../src/lib/productCode.js';

const SELECT_NONE = '__none__';
const SELECT_ORPHAN_CAT_PREFIX = '__orphan_cat__:';

function resolveEntitySelectValue(selectedId, options, { noneValue = SELECT_NONE, orphanPrefix } = {}) {
  const id = String(selectedId || '').trim();
  if (!id) return noneValue;
  if (!Array.isArray(options) || options.length === 0) return noneValue;
  return options.some((o) => String(o?.id || '') === id) ? id : `${orphanPrefix}${id}`;
}

function buildFormDataFromProduto(produtoData) {
  const lista = Array.isArray(produtoData?.unidades_alternativas) ? produtoData.unidades_alternativas : [];
  const normalizedAlts = lista.slice(0, 5).filter((u) => String(u?.unidade || '').trim()).map((u) => ({
    ...u,
    unidade: normalizeSigla(u?.unidade) || String(u?.unidade || '').trim().toUpperCase(),
  }));
  const principalFinal = normalizeSigla(produtoData?.unidade_principal) || 'UN';
  const vitrineStored = normalizeSigla(produtoData?.unidade_vitrine) || '';
  const altsComIsComercial = syncIsComercialOnAlternativas(normalizedAlts, vitrineStored, principalFinal);
  return {
    ...produtoData,
    codigo_interno: formatProductCode(produtoData?.codigo_interno || ''),
    tags: Array.isArray(produtoData?.tags) ? produtoData.tags : [],
    unidades_alternativas: altsComIsComercial,
    unidade_principal: principalFinal,
    unidade_vitrine: vitrineStored,
  };
}

function simulateOpen(produto, categorias = [], fornecedores = []) {
  const formData = buildFormDataFromProduto(produto);
  const snapshot = buildProductSnapshotForPricing(formData, 10);
  const vendasUnitOptions = buildSaleUnitOptions(snapshot, 1);
  const categoriaSelectValue = resolveEntitySelectValue(formData.categoria_id, categorias, { orphanPrefix: SELECT_ORPHAN_CAT_PREFIX });
  const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
  const alternativas = (formData.unidades_alternativas || []).map((u) => normalizeSigla(u?.unidade) || '').filter(Boolean);
  const unitOptions = [principal, ...alternativas.filter((u) => u !== principal)];
  const comercialSelectValue = normalizeSigla(formData.unidade_vitrine) || principal;
  const commercialSelectOptions = [...unitOptions];
  if (comercialSelectValue && !commercialSelectOptions.includes(comercialSelectValue)) commercialSelectOptions.push(comercialSelectValue);
  const selectItemValues = [
    SELECT_NONE,
    categoriaSelectValue,
    ...categorias.map((c) => c.id),
    ...commercialSelectOptions,
    ...vendasUnitOptions.map((o) => o.unidade),
  ];
  for (const v of selectItemValues) {
    if (v === '' || v == null) throw new Error(`SelectItem com valor inválido: ${JSON.stringify(v)}`);
  }
  return { formData, vendasUnitOptions, categoriaSelectValue, commercialSelectOptions };
}

const cases = [
  { name: 'novo vazio', produto: null },
  { name: 'tags string', produto: { tags: 'a,b', unidade_principal: 'UN' } },
  { name: 'alt sem id', produto: { unidade_principal: 'UN', unidades_alternativas: [{ unidade: 'CX', fator_conversao: 2 }] } },
  { name: 'categoria órfã', produto: { categoria_id: 'cat-x', unidade_principal: 'UN' }, categorias: [{ id: 'cat-y', nome: 'Outra' }] },
  { name: 'cat id vazio na lista', produto: { unidade_principal: 'UN' }, categorias: [{ id: '', nome: 'Ruim' }, { id: 'ok', nome: 'OK' }] },
  { name: 'vitrine inválida', produto: { unidade_principal: 'UN', unidade_vitrine: 'ZZ', unidades_alternativas: [{ unidade: 'CX', fator_conversao: 2, id: '1' }] } },
  { name: 'principal vazio', produto: { unidade_principal: '', unidades_alternativas: [] } },
];

let failed = 0;
for (const c of cases) {
  try {
    simulateOpen(c.produto || {}, c.categorias || [], c.fornecedores || []);
    console.log(`[ok] ${c.name}`);
  } catch (e) {
    failed += 1;
    console.log(`[FAIL] ${c.name}: ${e.message}`);
  }
}

// crypto ausente
const saved = globalThis.crypto?.randomUUID;
if (globalThis.crypto) globalThis.crypto.randomUUID = undefined;
try {
  normalizeAlternativeUnits({ unidades_alternativas: [{ unidade: 'CX', fator_conversao: 2 }] });
  console.log('[ok] normalizeAlternativeUnits sem randomUUID');
} catch (e) {
  failed += 1;
  console.log(`[FAIL] crypto: ${e.message}`);
}
if (globalThis.crypto && saved) globalThis.crypto.randomUUID = saved;

assert.equal(failed, 0, `${failed} cenário(s) falharam`);
console.log('\nTodos os cenários passaram.');
