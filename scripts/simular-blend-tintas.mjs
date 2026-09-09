#!/usr/bin/env node
/**
 * Simula blend cadastral de tintas (legados → produto compra curado · cor).
 *
 * Colunas: produto compra · cor · estoque · custo médio · preço venda médio
 *
 * npm run simular:blend-tintas
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { cellStr, to4x3 } from './lib/catalogo3x3Map.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const CORE_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-core.xlsx');
const OUT_CSV = path.join(process.cwd(), 'docs', 'exports', 'P38-blend-tintas-simulacao.csv');
const OUT_CORE = path.join(process.cwd(), 'docs', 'exports', 'P38-blend-tintas-core.csv');
const OUT_ESPACO = path.join(process.cwd(), 'docs', 'exports', 'P38-blend-tintas-espaco.csv');

const MARCAS = [
  'VERBRAS',
  'VITÓRIA RÉGIA',
  'VITORIA REGIA',
  'HIPERCOR',
  'IQUINE',
  'HIDRACOR',
  'COLORGIN',
  'RENNER',
  'METÁLICA',
  'METALICA',
  'CITYCOLOR',
  'VERTEX',
  'VPRO',
  'CORAL',
  'TEKBOND',
  'ZARCOFER',
  'SUZAN',
  'SHERWIN',
  'SUVINIL',
];

const H3_PRODUTO_COMPRA = {
  ESMALTE: 'TINTA ESMALTE SINTETICO',
  'P/ PISO': 'TINTA P/ PISO',
  'ACR. FOSCO ECON.': 'TINTA ACRILICA FOSCO ECONOMICA',
  'SEMI-BRILHO': 'TINTA SEMI-BRILHO',
  STANDARD: 'TINTA STANDARD',
  'STANDARD POUPE+': 'TINTA STANDARD POUPE+',
  'INT/EXT STAND': 'TINTA STANDARD',
};

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function stripMarca(text = '') {
  let out = cellStr(text);
  for (const marca of MARCAS) {
    const re = new RegExp(`\\b${marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    out = out.replace(re, ' ').replace(/\s+/g, ' ').trim();
  }
  return out.replace(/\s+/g, ' ').trim();
}

function canonicalProdutoCompra(text = '') {
  return stripMarca(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bSINTETICO\b/gi, 'SINTETICO')
    .replace(/\bACRILICA\b/gi, 'ACRILICA')
    .replace(/\bECONOMICO\b/gi, 'ECONOMICA')
    .replace(/\bECON\b/gi, 'ECONOMICA')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeCor(cor = '') {
  let c = cellStr(cor).replace(/\s+/g, ' ').trim();
  c = c.replace(/^BRRANCO/i, 'BRANCO');
  c = c.replace(/\bCARTEPILA\b/i, 'CATERPILAR');
  c = c.replace(/\bAÇAI\b/i, 'ACAI');
  c = c.replace(/\bAÇAÍ\b/i, 'ACAI');
  c = c.replace(/\bDEMARÇÃO\b/i, 'DEMARCACAO');
  c = c.replace(/\bDEMARCAÇÃO\b/i, 'DEMARCACAO');
  return c;
}

function apresentacaoCurada(fmt = '', sku = '') {
  const raw = cellStr(fmt) || cellStr(sku);
  const n = norm(raw).replace(/[()]/g, '').replace(/\s+/g, ' ');
  if (!n) return /SPRAY/i.test(sku) ? 'SPRAY' : '';
  if (/SPRAY/.test(n) || /\b(300|350|360|400)\s*ML\b/.test(n)) return 'SPRAY';

  const ml = n.match(/(\d+[,.]?\d*)\s*ML\b/);
  if (ml) {
    const v = parseFloat(ml[1].replace(',', '.'));
    if (v >= 700 && v <= 950) return 'LT';
    return 'LT';
  }

  const gl = n.match(/\bGL\b/);
  if (gl) return 'GL';

  const l = n.match(/(\d+[,.]?\d*)\s*L\b/);
  if (l) {
    const v = parseFloat(l[1].replace(',', '.'));
    if (v >= 2.5 && v <= 4.5) return 'GL';
    if (v >= 14 && v <= 20) return 'BD';
    return `${v} L`;
  }

  return n;
}

function produtoCompraCurado(comp1 = '', comp2 = '', sku = '') {
  let base = canonicalProdutoCompra(comp1);
  if (!base || base === 'TINTA') {
    if (/ACAB/i.test(sku)) base = 'TINTA ACABAMENTO';
    else base = 'TINTA';
  }
  const ap = apresentacaoCurada(comp2, sku);
  if (!ap) return base;
  return `${base} · ${ap}`;
}

async function loadCoreByCodigo() {
  const map = new Map();
  if (!fs.existsSync(CORE_PATH)) return map;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CORE_PATH);
  const ws = wb.getWorksheet('Catálogo');
  if (!ws) return map;

  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = cellStr(row.getCell(1).value).toUpperCase();
    if (!codigo) return;
    map.set(codigo, {
      codigo_interno: codigo,
      etapa: cellStr(row.getCell(2).value),
      core: cellStr(row.getCell(3).value),
      linha: cellStr(row.getCell(4).value),
      produto_compra: cellStr(row.getCell(5).value),
      eixo_a: cellStr(row.getCell(6).value),
      eixo_b: cellStr(row.getCell(7).value),
      novo_sku: cellStr(row.getCell(8).value),
      sku_atual: cellStr(row.getCell(9).value),
    });
  });
  return map;
}

function inferCatalogRow(produto) {
  const codigo = cellStr(produto.codigo_interno).toUpperCase();
  const nome = cellStr(produto.nome);
  const h1 = cellStr(produto.campo_hierarquico_1);
  const h2 = cellStr(produto.campo_hierarquico_2);
  const h3 = cellStr(produto.campo_hierarquico_3);
  const h4 = cellStr(produto.campo_hierarquico_4);
  const h5 = cellStr(produto.campo_hierarquico_5);

  if (h1 === 'TINTA') {
    const pc = H3_PRODUTO_COMPRA[h3] || (h3 ? `TINTA ${h3}` : 'TINTA');
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: pc,
      eixo_a: h2,
      eixo_b: h4,
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h5,
    };
  }

  if (/^TINTA ESMALTE IQUINE/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ESMALTE SINTETICO',
      eixo_a: h2,
      eixo_b: 'IQUINE',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h3,
    };
  }

  if (/^TINTA ANTICORROSIVA/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ANTICORROSIVA',
      eixo_a: h2,
      eixo_b: h1.replace(/^TINTA ANTICORROSIVA\s*/i, '').trim(),
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h3 || nome.replace(/.*\s(\w+)\s*$/i, '$1'),
    };
  }

  if (/SPRAY/i.test(h1) || /SPRAY/i.test(nome)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA SPRAY',
      eixo_a: '',
      eixo_b: '',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: '',
    };
  }

  if (/^TINTA ACAB/i.test(h1)) {
    return {
      codigo_interno: codigo,
      etapa: '6 — Acabamento seco',
      core: 'PINTURA_OBRA',
      linha: 'TINTA',
      produto_compra: 'TINTA ACABAMENTO',
      eixo_a: h2,
      eixo_b: h4 || 'CITYCOLOR',
      novo_sku: nome,
      sku_atual: nome,
      _cor_hint: h5,
    };
  }

  return {
    codigo_interno: codigo,
    etapa: '6 — Acabamento seco',
    core: 'PINTURA_OBRA',
    linha: 'TINTA',
    produto_compra: h1 || 'TINTA',
    eixo_a: h2,
    eixo_b: h4 || h3,
    novo_sku: nome,
    sku_atual: nome,
    _cor_hint: h5 || h3,
  };
}

