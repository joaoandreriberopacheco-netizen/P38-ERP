#!/usr/bin/env node
/**
 * Lista pedidos Tintão no período e se entram no relatório (saldo pós-embarque).
 */
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets, P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';
import { pedidoCompraItemToLegacyMirror } from '../src/lib/pedidoCompraItemContract.js';
import { rebuildEmbarqueItensMirror, enrichEmbarqueMirrorFromPedidoItens } from '../src/lib/embarqueItemContract.js';
import {
  buildRelatorioPendenteEmbarqueFornecedor,
  RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT,
} from '../src/lib/relatorioPendenteEmbarqueFornecedor.js';
import { materializePedidosCompraView, getBorrowedStatus } from '../src/lib/comprasEmbarqueCards.js';
import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '../src/lib/consultaComprasEmbarques.js';
import { embarqueTemSaldoPendente } from '../src/lib/embarqueLogisticaHelpers.js';

const dataMin = process.argv.find((a) => a.startsWith('--desde='))?.slice(8)
  || RELATORIO_PENDENTE_EMBARQUE_DATA_MIN_DEFAULT;

loadDotEnvFiles();

function normTint(name = '') {
  return String(name || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

async function createSupabaseAdminClient() {
  const secrets = resolveP38Secrets('cloud-agent');
  const url =
    secrets.supabaseUrl
    || process.env.VITE_SUPABASE_URL
    || (secrets.projectRef || P38_CANONICAL_PROJECT_REF
      ? `https://${secrets.projectRef || P38_CANONICAL_PROJECT_REF}.supabase.co`
      : '');
  const key = secrets.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchTintBundle() {
  const sb = await createSupabaseAdminClient();
  const { data: pedidosRaw, error } = await sb
    .from('pedido_compra')
    .select('id, numero, fornecedor_nome, data_emissao, status, dados, created_at')
    .gte('data_emissao', dataMin)
    .order('data_emissao')
    .limit(3000);
  if (error) throw new Error(error.message);

  const tintPedidos = (pedidosRaw || []).filter((p) => {
    const st = String(p?.status || p?.dados?.status || '').trim();
    if (!st || st === 'Rascunho' || st === 'Cancelado') return false;
    const fn = p.fornecedor_nome || p?.dados?.fornecedor_nome || '';
    return normTint(fn).includes('tint');
  });

  const ids = tintPedidos.map((p) => p.id);
  if (!ids.length) return { pedidos: [], embarquesDb: [] };

  const { data: pciRows } = await sb.from('pedido_compra_item').select('*').in('pedido_compra_id', ids);
  const { data: embRows } = await sb.from('embarque').select('*').in('pedido_compra_id', ids);

  const itensPorPedido = new Map();
  for (const item of pciRows || []) {
    const pid = item.pedido_compra_id;
    if (!itensPorPedido.has(pid)) itensPorPedido.set(pid, []);
    itensPorPedido.get(pid).push(pedidoCompraItemToLegacyMirror(item));
  }

  const pedidos = tintPedidos.map((row) => ({
    id: row.id,
    numero: row.numero || row.dados?.numero,
    fornecedor_nome: row.fornecedor_nome || row.dados?.fornecedor_nome,
    data_emissao: row.data_emissao ? String(row.data_emissao).slice(0, 10) : row.dados?.data_emissao,
    status: row.status || row.dados?.status,
    itens: itensPorPedido.get(row.id) || [],
    created_date: row.created_at,
  }));

  const embIds = (embRows || []).map((e) => e.id);
  const { data: eiRows } = embIds.length
    ? await sb.from('embarque_item').select('*').in('embarque_id', embIds)
    : { data: [] };

  const linhasPorEmb = new Map();
  for (const ei of eiRows || []) {
    if (!linhasPorEmb.has(ei.embarque_id)) linhasPorEmb.set(ei.embarque_id, []);
    linhasPorEmb.get(ei.embarque_id).push(ei);
  }

  const embarquesDb = (embRows || []).map((row) => {
    const pedidoItens = itensPorPedido.get(row.pedido_compra_id) || [];
    const raw = linhasPorEmb.get(row.id) || [];
    const mirror = rebuildEmbarqueItensMirror(raw).map((l) => enrichEmbarqueMirrorFromPedidoItens(l, pedidoItens));
    return {
      id: row.id,
      pedido_compra_id: row.pedido_compra_id,
      numero: row.numero || row.dados?.numero,
      tipo: row.tipo || row.dados?.tipo,
      status_recebimento: row.status_recebimento || row.dados?.status_recebimento,
      status_recebimento_embarque: row.status_recebimento_embarque || row.dados?.status_recebimento_embarque,
      data_embarque: row.data_embarque || row.dados?.data_embarque,
      transportadora_nome: row.transportadora_nome || row.dados?.transportadora_nome,
      created_date: row.created_at,
      _linhas: mirror,
      _itens_fonte: 'sql',
    };
  });

  return { pedidos, embarquesDb };
}

const { pedidos, embarquesDb } = await fetchTintBundle();
const produtosMap = {};
const relatorio = buildRelatorioPendenteEmbarqueFornecedor(pedidos, embarquesDb, produtosMap, {
  dataEmissaoMin: dataMin,
  fornecedorNorm: 'tint',
  somenteSaldoAvaria: true,
});

const relatorioTodos = buildRelatorioPendenteEmbarqueFornecedor(pedidos, embarquesDb, produtosMap, {
  dataEmissaoMin: dataMin,
  fornecedorNorm: 'tint',
  somenteSaldoAvaria: false,
});

const noPdf = new Set(relatorio.pedidos.map((p) => p.pedido_id));
const noPdfAguardando = new Set(relatorioTodos.pedidos.map((p) => p.pedido_id));

const { cardsDeEmbarque } = materializePedidosCompraView(pedidos, embarquesDb, produtosMap);

console.log(`Período: emissão >= ${dataMin}`);
console.log(`Pedidos Tintão na base: ${pedidos.length}`);
console.log(`No PDF (só avaria/divergência): ${relatorio.totalPedidos}`);
console.log(`Se incluir «aguardando embarque»: ${relatorioTodos.totalPedidos}\n`);

const byFornecedor = {};
for (const p of pedidos) {
  byFornecedor[p.fornecedor_nome] = (byFornecedor[p.fornecedor_nome] || 0) + 1;
}
console.log('Cadastro fornecedor nos pedidos:', Object.entries(byFornecedor).map(([k, v]) => `${k} (${v})`).join(' · '));
console.log('');

for (const ped of [...pedidos].sort((a, b) => String(a.data_emissao).localeCompare(String(b.data_emissao)))) {
  const cards = cardsDeEmbarque.filter((c) => c.id === ped.id);
  const detalhes = [];
  let valorPendAvaria = 0;

  for (const card of cards) {
    const displayStatusRaw = getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []);
    const displayStatus =
      displayStatusRaw === 'Concluído' && embarqueTemSaldoPendente(card._embarque)
        ? 'Despachado'
        : displayStatusRaw;
    const itens = buildConsultaItensEmbarque(
      { ...card, _display_status: displayStatus },
      produtosMap,
      { modo: 'pendente' },
    );
    const val = calcConsultaValorEmbarque(card, itens, { modo: 'pendente' });
    const cod = card._display_code || card.numero;
    detalhes.push(`${cod}[${displayStatusRaw}]: pend=${itens.length} lin · R$${val.toFixed(0)}`);
    if (itens.length) valorPendAvaria += val;
  }

  let statusPdf = 'FORA';
  if (noPdf.has(ped.id)) statusPdf = 'NO PDF';
  else if (noPdfAguardando.has(ped.id)) statusPdf = 'só se --incluir-aguardando-embarque';

  console.log(`${statusPdf.padEnd(36)} ${ped.numero} · ${ped.data_emissao} · ${ped.fornecedor_nome}`);
  if (detalhes.length) console.log(`    ${detalhes.join(' | ')}`);
  else console.log('    (sem splits de embarque)');
}
