import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { BUDGET_MODULO_LABEL } from '@/lib/budgetCalculos';

const COLOR = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  lightLine: [220, 220, 220],
};

const FONT = {
  title: 13,
  section: 9,
  resumoLabel: 8.8,
  resumoValue: 8.8,
  grupo: 10.5,
  itemTitle: 9.2,
  itemDetail: 8,
  nota: 7.8,
};

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
const moeda = (value) =>
  `R$ ${number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function itemObservacao(item) {
  if (item?.coberturaBudget) return `Coberto pelo budget ${item.coberturaBudget}`;
  if (item?.entraNoTotal === false) return 'Informativo — não soma novamente';
  if (item?.destaque) return 'Compromisso do mês';
  return '';
}

function notaGrupo(grupo) {
  if (grupo.id === 'pontuais') {
    return 'Boletos e contas ocasionais com vencimento neste mês.';
  }
  if (grupo.separadoDoTotal) {
    return 'Provisão ou evento à parte — não entra no total operacional.';
  }
  return '';
}

/**
 * PDF enxuto da Visão Financeira:
 * 1) Resumo em página inteira (igual à tela)
 * 2) Plano detalhado nas páginas seguintes
 */
export async function generateRelatorioVisaoFinanceiraEnxutoPdf(payload = {}) {
  const {
    competenciaLabel = '',
    resumo = {},
    margemDetalhe = {},
    grupos = [],
    anexos = {},
    opcoesExplodido = {},
    generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const agrupamentoFixas = opcoesExplodido.agrupamentoFixas || 'vencimento';
  const provisoesExpandidas = opcoesExplodido.provisoesExpandidas || {};
  const {
    contasAnuais = {},
    provisoesAnuais = {},
    fretesCapacidade = {},
  } = anexos;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const right = pageW - margin;
  const pageBottom = pageH - 10;
  let y = 12;
  let contentLeft = margin;
  let contentWidth = pageW - margin * 2;

  const setFont = (style = 'normal', size = 9, color = COLOR.black) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0 = contentLeft, x1 = right, color = COLOR.lightLine, width = 0.06) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 12;
    setFont('bold', 8, COLOR.muted);
    doc.text(safe(`VISÃO FINANCEIRA — ${competenciaLabel} — continuação`), contentLeft, y);
    y += 6;
  };

  const advance = (dy) => {
    y += dy;
  };

  const textLines = (text, width, { style = 'normal', size = 9, color = COLOR.black, lineH = 3.8 } = {}) => {
    setFont(style, size, color);
    const lines = doc.splitTextToSize(safe(text), width);
    ensureSpace(lines.length * lineH);
    lines.forEach((line, index) => doc.text(line, contentLeft, y + index * lineH));
    advance(lines.length * lineH);
    return lines.length;
  };

  const drawResumoSecao = (titulo) => {
    ensureSpace(8);
    strokeH(y, contentLeft, right, COLOR.line, 0.1);
    advance(3);
    setFont('bold', FONT.section, COLOR.muted);
    doc.text(safe(titulo.toUpperCase()), contentLeft, y);
    advance(4.5);
  };

  const drawResumoLinha = (label, value, { prefix = '', bold = false, sublabel = '' } = {}) => {
    const labelW = contentWidth * 0.62;
    setFont(bold ? 'bold' : 'normal', FONT.resumoLabel, bold ? COLOR.black : COLOR.muted);
    const labelLines = doc.splitTextToSize(safe(label), labelW);
    const sublabelLines = sublabel
      ? doc.splitTextToSize(safe(sublabel), labelW)
      : [];
    const blockH = Math.max(4.2, labelLines.length * 3.8 + sublabelLines.length * 3.2 + (sublabel ? 0.8 : 0));
    ensureSpace(blockH + 1.5);

    const rowY = y;
    labelLines.forEach((line, index) => doc.text(line, contentLeft + 2, rowY + index * 3.8));
    if (sublabelLines.length) {
      const subY = rowY + labelLines.length * 3.8 + 0.6;
      setFont('normal', FONT.nota, COLOR.muted);
      sublabelLines.forEach((line, index) => doc.text(line, contentLeft + 2, subY + index * 3.2));
    }

    setFont(bold ? 'bold' : 'normal', FONT.resumoValue, COLOR.black);
    doc.text(safe(`${prefix}${moeda(value)}`), right, rowY, { align: 'right' });
    advance(blockH + 1.2);
    strokeH(y, contentLeft + 2, right);
    advance(1.4);
  };

  const drawItem = (item, { indent = 0, modoVencimento = false, mostrarDetalhe = true } = {}) => {
    const nome = modoVencimento ? item.nome || 'Sem descrição' : item.nome || 'Sem descrição';
    const detalhe = mostrarDetalhe
      ? [item.detalhe, itemObservacao(item)].filter(Boolean).join(' · ')
      : itemObservacao(item);
    const nomeX = contentLeft + indent;
    const nomeW = contentWidth - indent - 28;

    setFont('normal', FONT.itemTitle);
    const nomeLines = doc.splitTextToSize(safe(nome), nomeW);
    setFont('normal', FONT.itemDetail, COLOR.muted);
    const detalheLines = detalhe ? doc.splitTextToSize(safe(detalhe), nomeW) : [];
    const blockH = Math.max(
      5.5,
      nomeLines.length * 3.8 + (detalheLines.length ? detalheLines.length * 3.4 + 0.8 : 0),
    );

    ensureSpace(blockH + 1.2);
    const rowY = y;
    setFont('normal', FONT.itemTitle);
    nomeLines.forEach((line, index) => doc.text(line, nomeX, rowY + index * 3.8));
    setFont('bold', FONT.itemTitle);
    doc.text(moeda(item.valor), right, rowY, { align: 'right' });
    if (detalheLines.length) {
      const detalheY = rowY + nomeLines.length * 3.8 + 0.5;
      setFont('normal', FONT.itemDetail, COLOR.muted);
      detalheLines.forEach((line, index) => doc.text(line, nomeX, detalheY + index * 3.4));
    }
    advance(blockH + 1.4);
  };

  const drawDateBucket = (bloco) => {
    ensureSpace(7);
    setFont('bold', 8.8, COLOR.muted);
    doc.text(safe(bloco.label), contentLeft + 1, y);
    advance(4);
    for (const item of bloco.items || []) {
      drawItem(item, { indent: 4, modoVencimento: true, mostrarDetalhe: false });
    }
    advance(1);
  };

  const drawItensPorVencimento = (blocos = []) => {
    for (const bloco of blocos) drawDateBucket(bloco);
  };

  const drawSubgrupo = (label, subtotal) => {
    ensureSpace(6);
    setFont('bold', 8.8, COLOR.muted);
    doc.text(safe(label), contentLeft + 1, y);
    doc.text(moeda(subtotal), right, y, { align: 'right' });
    advance(4.5);
  };

  const drawGrupo = (grupo) => {
    ensureSpace(14);
    advance(3);
    strokeH(y, contentLeft, right, COLOR.line, 0.12);
    advance(3.5);
    setFont('bold', FONT.grupo);
    doc.text(safe(grupo.label), contentLeft, y);
    doc.text(moeda(grupo.subtotal), right, y, { align: 'right' });
    advance(4.5);

    const nota = notaGrupo(grupo);
    if (nota) {
      textLines(nota, contentWidth, { size: FONT.nota, color: COLOR.muted, lineH: 3.4 });
      advance(1);
    }

    if (grupo.vazio) {
      textLines('Nenhum item nesta camada.', { size: FONT.nota, color: COLOR.muted, lineH: 3.4 });
      advance(2);
      return;
    }

    if (grupo.layout === 'vencimento_ou_centro') {
      if (agrupamentoFixas === 'centro_custo') {
        for (const centro of grupo.porCentro || []) {
          drawSubgrupo(centro.label, centro.subtotal);
          for (const item of centro.items || []) {
            drawItem(item, { indent: 4, modoVencimento: true, mostrarDetalhe: false });
          }
        }
      } else {
        drawItensPorVencimento(grupo.porVencimento);
      }
    } else if (grupo.layout === 'lista') {
      const items = (grupo.lista || []).flatMap((bloco) => bloco.items || []);
      for (const item of items) {
        const detalhe = [
          item.frequencia,
          item.valorSecundario != null
            ? `${item.valorSecundarioLabel || 'Parcela'}: ${moeda(item.valorSecundario)}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ');
        drawItem({ ...item, detalhe }, { mostrarDetalhe: Boolean(detalhe), indent: 2 });
      }
    } else if (grupo.layout === 'provisoes_colapsaveis') {
      for (const item of grupo.items || []) {
        if (item.colapsavel) {
          drawSubgrupo(item.nome, item.valor);
          if (provisoesExpandidas[item.id]) {
            for (const filho of item.filhos || []) {
              drawItem(filho, { indent: 4, mostrarDetalhe: false });
            }
          }
        } else {
          drawItem(item, { indent: 2 });
        }
      }
    } else if (grupo.layout === 'centro_categoria') {
      for (const centro of grupo.porCentroCategoria || []) {
        drawSubgrupo(centro.label, centro.subtotal);
        for (const categoria of centro.categorias || []) {
          drawSubgrupo(categoria.label, categoria.subtotal);
          for (const item of categoria.items || []) {
            drawItem(item, { indent: 4, mostrarDetalhe: false });
          }
        }
      }
    } else if (grupo.layout === 'vencimento') {
      drawItensPorVencimento(grupo.porVencimento);
    } else {
      for (const centro of grupo.centros || []) {
        drawSubgrupo(centro.label, centro.subtotal);
        for (const categoria of centro.categorias || []) {
          drawSubgrupo(categoria.label, categoria.subtotal);
          for (const item of categoria.items || []) {
            drawItem(item, { indent: 4 });
          }
        }
      }
    }

    advance(3);
  };

  const drawAnexoTitulo = (titulo, nota = '') => {
    doc.addPage();
    y = 12;
    setFont('bold', 11);
    doc.text(safe(titulo), contentLeft, y);
    advance(5);
    if (nota) {
      textLines(nota, contentWidth, { size: FONT.nota, color: COLOR.muted, lineH: 3.4 });
      advance(2);
    }
  };

  // —— Página 1: cabeçalho + resumo (largura total) ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório Visão Financeira'), contentLeft, y);
  advance(5.5);
  setFont('normal', 8.5, COLOR.muted);
  doc.text(safe(`Competência ${competenciaLabel} · gerado em ${generatedAt}`), contentLeft, y);
  advance(7);

  setFont('bold', 11);
  doc.text(safe('Resumo financeiro'), contentLeft, y);
  advance(6);

  drawResumoLinha('Lucro bruto', resumo.lucroBruto, { prefix: '+ ', bold: true });
  if (number(margemDetalhe?.receita_liquida) > 0) {
    textLines(
      `Receita líquida ${moeda(margemDetalhe.receita_liquida)} · CMV ${moeda(margemDetalhe.custo_total)}`,
      contentWidth,
      { size: FONT.nota, color: COLOR.muted, lineH: 3.4 },
    );
    advance(1);
  }

  drawResumoSecao('Despesas planejadas por camada');
  drawResumoLinha('Contas fixas mensais (recorrentes)', resumo.fixasRecorrentes, { prefix: '− ' });
  drawResumoLinha('Folha de pagamento', resumo.folha, { prefix: '− ' });
  drawResumoLinha(BUDGET_MODULO_LABEL, resumo.budgets, { prefix: '− ' });
  if (number(resumo.pontuaisExtraPlano) > 0) {
    drawResumoLinha('Pauta do mês (fora do plano fixo)', resumo.pontuaisExtraPlano, {
      prefix: '− ',
      sublabel: `${moeda(resumo.pontuais)} no total de vencimentos do mês`,
    });
  }
  drawResumoLinha('Total operacional', resumo.totalOperacional, { prefix: '− ', bold: true });
  drawResumoLinha('Resultado operacional', resumo.resultadoOperacional, { prefix: '= ', bold: true });

  if (number(resumo.provisoesFolha) > 0) {
    drawResumoSecao('Provisões de folha');
    drawResumoLinha('Provisões de folha', resumo.provisoesFolha, { prefix: '− ' });
    drawResumoLinha('Total com provisões de folha', resumo.totalComProvisoes, { prefix: '− ', bold: true });
    drawResumoLinha('Resultado com provisões de folha', resumo.resultadoComProvisoes, {
      prefix: '= ',
      bold: true,
    });
  }

  if (number(resumo.pontuais) > 0) {
    drawResumoSecao('Desembolso conhecido no mês');
    drawResumoLinha('Pauta do mês (boletos e ocasionais)', resumo.pontuais, { prefix: '− ' });
    drawResumoLinha('Total desembolso', resumo.totalDesembolsoMes, { prefix: '− ', bold: true });
    drawResumoLinha('Saldo após compromissos conhecidos', resumo.resultadoDesembolso, {
      prefix: '= ',
      bold: true,
    });
  }

  drawResumoLinha('Realizado no fluxo (referência)', resumo.resultadoRealizado, {
    prefix: '= ',
    sublabel: 'Lucro bruto menos despesas já pagas',
  });

  // —— Plano detalhado (nova página) ——
  doc.addPage();
  y = 12;
  setFont('bold', 11);
  doc.text(safe('Plano detalhado'), contentLeft, y);
  advance(5);
  textLines(
    'Corpo do relatório: contas fixas mensais, folha, budgets e pauta ocasional.',
    contentWidth,
    { size: FONT.nota, color: COLOR.muted, lineH: 3.4 },
  );
  advance(2);

  for (const grupo of grupos) {
    drawGrupo(grupo);
  }

  if (contasAnuais?.itens?.length > 0) {
    drawAnexoTitulo(
      'Anexo A — Contas anuais e não mensais',
      'Cadastro de IPTU, IPVA, alvarás e similares. Valores integrais e vencimentos de referência.',
    );
    for (const item of contasAnuais.itens) {
      const detalhe = [
        item.frequencia,
        item.dataVencimentoLabel ? `Venc. ${item.dataVencimentoLabel}` : '',
        item.venceNesteMes ? 'Vence neste mês' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      drawItem(
        { nome: item.nome, valor: item.valorParcela, detalhe },
        { mostrarDetalhe: Boolean(detalhe), indent: 2 },
      );
    }
    if (number(contasAnuais.totalVencimentoMes) > 0) {
      drawResumoLinha('Total com vencimento neste mês', contasAnuais.totalVencimentoMes, { bold: true });
    }
  }

  if (provisoesAnuais?.itens?.length > 0) {
    drawAnexoTitulo(
      'Anexo B — Provisões anuais',
      'Parcela mensal diluída das contas com recorrência maior que mensal.',
    );
    for (const item of provisoesAnuais.itens) {
      const detalhe = [
        item.frequencia,
        `Parcela: ${moeda(item.valorParcela)}`,
        item.venceNesteMes ? 'Vence neste mês' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      drawItem(
        { nome: item.nome, valor: item.provisaoMensal, detalhe },
        { mostrarDetalhe: true, indent: 2 },
      );
    }
    drawResumoLinha('Total provisão mensal', provisoesAnuais.totalProvisaoMensal, { bold: true });
    drawResumoLinha('Equivalente anual no cadastro', provisoesAnuais.totalEquivalenteAnual);
  }

  if (
    number(fretesCapacidade?.capacidadeCompraBase) > 0 ||
    number(fretesCapacidade?.totalFretes) > 0 ||
    (fretesCapacidade?.itens || []).length > 0
  ) {
    drawAnexoTitulo(
      'Anexo C — Fretes e capacidade de compra',
      'Fretes de barcaças e itinerários. A capacidade usa o CMV vendido como base.',
    );
    drawResumoLinha('CMV vendido (base)', fretesCapacidade.capacidadeCompraBase, { prefix: '+ ' });
    drawResumoLinha('Fretes agendados no mês', fretesCapacidade.totalFretes, { prefix: '− ' });
    drawResumoLinha('Disponível para novas compras', fretesCapacidade.capacidadeDisponivel, {
      prefix: '= ',
      bold: true,
    });
    advance(2);
    drawItensPorVencimento(fretesCapacidade.porVencimento || []);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFont('normal', 7, COLOR.muted);
    doc.text(safe(`Visão Financeira · ${competenciaLabel}`), margin, pageH - 5);
    doc.text(`${page}/${pageCount}`, right, pageH - 5, { align: 'right' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'visao_financeira_enxuto_a4_v9',
  };
}