function blendKey(produtoCompra, cor) {
  return `${canonicalProdutoCompra(produtoCompra)}\x00${norm(cor)}`;
}

function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const PEDIDO_STATUS_EXCLUIDOS = new Set([
  'rascunho',
  'cancelado',
  'rejeitado financeiramente',
  'rejeitado',
  'concluido',
  'devolvido',
]);

const PEDIDO_APROVADO = new Set([
  'aprovado financeiramente',
  'aprovado',
  'enviado',
  'despachado',
  'em transito',
  'aguardando recepcao',
  'aguardando recepcao',
  'aguardando embarque',
  'em recepcao',
  'recebido parcialmente',
  'recebido parcial',
  'pendencia',
]);

function pedidoCompraEstaConcluido(pedido = {}) {
  const statusPedido = normalizeStatus(pedido.status);
  if (PEDIDO_STATUS_EXCLUIDOS.has(statusPedido)) return true;
  const statusReceb = normalizeStatus(pedido.status_recebimento_geral);
  return (
    statusReceb.startsWith('concluido') ||
    statusReceb === 'recebido ok' ||
    statusReceb.includes('concluido com divergencia')
  );
}

function pedidoCompraAprovadoNaoConcluido(pedido = {}) {
  if (pedidoCompraEstaConcluido(pedido)) return false;
  const statusPedido = normalizeStatus(pedido.status);
  if (PEDIDO_STATUS_EXCLUIDOS.has(statusPedido)) return false;
  const aprov = normalizeStatus(pedido.status_aprovacao_financeira);
  const status = normalizeStatus(pedido.status);
  return PEDIDO_APROVADO.has(aprov) || PEDIDO_APROVADO.has(status);
}

