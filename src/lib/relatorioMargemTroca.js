/**
 * Troca no Relatório de Margem — receita económica do substituto e dedução do lucro
 * já contabilizado nos itens devolvidos (mesma lógica do caixa / auditoria).
 */
import {
  devolucaoItensRetorno,
  devolucaoItensSubstitutos,
} from '@/lib/substituicoesVendaCaixa';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function pedidoObservacoesMargem(pedido) {
  return String(pedido?.observacoes ?? pedido?.dados?.observacoes ?? '').trim();
}

export function extrairNumeroDevolucaoObservacoesMargem(observacoes) {
  const match = String(observacoes || '').match(/Troca\s+(DT-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

export function devolucaoTrocaAtivaMargem(devolucao) {
  return Boolean(devolucao?.numero) && String(devolucao?.status || '').toLowerCase() !== 'cancelada';
}

/** Índice por número DT-… para resolver troca a partir do pedido substituto. */
export function buildIndiceDevolucaoTrocaMargem(devolucoes = []) {
  const porNumero = new Map();
  for (const devolucao of devolucoes || []) {
    if (!devolucaoTrocaAtivaMargem(devolucao)) continue;
    porNumero.set(String(devolucao.numero).trim().toUpperCase(), devolucao);
  }
  return { porNumero };
}

export function resolverDevolucaoTrocaPedidoMargem(pedido, indice = { porNumero: new Map() }) {
  const numero = extrairNumeroDevolucaoObservacoesMargem(pedidoObservacoesMargem(pedido));
  if (!numero) return null;
  return indice.porNumero.get(numero) || null;
}

/** Valor bruto dos substitutos (crédito devolvido + diferença paga no caixa). */
export function valorSubstitutosTrocaMargem(devolucao, pedido, resolverTotalLinhaVenda) {
  const itensSubstitutos = devolucaoItensSubstitutos(devolucao);
  if (itensSubstitutos.length) {
    return roundMoney(itensSubstitutos.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
  }
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return roundMoney(itens.reduce((sum, item) => sum + resolverTotalLinhaVenda(item), 0));
}

/**
 * Lucro já reconhecido nos itens devolvidos do pedido origem (a deduzir do substituto).
 * @param {object} devolucao
 * @param {object} pedidoOrigem — com itens hidratados
 * @param {Record<string, object>} prodMap
 * @param {{ alocarReceitaPedidoNasLinhas: Function, resolverCustoUnitarioMargem: Function, resolverTotalLinhaVenda: Function, resolveMargemProdutoKey: Function }} deps
 */
export function calcularDeducaoLucroDevolvidoMargem(devolucao, pedidoOrigem, prodMap, deps) {
  if (!devolucao || !pedidoOrigem || !deps) return 0;

  const {
    alocarReceitaPedidoNasLinhas,
    resolverCustoUnitarioMargem,
    itensPedidoValidos,
  } = deps;

  const retornos = devolucaoItensRetorno(devolucao);
  if (!retornos.length) return 0;

  const itensOrigem = itensPedidoValidos(pedidoOrigem);
  const alocacoesOrigem = alocarReceitaPedidoNasLinhas(pedidoOrigem);

  let deducao = 0;
  for (const retorno of retornos) {
    const produtoId = String(retorno.produto_id || '');
    const idx = itensOrigem.findIndex((item) => String(item.produto_id || '') === produtoId);
    if (idx < 0) continue;

    const item = itensOrigem[idx];
    const qtdOriginal =
      Number(item.quantidade_base ?? (Number(item.quantidade) || 0) * Number(item.fator_conversao || 1) ?? item.quantidade ?? 0) || 0;
    const qtdDevolvida = Number(retorno.quantidade_devolvida) || 0;
    if (qtdOriginal <= 0 || qtdDevolvida <= 0) continue;

    const product = produtoId ? prodMap[produtoId] : null;
    const custoUnit = resolverCustoUnitarioMargem(item, product);
    const receitaLinha = alocacoesOrigem[idx]?.receita_liquida ?? 0;
    const lucroLinhaOriginal = receitaLinha - roundMoney(custoUnit * qtdOriginal);
    // Troca no caixa: deduz o lucro integral já contabilizado na linha devolvida (pedido origem).
    deducao += roundMoney(lucroLinhaOriginal);
  }

  return roundMoney(deducao);
}

/**
 * Distribui a dedução de lucro devolvido pelas linhas substitutas do pedido.
 */
export function aplicarDeducaoLucroTrocaSubstituto({
  reportMap,
  pedido,
  devolucao,
  pedidoOrigem,
  prodMap,
  deps,
}) {
  const deducaoTotal = calcularDeducaoLucroDevolvidoMargem(devolucao, pedidoOrigem, prodMap, deps);
  if (deducaoTotal <= 0) return 0;

  const substitutos = devolucaoItensSubstitutos(devolucao);
  const alvos =
    substitutos.length > 0
      ? substitutos.map((item) => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          peso: Number(item.total) || 0,
        }))
      : (pedido?.itens || []).map((item) => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          peso: deps.resolverTotalLinhaVenda(item),
        }));

  const somaPesos = alvos.reduce((sum, alvo) => sum + (Number(alvo.peso) || 0), 0);
  for (const alvo of alvos) {
    const prodKey = deps.resolveMargemProdutoKey(alvo);
    const peso = somaPesos > 0 ? (Number(alvo.peso) || 0) / somaPesos : 1 / Math.max(1, alvos.length);
    const deducaoLinha = roundMoney(deducaoTotal * peso);
    if (!reportMap[prodKey]) continue;
    reportMap[prodKey].lucro_troca_deducao =
      roundMoney((reportMap[prodKey].lucro_troca_deducao || 0) + deducaoLinha);
  }

  return deducaoTotal;
}
