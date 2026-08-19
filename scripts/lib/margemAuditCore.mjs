/**
 * Núcleo partilhado — auditoria Relatório de Margem (mesma regra do app).
 */
import pg from 'pg';
import { requireBase44Client } from '../base44-env.mjs';

export const STATUS_ELEGIVEL = [
  'Financeiro OK',
  'Pedido Concluído',
  'Em Separação',
  'Em Rota de Entrega',
];

export const CUSTO_MARGEM_CAMPOS = [
  { sourceKey: 'valor_compra', totalKey: 'custo_compra_total', label: 'Compra' },
  { sourceKey: 'custo_avaria', totalKey: 'custo_avaria_total', label: 'Avaria' },
  { sourceKey: 'custo_frete', totalKey: 'custo_frete_total', label: 'Frete' },
  { sourceKey: 'custo_imposto1', totalKey: 'custo_imposto1_total', label: 'Imposto 1' },
  { sourceKey: 'custo_imposto2', totalKey: 'custo_imposto2_total', label: 'Imposto 2' },
  { sourceKey: 'custo_outros', totalKey: 'custo_outros_total', label: 'Outros' },
];

export const fmtR = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function parseMargemPeriodArgs(argv) {
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
    return null;
  }

  return { from, to, out: outArg ? outArg.slice('--out='.length) : '', json };
}

export function toRioBrancoDateKey(valor) {
  if (!valor) return '';
  const s = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

export function inDateRange(key, from, to) {
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDescontoText(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function resolveDescontoCompraFator1(product, valorCompraBruto) {
  const pct = normalizeNum(product?.desconto_perc);
  if (pct !== 0 && valorCompraBruto > 0) {
    const absVal = roundMoney((valorCompraBruto * Math.abs(pct)) / 100);
    return pct < 0 ? -absVal : absVal;
  }
  return roundMoney(parseDescontoText(product?.desconto_compra_padrao));
}

export function resolveAvariaFator1(product, valorCompraBruto) {
  const pct = normalizeNum(product?.avaria_percentual);
  if (pct <= 0 || valorCompraBruto <= 0) return 0;
  return roundMoney((valorCompraBruto * pct) / 100);
}

export function resolveCustoComponentesUnitBaseMargem(product = null) {
  if (!product) {
    return {
      valor_compra: 0,
      custo_avaria: 0,
      custo_frete: 0,
      custo_imposto1: 0,
      custo_imposto2: 0,
      custo_outros: 0,
    };
  }

  const valorCompraBruto = normalizeNum(product.valor_compra);
  const desconto = resolveDescontoCompraFator1(product, valorCompraBruto);
  const valorCompraLiquido = roundMoney(Math.max(0, valorCompraBruto - desconto));

  return {
    valor_compra: valorCompraLiquido,
    custo_avaria: resolveAvariaFator1(product, valorCompraBruto),
    custo_frete: normalizeNum(product.custo_frete_padrao),
    custo_imposto1: normalizeNum(product.custo_imposto1_padrao),
    custo_imposto2: normalizeNum(product.custo_imposto2_padrao),
    custo_outros: normalizeNum(product.custo_outros_padrao),
  };
}

export function criarTotaisComponentesZerados() {
  const out = {};
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    out[campo.totalKey] = 0;
  }
  out.custo_total = 0;
  out.receita_liquida = 0;
  out.lucro_total = 0;
  out.quantidade_produtos = 0;
  return out;
}

export function acumularComponentes(entry, componentesUnit, quantidadeBase) {
  const qtd = normalizeNum(quantidadeBase);
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    const unit = normalizeNum(componentesUnit[campo.sourceKey]);
    entry[campo.totalKey] = roundMoney((entry[campo.totalKey] || 0) + unit * qtd);
  }
}

export function somarTotaisComponentes(acc, row) {
  const out = { ...acc };
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    out[campo.totalKey] = roundMoney((out[campo.totalKey] || 0) + (row[campo.totalKey] || 0));
  }
  return out;
}