function qtyBaseItemPedido(item = {}) {
  const base = Number(item.quantidade_base);
  if (Number.isFinite(base) && base > 0) return base;
  const qtd = Number(item.quantidade_comercial) || 0;
  if (qtd <= 0) return 0;
  const fator = Number(item.fator_aplicado ?? item.fator_conversao) || 1;
  return qtd * fator;
}

function fatorEmbarque(item = {}, pedidoItem = null) {
  return Number(item.fator_aplicado ?? pedidoItem?.fator_aplicado) || 1;
}

function qtyBaseRecebidaEmbarque(item = {}, pedidoItem = null) {
  const recebida = Number(item.quantidade_recebida_comercial) || 0;
  if (recebida <= 0) return 0;
  if (pedidoItem) {
    const basePedido = qtyBaseItemPedido(pedidoItem);
    const qtdPedido = Number(pedidoItem.quantidade_comercial) || 0;
    if (basePedido > 0 && qtdPedido > 0) return (recebida / qtdPedido) * basePedido;
  }
  return recebida * fatorEmbarque(item, pedidoItem);
}

function qtyBaseEmbarcada(item = {}, pedidoItem = null) {
  const qtd =
    Number(item.quantidade_embarcada_comercial) ||
    Number(item.quantidade_pedida_comercial) ||
    0;
  if (qtd <= 0) return 0;
  if (pedidoItem) {
    const basePedido = qtyBaseItemPedido(pedidoItem);
    const qtdPedido = Number(pedidoItem.quantidade_comercial) || 0;
    if (basePedido > 0 && qtdPedido > 0) return (qtd / qtdPedido) * basePedido;
  }
  return qtd * fatorEmbarque(item, pedidoItem);
}

function embarqueEmTransito(embarque = {}) {
  const statusReceb = normalizeStatus(embarque.status_recebimento);
  const statusEmb = normalizeStatus(embarque.status);
  if (statusReceb === 'recebido ok' || statusReceb === 'com divergencia' || statusEmb === 'concluido') {
    return false;
  }
  return true;
}

