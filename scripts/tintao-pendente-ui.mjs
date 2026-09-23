#!/usr/bin/env node
/**
 * Tintão — itens pendentes pela mesma regra da lista Embarques (cards PENDENTE).
 * Não usa view falta_operacional / saldo a embarcar isolada.
 */
import { resolveP38Secrets } from './p38-secrets.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror } from '../src/lib/embarqueItemContract.js';
import { materializePedidosCompraView, getBorrowedStatus } from '../src/lib/comprasEmbarqueCards.js';
import { getTotalLinhaPedidoCompra } from '../src/lib/pedidoCompraFinanceiro.js';
import { getItemCompraExibicaoVitrine } from '../src/lib/productUnits.js';

const BASE = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

async function sbFetch(path) {
  const key = resolveP38Secrets().serviceRoleKey;
  const r = await fetch(`${BASE}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function mapProduto(row) {
  const d = row.dados && typeof row.dados === 'object' ? row.dados : {};
  return {
    id: row.id,
    nome: row.nome || d.nome,
    unidade_principal: row.unidade_principal || d.unidade_principal,
    unidade_vitrine: row.unidade_vitrine || d.unidade_vitrine,
    unidades: d.unidades || [],
    avaria_percentual: row.avaria_percentual ?? d.avaria_percentual,
    valor_compra: row.valor_compra ?? d.valor_compra,
    preco_venda_padrao: row.preco_venda_padrao ?? d.preco_venda_padrao,
  };
}

function hydratePedido(pc, itensSql) {
  const itens = (itensSql || [])
    .filter((i) => i.pedido_compra_id === pc.id)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map(pedidoCompraItemToLegacyMirror);
  return { ...pc, created_date: pc.created_at, updated_date: pc.updated_at, itens };
}

function hydrateEmbarque(e, itensSql) {
  const linhas = rebuildEmbarqueItensMirror((itensSql || []).filter((i) => i.embarque_id === e.id));
  const dados = e.dados && typeof e.dados === 'object' ? e.dados : {};
  return { ...e, ...dados, created_date: e.created_at, updated_date: e.updated_at, _linhas: linhas };
}

function cxFromItem(nome, qtdComercial, un, fator = 1) {
  const u = String(un || '').toUpperCase();
  if (u === 'CX' || u === 'CAIXA') return qtdComercial;
  const m = String(nome || '').match(/([\d,\.]+)\s*m[²2]\s*\/\s*cx/i)
    || String(nome || '').match(/\(([\d,\.]+)\s*m[²2]/i);
  const m2cx = m ? parseFloat(m[1].replace(',', '.')) : (fator > 1 ? fator : null);
  if (m2cx && qtdComercial) return qtdComercial / m2cx;
  return qtdComercial;
}

function valorProporcional(pedidoItem, qtdComercial) {
  const pedidoQtd = Number(pedidoItem?.quantidade) || 0;
  const lineTotal = getTotalLinhaPedidoCompra(pedidoItem);
  if (!pedidoQtd || !qtdComercial) return 0;
  return Math.round((qtdComercial / pedidoQtd) * lineTotal * 100) / 100;
}

async function main() {
  const pedidosRaw = await sbFetch(
    '/rest/v1/pedido_compra?select=*&fornecedor_nome=ilike.*tint*&status=neq.Concluído&order=numero.asc',
  );
  const ids = pedidosRaw.map((p) => p.id);
  if (!ids.length) {
    console.log(JSON.stringify({ pedidos: [], mensagem: 'Nenhum pedido Tintão aberto.' }));
    return;
  }

  const embMeta = await sbFetch(`/rest/v1/embarque?select=id&pedido_compra_id=in.(${ids.join(',')})`);
  const embIds = embMeta.map((e) => e.id);

  const [pci, emb, ei, prodRows] = await Promise.all([
    sbFetch(`/rest/v1/pedido_compra_item?select=*&pedido_compra_id=in.(${ids.join(',')})`),
    sbFetch(`/rest/v1/embarque?select=*&pedido_compra_id=in.(${ids.join(',')})`),
    embIds.length ? sbFetch(`/rest/v1/embarque_item?select=*&embarque_id=in.(${embIds.join(',')})`) : [],
    sbFetch('/rest/v1/produto?select=id,nome,unidade_principal,unidade_vitrine,avaria_percentual,valor_compra,preco_venda_padrao,dados&limit=8000'),
  ]);

  const produtosMap = Object.fromEntries(prodRows.map((p) => [p.id, mapProduto(p)]));
  const pedidos = pedidosRaw.map((pc) => hydratePedido(pc, pci));
  const embarquesDb = emb.map((e) => hydrateEmbarque(e, ei));
  const { cardsDeEmbarque } = materializePedidosCompraView(pedidos, embarquesDb, produtosMap);

  const cardsPendente = cardsDeEmbarque
    .map((card) => ({
      ...card,
      _display_status: getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []),
    }))
    .filter((c) => c._display_status === 'Pendente');

  const porPedido = new Map();
  let totalValor = 0;
  let totalCx = 0;

  for (const card of cardsPendente) {
    const pedidoNum = card.numero;
    const pedidoItens = card.itens || [];

    if (!porPedido.has(pedidoNum)) {
      porPedido.set(pedidoNum, {
        fornecedor: card.fornecedor_nome,
        cards: [],
        itens: [],
        subtotal: 0,
        subtotalCx: 0,
      });
    }
    const grp = porPedido.get(pedidoNum);

    const itensCard = (card._display_itens || []).map((disp) => {
      const pedidoItem = pedidoItens.find((pi) => pi.produto_id === disp.produto_id) || {};
      const prod = produtosMap[disp.produto_id];
      const exib = getItemCompraExibicaoVitrine(pedidoItem, prod);
      const qtd = Number(disp.quantidade ?? disp.quantidade_embarcada ?? 0) || 0;
      const un = disp.unidade_medida || exib.unidade_medida || 'UN';
      const cx = Math.round(cxFromItem(disp.produto_nome, qtd, un, exib.fator_conversao) * 100) / 100;
      const valor = valorProporcional(pedidoItem, qtd);
      return {
        card: card._display_code,
        descricao: disp.produto_nome,
        qtd,
        un,
        cx,
        valor,
      };
    }).filter((i) => i.qtd > 0.001);

    grp.cards.push({
      codigo: card._display_code,
      ordinal: card._display_ordinal,
      qtdCard: card._quantidade_pendente,
    });
    grp.itens.push(...itensCard);
    grp.subtotal += itensCard.reduce((s, i) => s + i.valor, 0);
    grp.subtotalCx += itensCard.reduce((s, i) => s + (i.cx || 0), 0);
    totalValor += itensCard.reduce((s, i) => s + i.valor, 0);
    totalCx += itensCard.reduce((s, i) => s + (i.cx || 0), 0);
  }

  const payload = {
    criterio: 'Cards PENDENTE — materializePedidosCompraView + getBorrowedStatus (mesma UI)',
    geradoEm: new Date().toISOString(),
    totalPedidos: porPedido.size,
    totalCards: cardsPendente.length,
    totalCx: Math.round(totalCx * 100) / 100,
    totalValor: Math.round(totalValor * 100) / 100,
    pedidos: [...porPedido.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([numero, g]) => ({
        pedido: numero,
        fornecedor: g.fornecedor,
        subtotal: Math.round(g.subtotal * 100) / 100,
        subtotalCx: Math.round(g.subtotalCx * 100) / 100,
        cards: g.cards,
        itens: g.itens,
      })),
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
