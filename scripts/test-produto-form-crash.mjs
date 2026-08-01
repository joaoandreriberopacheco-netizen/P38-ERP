/**
 * Testes internos (sem browser) para cenários que derrubam o formulário de produto.
 */
import assert from 'node:assert/strict';

// Simula productUnits.normalizeAlternativeUnitRow sem crypto.randomUUID
function normalizeAlternativeUnitRowUnsafe(item = {}) {
  const unidade = String(item.unidade || '').trim().toUpperCase();
  return {
    id: String(item.id || '').trim() || crypto.randomUUID(),
    unidade,
  };
}

function normalizeAlternativeUnitRowSafe(item = {}) {
  const unidade = String(item.unidade || '').trim().toUpperCase();
  let id = String(item.id || '').trim();
  if (!id) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      id = `u_${Date.now().toString(36)}`;
    }
  }
  return { id, unidade };
}

// Sem randomUUID (alguns WebViews antigos)
const original = globalThis.crypto?.randomUUID;
if (globalThis.crypto) {
  globalThis.crypto.randomUUID = undefined;
}

let threw = false;
try {
  normalizeAlternativeUnitRowUnsafe({ unidade: 'CX' });
} catch (e) {
  threw = true;
  console.log('[repro] crypto.randomUUID ausente → crash:', e.message);
}
assert.equal(threw, true, 'esperava crash sem fallback de id');

const safe = normalizeAlternativeUnitRowSafe({ unidade: 'CX' });
assert.ok(safe.id, 'fallback seguro deve gerar id');
console.log('[ok] fallback de id em embalagens sem crypto.randomUUID');

if (original) globalThis.crypto.randomUUID = original;

// Select: valor órfão (categoria carregando)
function resolveEntitySelectValue(selectedId, options, { noneValue = '__none__', orphanPrefix = '__orphan__' } = {}) {
  const id = String(selectedId || '').trim();
  if (!id) return noneValue;
  if (!Array.isArray(options) || options.length === 0) return noneValue;
  return options.some((o) => String(o.id) === id) ? id : `${orphanPrefix}:${id}`;
}

const categoriaId = 'cat-deleted-123';
const antesDeCarregar = resolveEntitySelectValue(categoriaId, []);
assert.equal(antesDeCarregar, '__none__', 'antes de carregar lista → sem valor inválido');

const depois = resolveEntitySelectValue(categoriaId, [{ id: 'outra' }]);
assert.equal(depois, '__orphan__:cat-deleted-123', 'categoria ausente → marcador órfão');

console.log('[ok] select de entidade com valor órfão');
console.log('\nTodos os cenários de regressão passaram.');
