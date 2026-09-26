/**
 * Estilo A4 “proposta comercial” (referência: scripts/cotacao-miguel-alejandro-osorio.html).
 * Tipografia: Segoe UI no PDF de referência; Inter como fallback web — ver documentoComercialA4Font.js.
 */

import { DOCUMENTO_COMERCIAL_A4_FONT } from '@/lib/documentoComercialA4Font';

export {
  DOCUMENTO_COMERCIAL_A4_FONT,
  DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE,
  ensureDocumentoComercialA4FontLoaded,
} from '@/lib/documentoComercialA4Font';

/** Linha fina de tabela (mesmo peso visual das tabelas do app). */
export const DOCUMENTO_COMERCIAL_A4_BORDER = '#e8e8e8';
export const DOCUMENTO_COMERCIAL_A4_BORDER_STRONG = '#d9d9d9';

/** Separador visual entre colunas na linha de produto. */
export const DOCUMENTO_COMERCIAL_SEP = '·';

export function joinCamposDocumento(...partes) {
  return partes
    .flat()
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(` ${DOCUMENTO_COMERCIAL_SEP} `);
}

export const fmtMoedaBRL = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtNumeroPt = (n, frac = 2) =>
  (Number(n) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });

export const fmtDataDocumento = (d = new Date()) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const unidadeEhM2 = (unidade) => {
  const u = String(unidade || '').trim().toUpperCase().replace('²', '2');
  return u === 'M2' || u === 'MT2';
};

/** Linha de resumo no cabeçalho (ex.: 231,80 M² · 95 cx · R$ 22.750,00). */
export function buildResumoDocumentoComercial(itens = [], total = 0) {
  const lista = Array.isArray(itens) ? itens : [];
  let somaM2 = 0;
  let somaCx = 0;
  for (const item of lista) {
    const qtd = Number(item.qtd ?? item.quantidade) || 0;
    if (unidadeEhM2(item.unidade)) somaM2 += qtd;
    const cx = Number(item.caixas ?? item.quantidade_caixas);
    if (Number.isFinite(cx) && cx > 0) somaCx += cx;
  }
  const partes = [];
  if (somaM2 > 0) partes.push(`${fmtNumeroPt(somaM2)} M²`);
  if (somaCx > 0) partes.push(`${fmtNumeroPt(somaCx, 0)} cx`);
  partes.push(fmtMoedaBRL(total));
  return partes.join(' · ');
}

export function itensTemColunaCaixas(itens = []) {
  return (itens || []).some((item) => {
    const cx = Number(item.caixas ?? item.quantidade_caixas);
    return Number.isFinite(cx) && cx > 0;
  });
}

export function labelColunaQuantidade(itens = []) {
  const lista = itens || [];
  if (lista.length > 0 && lista.every((i) => unidadeEhM2(i.unidade))) return 'Quant (M²)';
  return 'Quant.';
}

export function labelColunaPrecoUnit(itens = []) {
  const lista = itens || [];
  if (lista.length > 0 && lista.every((i) => unidadeEhM2(i.unidade))) return 'Valor unit. (M²)';
  const un = lista[0]?.unidade;
  if (un && lista.every((i) => String(i.unidade || '').toUpperCase() === String(un).toUpperCase())) {
    return `Valor unit. (${un})`;
  }
  return 'Valor unit.';
}

export const documentoComercialA4PageStyle = {
  width: '210mm',
  minHeight: '297mm',
  fontFamily: DOCUMENTO_COMERCIAL_A4_FONT,
  fontWeight: 400,
  fontSize: '13px',
  lineHeight: 1.45,
  color: '#111',
  background: '#fff',
  padding: '18mm 16mm',
  margin: '0 auto',
  WebkitFontSmoothing: 'antialiased',
};

export const documentoComercialA4DocStyle = {
  maxWidth: '680px',
  margin: '0 auto',
  padding: '8px 0 24px',
};

/** Pedido de venda → props do DocumentoComercialA4. */
export function mapPedidoVendaParaDocumentoComercial(pedido, dadosEmpresa, dadosCliente, getUnidadeMedida) {
  const itensRaw = Array.isArray(pedido?.itens) ? pedido.itens : [];
  const itens = [...itensRaw]
    .sort((a, b) => String(a?.produto_nome || '').localeCompare(String(b?.produto_nome || ''), 'pt-BR', { sensitivity: 'base' }))
    .map((item) => ({
      produto_id: item.produto_id,
      nome: item.produto_nome || '',
      qtd: parseFloat(item.quantidade) || 0,
      unidade: getUnidadeMedida ? getUnidadeMedida(item) : (item.unidade_medida || 'UN'),
      preco_unit: parseFloat(item.preco_unitario_praticado) || 0,
      total: parseFloat(item.total) || 0,
      caixas: item.quantidade_caixas ?? item.caixas,
    }));

  const clienteNome = pedido?.cliente_nome || dadosCliente?.nome || '';

  return {
    tipo: 'pedido_venda',
    empresa: dadosEmpresa,
    clienteNome,
    numero: pedido?.numero || '',
    data: pedido?.created_date || new Date(),
    itens,
    subtotal: pedido?.subtotal,
    desconto: pedido?.valor_desconto,
    frete: pedido?.valor_frete,
    freteIncluso: false,
    total: pedido?.valor_total,
    observacoes: pedido?.observacoes || '',
    vendedorNome: pedido?.vendedor_nome || '',
    pagamentos: pedido?.pagamentos || [],
    rodapeLegal: 'Este documento não possui validade fiscal.',
  };
}
