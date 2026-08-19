#!/usr/bin/env node
/**
 * Detalha custos "Outros" do Relatório de Margem por produto e linha hierárquica.
 * Usa a mesma regra do app: custo_outros_padrao (cadastro atual) × quantidade base vendida.
 *
 * Uso:
 *   npm run audit:margem-outros -- --from=2026-07-01 --to=2026-07-31
 *   npm run audit:margem-outros -- --competencia=2026-07
 *   npm run audit:margem-outros -- --from=2026-07-01 --to=2026-07-31 --json --out=docs/audit/margem-outros-jul-2026.json
 *
 * Credenciais: DATABASE_URL (Supabase) ou Base44 (VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { loadDotEnvFiles, REPO_ROOT, requireBase44Client } from './base44-env.mjs';

loadDotEnvFiles();

const STATUS_ELEGIVEL = [
  'Financeiro OK',
  'Pedido Concluído',
  'Em Separação',
  'Em Rota de Entrega',
];

const fmtR = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseArgs(argv) {
  const fromArg = argv.find((a) => a.startsWith('--from='));
  const toArg = argv.find((a) => a.startsWith('--to='));
  const compArg = argv.find((a) => a.startsWith('--competencia='));
  const outArg = argv.find((a) => a.startsWith('--out='));
  const json = argv.includes('--json');

  let from = fromArg?.slice('--from='.length) || '';
  let to = toArg?.slice('--to='.length) || '';

  if (compArg) {
    const comp = compArg.slice('--competencia='.length).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(comp)) {
      console.error('Competência inválida. Use YYYY-MM');
      process.exit(1);
    }
    const [y, m] = comp.split('-').map(Number);
    from = `${comp}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    to = `${comp}-${String(lastDay).padStart(2, '0')}`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    console.error(
      'Uso: npm run audit:margem-outros -- --from=YYYY-MM-DD --to=YYYY-MM-DD\n' +
        '     npm run audit:margem-outros -- --competencia=YYYY-MM [--json] [--out=caminho.json]',
    );
    process.exit(1);
  }

  return {
    from,
    to,
    out: outArg ? outArg.slice('--out='.length) : '',
    json,
  };
}

function toRioBrancoDateKey(valor) {
  if (!valor) return '';
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

function inDateRange(key, from, to) {
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDescontoCompra(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function resolveAvariaFator1(product, valorCompraBruto) {
  const pct = normalizeNum(product?.avaria_percentual);
  if (pct > 0 && valorCompraBruto > 0) return roundMoney(valorCompraBruto * (pct / 100));
  return 0;
}

function resolveCustoOutrosUnit(product) {
  return normalizeNum(product?.custo_outros_padrao);
}

function resolveQuantidadeBase(item) {
  const qtdComercial = normalizeNum(item?.quantidade ?? item?.quantidade_comercial);
  const fator = normalizeNum(item?.fator_conversao ?? item?.fator_aplicado) || 1;
  const qBase = normalizeNum(item?.quantidade_base);
  if (qBase > 0) return qBase;
  if (qtdComercial > 0) return qtdComercial * fator;
  return 0;
}

function pedidoElegivel(pedido) {
  if (!pedido) return false;
  const status = String(pedido.status ?? pedido.dados?.status ?? '').trim();
  if (status === 'Cancelado' || status.toLowerCase() === 'cancelado') return false;
  return STATUS_ELEGIVEL.includes(status);
}

function saleDateKey(pedido) {
  const raw =
    pedido?.created_date ??
    pedido?.created_at ??
    pedido?.dados?.created_date ??
    pedido?.dados?.data_venda ??
    pedido?.dados?.data_emissao;
  return toRioBrancoDateKey(raw);
}

function mapProductRow(row) {
  const dados = row?.dados && typeof row.dados === 'object' ? row.dados : {};
  return {
    id: row.id,
    nome: row.nome ?? dados.nome ?? '',
    campo_hierarquico_1: row.campo_hierarquico_1 ?? dados.campo_hierarquico_1 ?? 'Outros',
    campo_hierarquico_2: row.campo_hierarquico_2 ?? dados.campo_hierarquico_2 ?? '',
    categoria_nome: row.categoria_nome ?? dados.categoria_nome ?? '',
    custo_outros_padrao: normalizeNum(row.custo_outros_padrao ?? dados.custo_outros_padrao),
    custo_imposto1_padrao: normalizeNum(row.custo_imposto1_padrao ?? dados.custo_imposto1_padrao),
    custo_imposto2_padrao: normalizeNum(row.custo_imposto2_padrao ?? dados.custo_imposto2_padrao),
    valor_compra: normalizeNum(row.valor_compra ?? dados.valor_compra),
    desconto_compra_padrao: row.desconto_compra_padrao ?? dados.desconto_compra_padrao,
    avaria_percentual: normalizeNum(row.avaria_percentual ?? dados.avaria_percentual),
  };
}

function acumularOutros(reportMap, item, product) {
  const prodKey = item.produto_id ? String(item.produto_id) : `nome:${String(item.produto_nome || '').trim().toLowerCase()}`;
  const outrosUnit = product ? resolveCustoOutrosUnit(product) : 0;
  const qtdBase = resolveQuantidadeBase(item);

  if (!reportMap[prodKey]) {
    reportMap[prodKey] = {
      produto_id: item.produto_id || null,
      nome: product?.nome || item.produto_nome || prodKey,
      linha: product?.campo_hierarquico_1 || 'Outros',
      grupo: product?.campo_hierarquico_2 || '',
      categoria: product?.categoria_nome || '',
      outros_unit: outrosUnit,
      quantidade_base: 0,
      custo_outros_total: 0,
      custo_imposto1_total: 0,
      custo_imposto2_total: 0,
    };
  }

  const entry = reportMap[prodKey];
  entry.quantidade_base += qtdBase;
  entry.custo_outros_total = roundMoney(entry.custo_outros_total + outrosUnit * qtdBase);
  if (product) {
    entry.custo_imposto1_total = roundMoney(
      entry.custo_imposto1_total + normalizeNum(product.custo_imposto1_padrao) * qtdBase,
    );
    entry.custo_imposto2_total = roundMoney(
      entry.custo_imposto2_total + normalizeNum(product.custo_imposto2_padrao) * qtdBase,
    );
  }
}

function buildReportFromSales(sales, products, from, to) {
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const reportMap = {};

  for (const sale of sales) {
    if (!pedidoElegivel(sale)) continue;
    if (!inDateRange(saleDateKey(sale), from, to)) continue;

    const itens = Array.isArray(sale.itens) ? sale.itens : [];
    for (const item of itens) {
      if (!item || typeof item !== 'object') continue;
      const product = item.produto_id ? prodMap.get(item.produto_id) : null;
      acumularOutros(reportMap, item, product);
    }
  }

  return Object.values(reportMap)
    .filter((r) => r.custo_outros_total > 0.0001)
    .sort((a, b) => b.custo_outros_total - a.custo_outros_total);
}

async function loadViaPostgres(from, to) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const statusList = STATUS_ELEGIVEL;
    const { rows: itemRows } = await client.query(
      `
      with vendas as (
        select pv.id
        from public.pedido_venda pv
        where public.p38_pedido_venda_sale_date(pv) between $1::date and $2::date
          and coalesce(pv.status, pv.dados->>'status', '') = any($3::text[])
      ),
      agg as (
        select
          pvi.produto_id,
          sum(coalesce(pvi.quantidade_base, 0))::numeric as quantidade_base
        from public.pedido_venda_item pvi
        inner join vendas v on v.id = pvi.pedido_venda_id
        where pvi.produto_id is not null
        group by pvi.produto_id
      )
      select
        p.id as produto_id,
        coalesce(p.nome, p.dados->>'nome', '') as nome,
        coalesce(p.campo_hierarquico_1, p.dados->>'campo_hierarquico_1', 'Outros') as linha,
        coalesce(p.campo_hierarquico_2, p.dados->>'campo_hierarquico_2', '') as grupo,
        coalesce(p.categoria_nome, p.dados->>'categoria_nome', '') as categoria,
        coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) as outros_unit,
        coalesce(p.custo_imposto1_padrao, (p.dados->>'custo_imposto1_padrao')::numeric, 0) as imposto1_unit,
        coalesce(p.custo_imposto2_padrao, (p.dados->>'custo_imposto2_padrao')::numeric, 0) as imposto2_unit,
        a.quantidade_base
      from agg a
      inner join public.produto p on p.id = a.produto_id
      where coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) > 0
      order by (coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) * a.quantidade_base) desc
      `,
      [from, to, statusList],
    );

    return itemRows.map((row) => ({
      produto_id: row.produto_id,
      nome: row.nome,
      linha: row.linha || 'Outros',
      grupo: row.grupo || '',
      categoria: row.categoria || '',
      outros_unit: roundMoney(row.outros_unit),
      quantidade_base: roundMoney(row.quantidade_base),
      custo_outros_total: roundMoney(row.outros_unit * row.quantidade_base),
      custo_imposto1_total: roundMoney(row.imposto1_unit * row.quantidade_base),
      custo_imposto2_total: roundMoney(row.imposto2_unit * row.quantidade_base),
    }));
  } finally {
    await client.end();
  }
}

async function loadViaBase44(from, to) {
  const base44 = requireBase44Client();

  const products = [];
  let skip = 0;
  const pageSize = 500;
  for (let page = 0; page < 80; page += 1) {
    const batch = await base44.entities.Produto.list('-created_date', pageSize, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    let novos = 0;
    for (const row of rows) {
      if (!row?.id) continue;
      if (products.some((p) => p.id === row.id)) continue;
      products.push(mapProductRow(row));
      novos += 1;
    }
    if (rows.length < pageSize || novos === 0) break;
    skip += pageSize;
  }

  const sales = [];
  skip = 0;
  for (let page = 0; page < 80; page += 1) {
    const batch = await base44.entities.PedidoVenda.list('-created_date', pageSize, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    let novos = 0;
    for (const pedido of rows) {
      if (!pedido?.id) continue;
      if (sales.some((p) => p.id === pedido.id)) continue;
      sales.push(pedido);
      novos += 1;
    }
    if (rows.length < pageSize || novos === 0) break;
    skip += pageSize;
  }

  const pedidoIdsSemItens = sales.filter((p) => !Array.isArray(p.itens) || p.itens.length === 0).map((p) => p.id);
  const itensPorPedido = {};

  if (pedidoIdsSemItens.length && base44.entities.PedidoVendaItem?.filter) {
    const chunk = 40;
    for (let i = 0; i < pedidoIdsSemItens.length; i += chunk) {
      const ids = pedidoIdsSemItens.slice(i, i + chunk);
      try {
        const batch = await base44.entities.PedidoVendaItem.filter({ pedido_venda_id: { $in: ids } });
        const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
        for (const it of rows) {
          const pid = String(it.pedido_venda_id);
          if (!itensPorPedido[pid]) itensPorPedido[pid] = [];
          itensPorPedido[pid].push(it);
        }
      } catch {
        /* ignora chunk */
      }
    }
  }

  const salesHidratados = sales.map((pedido) => ({
    ...pedido,
    itens:
      Array.isArray(pedido.itens) && pedido.itens.length
        ? pedido.itens
        : itensPorPedido[String(pedido.id)] || [],
  }));

  return buildReportFromSales(salesHidratados, products, from, to);
}