export function calcularCustoTotalLinha(row) {
  let total = 0;
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    total += normalizeNum(row[campo.totalKey]);
  }
  return roundMoney(total);
}

export function resolveQuantidadeBase(item) {
  const qtdComercial = normalizeNum(item?.quantidade ?? item?.quantidade_comercial);
  const fator = normalizeNum(item?.fator_conversao ?? item?.fator_aplicado) || 1;
  const qBase = normalizeNum(item?.quantidade_base);
  if (qBase > 0) return qBase;
  if (qtdComercial > 0) return qtdComercial * fator;
  return 0;
}

export function pedidoElegivel(pedido) {
  if (!pedido) return false;
  const status = String(pedido.status ?? pedido.dados?.status ?? '').trim();
  if (status === 'Cancelado' || status.toLowerCase() === 'cancelado') return false;
  return STATUS_ELEGIVEL.includes(status);
}

export function saleDateKey(pedido) {
  const raw =
    pedido?.created_date ??
    pedido?.created_at ??
    pedido?.dados?.created_date ??
    pedido?.dados?.data_venda ??
    pedido?.dados?.data_emissao;
  return toRioBrancoDateKey(raw);
}

export function mapProductRow(row) {
  const dados = row?.dados && typeof row.dados === 'object' ? row.dados : {};
  return {
    id: row.id,
    nome: row.nome ?? dados.nome ?? '',
    campo_hierarquico_1: row.campo_hierarquico_1 ?? dados.campo_hierarquico_1 ?? 'Outros',
    campo_hierarquico_2: row.campo_hierarquico_2 ?? dados.campo_hierarquico_2 ?? '',
    categoria_nome: row.categoria_nome ?? dados.categoria_nome ?? '',
    valor_compra: normalizeNum(row.valor_compra ?? dados.valor_compra),
    desconto_compra_padrao: row.desconto_compra_padrao ?? dados.desconto_compra_padrao,
    desconto_perc: normalizeNum(row.desconto_perc ?? dados.desconto_perc),
    avaria_percentual: normalizeNum(row.avaria_percentual ?? dados.avaria_percentual),
    custo_frete_padrao: normalizeNum(row.custo_frete_padrao ?? dados.custo_frete_padrao),
    custo_imposto1_padrao: normalizeNum(row.custo_imposto1_padrao ?? dados.custo_imposto1_padrao),
    custo_imposto2_padrao: normalizeNum(row.custo_imposto2_padrao ?? dados.custo_imposto2_padrao),
    custo_outros_padrao: normalizeNum(row.custo_outros_padrao ?? dados.custo_outros_padrao),
    preco_custo_calculado: normalizeNum(row.preco_custo_calculado ?? dados.preco_custo_calculado),
  };
}

function resolverTotalLinhaVenda(item = {}) {
  const qtdComercial = normalizeNum(item.quantidade);
  const direto = normalizeNum(item.total ?? item.valor_total ?? item.valor_total_item ?? item.subtotal);
  if (direto > 0) return direto;

  const preco = normalizeNum(item.preco_unitario_praticado ?? item.preco_unitario_fator1);
  if (qtdComercial > 0 && preco > 0) return qtdComercial * preco;

  const quantidadeBase =
    normalizeNum(item.quantidade_base) ||
    (qtdComercial * normalizeNum(item.fator_conversao) || 1) ||
    qtdComercial;
  const precoBase = normalizeNum(
    item.preco_final_unitario_fator1 ?? item.preco_unitario_praticado ?? item.preco_unitario_fator1,
  );
  if (quantidadeBase > 0 && precoBase > 0) return quantidadeBase * precoBase;
  return 0;
}

function resolverValorTotalPedido(pedido = {}) {
  const direto = normalizeNum(pedido.valor_total ?? pedido.total);
  if (direto > 0) return roundMoney(direto);
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  return roundMoney(itens.reduce((acc, item) => acc + resolverTotalLinhaVenda(item), 0));
}

