/**
 * Motor Preço Justo — classificação semântica + equação do subsídio.
 * Espelha scripts/backtest_preco_justo.py para uso no dashboard P38.
 */

import {
  pedidoElegivelMargem,
  resolveCustoUnitarioMargem,
  resolverTotalLinhaVenda,
  alocarReceitaPedidoNasLinhas,
  vendaNoIntervaloConsulta,
} from '@/lib/relatorioMargemCalculos';

export const GLOBAL_MARKUP_ALVO = 0.4;
export const MARKUP_DESTINO = 0.2;
export const MARKUP_ROTINA = 0.4;

export const FLEX_MARGEM_MAX_PCT = 25;
export const FLEX_PESO_FATURAMENTO_MIN_PCT = 1.5;
export const FLEX_DESTINO_CUSTO_MIN_PCT = 12;

const KW_DESTINO = [
  'cimento', 'areia', 'brita', 'vergalhao', 'vergalhão', 'ferro', 'telha',
  'tubo pvc', 'tubo esgoto', 'tubo agua', 'tubo água', 'concreto',
  'cal hidratada', 'cal virgem', 'bloco', 'tijolo',
];

const KW_ROTINA = [
  'porcelanato', 'piso', 'pisos', 'ceramica', 'cerâmica', 'argamassa',
  'revestimento', 'azulejo',
];

const KW_CONVENIENCIA = [
  'rejunte', 'espacador', 'espaçador', 'parafuso', 'ferramenta', 'fita',
  'disco de corte', 'disco corte', 'broca', 'impermeabilizante', 'pincel',
  'conexao', 'conexão', 'interruptor', 'tomada', 'silicone', 'cola', 'rodape', 'rodapé',
];

