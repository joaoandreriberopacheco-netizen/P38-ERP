import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';
import { materializePedidosCompraView, getBorrowedStatus } from '@/lib/comprasEmbarqueCards';
import { calcValorTotalPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  MIN_SALDO_PENDENTE_BASE,
  embarqueTemSaldoPendente,
  qtyRecebidaBaseLinha,
  resolveSaldoPendenteEmbarqueBase,
} from '@/lib/embarqueLogisticaHelpers';
import { isNecessidadeRenderizada } from '@/lib/pedidoCompraNecessidade';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { resolveEmbarqueQuantidadeBase } from '@/lib/embarqueQuantityResolve';

export const RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT = '2026-07-20';

function parseDataEmissaoPedido(pedido = {}) {
  const raw = pedido.data_emissao || pedido.data_aprovacao_financeira || pedido.created_date;
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function qtyPedidaBaseItem(item = {}) {
  return resolveEmbarqueQuantidadeBase(
    {
      ...item,
      quantidade_pedida_base: item.quantidade_base,
      quantidade_pedida_apresentacao: item.quantidade_pedida_apresentacao ?? item.quantidade,
      quantidade_pedida: item.quantidade,
    },
    'pedida',
  );
}

function totalPedidoBase(pedido = {}) {
  return roundToTwoDecimals(
    (pedido.itens || []).reduce((acc, item) => acc + qtyPedidaBaseItem(item), 0),
  );
}

function classificarMotivoPendencia(card = {}) {
  const embarque = card._embarque;
  if (card._is_necessidade || isNecessidadeRenderizada(embarque)) {
    return 'Reposição pós-recepção (Necessidade)';
  }
  const linhas = getEmbarqueItensLinhas(embarque);
  const recepcaoIniciada = linhas.some((l) => qtyRecebidaBaseLinha(l) > MIN_SALDO_PENDENTE_BASE);
  const st = String(embarque?.status_recebimento || embarque?.status_recebimento_embarque || '').trim();
  if (/diverg|parcial/i.test(st) || recepcaoIniciada) {
    return 'Saldo não recebido (avaria / divergência)';
  }
  return 'Aguardando embarque / despacho';
}

/**
 * Monta relatório por embarque (cards materializados + consulta modo pendente).
 */
export function buildRelatorioPendenteEmbarqueFornecedor(
  pedidos = [],
  embarquesDb = [],
  produtosMap = {},
  options = {},
) {
  const {
    dataEmissaoMin = RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT,
    fornecedorNorm = '',
    incluirCardsSemItensConsulta = false,
  } = options;

  const fornecedorFiltro = String(fornecedorNorm || '').trim().toLowerCase();
  const { cardsDeEmbarque } = materializePedidosCompraView(pedidos, embarquesDb, produtosMap);
  const pedidoPorId = new Map(pedidos.map((p) => [p.id, p]));
  const totaisPedidoCache = new Map();

  const getTotaisPedido = (pedidoId) => {
    if (totaisPedidoCache.has(pedidoId)) return totaisPedidoCache.get(pedidoId);
    const pedido = pedidoPorId.get(pedidoId) || {};
    const tot = {
      valor: calcValorTotalPedidoCompra(pedido),
      base: totalPedidoBase(pedido),
    };
    totaisPedidoCache.set(pedidoId, tot);
    return tot;
  };

  const embarques = [];

  for (const card of cardsDeEmbarque) {
    const dataEmissao = parseDataEmissaoPedido(card);
    if (dataEmissaoMin && dataEmissao && dataEmissao < dataEmissaoMin) continue;
    if (dataEmissaoMin && !dataEmissao) continue;

    const fornecedor = String(card.fornecedor_nome || card._display_fornecedor || '—').trim();
    if (fornecedorFiltro && !fornecedor.toLowerCase().includes(fornecedorFiltro)) continue;

    const displayStatusRaw = getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []);
    // Pedido «Concluído com Divergência» pode marcar o card Concluído mesmo com saldo no split — consulta usa o saldo real.
    const displayStatus =
      displayStatusRaw === 'Concluído' && embarqueTemSaldoPendente(card._embarque)
        ? 'Despachado'
        : displayStatusRaw;
    const itensConsulta = buildConsultaItensEmbarque(
      { ...card, _display_status: displayStatus },
      produtosMap,
      { modo: 'pendente' },
    );
    if (!itensConsulta.length && !incluirCardsSemItensConsulta) continue;
    if (displayStatus === 'Concluído' && !itensConsulta.length) continue;

    const valorPendente = calcConsultaValorEmbarque(card, itensConsulta, { modo: 'pendente' });
    const basePendente = roundToTwoDecimals(
      itensConsulta.reduce((acc, item) => acc + (Number(item.quantidade_base) || 0), 0),
    );
    const { valor: valorPedido, base: basePedido } = getTotaisPedido(card.id);

    const pctValorPedido = valorPedido > 0
      ? roundToTwoDecimals((valorPendente / valorPedido) * 100)
      : 0;
    const pctBasePedido = basePedido > 0
      ? roundToTwoDecimals((basePendente / basePedido) * 100)
      : 0;

    embarques.push({
      pedido_id: card.id,
      pedido_numero: card.numero,
      data_emissao: dataEmissao,
      fornecedor,
      embarque_codigo: card._display_code || card.numero,
      embarque_ordinal: card._display_ordinal || '',
      display_status: displayStatusRaw,
      motivo: classificarMotivoPendencia(card),
      valor_pedido: valorPedido,
      valor_pendente: valorPendente,
      pct_valor_sobre_pedido: pctValorPedido,
      base_pedido: basePedido,
      base_pendente: basePendente,
      pct_base_sobre_pedido: pctBasePedido,
      itens: itensConsulta.map((item) => ({
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        unidade: item.unidade_medida,
        valor: Number(item.valor_total_item) || Number(item.total) || 0,
      })),
    });
  }

  embarques.sort((a, b) => {
    const fa = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
    if (fa !== 0) return fa;
    const da = a.data_emissao || '';
    const db = b.data_emissao || '';
    if (da !== db) return da.localeCompare(db);
    return String(a.embarque_codigo).localeCompare(String(b.embarque_codigo), 'pt-BR');
  });

  const porFornecedor = {};
  for (const row of embarques) {
    if (!porFornecedor[row.fornecedor]) {
      porFornecedor[row.fornecedor] = {
        fornecedor: row.fornecedor,
        embarques: [],
        valor_pendente: 0,
      };
    }
    porFornecedor[row.fornecedor].embarques.push(row);
    porFornecedor[row.fornecedor].valor_pendente = roundToTwoDecimals(
      porFornecedor[row.fornecedor].valor_pendente + row.valor_pendente,
    );
  }

  return {
    geradoEm: new Date().toISOString(),
    dataEmissaoMin,
    totalEmbarques: embarques.length,
    embarques,
    fornecedores: Object.values(porFornecedor).sort((a, b) =>
      a.fornecedor.localeCompare(b.fornecedor, 'pt-BR'),
    ),
  };
}

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(n) {
  return `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** HTML para partilha com fornecedor (A4, estilo neutro). */
export function renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio = {}, tituloExtra = '') {
  const geradoEm = new Date(relatorio.geradoEm || Date.now()).toLocaleString('pt-BR', {
    timeZone: 'America/Manaus',
  });
  const dataMin = relatorio.dataEmissaoMin || RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT;

  const blocos = (relatorio.fornecedores || []).map((grupo) => {
    const cards = grupo.embarques.map((emb) => {
      const linhas = (emb.itens || []).map(
        (item) => `
        <tr>
          <td>${item.produto_nome}</td>
          <td class="num">${Number(item.quantidade).toLocaleString('pt-BR')}</td>
          <td class="num">${item.unidade || ''}</td>
          <td class="num">${brl(item.valor)}</td>
        </tr>`,
      ).join('');

      return `
      <article class="embarque">
        <header class="embarque-head">
          <div>
            <strong>${emb.embarque_codigo}</strong>
            <span class="muted"> · Pedido ${emb.pedido_numero} · emissão ${fmtData(emb.data_emissao)}</span>
          </div>
          <div class="badges">
            <span class="badge">${emb.motivo}</span>
            <span class="badge pct">${pct(emb.pct_valor_sobre_pedido)} do pedido</span>
          </div>
        </header>
        <p class="resumo-embarque">
          Pendente: <strong>${brl(emb.valor_pendente)}</strong>
          · ${pct(emb.pct_valor_sobre_pedido)} do valor do pedido (${brl(emb.valor_pedido)})
          · ${pct(emb.pct_base_sobre_pedido)} em quantidade (base)
        </p>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th class="num">Qtd pend.</th>
              <th class="num">Un.</th>
              <th class="num">Valor</th>
            </tr>
          </thead>
          <tbody>${linhas || '<tr><td colspan="4" class="muted">Sem linhas detalhadas</td></tr>'}</tbody>
        </table>
      </article>`;
    }).join('');

    return `
    <section class="fornecedor">
      <h2>${grupo.fornecedor}</h2>
      <p class="sub">${grupo.embarques.length} embarque(s) · total pendente ${brl(grupo.valor_pendente)}</p>
      ${cards}
    </section>`;
  }).join('');

  const titulo = tituloExtra || 'Pendências por embarque — visão fornecedor';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${titulo}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px; line-height: 1.45; color: #111; background: #fff; margin: 0; padding: 24px;
    }
    .doc { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    h2 { font-size: 17px; margin: 28px 0 6px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
    .sub { color: #555; margin: 0 0 14px; font-size: 12px; }
    .embarque { margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid #efefef; }
    .embarque-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge { font-size: 11px; background: #f3f4f6; padding: 2px 8px; border-radius: 999px; }
    .badge.pct { background: #fef3c7; color: #92400e; }
    .resumo-embarque { margin: 0 0 8px; font-size: 12px; color: #333; }
    .muted { color: #888; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 5px 0; border-bottom: 1px solid #f0f0f0; text-align: left; vertical-align: top; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    thead th { font-size: 11px; color: #444; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="doc">
    <h1>${titulo}</h1>
    <p class="meta">
      Gerado em ${geradoEm} · Pedidos com emissão a partir de ${fmtData(dataMin)} ·
      ${relatorio.totalEmbarques || 0} embarque(s) com saldo pendente
    </p>
    <p class="meta">
      O percentual «do pedido» compara o valor pendente deste embarque com o valor total do pedido de compra
      (mesma regra da consulta Embarques / aba Saldo a embarcar).
    </p>
    ${blocos || '<p class="muted">Nenhum embarque pendente no período.</p>'}
  </div>
</body>
</html>`;
}