function distribuirValorProporcional(total, pesos = []) {
  const alvo = roundMoney(total);
  if (!pesos.length) return [];

  const somaPesos = pesos.reduce((acc, peso) => acc + normalizeNum(peso), 0);
  if (somaPesos <= 0) {
    return distribuirValorProporcional(alvo, Array(pesos.length).fill(1));
  }

  const brutos = pesos.map((peso) => (normalizeNum(peso) / somaPesos) * alvo);
  const arredondados = brutos.map(roundMoney);
  let diffCentavos = Math.round((alvo - arredondados.reduce((acc, v) => acc + v, 0)) * 100);
  if (!diffCentavos) return arredondados;

  const ordem = brutos
    .map((bruto, index) => ({ index, resto: bruto - arredondados[index] }))
    .sort((a, b) => (diffCentavos > 0 ? b.resto - a.resto : a.resto - b.resto));

  let cursor = 0;
  while (diffCentavos !== 0 && ordem.length > 0) {
    const { index } = ordem[cursor % ordem.length];
    arredondados[index] = roundMoney(arredondados[index] + (diffCentavos > 0 ? 0.01 : -0.01));
    diffCentavos += diffCentavos > 0 ? -1 : 1;
    cursor += 1;
  }

  return arredondados;
}

function alocarReceitaPedidoNasLinhas(pedido = {}) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens.filter(Boolean) : [];
  if (!itens.length) return [];

  const brutos = itens.map((item) => resolverTotalLinhaVenda(item));
  const valorPedido = resolverValorTotalPedido(pedido);

  if (valorPedido <= 0 && brutos.reduce((a, b) => a + b, 0) <= 0) {
    return itens.map(() => ({ receita_liquida: 0 }));
  }

  if (brutos.reduce((a, b) => a + b, 0) <= 0) {
    const receitas = distribuirValorProporcional(valorPedido, Array(itens.length).fill(1));
    return receitas.map((receita_liquida) => ({ receita_liquida }));
  }

  const receitas = distribuirValorProporcional(valorPedido, brutos);
  return receitas.map((receita_liquida) => ({ receita_liquida }));
}

export function buildLinhasMargemFromSales(sales, products, from, to) {
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const reportMap = {};

  for (const sale of sales) {
    if (!pedidoElegivel(sale)) continue;
    if (!inDateRange(saleDateKey(sale), from, to)) continue;

    const itens = Array.isArray(sale.itens) ? sale.itens.filter(Boolean) : [];
    const alocacoes = alocarReceitaPedidoNasLinhas(sale);

    for (let index = 0; index < itens.length; index += 1) {
      const item = itens[index];
      const prodKey = item.produto_id ? String(item.produto_id) : `nome:${String(item.produto_nome || '').trim().toLowerCase()}`;
      const product = item.produto_id ? prodMap.get(item.produto_id) : null;
      const alloc = alocacoes[index] || { receita_liquida: 0 };

      if (!reportMap[prodKey]) {
        reportMap[prodKey] = {
          produto_id: item.produto_id || null,
          nome: product?.nome || item.produto_nome || prodKey,
          linha: product?.campo_hierarquico_1 || 'Outros',
          ...Object.fromEntries(CUSTO_MARGEM_CAMPOS.map((c) => [c.totalKey, 0])),
          receita_liquida: 0,
          quantidade_base: 0,
        };
      }

      const entry = reportMap[prodKey];
      const qtdBase = resolveQuantidadeBase(item);
      entry.quantidade_base += qtdBase;
      entry.receita_liquida = roundMoney(entry.receita_liquida + (alloc.receita_liquida || 0));
      acumularComponentes(entry, resolveCustoComponentesUnitBaseMargem(product), qtdBase);
    }
  }

  return Object.values(reportMap).map((row) => {
    const custo_total = calcularCustoTotalLinha(row);
    const receita_liquida = roundMoney(row.receita_liquida);
    return {
      ...row,
      custo_total,
      receita_liquida,
      lucro_total: roundMoney(receita_liquida - custo_total),
    };
  });
}

