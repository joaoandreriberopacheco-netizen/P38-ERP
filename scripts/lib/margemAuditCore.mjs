/**
 * Núcleo partilhado — auditoria Relatório de Margem via Supabase (Postgres).
 */
import { withSupabasePg } from './supabasePg.mjs';

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

export function calcularCustoTotalLinha(row) {
  let total = 0;
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    total += normalizeNum(row[campo.totalKey]);
  }
  return roundMoney(total);
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
    outros_unit: roundMoney(normalizeNum(row.custo_outros_padrao)),
  };
  for (const campo of CUSTO_MARGEM_CAMPOS) {
    linha[campo.totalKey] = roundMoney(normalizeNum(componentes[campo.sourceKey]) * qtd);
  }
  linha.custo_total = calcularCustoTotalLinha(linha);
  linha.lucro_total = 0;
  return linha;
}

export async function loadMargemSupabase(from, to) {
  return withSupabasePg(async (client) => {
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
      return { fonte: 'supabase', linhas: [], receita_liquida: 0, custo_total: 0, lucro_total: 0 };
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

    return { fonte: 'supabase', linhas, receita_liquida, custo_total, lucro_total };
  });
}

export async function loadMargemPeriodo(from, to) {
  const result = await loadMargemSupabase(from, to);
  const totais = calcularTotaisMargem(result.linhas);
  totais.receita_liquida = result.receita_liquida;
  totais.custo_total = result.custo_total;
  totais.lucro_total = result.lucro_total;
  totais.markup_percentual =
    totais.custo_total > 0 ? roundMoney((totais.lucro_total / totais.custo_total) * 100) : 0;
  totais.margem_percentual =
    totais.receita_liquida > 0 ? roundMoney((totais.lucro_total / totais.receita_liquida) * 100) : 0;
  return { fonte: result.fonte, linhas: result.linhas, totais };
}

export async function loadProdutosComOutrosCadastro({ soAtivos = true } = {}) {
  return withSupabasePg(async (client) => {
    const filtroAtivo = soAtivos
      ? 'and coalesce(p.ativo, (p.dados->>\'ativo\')::boolean, true) = true'
      : '';
    const { rows } = await client.query(
      `
      select
        p.id,
        coalesce(p.nome, p.dados->>'nome', '') as nome,
        coalesce(p.codigo_interno, p.dados->>'codigo_interno', '') as codigo_interno,
        coalesce(p.campo_hierarquico_1, p.dados->>'campo_hierarquico_1', 'Outros') as linha,
        coalesce(p.campo_hierarquico_2, p.dados->>'campo_hierarquico_2', '') as grupo,
        coalesce(p.categoria_nome, p.dados->>'categoria_nome', '') as categoria,
        coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) as outros_unit,
        coalesce(p.unidade_principal, p.dados->>'unidade_principal', 'UN') as unidade,
        coalesce(p.ativo, (p.dados->>'ativo')::boolean, true) as ativo
      from public.produto p
      where coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) > 0
      ${filtroAtivo}
      order by outros_unit desc, nome asc
      `,
    );
    return rows.map((r) => ({
      produto_id: r.id,
      codigo_interno: r.codigo_interno,
      nome: r.nome,
      linha: r.linha || 'Outros',
      grupo: r.grupo || '',
      categoria: r.categoria || '',
      outros_unit: roundMoney(r.outros_unit),
      unidade: r.unidade || 'UN',
      ativo: r.ativo !== false,
    }));
  });
}
