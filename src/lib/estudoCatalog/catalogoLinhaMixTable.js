/**
 * Formatação de eixos — tabela Produto compra | SKUs | Eixos (grelha).
 */

function trim(s) {
  return String(s ?? '').trim();
}

export function normalizeEixoChip(text) {
  return trim(text)
    .replace(/['"]/g, '')
    .replace(/\s*MM\s*/gi, '')
    .replace(/\s*-\s*/g, 'x')
    .replace(/\s+[xX×]\s+/g, 'x')
    .replace(/\s+/g, '')
    .replace(/X/g, 'x')
    .toLowerCase();
}

export function eixoChipText(row) {
  const a = trim(row.eixo_a);
  const b = trim(row.eixo_b);
  const aUp = a.toUpperCase();

  if (a && !['CURTA', 'LONGA', 'MISTO', 'MISTA', 'OUTROS'].includes(aUp)) {
    const fromA = normalizeEixoChip(a);
    if (fromA) return fromA;
  }
  if (b) {
    const fromB = normalizeEixoChip(b);
    if (fromB) return fromB;
  }
  if (aUp === 'MISTO' || aUp === 'MISTA') return 'mista';
  if (a) return normalizeEixoChip(a) || a;
  return trim(row.novo_sku) || trim(row.codigo_interno) || '—';
}

function isBuchaStyle(skus) {
  return skus.length > 0 && skus.every((s) => {
    const a = trim(s.eixo_a).toUpperCase();
    return a === 'CURTA' || a === 'LONGA';
  });
}

function isCurvaEsgoto(skus) {
  return skus.length > 0 && skus.every((s) => trim(s.eixo_a).toUpperCase() === 'CURTA' && /90/i.test(trim(s.eixo_b)));
}

/** Chips para coluna Eixos (grelha). */
export function buildPcEixoDisplay(produtoCompraNome, skus = []) {
  if (!skus.length) return { prefix: '', chips: [] };

  if (isBuchaStyle(skus)) {
    const sizeMap = new Map();
    for (const row of skus) {
      const size = normalizeEixoChip(row.eixo_b) || normalizeEixoChip(row.eixo_a);
      if (!size) continue;
      const prev = sizeMap.get(size) || { text: size, alert: false };
      prev.alert = prev.alert || row.zerado || row.abaixo_ponto;
      sizeMap.set(size, prev);
    }
    return {
      prefix: 'curta/longa x ',
      chips: [...sizeMap.values()].sort((a, b) => a.text.localeCompare(b.text, 'pt-BR', { numeric: true })),
    };
  }

  if (isCurvaEsgoto(skus)) {
    return {
      prefix: 'curta/longa x ',
      chips: [{ text: '90', alert: skus.some((s) => s.zerado || s.abaixo_ponto) }],
    };
  }

  const chips = skus.map((row) => ({
    text: eixoChipText(row),
    alert: row.zerado || row.abaixo_ponto,
  }));

  return { prefix: '', chips };
}

export function collectLinhaBitolas(pcs = [], solos = []) {
  const nums = new Set();
  const all = [...pcs.flatMap((p) => p.skus || []), ...solos];
  for (const row of all) {
    const m = eixoChipText(row).match(/^(\d+)/);
    if (m) nums.add(m[1]);
  }
  return [...nums].sort((a, b) => Number(a) - Number(b));
}

export function coreDisplaySlug(core) {
  return trim(core).toLowerCase().replace(/_/g, '.');
}

/** Ordem legível na loja (tubo → conexões → reduções). */
const PC_ORDER_HINTS = [
  /^TUBO/i,
  /^LUVA SOLD/i,
  /^JOELHO/i,
  /^TE /i,
  /^CAP /i,
  /^UNI/i,
  /^LUVA RED/i,
  /^BUCHA/i,
  /^ADAPTADOR/i,
];

export function sortProdutoCompraRows(rows = []) {
  const score = (name) => {
    const i = PC_ORDER_HINTS.findIndex((re) => re.test(name));
    return i >= 0 ? i : 900;
  };
  return [...rows].sort((a, b) => {
    const sa = score(a.produto_compra_nome || a.name || '');
    const sb = score(b.produto_compra_nome || b.name || '');
    if (sa !== sb) return sa - sb;
    return (a.produto_compra_nome || a.name || '').localeCompare(b.produto_compra_nome || b.name || '', 'pt-BR');
  });
}