export function calcularTotaisMargem(linhas = []) {
  const totais = criarTotaisComponentesZerados();
  for (const row of linhas) {
    for (const campo of CUSTO_MARGEM_CAMPOS) {
      totais[campo.totalKey] = roundMoney(totais[campo.totalKey] + (row[campo.totalKey] || 0));
    }
    totais.custo_total = roundMoney(totais.custo_total + (row.custo_total || 0));
    totais.receita_liquida = roundMoney(totais.receita_liquida + (row.receita_liquida || 0));
    totais.lucro_total = roundMoney(totais.lucro_total + (row.lucro_total || 0));
  }
  totais.quantidade_produtos = linhas.length;
  totais.markup_percentual =
    totais.custo_total > 0 ? roundMoney((totais.lucro_total / totais.custo_total) * 100) : 0;
  totais.margem_percentual =
    totais.receita_liquida > 0 ? roundMoney((totais.lucro_total / totais.receita_liquida) * 100) : 0;
  return totais;
}

function mapAggRowToLinha(row) {
  const componentes = resolveCustoComponentesUnitBaseMargem({
    valor_compra: row.valor_compra,
    desconto_compra_padrao: row.desconto_compra_padrao,
    desconto_perc: row.desconto_perc,
    avaria_percentual: row.avaria_percentual,
    custo_frete_padrao: row.custo_frete_padrao,
    custo_imposto1_padrao: row.custo_imposto1_padrao,
    custo_imposto2_padrao: row.custo_imposto2_padrao,
    custo_outros_padrao: row.custo_outros_padrao,
  });
  const qtd = normalizeNum(row.quantidade_base);
  const linha = {
    produto_id: row.produto_id,
    nome: row.nome,
    linha: row.linha || 'Outros',
    quantidade_base: qtd,
    receita_liquida: 0,
  };
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    linha[campo.totalKey] = roundMoney(normalizeNum(componentes[campo.sourceKey]) * qtd);
  }
  linha.custo_total = calcularCustoTotalLinha(linha);
  linha.lucro_total = 0;
  return linha;
}

export async function loadMargemViaPostgres(from, to) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      `
      with vendas as (
        select pv.id, public.p38_pedido_venda_total(pv) as valor_total
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
      ),
      receita as (
        select coalesce(sum(valor_total), 0)::numeric as receita_liquida from vendas
      )
      select
        p.id as produto_id,
        coalesce(p.nome, p.dados->>'nome', '') as nome,
        coalesce(p.campo_hierarquico_1, p.dados->>'campo_hierarquico_1', 'Outros') as linha,
        coalesce(p.valor_compra, (p.dados->>'valor_compra')::numeric, 0) as valor_compra,
        coalesce(p.desconto_compra_padrao, p.dados->>'desconto_compra_padrao', '') as desconto_compra_padrao,
        coalesce(p.desconto_perc, (p.dados->>'desconto_perc')::numeric, 0) as desconto_perc,
        coalesce(p.avaria_percentual, (p.dados->>'avaria_percentual')::numeric, 0) as avaria_percentual,
        coalesce(p.custo_frete_padrao, (p.dados->>'custo_frete_padrao')::numeric, 0) as custo_frete_padrao,
        coalesce(p.custo_imposto1_padrao, (p.dados->>'custo_imposto1_padrao')::numeric, 0) as custo_imposto1_padrao,
        coalesce(p.custo_imposto2_padrao, (p.dados->>'custo_imposto2_padrao')::numeric, 0) as custo_imposto2_padrao,
        coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) as custo_outros_padrao,
        a.quantidade_base,
        (select receita_liquida from receita) as receita_liquida_periodo
      from agg a
      inner join public.produto p on p.id = a.produto_id
      `,
      [from, to, STATUS_ELEGIVEL],
    );

    if (!rows.length) {
      return { fonte: 'postgres', linhas: [], receita_liquida: 0 };
    }

    const receita_liquida = roundMoney(rows[0]?.receita_liquida_periodo);
    const linhas = rows.map(mapAggRowToLinha);
    const custo_total = roundMoney(linhas.reduce((s, r) => s + r.custo_total, 0));
    const lucro_total = roundMoney(receita_liquida - custo_total);

    for (const linha of linhas) {
      const peso = custo_total > 0 ? linha.custo_total / custo_total : 0;
      linha.receita_liquida = roundMoney(receita_liquida * peso);
      linha.lucro_total = roundMoney(linha.receita_liquida - linha.custo_total);
    }

    return { fonte: 'postgres', linhas, receita_liquida, custo_total, lucro_total };
  } finally {
    await client.end();
  }
}