function agruparPorLinha(produtos) {
  const map = new Map();
  for (const row of produtos) {
    const key = row.linha || 'Outros';
    if (!map.has(key)) {
      map.set(key, { linha: key, produtos: 0, quantidade_base: 0, custo_outros_total: 0 });
    }
    const g = map.get(key);
    g.produtos += 1;
    g.quantidade_base += row.quantidade_base || 0;
    g.custo_outros_total = roundMoney(g.custo_outros_total + (row.custo_outros_total || 0));
  }
  return [...map.values()].sort((a, b) => b.custo_outros_total - a.custo_outros_total);
}

function imprimirRelatorio({ from, to, fonte, produtos }) {
  const totalOutros = roundMoney(produtos.reduce((s, r) => s + (r.custo_outros_total || 0), 0));
  const totalImp1 = roundMoney(produtos.reduce((s, r) => s + (r.custo_imposto1_total || 0), 0));
  const totalImp2 = roundMoney(produtos.reduce((s, r) => s + (r.custo_imposto2_total || 0), 0));
  const linhas = agruparPorLinha(produtos);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Relatório de Margem — detalhe "Outros Custos"');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Período: ${from} a ${to} (fuso Rio Branco, UTC-5)`);
  console.log(`  Fonte: ${fonte}`);
  console.log(`  Regra: custo_outros_padrao do cadastro ATUAL × qtd base vendida`);
  console.log('');
  console.log(`  Total Outros:   R$ ${fmtR(totalOutros)}`);
  console.log(`  Total Imposto1: R$ ${fmtR(totalImp1)}  (referência — linha separada no relatório)`);
  console.log(`  Total Imposto2: R$ ${fmtR(totalImp2)}  (referência — linha separada no relatório)`);
  console.log(`  Produtos com Outros > 0: ${produtos.length}`);
  console.log('');

  if (!produtos.length) {
    console.log('  Nenhum produto com custo "Outros" no período.');
    console.log('');
    return { totalOutros, linhas, produtos };
  }

  console.log('── Por linha de produto (campo_hierarquico_1) ──');
  console.log('');
  for (const g of linhas) {
    const pct = totalOutros > 0 ? ((g.custo_outros_total / totalOutros) * 100).toFixed(1) : '0.0';
    console.log(
      `  ${g.linha.padEnd(28)} R$ ${fmtR(g.custo_outros_total).padStart(12)}  (${pct}% · ${g.produtos} prod.)`,
    );
  }

  console.log('');
  console.log('── Top produtos (Outros) ──');
  console.log('');
  console.log('  Produto'.padEnd(42) + 'Linha'.padEnd(22) + 'Out/Un'.padStart(10) + 'Qtd base'.padStart(12) + 'Total Out'.padStart(14));
  console.log('  ' + '─'.repeat(96));

  const top = produtos.slice(0, 40);
  for (const row of top) {
    const nome = String(row.nome || '').slice(0, 40).padEnd(42);
    const linha = String(row.linha || '').slice(0, 20).padEnd(22);
    console.log(
      `  ${nome}${linha}${fmtR(row.outros_unit).padStart(10)}${fmtR(row.quantidade_base).padStart(12)}${fmtR(row.custo_outros_total).padStart(14)}`,
    );
  }

  if (produtos.length > top.length) {
    console.log(`  … e mais ${produtos.length - top.length} produto(s). Use --json para lista completa.`);
  }

  console.log('');
  console.log('  Nota: "Outros" = campo Outros Custos no cadastro do produto.');
  console.log('  Não inclui Imposto 1/2 (aparecem em linhas separadas no relatório).');
  console.log('');

  return { totalOutros, totalImp1, totalImp2, linhas, produtos };
}

async function main() {
  const { from, to, out, json } = parseArgs(process.argv.slice(2));

  let fonte = 'postgres';
  let produtos = await loadViaPostgres(from, to).catch((err) => {
    console.warn('[postgres] Falha:', err?.message || err);
    return null;
  });

  if (!produtos) {
    fonte = 'base44';
    produtos = await loadViaBase44(from, to);
  }

  const resumo = imprimirRelatorio({ from, to, fonte, produtos });

  if (out || json) {
    const payload = {
      exportedAt: new Date().toISOString(),
      periodo: { from, to },
      fonte,
      totais: {
        custo_outros_total: resumo.totalOutros,
        custo_imposto1_total: resumo.totalImp1,
        custo_imposto2_total: resumo.totalImp2,
      },
      por_linha: resumo.linhas,
      produtos: resumo.produtos,
    };

    if (out) {
      const abs = join(REPO_ROOT, out);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`JSON gravado em ${out}`);
    } else if (json) {
      console.log(JSON.stringify(payload, null, 2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