/** Pendente de compra por produto (pedido aprovado não concluído + embarque em trânsito). */
async function fetchPendenteCompraPorProduto(sb, produtoIds) {
  const map = new Map();
  for (const id of produtoIds) map.set(String(id), 0);
  if (!produtoIds.length) return map;

  const chunk = 40;
  const pciRows = [];
  for (let i = 0; i < produtoIds.length; i += chunk) {
    const { data, error } = await sb
      .from('pedido_compra_item')
      .select(
        'id, produto_id, pedido_compra_id, quantidade_base, quantidade_comercial, fator_aplicado',
      )
      .in('produto_id', produtoIds.slice(i, i + chunk));
    if (error) throw error;
    pciRows.push(...(data || []));
  }

  const pedidoIds = [...new Set(pciRows.map((r) => r.pedido_compra_id).filter(Boolean))];
  const pedidos = [];
  for (let i = 0; i < pedidoIds.length; i += chunk) {
    const { data, error } = await sb
      .from('pedido_compra')
      .select('id, status, status_aprovacao_financeira, status_recebimento_geral')
      .in('id', pedidoIds.slice(i, i + chunk));
    if (error) throw error;
    pedidos.push(...(data || []));
  }

  const pedidosById = new Map(pedidos.map((p) => [String(p.id), { ...p, itens: [] }]));
  for (const item of pciRows) {
    const pedido = pedidosById.get(String(item.pedido_compra_id));
    if (pedido) pedido.itens.push(item);
  }

  const embarques = [];
  for (let i = 0; i < pedidoIds.length; i += chunk) {
    const { data, error } = await sb
      .from('embarque')
      .select('id, pedido_compra_id, status, status_recebimento')
      .in('pedido_compra_id', pedidoIds.slice(i, i + chunk));
    if (error) throw error;
    embarques.push(...(data || []));
  }

  const embIds = embarques.map((e) => e.id);
  const embItems = [];
  for (let i = 0; i < embIds.length; i += chunk) {
    const { data, error } = await sb
      .from('embarque_item')
      .select(
        'embarque_id, produto_id, pedido_compra_item_id, quantidade_recebida_comercial, quantidade_embarcada_comercial, quantidade_pedida_comercial',
      )
      .in('embarque_id', embIds.slice(i, i + chunk));
    if (error) throw error;
    embItems.push(...(data || []));
  }

  const embItemsByEmb = new Map();
  for (const item of embItems) {
    const k = String(item.embarque_id);
    if (!embItemsByEmb.has(k)) embItemsByEmb.set(k, []);
    embItemsByEmb.get(k).push(item);
  }

  const recebidosPorPedido = {};
  for (const embarque of embarques) {
    const pedidoKey = String(embarque.pedido_compra_id);
    if (!recebidosPorPedido[pedidoKey]) recebidosPorPedido[pedidoKey] = {};
    const pedido = pedidosById.get(pedidoKey);
    for (const item of embItemsByEmb.get(String(embarque.id)) || []) {
      const pid = String(item.produto_id || '');
      if (!pid) continue;
      const pedidoItem =
        pedido?.itens?.find(
          (l) => l.id === item.pedido_compra_item_id || l.produto_id === item.produto_id,
        ) || null;
      const qty = qtyBaseRecebidaEmbarque(item, pedidoItem);
      if (qty > 0) recebidosPorPedido[pedidoKey][pid] = (recebidosPorPedido[pedidoKey][pid] || 0) + qty;
    }
  }

  for (const pedido of pedidosById.values()) {
    if (!pedidoCompraAprovadoNaoConcluido(pedido)) continue;
    const recebidos = recebidosPorPedido[String(pedido.id)] || {};
    for (const item of pedido.itens) {
      const pid = String(item.produto_id || '');
      if (!pid || !map.has(pid)) continue;
      const pedidoQty = qtyBaseItemPedido(item);
      const recebido = Number(recebidos[pid] || 0);
      const pendente = Math.max(0, pedidoQty - recebido);
      if (pendente > 0) map.set(pid, (map.get(pid) || 0) + pendente);
    }
  }

  for (const embarque of embarques) {
    if (!embarqueEmTransito(embarque)) continue;
    const pedido = pedidosById.get(String(embarque.pedido_compra_id));
    if (pedido && pedidoCompraEstaConcluido(pedido)) continue;
    for (const item of embItemsByEmb.get(String(embarque.id)) || []) {
      const pid = String(item.produto_id || '');
      if (!pid || !map.has(pid)) continue;
      const pedidoItem =
        pedido?.itens?.find(
          (l) => l.id === item.pedido_compra_item_id || l.produto_id === item.produto_id,
        ) || null;
      const embarcado = qtyBaseEmbarcada(item, pedidoItem);
      const recebido = qtyBaseRecebidaEmbarque(item, pedidoItem);
      const pendente = Math.max(0, embarcado - recebido);
      if (pendente <= 0) continue;
      map.set(pid, Math.max(map.get(pid) || 0, pendente));
    }
  }

  return map;
}