const GRUPO_LABEL = {
  destino: 'Destino (KVI)',
  rotina: 'Rotina / Subsidiadores',
  conveniencia: 'Conveniência / Complementar',
};

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function contemPalavraChave(texto, palavras) {
  const norm = normalizarTexto(texto);
  return palavras.some((kw) => norm.includes(normalizarTexto(kw)));
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function markupPct(custo, faturamento) {
  if (!custo || custo <= 0) return 0;
  return roundMoney(((faturamento / custo) - 1) * 100);
}

function classificarPorPalavras(nome, categoria) {
  const texto = `${nome || ''} ${categoria || ''}`;
  if (contemPalavraChave(texto, KW_ROTINA)) return { grupo: 'rotina', motivo: 'palavra-chave rotina' };
  if (contemPalavraChave(texto, KW_DESTINO)) return { grupo: 'destino', motivo: 'palavra-chave destino' };
  if (contemPalavraChave(texto, KW_CONVENIENCIA)) return { grupo: 'conveniencia', motivo: 'palavra-chave conveniência' };
  return { grupo: 'conveniencia', motivo: 'padrão (sem palavra-chave)' };
}

function itensPedidoValidos(pedido = {}) {
  return (Array.isArray(pedido.itens) ? pedido.itens : []).filter((item) => item && typeof item === 'object');
}

/**
 * Agrega vendas faturadas por produto no intervalo.
 */
export function agregarProdutosPrecoJusto(sales = [], products = [], intervalo = null) {
  const prodMap = (products || []).reduce((acc, p) => {
    if (p?.id) acc[p.id] = p;
    return acc;
  }, {});

  const map = {};
  const { from, to } = intervalo || {};

  for (const sale of sales || []) {
    if (!pedidoElegivelMargem(sale)) continue;
    if (!vendaNoIntervaloConsulta(sale, from, to)) continue;

    const itens = itensPedidoValidos(sale);
    const alocacoes = alocarReceitaPedidoNasLinhas(sale);

    for (let index = 0; index < itens.length; index += 1) {
      const item = itens[index];
      const product = item.produto_id ? prodMap[item.produto_id] : null;
      const key = item.produto_id || `nome:${String(item.produto_nome || '').trim().toLowerCase()}`;
      const custoUnit = resolveCustoUnitarioMargem(item, product);
      const qtdBase =
        Number(
          item.quantidade_base
          ?? (Number(item.quantidade || 0) * Number(item.fator_conversao || item.fator_aplicado || 1))
          ?? 0,
        ) || 0;
      const custoLinha = roundMoney(custoUnit * qtdBase);
      const alloc = alocacoes[index] || { receita_liquida: resolverTotalLinhaVenda(item) };
      const fatLinha = roundMoney(alloc.receita_liquida || resolverTotalLinhaVenda(item));

      if (!map[key]) {
        map[key] = {
          produto_id: item.produto_id || null,
          produto_nome: item.produto_nome || product?.nome || 'Sem nome',
          categoria_nome: product?.categoria_nome || '',
          quantidade_base: 0,
          custo_real: 0,
          faturamento_real: 0,
        };
      }
      map[key].quantidade_base += qtdBase;
      map[key].custo_real = roundMoney(map[key].custo_real + custoLinha);
      map[key].faturamento_real = roundMoney(map[key].faturamento_real + fatLinha);
    }
  }

  return Object.values(map).filter((r) => r.custo_real > 0 || r.faturamento_real > 0);
}

export function aplicarClassificacaoFlexivel(produtos, opts = {}) {
  const flexMargemMax = opts.flexMargemMax ?? FLEX_MARGEM_MAX_PCT;
  const flexPesoMin = opts.flexPesoMin ?? FLEX_PESO_FATURAMENTO_MIN_PCT;
  const flexDestinoCustoMin = opts.flexDestinoCustoMin ?? FLEX_DESTINO_CUSTO_MIN_PCT;

  if (!produtos.length) return [];

  const totalCusto = produtos.reduce((s, p) => s + p.custo_real, 0);
  const totalFat = produtos.reduce((s, p) => s + p.faturamento_real, 0);

  let rows = produtos.map((p) => {
    const { grupo, motivo } = classificarPorPalavras(p.produto_nome, p.categoria_nome);
    const margem_real_pct = markupPct(p.custo_real, p.faturamento_real);
    const peso_faturamento_pct = totalFat > 0 ? roundMoney((p.faturamento_real / totalFat) * 100) : 0;
    const peso_custo_pct = totalCusto > 0 ? roundMoney((p.custo_real / totalCusto) * 100) : 0;
    return { ...p, grupo, motivo_classificacao: motivo, margem_real_pct, peso_faturamento_pct, peso_custo_pct };
  });

  const custoDestinoKw = rows.filter((r) => r.grupo === 'destino').reduce((s, r) => s + r.custo_real, 0);
  const pesoDestinoKw = totalCusto > 0 ? (custoDestinoKw / totalCusto) * 100 : 0;

  if (pesoDestinoKw < flexDestinoCustoMin) {
    const candidatos = rows
      .filter(
        (r) => r.grupo === 'conveniencia'
          && r.margem_real_pct <= flexMargemMax
          && r.peso_faturamento_pct >= flexPesoMin,
      )
      .sort((a, b) => a.margem_real_pct - b.margem_real_pct || b.peso_faturamento_pct - a.peso_faturamento_pct);

    let custoAcum = custoDestinoKw;
    const metaCusto = totalCusto * (flexDestinoCustoMin / 100);

    for (const row of candidatos) {
      if (custoAcum >= metaCusto) break;
      rows = rows.map((r) => (
        r.produto_id === row.produto_id && r.produto_nome === row.produto_nome
          ? {
            ...r,
            grupo: 'destino',
            motivo_classificacao: `flexível: margem real ${r.margem_real_pct.toFixed(1)}% + peso faturamento ${r.peso_faturamento_pct.toFixed(1)}%`,
          }
          : r
      ));
      custoAcum += row.custo_real;
    }
  }

  rows = rows.map((r) => {
    if (r.grupo !== 'conveniencia') return r;
    if (r.margem_real_pct <= MARKUP_DESTINO * 100 + 5 && r.peso_faturamento_pct >= flexPesoMin * 2) {
      return {
        ...r,
        grupo: 'destino',
        motivo_classificacao: `flexível alto impacto: margem ${r.margem_real_pct.toFixed(1)}%, faturamento ${r.peso_faturamento_pct.toFixed(1)}% do total`,
      };
    }
    return r;
  });

  return rows;
}

export function simularPrecoJusto(produtos, opts = {}) {
  const classificados = aplicarClassificacaoFlexivel(produtos, opts);
  const custoTotal = classificados.reduce((s, p) => s + p.custo_real, 0);
  const faturamentoAlvo = roundMoney(custoTotal * (1 + GLOBAL_MARKUP_ALVO));

  const gruposCodigos = ['destino', 'rotina', 'conveniencia'];
  const markupFixo = { destino: MARKUP_DESTINO, rotina: MARKUP_ROTINA };

  let fatDestino = 0;
  let fatRotina = 0;
  const resumo = [];

  for (const codigo of ['destino', 'rotina']) {
    const sub = classificados.filter((p) => p.grupo === codigo);
    const custoG = sub.reduce((s, p) => s + p.custo_real, 0);
    const fatG = roundMoney(custoG * (1 + markupFixo[codigo]));
    if (codigo === 'destino') fatDestino = fatG;
    else fatRotina = fatG;
    resumo.push({
      grupo: codigo,
      grupo_label: GRUPO_LABEL[codigo],
      custo_real: roundMoney(custoG),
      peso_custo_pct: custoTotal > 0 ? roundMoney((custoG / custoTotal) * 100) : 0,
      markup_simulado_pct: markupFixo[codigo] * 100,
      faturamento_simulado: fatG,
    });
  }

  const subConv = classificados.filter((p) => p.grupo === 'conveniencia');
  const custoConv = subConv.reduce((s, p) => s + p.custo_real, 0);
  const fatConvNecessario = roundMoney(faturamentoAlvo - fatDestino - fatRotina);
  const markupConvPct = custoConv > 0 ? markupPct(custoConv, fatConvNecessario) : 0;

  resumo.push({
    grupo: 'conveniencia',
    grupo_label: GRUPO_LABEL.conveniencia,
    custo_real: roundMoney(custoConv),
    peso_custo_pct: custoTotal > 0 ? roundMoney((custoConv / custoTotal) * 100) : 0,
    markup_simulado_pct: markupConvPct,
    faturamento_simulado: fatConvNecessario,
  });

  const detalhe = classificados.map((p) => {
    const mk = p.grupo === 'destino' ? MARKUP_DESTINO * 100
      : p.grupo === 'rotina' ? MARKUP_ROTINA * 100
        : markupConvPct;
    const precoVendaSimulado = roundMoney(p.custo_real * (1 + mk / 100));
    return {
      ...p,
      grupo_label: GRUPO_LABEL[p.grupo],
      markup_grupo_pct: mk,
      preco_venda_simulado: precoVendaSimulado,
      preco_unitario_simulado: p.quantidade_base > 0
        ? roundMoney(precoVendaSimulado / p.quantidade_base)
        : precoVendaSimulado,
    };
  }).sort((a, b) => {
    const ord = gruposCodigos.indexOf(a.grupo) - gruposCodigos.indexOf(b.grupo);
    return ord !== 0 ? ord : b.custo_real - a.custo_real;
  });

  const flexCount = detalhe.filter((d) => String(d.motivo_classificacao || '').startsWith('flexível')).length;

  return {
    resumo_grupos: resumo.map((r) => ({
      ...r,
      peso_faturamento_simulado_pct: faturamentoAlvo > 0
        ? roundMoney((r.faturamento_simulado / faturamentoAlvo) * 100)
        : 0,
    })),
    detalhe_produtos: detalhe,
    markup_conveniencia_pct: markupConvPct,
    faturamento_alvo_global: faturamentoAlvo,
    custo_real_total: roundMoney(custoTotal),
    meta_global_pct: GLOBAL_MARKUP_ALVO * 100,
    flex_count: flexCount,
  };
}

/** Recalcula markup de conveniência para cenário what-if (sliders). */
export function calcularWhatIf({ custoTotal, custoDestino, custoRotina, custoConveniencia, markupDestinoPct, markupRotinaPct }) {
  const alvo = custoTotal * (1 + GLOBAL_MARKUP_ALVO);
  const fatD = custoDestino * (1 + markupDestinoPct / 100);
  const fatR = custoRotina * (1 + markupRotinaPct / 100);
  const fatC = alvo - fatD - fatR;
  const mkC = custoConveniencia > 0 ? markupPct(custoConveniencia, fatC) : 0;
  const fatTotal = fatD + fatR + Math.max(0, fatC);
  const globalMk = custoTotal > 0 ? markupPct(custoTotal, fatTotal) : 0;
  return { markupConvenienciaPct: mkC, globalMarginPct: globalMk, faturamentoAlvo: roundMoney(alvo) };
}
