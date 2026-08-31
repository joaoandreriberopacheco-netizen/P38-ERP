/** Regras TINTA SPRAY — aplicadas ao Excel via scripts/apply-estudo-catalog-excel-decisoes.mjs; manifest lê só o xlsx. */

function normPc(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function isSprayRow(row) {
  const pc = normPc(row.produto_compra_nome || row.produto_compra);
  if (pc === 'TINTA SPRAY' || pc === 'TINTA SPRAY METALICO') return true;
  const linha = normPc(row.linha_nome || row.linha);
  return linha === 'TINTA SPRAY' || linha === 'TINTA SPRAY METALICO';
}

function isMetalicoSpray(row) {
  const blob = `${row.sku_atual || ''} ${row.novo_sku || ''} ${row.produto_compra_nome || ''} ${row.produto_compra || ''}`;
  return /MET[ÁA]LIC/i.test(blob);
}

function extractVolume(text) {
  const m = String(text || '').match(/(\d+)\s*ML/i);
  return m ? `${m[1]} ML` : '';
}

/** Cor após hífen final ou após METÁLIC(A/O). */
function extractCor(text) {
  const s = String(text || '').trim();
  const dash = s.match(/\s-\s([^-]+)$/i);
  if (dash) return dash[1].trim();
  const metal = s.match(/MET[ÁA]LIC[OA]\s*-?\s*(.+)$/i);
  if (metal) return metal[1].trim();
  return '';
}

function buildNovoSku(parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function metaFor(metaByCodigo, codigo, fallback) {
  return metaByCodigo.get(codigo) || fallback;
}

/**
 * @param {object} row — linha do manifest (pré-override bloco)
 * @param {Map<string, object>} metaByCodigo — hierarquiaPortalLinhas por codigo
 */
export function applySprayLinhaRules(row, metaByCodigo) {
  if (!isSprayRow(row)) return row;

  if (isMetalicoSpray(row)) {
    const skuRef = row.sku_atual || row.novo_sku || '';
    const cor = extractCor(skuRef) || row.eixo_a || '';
    const volume = extractVolume(skuRef) || extractVolume(row.eixo_a) || row.eixo_b || '';
    const meta = metaFor(metaByCodigo, 'TINTA_SPRAY_METALICO', {
      codigo: 'TINTA_SPRAY_METALICO',
      nome: 'TINTA SPRAY METÁLICO',
      tipo: 'portfolio',
      ordem: 92,
      grupo: 'pintura',
    });

    return {
      ...row,
      linha: meta.nome,
      linha_display: meta.nome,
      linha_codigo: meta.codigo,
      linha_nome: meta.nome,
      linha_pathway_key: meta.codigo,
      linha_tipo: 'portfolio',
      linha_ordem: meta.ordem ?? 92,
      linha_grupo: meta.grupo || 'pintura',
      produto_compra: 'TINTA SPRAY METÁLICO',
      produto_compra_nome: 'TINTA SPRAY METÁLICO',
      eixo_a: cor,
      eixo_b: volume,
      novo_sku: buildNovoSku(['TINTA SPRAY METÁLICO', cor, volume]),
    };
  }

  const skuRef = row.sku_atual || row.novo_sku || '';
  const volume = extractVolume(row.eixo_a) || extractVolume(skuRef) || row.eixo_a || '';
  const cor = extractCor(skuRef) || row.eixo_b || '';
  const meta = metaFor(metaByCodigo, 'TINTA_SPRAY', {
    codigo: 'TINTA_SPRAY',
    nome: 'TINTA SPRAY',
    tipo: 'portfolio',
    ordem: 91,
    grupo: 'pintura',
  });

  return {
    ...row,
    linha: meta.nome,
    linha_display: meta.nome,
    linha_codigo: meta.codigo,
    linha_nome: meta.nome,
    linha_pathway_key: meta.codigo,
    linha_tipo: 'portfolio',
    linha_ordem: meta.ordem ?? 91,
    linha_grupo: meta.grupo || 'pintura',
    produto_compra: 'TINTA SPRAY',
    produto_compra_nome: 'TINTA SPRAY',
    eixo_a: volume || row.eixo_a,
    eixo_b: cor,
    novo_sku: buildNovoSku(['TINTA SPRAY', volume, cor]),
  };
}

export function applySprayLinhaRulesAll(rows, linhasMestre = []) {
  const metaByCodigo = new Map(
    (linhasMestre || []).map((l) => [l.codigo, l]),
  );
  return rows.map((row) => applySprayLinhaRules(row, metaByCodigo));
}