export async function loadMargemViaBase44(from, to) {
  const base44 = requireBase44Client();

  const products = [];
  let skip = 0;
  for (let page = 0; page < 80; page += 1) {
    const batch = await base44.entities.Produto.list('-created_date', 500, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    let novos = 0;
    for (const row of rows) {
      if (!row?.id || products.some((p) => p.id === row.id)) continue;
      products.push(mapProductRow(row));
      novos += 1;
    }
    if (rows.length < 500 || novos === 0) break;
    skip += 500;
  }

  const sales = [];
  skip = 0;
  for (let page = 0; page < 80; page += 1) {
    const batch = await base44.entities.PedidoVenda.list('-created_date', 500, skip);
    const rows = Array.isArray(batch) ? batch : batch?.data ?? [];
    if (!rows.length) break;
    let novos = 0;
    for (const pedido of rows) {
      if (!pedido?.id || sales.some((p) => p.id === pedido.id)) continue;
      sales.push(pedido);
      novos += 1;
    }
    if (rows.length < 500 || novos === 0) break;
    skip += 500;
  }

  const semItens = sales.filter((p) => !Array.isArray(p.itens) || !p.itens.length);
  const itensPorPedido = {};
  if (semItens.length && base44.entities.PedidoVendaItem?.filter) {
    for (let i = 0; i < semItens.length; i += 40) {
      const ids = semItens.slice(i, i + 40).map((p) => p.id);
      try {
        const batch = await base44.entities.PedidoVendaItem.filter({ pedido_venda_id: { $in: ids } });
        for (const it of Array.isArray(batch) ? batch : batch?.data ?? []) {
          const pid = String(it.pedido_venda_id);
          if (!itensPorPedido[pid]) itensPorPedido[pid] = [];
          itensPorPedido[pid].push(it);
        }
      } catch {
        /* ignora */
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

  const linhas = buildLinhasMargemFromSales(salesHidratados, products, from, to);
  const totais = calcularTotaisMargem(linhas);
  return {
    fonte: 'base44',
    linhas,
    receita_liquida: totais.receita_liquida,
    custo_total: totais.custo_total,
    lucro_total: totais.lucro_total,
    totais,
  };
}

export async function loadMargemPeriodo(from, to) {
  const pgResult = await loadMargemViaPostgres(from, to).catch((err) => {
    console.warn('[postgres]', err?.message || err);
    return null;
  });
  if (pgResult) {
    const totais = calcularTotaisMargem(pgResult.linhas);
    totais.receita_liquida = pgResult.receita_liquida;
    totais.custo_total = pgResult.custo_total;
    totais.lucro_total = pgResult.lucro_total;
    totais.markup_percentual =
      totais.custo_total > 0 ? roundMoney((totais.lucro_total / totais.custo_total) * 100) : 0;
    totais.margem_percentual =
      totais.receita_liquida > 0 ? roundMoney((totais.lucro_total / totais.receita_liquida) * 100) : 0;
    return { fonte: pgResult.fonte, linhas: pgResult.linhas, totais };
  }

  const b44 = await loadMargemViaBase44(from, to);
  return { fonte: b44.fonte, linhas: b44.linhas, totais: b44.totais };
}