function classificaDestino(legados) {
  const temEstoque = legados.some((l) => l.estoque > 0);
  const temPendente = legados.some((l) => l.pendente_compra > 0);
  if (temEstoque || temPendente) return 'core';
  return 'espaco';
}

function motivoDestino(legados) {
  const parts = [];
  const est = legados.reduce((s, l) => s + l.estoque, 0);
  const pend = legados.reduce((s, l) => s + l.pendente_compra, 0);
  if (est > 0) parts.push(`estoque ${est}`);
  if (pend > 0) parts.push(`compra pendente ${pend.toFixed(0)} un`);
  if (!parts.length) return 'sem estoque · sem compra pendente';
  return parts.join(' · ');
}

function writeCsv(pathOut, rows) {
  const lines = [
    'produto compra;cor;estoque;compra pendente;custo médio;preço venda médio;legados;destino;motivo',
    ...rows.map((r) =>
      [
        r.produto_compra,
        r.cor,
        r.estoque,
        Number(r.pendente_compra || 0).toFixed(2).replace('.', ','),
        Number(r.custo_medio || 0).toFixed(2).replace('.', ','),
        Number(r.preco_medio || 0).toFixed(2).replace('.', ','),
        r.n_legados,
        r.destino,
        r.motivo,
      ].join(';'),
    ),
  ];
  fs.writeFileSync(pathOut, lines.join('\n'), 'utf8');
}

