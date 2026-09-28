import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';
import { materializePedidosCompraView, getBorrowedStatus } from '@/lib/comprasEmbarqueCards';
import { calcValorTotalPedidoCompra, getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  MIN_SALDO_PENDENTE_BASE,
  embarqueTemDespachoInformado,
  embarqueTemSaldoPendente,
  qtyRecebidaBaseLinha,
  resolveSaldoPendenteEmbarqueBase,
} from '@/lib/embarqueLogisticaHelpers';
import { isNecessidadeRenderizada } from '@/lib/pedidoCompraNecessidade';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { resolveEmbarqueQuantidadeBase, resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { getItemCompraExibicaoVitrine, commercialQuantityFromBase } from '@/lib/productUnits';
import {
  resolveEmbarqueCodigoExibicao,
  sortEmbarquesParaExibicao,
} from '@/lib/embarqueDisplayUtils';
import { isEmbarqueSaldoPendente } from '@/lib/embarqueTipoSaldoPendente';

export const RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT = '2026-07-20';

const MOTIVO_AGUARDANDO_EMBARQUE = 'Aguardando embarque / despacho';

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

export function extractFormatoProduto(nome = '') {
  const m = String(nome || '').match(/\b(\d{2,3}\s*[x×]\s*\d{2,3})\b/i);
  return m ? m[1].replace(/\s+/g, '').toLowerCase().replace('×', 'x') : 'Outros';
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
  return MOTIVO_AGUARDANDO_EMBARQUE;
}

/** Primeiro despacho real do pedido (split A / principal). */
export function resolveDespachoPrincipalPedido(pedido = {}, embarquesDoPedido = []) {
  const pedidoCtx = { ...pedido, _embarques: embarquesDoPedido };
  const ordenados = sortEmbarquesParaExibicao(embarquesDoPedido, pedidoCtx);
  const principal = ordenados.find(
    (emb) => !isEmbarqueSaldoPendente(emb) && !isNecessidadeRenderizada(emb) && embarqueTemDespachoInformado(emb),
  ) || ordenados.find((emb) => !isEmbarqueSaldoPendente(emb) && !isNecessidadeRenderizada(emb));

  if (!principal) return null;

  const codigo = resolveEmbarqueCodigoExibicao(pedidoCtx, principal);
  const dataEmb = principal.data_embarque ? String(principal.data_embarque).slice(0, 10) : null;
  return {
    codigo,
    data_embarque: dataEmb,
    transportadora: principal.transportadora_nome || '—',
    status_recebimento: principal.status_recebimento || principal.status_recebimento_embarque || '—',
  };
}

function buildLinhaDetalheFornecedor({
  pedido,
  pedidoItem,
  produto,
  sqlLine,
  consultaItem,
  embarqueCodigo,
  valorPedidoTotal,
}) {
  const exib = getItemCompraExibicaoVitrine(pedidoItem, produto);
  const qPedido = qtyComercialPedidoItem(pedidoItem, produto);
  const qEmbarcada = resolveEmbarqueQuantidadeComercial(sqlLine || {}, 'embarcada');
  const qRecebida = resolveEmbarqueQuantidadeComercial(sqlLine || {}, 'recebida');
  const unidade = consultaItem?.unidade_medida || exib.unidade_medida || 'UN';
  const fatorExib = Number(pedidoItem?.fator_conversao ?? exib.fator_conversao ?? 1) || 1;
  const qPendenteBase = Number(consultaItem?.quantidade_base)
    || (sqlLine ? resolveSaldoPendenteEmbarqueBase(sqlLine) : 0)
    || 0;
  let qPendente = Number(consultaItem?.quantidade) || 0;
  if (qPendenteBase > MIN_SALDO_PENDENTE_BASE && fatorExib > 1) {
    const com = commercialQuantityFromBase(qPendenteBase, fatorExib, unidade);
    if (com > 0) qPendente = com;
  } else if (qPedido > 0 && qPendente > qPedido * 1.01 && fatorExib > 1) {
    qPendente = roundToTwoDecimals(qPendente / fatorExib);
  }
  const valorPedidoLinha = getTotalLinhaPedidoCompra(pedidoItem);
  const valorPendente = Number(consultaItem?.valor_total_item) || Number(consultaItem?.total) || 0;
  const precoUnitPendente = qPendente > 0 ? roundToTwoDecimals(valorPendente / qPendente) : 0;

  return {
    produto_id: pedidoItem?.produto_id,
    produto_nome: consultaItem?.produto_nome || pedidoItem?.produto_nome,
    formato: extractFormatoProduto(pedidoItem?.produto_nome),
    embarque_codigo: embarqueCodigo,
    quantidade_pedido: qPedido,
    quantidade_embarcada: qEmbarcada,
    quantidade_recebida: qRecebida,
    quantidade_pendente: qPendente,
    unidade,
    valor_pedido_linha: valorPedidoLinha,
    valor_pendente: valorPendente,
    preco_unitario_pendente: precoUnitPendente,
    pct_cx_sobre_linha_pedido: qPedido > 0
      ? roundToTwoDecimals((qPendente / qPedido) * 100)
      : 0,
    pct_valor_sobre_pedido: valorPedidoTotal > 0
      ? roundToTwoDecimals((valorPendente / valorPedidoTotal) * 100)
      : 0,
    pct_valor_sobre_linha_pedido: valorPedidoLinha > 0
      ? roundToTwoDecimals((valorPendente / valorPedidoLinha) * 100)
      : 0,
  };
}

/** Quantidade comercial (caixa/vitrine) pedida na linha do pedido de compra. */
export function qtyComercialPedidoItem(item = {}, produto = null) {
  const qItem = Number(item?.quantidade);
  const fator = Number(item?.fator_conversao ?? 1) || 1;
  const base = Number(item?.quantidade_base);
  if (Number.isFinite(qItem) && qItem > 0) {
    if (fator > 1 && Number.isFinite(base) && base > 0) {
      const expectedBase = qItem * fator;
      if (Math.abs(expectedBase - base) <= 0.02 * Math.max(1, expectedBase)) {
        return roundToTwoDecimals(qItem);
      }
    }
    if (fator <= 1) return roundToTwoDecimals(qItem);
  }
  const exib = getItemCompraExibicaoVitrine(item, produto);
  return roundToTwoDecimals(Number(exib.quantidade) || qItem || 0);
}

/** Soma caixas (vitrine) de todo o pedido de compra — denominador do % por pedido. */
export function totalCxComercialPedido(pedido = {}, produtosMap = {}) {
  return roundToTwoDecimals(
    (pedido.itens || []).reduce((acc, item) => {
      const produto = produtosMap[item.produto_id] || null;
      return acc + qtyComercialPedidoItem(item, produto);
    }, 0),
  );
}

/** Agrupa avarias do mesmo produto (vários embarques) numa linha por modelo. */
export function consolidarLinhasPorProduto(linhas = [], totalCxPedido = 0) {
  const map = new Map();
  for (const linha of linhas) {
    const key = String(linha.produto_id || linha.produto_nome || '');
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        ...linha,
        quantidade_pendente: 0,
        valor_pendente: 0,
        embarque_codigos: [],
      });
    }
    const acc = map.get(key);
    acc.quantidade_pendente = roundToTwoDecimals(
      acc.quantidade_pendente + (Number(linha.quantidade_pendente) || 0),
    );
    acc.valor_pendente = roundToTwoDecimals(acc.valor_pendente + (Number(linha.valor_pendente) || 0));
    const cod = linha.embarque_codigo;
    if (cod && !acc.embarque_codigos.includes(cod)) acc.embarque_codigos.push(cod);
    acc.quantidade_embarcada = Math.max(
      Number(acc.quantidade_embarcada) || 0,
      Number(linha.quantidade_embarcada) || 0,
    );
    acc.quantidade_recebida = Math.max(
      Number(acc.quantidade_recebida) || 0,
      Number(linha.quantidade_recebida) || 0,
    );
  }

  return [...map.values()]
    .map((l) => ({
      ...l,
      embarque_codigo: (l.embarque_codigos || []).join(', ') || l.embarque_codigo,
      pct_cx_sobre_linha_pedido: l.quantidade_pedido > 0
        ? roundToTwoDecimals((l.quantidade_pendente / l.quantidade_pedido) * 100)
        : 0,
      pct_cx_sobre_pedido_total: totalCxPedido > 0
        ? roundToTwoDecimals((l.quantidade_pendente / totalCxPedido) * 100)
        : 0,
    }))
    .sort((a, b) => String(a.produto_nome).localeCompare(String(b.produto_nome), 'pt-BR'));
}

