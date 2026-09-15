/**
 * Curva ABCDE — regra de negócio canónica (catálogo + job calcularIEP).
 *
 * Etapas:
 * 1. Agrupar lucro 90d por subtipo (campo_hierarquico_1 + campo_hierarquico_2;
 *    se faltar h2, agrupa só na família h1).
 * 2. Ordenar grupos do maior lucro para o menor e calcular % acumulado.
 * 3. Classificar Pareto: A ≤70%, B ≤85%, C ≤95%, D restante (5%).
 * 4. Classe E — SKU sem venda no período (candidato a descontinuação).
 *
 * Se nenhum grupo tiver lucro positivo, usa receita agregada como fallback.
 */

export const ABCD_CURVA_VERSAO = 'V17-grupo-h2-pareto-7095105-e-sem-venda';

export const ABCD_REGRAS = {
  janela_dias: 90,
  abcd_nivel: 'campo_hierarquico_2 (ou campo_hierarquico_1 se h2 vazio)',
  pareto: 'A até 70% · B até 85% · C até 95% · D até 100% · E sem venda',
  agrupamento:
    'Pareto no nível 2 (h1+h2); se não houver h2, no nível 1 (h1). Mesma letra A–D para SKUs do grupo com venda; E só no SKU sem venda no período',
};

function hierarchyKey(parts) {
  return parts.filter(Boolean).join('\x00');
}

/** Selo no subtipo (h1+h2); só h1 quando o nível 2 não está preenchido. */
export function grupoAbcdKey(produto) {
  const h1 = String(produto?.campo_hierarquico_1 ?? 'unassigned').trim();
  const h2 = String(produto?.campo_hierarquico_2 ?? '').trim();
  if (h2) return hierarchyKey([h1, h2]);
  return hierarchyKey([h1]);
}

/** Etapa 1 — lista de grupos com lucro (e receita opcional) agregados. */
export function etapa1_listarGruposLucro(entradasGrupo) {
  const lista = (entradasGrupo || []).map(({ id, lucro, receita = 0 }) => ({
    id: String(id),
    lucro: Number(lucro) || 0,
    receita: Number(receita) || 0,
  }));
  return {
    lista,
    grupos: lista.length,
    total_grupos: lista.length,
  };
}

/** Etapa 2 — ordena e calcula participação acumulada do lucro positivo. */
export function etapa2_ordenarDistribuicao(lista) {
  const ranking = [...(lista || [])].sort((a, b) => b.lucro - a.lucro);

  let totalLucroPositivo = 0;
  for (const entry of ranking) {
    if (entry.lucro > 0) totalLucroPositivo += entry.lucro;
  }

  let acumulado = 0;
  const rankingOrdenado = ranking.map((entry) => {
    if (entry.lucro <= 0) {
      return { ...entry, participacao_acumulada_pct: 0 };
    }
    acumulado += entry.lucro;
    const pct = totalLucroPositivo > 0 ? (acumulado / totalLucroPositivo) * 100 : 0;
    return { ...entry, participacao_acumulada_pct: pct };
  });

  return { ranking: rankingOrdenado, totalLucroPositivo };
}

function classeGrupoSemLucroPositivo(entry) {
  return (entry.receita || 0) <= 0 ? 'E' : 'D';
}

/** Etapa 3 — A/B/C/D a partir do % acumulado; grupos sem receita → E; com venda e sem lucro → D. */
export function etapa3_classificarAbcd(ranking, totalLucroPositivo) {
  const mapa = {};
  for (const entry of ranking || []) {
    mapa[entry.id] = classeGrupoSemLucroPositivo(entry);
  }
  if (totalLucroPositivo <= 0) return mapa;

  for (const entry of ranking) {
    if (entry.lucro <= 0) continue;
    const pct = entry.participacao_acumulada_pct ?? 0;
    if (pct <= 70) mapa[entry.id] = 'A';
    else if (pct <= 85) mapa[entry.id] = 'B';
    else if (pct <= 95) mapa[entry.id] = 'C';
    else mapa[entry.id] = 'D';
  }
  return mapa;
}

/**
 * Pipeline completo: grupos → Pareto.
 * Cada item: { id, lucro, receita? }.
 */
export function classificarGruposAbcdPareto(entradasGrupo) {
  const etapa1 = etapa1_listarGruposLucro(entradasGrupo);
  const etapa2 = etapa2_ordenarDistribuicao(etapa1.lista);

  if (etapa2.totalLucroPositivo > 0) {
    return {
      mapaAbcdGrupo: etapa3_classificarAbcd(etapa2.ranking, etapa2.totalLucroPositivo),
      ranking: etapa2.ranking,
      totalLucroPositivo: etapa2.totalLucroPositivo,
      usouReceitaFallback: false,
      grupos: etapa1.grupos,
    };
  }

  const rankingReceita = etapa1.lista
    .filter((entry) => entry.receita > 0)
    .map((entry) => ({ id: entry.id, lucro: entry.receita, receita: entry.receita }))
    .sort((a, b) => b.lucro - a.lucro);

  const totalReceita = rankingReceita.reduce((acc, entry) => acc + entry.lucro, 0);
  if (totalReceita > 0) {
    const etapa2Receita = etapa2_ordenarDistribuicao(rankingReceita);
    return {
      mapaAbcdGrupo: etapa3_classificarAbcd(etapa2Receita.ranking, etapa2Receita.totalLucroPositivo),
      ranking: etapa2Receita.ranking,
      totalLucroPositivo: 0,
      usouReceitaFallback: true,
      grupos: etapa1.grupos,
    };
  }

  const mapaAbcdGrupo = {};
  for (const entry of etapa1.lista) {
    mapaAbcdGrupo[entry.id] = classeGrupoSemLucroPositivo(entry);
  }
  return {
    mapaAbcdGrupo,
    ranking: etapa2.ranking,
    totalLucroPositivo: 0,
    usouReceitaFallback: false,
    grupos: etapa1.grupos,
  };
}

/** Monta entradas de grupo a partir de lucro/receita por produto. */
export function agregarLucroPorGrupoAbcd(produtos, metricasPorProdutoId) {
  const lucroPorGrupo = {};
  const receitaPorGrupo = {};

  for (const produto of produtos || []) {
    const pid = produto?.id;
    const metrica = metricasPorProdutoId?.[pid] || {};
    const key = grupoAbcdKey(produto);
    lucroPorGrupo[key] = (lucroPorGrupo[key] || 0) + (Number(metrica.lucro) || 0);
    receitaPorGrupo[key] = (receitaPorGrupo[key] || 0) + (Number(metrica.receita) || 0);
  }

  return Object.keys(lucroPorGrupo).map((id) => ({
    id,
    lucro: lucroPorGrupo[id],
    receita: receitaPorGrupo[id] || 0,
  }));
}

/** SKU sem venda no período → E; caso contrário, letra do grupo (A–D). */
export function abcdClasseParaProduto(produto, mapaAbcdGrupo, metricaSku) {
  if (metricaSku && metricaSku.teveVenda === false) return 'E';
  return mapaAbcdGrupo?.[grupoAbcdKey(produto)] || 'D';
}