function weightedAvg(items, qtyKey, valKey) {
  let qtySum = 0;
  let valSum = 0;
  for (const it of items) {
    const q = Math.max(0, Number(it[qtyKey]) || 0);
    const v = Number(it[valKey]) || 0;
    if (q > 0) {
      qtySum += q;
      valSum += q * v;
    }
  }
  if (qtySum > 0) return valSum / qtySum;
  const vals = items.map((it) => Number(it[valKey]) || 0).filter((v) => v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function main() {
  const coreMap = await loadCoreByCodigo();
  const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: produtosRaw, error } = await sb
    .from('produto')
    .select(
      'id,codigo_interno,nome,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_3,campo_hierarquico_4,campo_hierarquico_5,estoque_atual,preco_custo_calculado,preco_venda_padrao',
    )
    .eq('ativo', true)
    .or('nome.ilike.%TINTA%,campo_hierarquico_1.ilike.%TINTA%');

  if (error) throw error;

  const produtos = (produtosRaw || []).filter(
    (p) => !/^VERNIZ/i.test(p.nome || '') && !/^VERNIZ/i.test(p.campo_hierarquico_1 || ''),
  );

  const pendenteMap = await fetchPendenteCompraPorProduto(
    sb,
    produtos.map((p) => p.id),
  );

  const legados = [];
  for (const p of produtos) {
    const pendente_compra = Number(pendenteMap.get(String(p.id)) || 0);
    const codigo = cellStr(p.codigo_interno).toUpperCase();
    const catalogRow = coreMap.get(codigo) || inferCatalogRow(p);
    const mapped = to4x3(catalogRow);
    let cor = normalizeCor(mapped.comp3 || catalogRow._cor_hint || '');
    if (!cor && /SPRAY/i.test(p.nome)) {
      const dash = p.nome.match(/\s[-–—]\s+(.+)$/);
      if (dash) cor = normalizeCor(dash[1]);
      else {
        const tail = p.nome.replace(/^TINTA SPRAY[^A-Z0-9ÁÉÍÓÚÃÕÂÊÔÇ]*\d*\s*ML?\s*[-–—]?\s*/i, '');
        if (tail && tail !== p.nome) cor = normalizeCor(tail);
      }
    }
    const pcCurado = produtoCompraCurado(mapped.comp1, mapped.comp2, p.nome);

    legados.push({
      id: p.id,
      codigo,
      nome: p.nome,
      produto_compra: pcCurado,
      cor,
      estoque: Math.max(0, Number(p.estoque_atual) || 0),
      custo: Number(p.preco_custo_calculado) || 0,
      preco: Number(p.preco_venda_padrao) || 0,
      pendente_compra,
      comp1: mapped.comp1,
      comp2: mapped.comp2,
      comp3: mapped.comp3,
    });
  }

  const grupos = new Map();
  for (const leg of legados) {
    const k = blendKey(leg.produto_compra, leg.cor);
    if (!grupos.has(k)) {
      grupos.set(k, {
        produto_compra: leg.produto_compra,
        cor: leg.cor,
        legados: [],
      });
    }
    grupos.get(k).legados.push(leg);
  }

  const blended = [...grupos.values()]
    .map((g) => {
      const estoque = g.legados.reduce((s, l) => s + l.estoque, 0);
      const pendente_compra = g.legados.reduce((s, l) => s + l.pendente_compra, 0);
      const custo_medio = weightedAvg(g.legados, 'estoque', 'custo');
      const preco_medio = weightedAvg(g.legados, 'estoque', 'preco');
      const destino = classificaDestino(g.legados);
      return {
        produto_compra: g.produto_compra,
        cor: g.cor,
        estoque,
        pendente_compra,
        custo_medio,
        preco_medio,
        n_legados: g.legados.length,
        destino,
        motivo: motivoDestino(g.legados),
        legados: g.legados,
      };
    })
    .sort(
      (a, b) =>
        a.produto_compra.localeCompare(b.produto_compra, 'pt-BR') ||
        a.cor.localeCompare(b.cor, 'pt-BR'),
    );

  const core = blended.filter((r) => r.destino === 'core');
  const espaco = blended.filter((r) => r.destino === 'espaco');
  const espacoKeys = new Set(espaco.map((r) => blendKey(r.produto_compra, r.cor)));
  const legadosEspaco = legados.filter((l) => espacoKeys.has(blendKey(l.produto_compra, l.cor))).length;
  const fusoes = blended.filter((r) => r.n_legados > 1);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BLEND CADASTRAL — TINTAS (simulação + core / espaço)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Legados activos:  ${legados.length}`);
  console.log(`Linhas curadas:   ${blended.length} (${fusoes.length} fusões N→1)`);
  console.log(
    `→ CORE (catálogo): ${core.length} linhas · ${core.reduce((s, r) => s + r.estoque, 0)} un estoque · ${core.reduce((s, r) => s + r.pendente_compra, 0).toFixed(0)} un compra pendente`,
  );
  console.log(`→ ESPAÇO (arquivo): ${espaco.length} linhas · ${legadosEspaco} legados`);
  console.log('');

  const hdr = [
    'produto compra',
    'cor',
    'estoque',
    'compra pend.',
    'custo médio',
    'preço venda médio',
    'legados',
    'motivo',
  ];

  console.log('── CORE (fica no catálogo) ──');
  for (const r of core) {
    console.log(
      [
        r.produto_compra,
        r.cor || '(sem cor)',
        r.estoque,
        r.pendente_compra > 0 ? r.pendente_compra.toFixed(0) : '0',
        fmtMoney(r.custo_medio),
        fmtMoney(r.preco_medio),
        r.n_legados > 1 ? `${r.n_legados}→1` : '1',
        r.motivo,
      ].join('\t'),
    );
  }

  console.log('\n── ESPAÇO (sem estoque · sem compra pendente) ──');
  for (const r of espaco) {
    console.log([r.produto_compra, r.cor || '(sem cor)', r.n_legados > 1 ? `${r.n_legados}→1` : '1'].join('\t'));
  }

  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  writeCsv(OUT_CSV, blended);
  writeCsv(OUT_CORE, core);
  writeCsv(OUT_ESPACO, espaco);
  console.log(`\n[simular-blend-tintas] CSV completo → ${OUT_CSV}`);
  console.log(`[simular-blend-tintas] CSV core    → ${OUT_CORE}`);
  console.log(`[simular-blend-tintas] CSV espaço  → ${OUT_ESPACO}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
