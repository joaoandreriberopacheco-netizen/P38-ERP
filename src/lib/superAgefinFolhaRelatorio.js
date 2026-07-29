/**
 * SUPERAGEFIN — bloco de Folha no relatório impresso (dia 05).
 *
 * No vencimento dia 5 do mês M paga-se a competência M−1 (regra FOLHA_DIA_VENCIMENTO).
 * Inclui apenas **funcionários** — sócios ficam de fora (retirada costuma ser semanal / aos sábados).
 * No papel: **3 colunas de blocos** (cada bloco = nome + salário + espaço para anotar à mão).
 */

import {
  calcularTotaisCompetencia,
  dataVencimentoPagamentoFolha,
  extrairSalarioBase,
  FOLHA_DIA_VENCIMENTO,
  isSocio,
  mapaModelosPorColaborador,
  modeloEstaAtivoNaCompetencia,
  montarCompetenciasVisao,
  nomeColaboradorCompetencia,
  shiftCompetencia,
} from '@/lib/folhaPrevisaoCalculos';
import { listarCompetencias, listarModelos } from '@/lib/folhaPrevisaoService';

export function dataDia5DoMes(dateOrYm) {
  if (typeof dateOrYm === 'string' && /^\d{4}-\d{2}/.test(dateOrYm)) {
    const ym = dateOrYm.slice(0, 7);
    return `${ym}-${String(FOLHA_DIA_VENCIMENTO).padStart(2, '0')}`;
  }
  const d = dateOrYm instanceof Date ? dateOrYm : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(FOLHA_DIA_VENCIMENTO).padStart(2, '0')}`;
}

/** Competência de folha cujo pagamento cai no dia 5 informado (YYYY-MM-DD). */
export function competenciaReferenteAoPagamentoDia5(dataPagamentoIso) {
  const ym = String(dataPagamentoIso || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  return shiftCompetencia(ym, -1);
}

/**
 * @returns {Promise<{
 *   dataPagamento: string,
 *   competencia: string,
 *   linhas: Array<{ nome: string, salario: number, liquido: number }>,
 *   totalSalarios: number,
 *   totalLiquido: number,
 * }>}
 */
export async function carregarFolhaParaRelatorioDia5(dataPagamentoIso) {
  const dataPagamento = String(dataPagamentoIso || '').slice(0, 10);
  const competencia = competenciaReferenteAoPagamentoDia5(dataPagamento);
  if (!competencia) {
    return {
      dataPagamento,
      competencia: '',
      linhas: [],
      totalSalarios: 0,
      totalLiquido: 0,
    };
  }

  const [modelos, competenciasPersistidas] = await Promise.all([
    listarModelos(),
    listarCompetencias(competencia),
  ]);

  const competencias = montarCompetenciasVisao(competencia, modelos, competenciasPersistidas);
  const modelosMap = mapaModelosPorColaborador(modelos);
  const modelosPorId = Object.fromEntries(
    (modelos || []).filter((m) => m?.id != null).map((m) => [String(m.id), m]),
  );

  const linhas = [];
  for (const comp of competencias) {
    // Só entra quem ainda tem modelo ativo na Folha. Linhas órfãs em
    // folha_previsao_competencia (pessoa removida/excluída) ficam de fora.
    const modelo =
      (comp.modelo_id != null && modelosPorId[String(comp.modelo_id)]) ||
      modelosMap[comp.colaborador_id] ||
      null;
    if (!modelo || modelo.ativo === false) continue;
    if (!modeloEstaAtivoNaCompetencia(modelo, competencia)) continue;
    // Dia 5 = folha de funcionários. Sócios (retirada semanal aos sábados) não entram.
    if (isSocio(modelo)) continue;

    const nome = nomeColaboradorCompetencia(comp, modelosMap) || modelo.colaborador_nome || '—';
    const salario =
      extrairSalarioBase(modelo) ||
      extrairSalarioBase({ rubricas: comp.rubricas }) ||
      0;
    const totais = calcularTotaisCompetencia(comp, modelo);
    const liquido = Number(totais.liquido) || 0;
    if (!(liquido > 0) && !(Number(salario) > 0)) continue;

    linhas.push({
      nome,
      salario: Number(salario) || 0,
      liquido,
    });
  }

  linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  const totalSalarios = linhas.reduce((acc, row) => acc + (Number(row.salario) || 0), 0);
  const totalLiquido = linhas.reduce((acc, row) => acc + (Number(row.liquido) || 0), 0);

  return {
    dataPagamento,
    competencia,
    linhas,
    totalSalarios,
    totalLiquido,
  };
}

/** Confirma que a data de pagamento bate com a regra do sistema (dia 5 do mês seguinte à competência). */
export function pagamentoBateComRegraFolha(competencia, dataPagamentoIso) {
  return dataVencimentoPagamentoFolha(competencia) === String(dataPagamentoIso || '').slice(0, 10);
}

/**
 * HTML da secção analógica: **3 colunas de blocos de funcionários**
 * (cada bloco = nome + salário + espaço em branco para anotar à mão)
 * + linha de conta “Folha de pagamento”.
 * @param {{
 *   folha: Awaited<ReturnType<typeof carregarFolhaParaRelatorioDia5>>,
 *   spx: (n: number) => string,
 *   escapeHtml: (v: unknown) => string,
 *   formatCurrency: (v: number) => string,
 *   labelData: string,
 * }} opts
 */
export function montarHtmlSecaoFolhaAnaloga({ folha, spx, escapeHtml, formatCurrency, labelData }) {
  if (!folha?.linhas?.length) {
    return {
      contaSintetica: null,
      secaoHtml: '',
      totalConta: 0,
    };
  }

  const totalConta = folha.totalLiquido > 0 ? folha.totalLiquido : folha.totalSalarios;

  const contaSintetica = {
    id: `superagefin-folha-${folha.dataPagamento}`,
    descricao: 'FOLHA DE PAGAMENTO',
    valor: totalConta,
    data_vencimento: folha.dataPagamento,
    status: 'Em Aberto',
    _superagefin_folha: true,
  };

  /** Cada funcionário = um bloco; 3 colunas; altura ~2× para anotar à mão em A4 */
  const linhasAnotacao = Array.from({ length: 14 }, () =>
    `<div style="height:20px;border-bottom:1px dotted #94a3b8"></div>`,
  ).join('');

  const blocosHtml = folha.linhas
    .map((row) => {
      const salarioLabel = row.salario > 0 ? formatCurrency(row.salario) : '—';
      return `<article style="break-inside:avoid;page-break-inside:avoid;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:10px 10px 14px;min-height:336px;box-sizing:border-box">
        <p style="margin:0;font-size:${spx(12)};line-height:1.2;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:0.01em">${escapeHtml(row.nome)}</p>
        <p style="margin:4px 0 0;font-size:${spx(12)};line-height:1.2;font-weight:400;color:#000">${escapeHtml(salarioLabel)}</p>
        <p style="margin:10px 0 4px;font-size:${spx(9)};line-height:1.1;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Anotações</p>
        <div aria-hidden="true" style="margin-top:2px">${linhasAnotacao}</div>
      </article>`;
    })
    .join('');

  const secaoHtml = `<section style="margin-top:10px;border-radius:10px;overflow:visible;background:#eef2f7">
    <div style="padding:8px 6px;background:#e2e8f0;border-bottom:1px solid #cbd5e1;break-after:avoid;page-break-after:avoid">
      <p style="margin:0;font-size:${spx(13)};line-height:1.25;font-weight:700;color:#000">Folha de pagamento (funcionários) — 3 colunas no papel</p>
      <p style="margin:4px 0 0;font-size:${spx(11)};line-height:1.25;color:#334155">
        Vencimento ${escapeHtml(labelData)} · Competência ${escapeHtml(folha.competencia)} · Sócios não entram · Em cada bloco: nome, salário e espaço para adiantamentos / faltas / observações
      </p>
    </div>
    <div style="padding:6px 2px;background:#f8fafc;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-items:stretch">
      ${blocosHtml}
    </div>
  </section>`;

  return { contaSintetica, secaoHtml, totalConta };
}