function finalizarPedidoRelatorio(bloco, pedidoOrigem = {}, produtosMap = {}) {
  const totalCxPedido = totalCxComercialPedido(pedidoOrigem, produtosMap);
  const linhas = consolidarLinhasPorProduto(bloco.linhas, totalCxPedido);
  const totalCxPendente = roundToTwoDecimals(
    linhas.reduce((s, l) => s + (Number(l.quantidade_pendente) || 0), 0),
  );
  const pctCxAvariaSobrePedido = totalCxPedido > 0
    ? roundToTwoDecimals((totalCxPendente / totalCxPedido) * 100)
    : 0;

  return {
    ...bloco,
    linhas,
    total_cx_pedido: totalCxPedido,
    total_cx_pendente: totalCxPendente,
    pct_cx_avaria_sobre_pedido: pctCxAvariaSobrePedido,
    unidade_pedido: linhas[0]?.unidade || 'CX',
    grupos_formato: agruparLinhasPorFormato(linhas),
    pct_valor_pendente_sobre_pedido: bloco.valor_pedido > 0
      ? roundToTwoDecimals((bloco.valor_pendente / bloco.valor_pedido) * 100)
      : 0,
  };
}

/**
 * Relatório estilo órfãos Tintão: pedido original, despacho principal, avarias + % sobre pedido.
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
    /** Foco fornecedor: só saldo pós-embarque / divergência (não «falta embarcar»). */
    somenteSaldoAvaria = true,
  } = options;

  const fornecedorFiltro = String(fornecedorNorm || '').trim().toLowerCase();
  const embarquesPorPedido = embarquesDb.reduce((acc, emb) => {
    const pid = emb.pedido_compra_id;
    if (!pid) return acc;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(emb);
    return acc;
  }, {});

  const { cardsDeEmbarque } = materializePedidosCompraView(pedidos, embarquesDb, produtosMap);
  const pedidoPorId = new Map(pedidos.map((p) => [p.id, p]));
  const totaisPedidoCache = new Map();
  const pedidosRelatorio = new Map();

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

  const ensurePedidoBloco = (pedidoId, fornecedor) => {
    if (!pedidosRelatorio.has(pedidoId)) {
      const pedido = pedidoPorId.get(pedidoId) || {};
      const embarquesDoPedido = sortEmbarquesParaExibicao(
        embarquesPorPedido[pedidoId] || [],
        pedido,
      );
      const { valor, base } = getTotaisPedido(pedidoId);
      pedidosRelatorio.set(pedidoId, {
        pedido_id: pedidoId,
        pedido_numero: pedido.numero,
        data_emissao: parseDataEmissaoPedido(pedido),
        fornecedor,
        valor_pedido: valor,
        base_pedido: base,
        valor_pendente: 0,
        base_pendente: 0,
        pct_valor_pendente_sobre_pedido: 0,
        despacho_principal: resolveDespachoPrincipalPedido(pedido, embarquesDoPedido),
        linhas: [],
        embarques_resumo: [],
      });
    }
    return pedidosRelatorio.get(pedidoId);
  };

  const embarques = [];

  for (const card of cardsDeEmbarque) {
    const dataEmissao = parseDataEmissaoPedido(card);
    if (dataEmissaoMin && dataEmissao && dataEmissao < dataEmissaoMin) continue;
    if (dataEmissaoMin && !dataEmissao) continue;

    const fornecedor = String(card.fornecedor_nome || card._display_fornecedor || '—').trim();
    if (fornecedorFiltro && !fornecedor.toLowerCase().includes(fornecedorFiltro)) continue;

    const motivo = classificarMotivoPendencia(card);
    if (somenteSaldoAvaria && motivo === MOTIVO_AGUARDANDO_EMBARQUE) continue;

    const displayStatusRaw = getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []);
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
    const pedido = pedidoPorId.get(card.id) || card;

    const pctValorPedido = valorPedido > 0
      ? roundToTwoDecimals((valorPendente / valorPedido) * 100)
      : 0;
    const pctBasePedido = basePedido > 0
      ? roundToTwoDecimals((basePendente / basePedido) * 100)
      : 0;

    const embarqueCodigo = card._display_code || card.numero;
    const linhasSql = getEmbarqueItensLinhas(card._embarque);
    const linhasDetalhe = itensConsulta.map((consultaItem) => {
      const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === consultaItem.produto_id) || {};
      const sqlLine = linhasSql.find((l) => l.produto_id === consultaItem.produto_id) || null;
      const produto = produtosMap[consultaItem.produto_id] || null;
      return buildLinhaDetalheFornecedor({
        pedido,
        pedidoItem,
        produto,
        sqlLine,
        consultaItem,
        embarqueCodigo,
        valorPedidoTotal: valorPedido,
      });
    });

    const blocoPedido = ensurePedidoBloco(card.id, fornecedor);
    blocoPedido.linhas.push(...linhasDetalhe);
    blocoPedido.valor_pendente = roundToTwoDecimals(blocoPedido.valor_pendente + valorPendente);
    blocoPedido.base_pendente = roundToTwoDecimals(blocoPedido.base_pendente + basePendente);
    blocoPedido.embarques_resumo.push({
      embarque_codigo: embarqueCodigo,
      motivo,
      valor_pendente: valorPendente,
      pct_valor_sobre_pedido: pctValorPedido,
    });

    embarques.push({
      pedido_id: card.id,
      pedido_numero: card.numero,
      data_emissao: dataEmissao,
      fornecedor,
      embarque_codigo: embarqueCodigo,
      embarque_ordinal: card._display_ordinal || '',
      display_status: displayStatusRaw,
      motivo,
      valor_pedido: valorPedido,
      valor_pendente: valorPendente,
      pct_valor_sobre_pedido: pctValorPedido,
      base_pedido: basePedido,
      base_pendente: basePendente,
      pct_base_sobre_pedido: pctBasePedido,
      linhas: linhasDetalhe,
    });
  }

  const pedidosLista = [...pedidosRelatorio.values()]
    .filter((p) => p.linhas.length > 0)
    .map((p) => finalizarPedidoRelatorio(p, pedidoPorId.get(p.pedido_id) || {}, produtosMap))
    .sort((a, b) => {
      const fa = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
      if (fa !== 0) return fa;
      return String(a.data_emissao || '').localeCompare(String(b.data_emissao || ''));
    });

  const porFornecedor = {};
  for (const ped of pedidosLista) {
    if (!porFornecedor[ped.fornecedor]) {
      porFornecedor[ped.fornecedor] = {
        fornecedor: ped.fornecedor,
        pedidos: [],
        valor_pendente: 0,
        total_cx_pedido: 0,
        total_cx_pendente: 0,
        pct_cx_avaria_sobre_pedidos: 0,
      };
    }
    porFornecedor[ped.fornecedor].pedidos.push(ped);
    porFornecedor[ped.fornecedor].valor_pendente = roundToTwoDecimals(
      porFornecedor[ped.fornecedor].valor_pendente + ped.valor_pendente,
    );
    porFornecedor[ped.fornecedor].total_cx_pedido = roundToTwoDecimals(
      porFornecedor[ped.fornecedor].total_cx_pedido + (ped.total_cx_pedido || 0),
    );
    porFornecedor[ped.fornecedor].total_cx_pendente = roundToTwoDecimals(
      porFornecedor[ped.fornecedor].total_cx_pendente + (ped.total_cx_pendente || 0),
    );
  }

  const fornecedores = Object.values(porFornecedor)
    .map((g) => ({
      ...g,
      pct_cx_avaria_sobre_pedidos: g.total_cx_pedido > 0
        ? roundToTwoDecimals((g.total_cx_pendente / g.total_cx_pedido) * 100)
        : 0,
      unidade: g.pedidos[0]?.unidade_pedido || 'CX',
    }))
    .sort((a, b) => a.fornecedor.localeCompare(b.fornecedor, 'pt-BR'));

  embarques.sort((a, b) => {
    const fa = a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
    if (fa !== 0) return fa;
    const da = a.data_emissao || '';
    const db = b.data_emissao || '';
    if (da !== db) return da.localeCompare(db);
    return String(a.embarque_codigo).localeCompare(String(b.embarque_codigo), 'pt-BR');
  });

  const totalValorPendente = roundToTwoDecimals(pedidosLista.reduce((s, p) => s + p.valor_pendente, 0));
  const totalCxPedido = roundToTwoDecimals(pedidosLista.reduce((s, p) => s + (p.total_cx_pedido || 0), 0));
  const totalCxPendente = roundToTwoDecimals(pedidosLista.reduce((s, p) => s + (p.total_cx_pendente || 0), 0));
  const pctCxAvariaGeral = totalCxPedido > 0
    ? roundToTwoDecimals((totalCxPendente / totalCxPedido) * 100)
    : 0;

  return {
    geradoEm: new Date().toISOString(),
    dataEmissaoMin,
    somenteSaldoAvaria,
    totalEmbarques: embarques.length,
    totalPedidos: pedidosLista.length,
    totalValorPendente,
    totalCxPedido,
    totalCxPendente,
    pct_cx_avaria_geral: pctCxAvariaGeral,
    embarques,
    pedidos: pedidosLista,
    fornecedores,
  };
}

