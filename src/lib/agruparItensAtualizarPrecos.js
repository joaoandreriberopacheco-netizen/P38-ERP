import { formatarSoData } from '@/components/utils/dateUtils';

const cmpNome = (a, b) =>
  String(a?.produto_nome || '').localeCompare(String(b?.produto_nome || ''), 'pt-BR', { sensitivity: 'base' });

function sortItensAlfabeticamente(itens) {
  return [...itens].sort(cmpNome);
}

function buildGrupo(key, label, itens) {
  return {
    key,
    label,
    items: sortItensAlfabeticamente(itens),
  };
}

/**
 * @param {Array} itensCalc — linhas já enriquecidas pelo diálogo
 * @param {'alfabetica'|'pedido'|'fornecedor'|'eta'} modo
 */
export function agruparItensAtualizarPrecos(itensCalc = [], modo = 'alfabetica') {
  if (!itensCalc.length) return [];

  if (modo === 'alfabetica') {
    return [buildGrupo('alfabetica', null, itensCalc)];
  }

  const map = new Map();

  for (const item of itensCalc) {
    let groupKey;
    let groupLabel;

    if (modo === 'pedido') {
      const num = item._pedido_numero || 'Sem número';
      groupKey = `pedido:${item._pedido_id || num}`;
      groupLabel = num;
      const forn = item._fornecedor_nome;
      if (forn) groupLabel += ` · ${forn}`;
    } else if (modo === 'fornecedor') {
      const forn = item._fornecedor_nome || 'Sem fornecedor';
      groupKey = `fornecedor:${forn}`;
      groupLabel = forn;
    } else if (modo === 'eta') {
      const eta = item._eta || '';
      groupKey = eta ? `eta:${eta}` : 'eta:sem-eta';
      groupLabel = eta ? `ETA ${formatarSoData(eta)}` : 'Sem ETA';
    } else {
      groupKey = 'outros';
      groupLabel = null;
    }

    if (!map.has(groupKey)) {
      map.set(groupKey, { key: groupKey, label: groupLabel, items: [] });
    }
    map.get(groupKey).items.push(item);
  }

  const grupos = [...map.values()].map((g) => ({
    ...g,
    items: sortItensAlfabeticamente(g.items),
  }));

  if (modo === 'pedido') {
    grupos.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR'));
  } else if (modo === 'fornecedor') {
    grupos.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR'));
  } else if (modo === 'eta') {
    grupos.sort((a, b) => {
      const missingA = a.key === 'eta:sem-eta';
      const missingB = b.key === 'eta:sem-eta';
      if (missingA && missingB) return 0;
      if (missingA) return 1;
      if (missingB) return -1;
      return String(a.key).localeCompare(String(b.key), 'pt-BR');
    });
  }

  return grupos;
}
