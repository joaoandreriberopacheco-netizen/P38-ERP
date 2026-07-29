/**
 * SUPERAGEFIN — compromissos sintéticos (sócios aos sábados) e Budgets no papel.
 *
 * - Sócios com retirada semanal: um compromisso em cada sábado do mês
 *   (aparece na consulta e no relatório impresso).
 * - Budgets: secção analógica por centro de custo, após as contas do mês.
 */

import {
  isSocio,
  RETIRADA_FREQUENCIA,
} from '@/lib/folhaPrevisaoCalculos';
import { listarModelos as listarModelosFolha } from '@/lib/folhaPrevisaoService';
import {
  formatCurrency as formatCurrencyBudget,
  montarVisoesBudgets,
} from '@/lib/budgetCalculos';
import {
  listarCompetencias as listarCompetenciasBudget,
  listarModelos as listarModelosBudget,
} from '@/lib/budgetService';

/** Sábados (getDay === 6) do mês civil YYYY-MM. */
export function sabadosNoMes(ymOrDate) {
  let y;
  let m;
  if (typeof ymOrDate === 'string' && /^\d{4}-\d{2}/.test(ymOrDate)) {
    [y, m] = ymOrDate.slice(0, 7).split('-').map(Number);
  } else {
    const d = ymOrDate instanceof Date ? ymOrDate : new Date();
    y = d.getFullYear();
    m = d.getMonth() + 1;
  }
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    if (new Date(y, m - 1, day).getDay() === 6) {
      out.push(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return out;
}

export function competenciaDoMes(dateOrYm) {
  if (typeof dateOrYm === 'string' && /^\d{4}-\d{2}/.test(dateOrYm)) {
    return dateOrYm.slice(0, 7);
  }
  const d = dateOrYm instanceof Date ? dateOrYm : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function modeloSocioRetiradaSemanal(modelo) {
  if (!modelo || modelo.ativo === false) return false;
  if (!isSocio(modelo)) return false;
  const freq = modelo.retirada_frequencia || RETIRADA_FREQUENCIA.MENSAL;
  if (freq !== RETIRADA_FREQUENCIA.SEMANAL) return false;
  return Number(modelo.retirada_valor_fixo) > 0;
}

export function nomeSocioModelo(modelo) {
  return (
    String(modelo?.colaborador_nome || modelo?.nome || '').trim() || 'Sócio'
  );
}

/**
 * Contas sintéticas: um lançamento por sócio × cada sábado do mês.
 * Marcadas com `_superagefin_socio` (não editáveis no drawer).
 */
export function montarContasSinteticasSociosSabado(currentMonth, modelosFolha) {
  const sabados = sabadosNoMes(currentMonth);
  const socios = (modelosFolha || []).filter(modeloSocioRetiradaSemanal);
  if (!sabados.length || !socios.length) return [];

  const contas = [];
  for (const sabado of sabados) {
    for (const modelo of socios) {
      const nome = nomeSocioModelo(modelo);
      const valor = Number(modelo.retirada_valor_fixo) || 0;
      const colaboradorId = modelo.colaborador_id || modelo.id || 'x';
      contas.push({
        id: `superagefin-socio-${colaboradorId}-${sabado}`,
        // Prefixo "-" para a ordenação alfabética colocar as retiradas dos sócios antes dos demais nomes.
        descricao: `- ${nome}`,
        valor,
        data_vencimento: sabado,
        status: 'Em Aberto',
        tipo: 'Despesa',
        tags: ['conta_pagar', 'folha_socio', 'superagefin_sintetico'],
        terceiro_nome: nome,
        categoria: 'Pró-labore / sócios',
        natureza: 'Recorrente',
        is_recorrente: true,
        frequencia_recorrencia: 'Semanal',
        _superagefin_socio: true,
        _superagefin_sintetico: true,
      });
    }
  }

  return contas.sort((a, b) => {
    const c = String(a.data_vencimento).localeCompare(String(b.data_vencimento));
    if (c !== 0) return c;
    return String(a.descricao).localeCompare(String(b.descricao), 'pt-BR', { sensitivity: 'base' });
  });
}

export async function carregarModelosFolhaParaSuperAgefin() {
  try {
    return await listarModelosFolha();
  } catch (err) {
    console.error('SUPERAGEFIN: falha ao carregar modelos de folha', err);
    return [];
  }
}

export function contaSuperAgefinSomenteLeitura(conta) {
  return Boolean(
    conta?._superagefin_sintetico ||
      conta?._superagefin_socio ||
      conta?._superagefin_folha,
  );
}

/**
 * Budgets activos do mês, agrupados por centro de custo.
 */
export async function carregarBudgetsAgrupadosParaRelatorio(currentMonth) {
  const competencia = competenciaDoMes(currentMonth);
  try {
    const [modelos, comps] = await Promise.all([
      listarModelosBudget(),
      listarCompetenciasBudget(competencia),
    ]);
    const visoes = montarVisoesBudgets(modelos, competencia, comps, []);
    return agruparVisoesBudgetPorCentro(visoes);
  } catch (err) {
    console.error('SUPERAGEFIN: falha ao carregar budgets para relatório', err);
    return { competencia, grupos: [], totalOrcado: 0 };
  }
}

export function agruparVisoesBudgetPorCentro(visoes) {
  const map = new Map();
  for (const v of visoes || []) {
    if (!v?.modelo || v.modelo.ativo === false) continue;
    const centro = String(v.modelo.centro_custo || '').trim() || 'Sem centro de custo';
    if (!map.has(centro)) map.set(centro, []);
    map.get(centro).push(v);
  }

  const grupos = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }))
    .map(([centro, itens]) => {
      const ordenados = [...itens].sort((a, b) =>
        String(a.modelo?.nome || '').localeCompare(String(b.modelo?.nome || ''), 'pt-BR', {
          sensitivity: 'base',
        }),
      );
      const totalOrcado = ordenados.reduce((acc, v) => acc + (Number(v.orcado) || 0), 0);
      return { centro, itens: ordenados, totalOrcado };
    });

  const totalOrcado = grupos.reduce((acc, g) => acc + g.totalOrcado, 0);
  const competencia = visoes?.[0]?.competencia || '';
  return { competencia, grupos, totalOrcado };
}