function agruparLinhasPorFormato(linhas = []) {
  const map = {};
  for (const linha of linhas) {
    const fmt = linha.formato || 'Outros';
    if (!map[fmt]) map[fmt] = [];
    map[fmt].push(linha);
  }
  return Object.keys(map)
    .sort((a, b) => (a === 'Outros' ? 1 : b === 'Outros' ? -1 : a.localeCompare(b)))
    .map((formato) => {
      const grupo = map[formato];
      const quantPend = grupo.reduce((s, l) => s + (Number(l.quantidade_pendente) || 0), 0);
      const totalPend = grupo.reduce((s, l) => s + (Number(l.valor_pendente) || 0), 0);
      return { formato, linhas: grupo, quant_pendente: quantPend, valor_pendente: roundToTwoDecimals(totalPend) };
    });
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

/** HTML estilo órfãos Tintão (A4, grupos por formato, contexto do pedido). */
export function renderRelatorioPendenteEmbarqueFornecedorHtml(relatorio = {}, tituloExtra = '') {
  const geradoEm = new Date(relatorio.geradoEm || Date.now()).toLocaleString('pt-BR', {
    timeZone: 'America/Manaus',
  });
  const dataMin = relatorio.dataEmissaoMin || RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT;
  const titulo = tituloExtra || 'Saldo pós-embarque — reposição ao comprador';

  const blocosFornecedor = (relatorio.fornecedores || []).map((grupo) => {
    const pedidosHtml = (grupo.pedidos || []).map((ped) => {
      const princ = ped.despacho_principal;
      const ctxDespacho = princ
        ? `Despacho principal: <strong>${princ.codigo}</strong> · ${fmtData(princ.data_embarque)} · ${princ.transportadora} · recepção: ${princ.status_recebimento}`
        : 'Despacho principal: ainda não informado no sistema';

      const gruposFmt = (ped.grupos_formato || []).map((gfmt) => {
        const rows = gfmt.linhas.map((l) => `
          <tr>
            <td class="col-modelo">${l.produto_nome}<span class="emb-ref"> · ${l.embarque_codigo}</span></td>
            <td class="col-num">${Number(l.quantidade_pedido).toLocaleString('pt-BR')}</td>
            <td class="col-num">${Number(l.quantidade_embarcada).toLocaleString('pt-BR')}</td>
            <td class="col-num">${Number(l.quantidade_recebida).toLocaleString('pt-BR')}</td>
            <td class="col-num pend">${Number(l.quantidade_pendente).toLocaleString('pt-BR')}</td>
            <td class="col-num pct">${pct(l.pct_cx_sobre_linha_pedido)}</td>
            <td class="col-num pct">${pct(l.pct_cx_sobre_pedido_total)}</td>
            <td class="col-num">${brl(l.valor_pendente)}</td>
          </tr>`).join('');

        return `
        <section class="grupo">
          <h3 class="formato">${gfmt.formato}</h3>
          <table>
            <thead>
              <tr>
                <th class="col-modelo">Modelo / embarque</th>
                <th class="col-num">Pedido</th>
                <th class="col-num">Embarc.</th>
                <th class="col-num">Receb.</th>
                <th class="col-num">Avaria (cx)</th>
                <th class="col-num">% modelo</th>
                <th class="col-num">% pedido</th>
                <th class="col-num">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="subtotal">
                <td class="col-modelo">Subtotal ${gfmt.formato}</td>
                <td class="col-num"></td>
                <td class="col-num"></td>
                <td class="col-num"></td>
                <td class="col-num">${Number(gfmt.quant_pendente).toLocaleString('pt-BR')}</td>
                <td class="col-num"></td>
                <td class="col-num"></td>
                <td class="col-num">${brl(gfmt.valor_pendente)}</td>
              </tr>
            </tbody>
          </table>
        </section>`;
      }).join('');

      return `
      <article class="pedido">
        <h2 class="pedido-titulo">Pedido ${ped.pedido_numero}</h2>
        <p class="pedido-meta">
          Emissão ${fmtData(ped.data_emissao)} · Pedido original ${brl(ped.valor_pedido)} ·
          Saldo a repor <strong>${brl(ped.valor_pendente)}</strong> (${pct(ped.pct_valor_pendente_sobre_pedido)} em valor)
        </p>
        <p class="pedido-resumo-cx">
          <strong>${Number(ped.total_cx_pedido || 0).toLocaleString('pt-BR')} ${ped.unidade_pedido || 'CX'}</strong> pedidas no total ·
          <strong>${Number(ped.total_cx_pendente || 0).toLocaleString('pt-BR')}</strong> com avaria/divergência ·
          <strong class="pct">${pct(ped.pct_cx_avaria_sobre_pedido)}</strong> do pedido (caixas)
        </p>
        <p class="pedido-contexto">${ctxDespacho}</p>
        <p class="nota">
          Por modelo: % modelo = avaria ÷ caixas pedidas daquele item; % pedido = mesma avaria ÷ total de caixas do pedido (ex.: 200+200+200=600, 15 avaria → 2,5% no rodapé do pedido).
        </p>
        ${gruposFmt}
      </article>`;
    }).join('');

    return `
    <section class="fornecedor">
      <h2 class="fornecedor-nome">${grupo.fornecedor}</h2>
      <p class="sub">${grupo.pedidos.length} pedido(s) · ${Number(grupo.total_cx_pedido || 0).toLocaleString('pt-BR')} cx nos pedidos · ${Number(grupo.total_cx_pendente || 0).toLocaleString('pt-BR')} avaria · ${pct(grupo.pct_cx_avaria_sobre_pedidos)} · ${brl(grupo.valor_pendente)} a repor</p>
      ${pedidosHtml}
    </section>`;
  }).join('');

  const geralValor = relatorio.totalValorPendente || 0;
  const geralCxPedido = relatorio.totalCxPedido || 0;
  const geralCxAvaria = relatorio.totalCxPendente || 0;
  const geralPctCx = relatorio.pct_cx_avaria_geral || 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${titulo}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px; line-height: 1.45; color: #111; background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .doc { max-width: 680px; margin: 0 auto; padding: 8px 0 24px; }
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e8e8e8; }
    .header h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 6px; }
    .header .meta { font-size: 12px; color: #666; }
    .header .resumo { margin-top: 10px; font-size: 13px; color: #333; }
    .fornecedor-nome { font-size: 17px; margin: 24px 0 6px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
    .sub { color: #555; margin: 0 0 16px; font-size: 12px; }
    .pedido { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #efefef; }
    .pedido-titulo { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .pedido-meta, .pedido-contexto, .pedido-resumo-cx { font-size: 12px; color: #444; margin-bottom: 6px; }
    .pedido-resumo-cx { font-size: 13px; color: #222; }
    .nota { font-size: 11px; color: #666; margin: 8px 0 12px; line-height: 1.4; }
    .grupo { margin-bottom: 18px; }
    .formato { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead th {
      font-size: 10px; font-weight: 600; color: #111; text-align: left;
      padding: 5px 0 6px; border-bottom: 1px solid #d9d9d9;
    }
    tbody td { padding: 6px 0; border-bottom: 1px solid #efefef; vertical-align: top; font-size: 11px; }
    .col-modelo { width: 28%; padding-right: 8px; word-break: break-word; }
    .col-num { width: 9%; text-align: right; white-space: nowrap; }
    thead .col-num { text-align: right; }
    .emb-ref { color: #888; font-size: 10px; }
    .pend { font-weight: 600; }
    .pct { color: #92400e; }
    .subtotal td { font-weight: 600; border-top: 1px solid #d9d9d9; border-bottom: none; padding-top: 8px; }
    .geral { margin-top: 12px; }
  </style>
</head>
<body>
  <div class="doc">
    <header class="header">
      <h1>${titulo}</h1>
      <p class="meta">Gerado em ${geradoEm} · Pedidos com emissão a partir de ${fmtData(dataMin)} · Saldo pós-embarque (avaria / divergência / reposição)</p>
      <p class="resumo">
        <strong>${Number(geralCxPedido).toLocaleString('pt-BR')} cx</strong> pedidas (soma dos pedidos) ·
        <strong>${Number(geralCxAvaria).toLocaleString('pt-BR')} cx</strong> avaria ·
        <strong class="pct">${pct(geralPctCx)}</strong> geral ·
        <strong>${brl(geralValor)}</strong> a repor
      </p>
    </header>
    ${blocosFornecedor || '<p class="meta">Nenhum saldo pendente no período.</p>'}
    <section class="grupo geral">
      <h3 class="formato">Total geral (todos os pedidos do relatório)</h3>
      <p class="pedido-resumo-cx">
        <strong>${Number(geralCxPedido).toLocaleString('pt-BR')} caixas</strong> pedidas ·
        <strong>${Number(geralCxAvaria).toLocaleString('pt-BR')}</strong> com avaria ·
        <strong class="pct">${pct(geralPctCx)}</strong> proporcional ·
        ${brl(geralValor)} em valor a repor
      </p>
    </section>
  </div>
</body>
</html>`;
}
