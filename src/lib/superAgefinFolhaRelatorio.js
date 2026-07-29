/**
 * SUPERAGEFIN — bloco de Folha no relatório impresso (dia 05).
 *
 * No vencimento dia 5 do mês M paga-se a competência M−1 (regra FOLHA_DIA_VENCIMENTO).
 * Inclui apenas **funcionários** — sócios ficam de fora (retirada costuma ser semanal / aos sábados).
 * O gestor usa o papel de forma analógica: nome + salário impressos e coluna em branco
 * para adiantamentos, faltas e observações à mão.
 */

import {
  calcularTotaisCompetencia,
  dataVencimentoPagamentoFolha,
  extrairSalarioBase,
  FOLHA_DIA_VENCIMENTO,
  isSocio,
  mapaModelosPorColaborador,
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

  const linhas = [];
  for (const comp of competencias) {
    const modelo = modelosMap[comp.colaborador_id] || null;
    // Dia 5 = folha de funcionários. Sócios (ex.: retirada semanal aos sábados) não entram.
    if (isSocio(modelo || comp)) continue;

    const nome = nomeColaboradorCompetencia(comp, modelosMap) || '—';
    const salario =
      (modelo ? extrairSalarioBase(modelo) : 0) ||
      extrairSalarioBase({ rubricas: comp.rubricas }) ||
      0;
    const totais = calcularTotaisCompetencia(comp, modelo);
    linhas.push({
      nome,
      salario: Number(salario) || 0,
      liquido: Number(totais.liquido) || 0,
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
 * HTML da secção analógica (3 colunas) + linha de conta “Folha de pagamento”.
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

  const cabecalho = `<thead><tr>
    <th style="text-align:left;font-size:${spx(11)};line-height:1.2;font-weight:700;color:#000;padding:6px 8px;border-bottom:1px solid #94a3b8;width:34%">Funcionário</th>
    <th style="text-align:right;font-size:${spx(11)};line-height:1.2;font-weight:700;color:#000;padding:6px 8px;border-bottom:1px solid #94a3b8;width:16%">Salário</th>
    <th style="text-align:left;font-size:${spx(11)};line-height:1.2;font-weight:700;color:#000;padding:6px 8px;border-bottom:1px solid #94a3b8;width:50%">Anotações (adiantamentos, faltas, observações)</th>
  </tr></thead>`;

  const corpo = folha.linhas
    .map((row) => {
      const salarioLabel = row.salario > 0 ? formatCurrency(row.salario) : '—';
      return `<tr>
        <td style="vertical-align:middle;padding:10px 8px;border-bottom:1px solid #cbd5e1;font-size:${spx(12)};line-height:1.25;color:#000;font-weight:600">${escapeHtml(row.nome)}</td>
        <td style="vertical-align:middle;padding:10px 8px;border-bottom:1px solid #cbd5e1;text-align:right;font-size:${spx(12)};line-height:1.25;color:#000;white-space:nowrap">${escapeHtml(salarioLabel)}</td>
        <td style="vertical-align:middle;padding:10px 8px;border-bottom:1px solid #cbd5e1;height:36px">
          <div style="min-height:28px;border-bottom:1px dotted #94a3b8"></div>
        </td>
      </tr>`;
    })
    .join('');

  const secaoHtml = `<section style="margin-top:10px;border-radius:10px;overflow:visible;background:#eef2f7;break-inside:avoid;page-break-inside:avoid">
    <div style="padding:10px 12px;background:#e2e8f0;border-bottom:1px solid #cbd5e1">
      <p style="margin:0;font-size:${spx(13)};line-height:1.25;font-weight:700;color:#000">Folha de pagamento (funcionários) — anotações à mão</p>
      <p style="margin:4px 0 0;font-size:${spx(11)};line-height:1.25;color:#334155">
        Vencimento ${escapeHtml(labelData)} · Competência ${escapeHtml(folha.competencia)} · Sócios não entram nesta folha (retirada semanal) · 3ª coluna: adiantamentos, faltas, observações
      </p>
    </div>
    <div style="padding:8px;background:#ffffff">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">${cabecalho}<tbody>${corpo}</tbody></table>
    </div>
  </section>`;

  return { contaSintetica, secaoHtml, totalConta };
}