/**
 * HTML: Budgets em **1 coluna** (bloco a bloco),
 * com espaço para anotações à mão. Quebra de página só no artigo
 * (não no centro de custo inteiro) — evita grandes vazios no papel.
 */
export function montarHtmlSecaoBudgetsAnaloga({
  budgetsAgrupados,
  spx,
  escapeHtml,
  formatCurrency,
}) {
  const grupos = budgetsAgrupados?.grupos || [];
  if (!grupos.length) return '';

  const formatFn = formatCurrency || formatCurrencyBudget;
  const linhasAnotacao = Array.from({ length: 8 }, () =>
    `<div style="height:18px;border-bottom:1px dotted #94a3b8"></div>`,
  ).join('');

  const secoes = grupos
    .map((grupo) => {
      const blocos = grupo.itens
        .map((v) => {
          const nome = v.modelo?.nome || v.modelo?.categoria_nome || 'Budget';
          const catLabel = String(v.modelo?.categoria_nome || '').trim();
          const valor = Number(v.orcado) || 0;
          return `<article style="break-inside:avoid;page-break-inside:avoid;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:10px 12px 14px;min-height:196px;box-sizing:border-box">
            <p style="margin:0;font-size:${spx(12)};line-height:1.2;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:0.01em">${escapeHtml(nome)}</p>
            ${catLabel ? `<p style="margin:3px 0 0;font-size:${spx(10)};line-height:1.2;color:#475569">${escapeHtml(catLabel)}</p>` : ''}
            <p style="margin:6px 0 0;font-size:${spx(13)};line-height:1.2;font-weight:600;color:#000">${escapeHtml(formatFn(valor))}</p>
            <p style="margin:12px 0 4px;font-size:${spx(9)};line-height:1.1;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Anotações / rascunhos</p>
            <div aria-hidden="true">${linhasAnotacao}</div>
          </article>`;
        })
        .join('');

      return `<section style="margin-top:14px;break-inside:auto;page-break-inside:auto">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:8px 4px 6px;border-bottom:1px solid #94a3b8">
          <p style="margin:0;font-size:${spx(13)};line-height:1.2;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:0.04em">${escapeHtml(grupo.centro)}</p>
          <p style="margin:0;font-size:${spx(12)};line-height:1.2;color:#000">${escapeHtml(formatFn(grupo.totalOrcado))} · ${grupo.itens.length} budget${grupo.itens.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:10px">
          ${blocos}
        </div>
      </section>`;
    })
    .join('');

  return `<section style="margin-top:${spx(18)};border-radius:10px;overflow:visible;background:#f1f5f9;break-inside:auto;page-break-inside:auto">
    <div style="padding:10px 6px;background:#e2e8f0;border-bottom:1px solid #cbd5e1">
      <p style="margin:0;font-size:${spx(14)};line-height:1.25;font-weight:700;color:#000">Budgets — anotações por centro de custo</p>
      <p style="margin:4px 0 0;font-size:${spx(11)};line-height:1.25;color:#334155">
        Após as contas obrigatórias do mês · Competência ${escapeHtml(budgetsAgrupados.competencia || '')} · 1 coluna · Cada bloco: nome, valor orçado e espaço para rascunhos
      </p>
      <p style="margin:4px 0 0;font-size:${spx(12)};line-height:1.25;color:#000">
        Total orçado: ${escapeHtml(formatFn(budgetsAgrupados.totalOrcado || 0))}
      </p>
    </div>
    <div style="padding:8px 2px 12px;background:#f8fafc">${secoes}</div>
  </section>`;
}
