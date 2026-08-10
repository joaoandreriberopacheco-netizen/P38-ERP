import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';
import { format } from 'npm:date-fns';
import { ptBR } from 'npm:date-fns/locale';

/** Escala só no eixo Y (glifos mais altos, largura inalterada). */
const PDF_GLYPH_STRETCH_Y = 1.1;

const patchPdfTextVerticalStretch = (doc) => {
  const PdfMatrix = jsPDF.API?.Matrix;
  if (!PdfMatrix) return;
  const origText = doc.text.bind(doc);
  doc.text = function (text, x, y, options, transform) {
    if (options != null && typeof options === 'object' && options.angle instanceof PdfMatrix) {
      return origText(text, x, y, options, transform);
    }
    const stretch = new PdfMatrix(1, 0, 0, PDF_GLYPH_STRETCH_Y, 0, 0);
    if (options != null && typeof options === 'object' && !Array.isArray(options)) {
      return origText(text, x, y, { ...options, angle: stretch }, transform);
    }
    return origText(text, x, y, { angle: stretch }, transform);
  };
};

const safe = (t) => {
  if (!t) return '';
  return String(t)
    .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[ÀÁÂÃÄ]/g, 'A').replace(/[ÈÉÊË]/g, 'E').replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O').replace(/[ÙÚÛÜ]/g, 'U').replace(/[Ç]/g, 'C');
};

const fmtDate = (d) => {
  if (!d) return '-';
  try {
    return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

const fmtDateTime = (d) => {
  if (!d) return '-';
  try {
    return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return '-';
  }
};

const fmtCur = (v) => {
  const n = parseFloat(v) || 0;
  return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const getQuantidadeEfetivaItem = (item = {}) =>
  Number(item.quantidade_embarcada) || Number(item.quantidade_pedida) || Number(item.quantidade) || 0;

const getPercentualAjustePedido = (pedido = {}) => {
  const percentualDireto = Number(pedido.percentual_desconto);
  if (Number.isFinite(percentualDireto) && percentualDireto !== 0) return percentualDireto;

  const valorDesconto = Number(pedido.valor_desconto);
  const valorItens = Number(pedido.valor_itens);
  if (Number.isFinite(valorDesconto) && Number.isFinite(valorItens) && valorItens > 0) {
    return (valorDesconto / valorItens) * 100;
  }

  return 0;
};

const hasAjusteManualNoItem = (item = {}, baseUnit = 0) => {
  const descontoOuAcrescimo = Number(item.valor_desconto_item);
  if (Number.isFinite(descontoOuAcrescimo) && descontoOuAcrescimo !== 0) return true;

  const custoFinalUnitario = Number(item.custo_final_unitario);
  if (Number.isFinite(custoFinalUnitario) && Math.abs(custoFinalUnitario - baseUnit) > 0.01) return true;

  const qtd = getQuantidadeEfetivaItem(item);
  const totalItem = Number(item.total);
  if (Number.isFinite(totalItem) && qtd > 0) {
    const unitFromTotal = totalItem / qtd;
    if (Math.abs(unitFromTotal - baseUnit) > 0.01) return true;
  }

  return false;
};

const getValorUnitarioEfetivoItem = (item = {}, produto = {}, pedido = {}) => {
  const custoUnitario = Number(item.custo_unitario);
  const baseUnit = Number.isFinite(custoUnitario) ? custoUnitario : (Number(produto.valor_compra) || 0);
  const percentualAjustePedido = getPercentualAjustePedido(pedido);
  const multiplicadorPedido = 1 - (percentualAjustePedido / 100);
  const temAjusteManualItem = hasAjusteManualNoItem(item, baseUnit);

  const custoFinalUnitario = Number(item.custo_final_unitario);
  if (Number.isFinite(custoFinalUnitario) && custoFinalUnitario > 0) {
    return temAjusteManualItem ? custoFinalUnitario : (baseUnit * multiplicadorPedido);
  }

  // Regra principal: prioriza o cálculo efetivo já salvo no item.
  const totalItem = Number(item.total);
  const qtd = getQuantidadeEfetivaItem(item);
  if (Number.isFinite(totalItem) && qtd > 0) {
    const unitFromTotal = totalItem / qtd;
    return temAjusteManualItem ? unitFromTotal : (baseUnit * multiplicadorPedido);
  }

  const descontoOuAcrescimo = Number(item.valor_desconto_item);
  if (Number.isFinite(custoUnitario) && Number.isFinite(descontoOuAcrescimo)) {
    const unitComAjusteItem = custoUnitario - descontoOuAcrescimo;
    return temAjusteManualItem ? unitComAjusteItem : (unitComAjusteItem * multiplicadorPedido);
  }

  if (Number.isFinite(custoUnitario)) return custoUnitario * multiplicadorPedido;
  return (Number(produto.valor_compra) || 0) * multiplicadorPedido;
};

const getTotalItensEfetivoPedido = (pedido = {}, produtosMap = {}) =>
  (Array.isArray(pedido.itens) ? pedido.itens : []).reduce((sum, item) => {
    const produto = item.produto_id ? (produtosMap[item.produto_id] || {}) : {};
    const qtd = getQuantidadeEfetivaItem(item);
    const unit = getValorUnitarioEfetivoItem(item, produto, pedido);
    return sum + (qtd * unit);
  }, 0);

const calcTextHeight = (doc, value, width, baseHeight = 10, lineHeight = 4.4) => {
  const lines = doc.splitTextToSize(safe(value || '-'), width);
  return Math.max(baseHeight, 6 + (lines.length * lineHeight));
};

const page = {
  width: 210,
  height: 297,
  marginX: 12,
  marginTop: 12,
  marginBottom: 12,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nao autorizado' }, { status: 401 });

    const { pedido_id } = await req.json();
    if (!pedido_id) return Response.json({ error: 'pedido_id obrigatorio' }, { status: 400 });

    const pedidos = await base44.asServiceRole.entities.PedidoCompra.filter({ id: pedido_id });
    if (!pedidos?.length) return Response.json({ error: 'Pedido nao encontrado' }, { status: 404 });

    const pedido = pedidos[0];

    const linhasSql = await base44.asServiceRole.entities.PedidoCompraItem.filter({ pedido_compra_id: pedido.id });
    const itensPedido = (Array.isArray(linhasSql) ? linhasSql : [])
      .slice()
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
      .map((linha) => ({
        produto_id: linha.produto_id,
        produto_nome: linha.produto_nome,
        quantidade: Number(linha.quantidade_comercial) || 0,
        quantidade_base: Number(linha.quantidade_base) || 0,
        unidade_medida: linha.unidade_sigla || 'UN',
        custo_unitario: Number(linha.custo_unitario_fator1) || 0,
        custo_final_unitario: Number(linha.custo_total_unitario_fator1) || 0,
        total: Number(linha.total) || 0,
        fator_conversao: Number(linha.fator_aplicado) || 1,
      }));
    const pedidoComItens = { ...pedido, itens: itensPedido };

    const embarquesRows = await base44.asServiceRole.entities.Embarque.filter({ pedido_compra_id: pedido.id });
    const embarques = Array.isArray(embarquesRows) ? embarquesRows : [];

    const fornecedor = pedido.fornecedor_id
      ? await base44.asServiceRole.entities.Terceiro.get(pedido.fornecedor_id).catch(() => null)
      : null;

    const produtosIds = [...new Set(itensPedido.map((item) => item.produto_id).filter(Boolean))];
    const produtos = await Promise.all(
      produtosIds.map((id) => base44.asServiceRole.entities.Produto.get(id).catch(() => null))
    );
    const produtosMap = Object.fromEntries(produtos.filter(Boolean).map((produto) => [produto.id, produto]));

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    patchPdfTextVerticalStretch(doc);
    const usableWidth = page.width - (page.marginX * 2);
    let y = page.marginTop;

    const ensurePage = (neededHeight = 0) => {
      if (y + neededHeight > page.height - page.marginBottom) {
        doc.addPage();
        y = page.marginTop;
      }
    };

    const setText = (size = 10, weight = 'normal', color = [31, 41, 55]) => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
    };

    const drawText = (text, x, yy, options = {}) => {
      doc.text(safe(text || ''), x, yy, options);
    };

    const drawMutedLabel = (label, x, yy) => {
      setText(8, 'normal', [107, 114, 128]);
      drawText(label, x, yy);
    };

    const drawValue = (value, x, yy, options = {}) => {
      setText(10, 'bold', [17, 24, 39]);
      drawText(value, x, yy, options);
    };

    const drawPill = (text, x, yy, width) => {
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(x, yy, width, 9, 4, 4, 'F');
      setText(8, 'bold', [55, 65, 81]);
      drawText(text, x + width / 2, yy + 5.8, { align: 'center' });
    };

    const drawCard = (x, yy, width, title, rows) => {
      const dynamicHeight = rows.reduce((sum, [, value]) => sum + calcTextHeight(doc, value, width - 8), 0) + 12;
      ensurePage(dynamicHeight + 4);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, yy, width, dynamicHeight, 5, 5, 'F');
      setText(9, 'bold', [31, 41, 55]);
      drawText(title, x + 4, yy + 6);
      let innerY = yy + 12;
      rows.forEach(([label, value]) => {
        drawMutedLabel(label, x + 4, innerY);
        setText(9, 'bold', [17, 24, 39]);
        const lines = doc.splitTextToSize(safe(value || '-'), width - 8);
        lines.forEach((line, index) => {
          drawText(line, x + 4, innerY + 4.5 + (index * 4.4));
        });
        innerY += calcTextHeight(doc, value, width - 8);
      });
      return dynamicHeight;
    };

    const drawSectionTitle = (title) => {
      ensurePage(10);
      setText(11, 'bold', [17, 24, 39]);
      drawText(title, page.marginX, y);
      y += 4;
      doc.setDrawColor(229, 231, 235);
      doc.line(page.marginX, y, page.marginX + usableWidth, y);
      y += 6;
    };

    const drawWrappedTextBlock = (title, content) => {
      const lines = doc.splitTextToSize(safe(content || '-'), usableWidth - 8);
      const blockHeight = 14 + (lines.length * 4.5);
      ensurePage(blockHeight + 2);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(page.marginX, y, usableWidth, blockHeight, 5, 5, 'F');
      setText(9, 'bold', [31, 41, 55]);
      drawText(title, page.marginX + 4, y + 6);
      setText(9, 'normal', [55, 65, 81]);
      lines.forEach((line, index) => {
        drawText(line, page.marginX + 4, y + 12 + (index * 4.5));
      });
      y += blockHeight + 5;
    };

    const subtotalItens = getTotalItensEfetivoPedido(pedidoComItens, produtosMap);
    const frete = 0;
    const desconto = Number(pedido.valor_desconto) || 0;
    const totalPedido = Number(pedido.valor_total) || subtotalItens;
    const quantidadeItens = itensPedido.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
    const criador = pedido.created_by_nome || pedido.created_by_nickname || pedido.created_by || user.email || '-';

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, page.width, page.height, 'F');

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(page.marginX, y, usableWidth, 28, 7, 7, 'F');
    setText(8, 'bold', [107, 114, 128]);
    drawText('PEDIDO DE COMPRA', page.marginX + 5, y + 7);
    setText(20, 'bold', [17, 24, 39]);
    drawText(pedido.numero || 'Sem numero', page.marginX + 5, y + 17);
    setText(9, 'normal', [75, 85, 99]);
    drawText(fornecedor?.nome || pedido.fornecedor_nome || 'Fornecedor nao informado', page.marginX + 5, y + 24);

    drawPill(safe(pedido.status || 'Sem status'), page.marginX + usableWidth - 42, y + 5, 37);
    y += 34;

    const colGap = 4;
    const colWidth = (usableWidth - colGap) / 2;

    const resumoHeight = drawCard(page.marginX, y, colWidth, 'Resumo Executivo', [
      ['Fornecedor', fornecedor?.nome || pedido.fornecedor_nome || '-'],
      ['Emissao', fmtDate(pedido.data_emissao || pedido.created_date)],
      ['Entrega prevista', fmtDate(pedido.data_prevista_entrega)],
    ]);

    const financeiraHeight = drawCard(page.marginX + colWidth + colGap, y, colWidth, 'Central Financeira', [
      ['Total do pedido', fmtCur(totalPedido)],
      ['Status financeiro', pedido.status_aprovacao_financeira || 'Pendente'],
      ['Conta vinculada', pedido.conta_pagamento_id || '-'],
    ]);
    y += Math.max(resumoHeight, financeiraHeight) + 5;

    const rastreioHeight = drawCard(page.marginX, y, colWidth, 'Rastreabilidade', [
      ['Criado por', criador],
      ['Criado em', fmtDateTime(pedido.created_date)],
    ]);

    const operacaoHeight = drawCard(page.marginX + colWidth + colGap, y, colWidth, 'Operacao', [
      ['Itens', `${itensPedido.length} produtos / ${quantidadeItens} unidades`],
      ['Embarques', `${embarques.length} registrado(s)`],
    ]);
    y += Math.max(rastreioHeight, operacaoHeight) + 5;

    drawSectionTitle('Itens do Pedido');

    const tableColumns = {
      produto: page.marginX,
      qtd: page.marginX + 132,
      unit: page.marginX + 146,
      total: page.marginX + usableWidth,
    };

    ensurePage(12);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(page.marginX, y, usableWidth, 10, 4, 4, 'F');
    setText(8, 'bold', [55, 65, 81]);
    drawText('PRODUTO', tableColumns.produto + 3, y + 6.3);
    drawText('QTD', tableColumns.qtd, y + 6.3);
    drawText('UNIT.', tableColumns.unit, y + 6.3);
    drawText('TOTAL', tableColumns.total - 3, y + 6.3, { align: 'right' });
    y += 13;

    itensPedido.forEach((item) => {
      const produto = item.produto_id ? produtosMap[item.produto_id] : null;
      const nome = item.produto_nome || produto?.nome || '-';
      const nomeLines = doc.splitTextToSize(safe(nome), 86);
      const infoExtra = `${item.unidade_medida || 'UN'}${item.fator_conversao ? ` | fator ${item.fator_conversao}` : ''}`;
      const custoAumentado = Number(produto?.preco_custo_calculado) || 0;
      const custoAcessorios = (Number(produto?.custo_frete_padrao) || 0) + (Number(produto?.custo_imposto1_padrao) || 0) + (Number(produto?.custo_imposto2_padrao) || 0) + (Number(produto?.custo_outros_padrao) || 0);
      const valorVenda = Number(produto?.preco_venda_padrao) || 0;
      const detalheFinanceiro = `C. aum.: ${fmtCur(custoAumentado)}  |  Acess.: ${fmtCur(custoAcessorios)}  |  Venda: ${fmtCur(valorVenda)}`;
      const detalheLines = doc.splitTextToSize(safe(detalheFinanceiro), 126);
      const nomeLineHeight = 5.3;
      const detalheLineHeight = 4.2;
      const rowHeight = Math.max(22, 14 + (nomeLines.length * nomeLineHeight) + (detalheLines.length * detalheLineHeight));
      ensurePage(rowHeight + 3);

      doc.setFillColor(250, 250, 250);
      doc.roundedRect(page.marginX, y, usableWidth, rowHeight, 4, 4, 'F');

      setText(10.5, 'bold', [17, 24, 39]);
      nomeLines.forEach((line, index) => {
        drawText(line, tableColumns.produto + 3, y + 6 + (index * nomeLineHeight));
      });
      setText(8.4, 'normal', [107, 114, 128]);
      detalheLines.forEach((line, index) => {
        drawText(line, tableColumns.produto + 3, y + 10 + (nomeLines.length * nomeLineHeight) + (index * detalheLineHeight));
      });
      drawText(infoExtra, tableColumns.produto + 3, y + rowHeight - 3.8);

      setText(10, 'bold', [17, 24, 39]);
      const valorUnitarioEfetivo = getValorUnitarioEfetivoItem(item, produto || {}, pedidoComItens);
      drawText(String(item.quantidade || 0), tableColumns.qtd, y + 6.8);
      drawText(fmtCur(valorUnitarioEfetivo), tableColumns.unit, y + 6.8);
      drawText(fmtCur(valorUnitarioEfetivo * (Number(item.quantidade) || 0)), tableColumns.total - 3, y + 6.8, { align: 'right' });
      y += rowHeight + 3;
    });

    drawSectionTitle('Fechamento');
    const totaisHeight = drawCard(page.marginX, y, colWidth, 'Totais', [
      ['Subtotal', fmtCur(subtotalItens)],
      ['Frete', 'Ja embutido no custo dos produtos'],
      ['Desconto', fmtCur(desconto)],
      ['Total final', fmtCur(totalPedido)],
    ]);

    const fluxoHeight = drawCard(page.marginX + colWidth + colGap, y, colWidth, 'Fluxo do Pedido', [
      ['Status embarque', pedido.status_embarque || 'Nenhum'],
      ['Recebimento geral', pedido.status_recebimento_geral || 'Nenhum'],
      ['Conferencia', pedido.status_conferencia_pedido || 'Nao iniciada'],
    ]);
    y += Math.max(totaisHeight, fluxoHeight) + 5;

    drawSectionTitle('Painel Logistico');
    if (embarques.length === 0) {
      drawWrappedTextBlock('Embarques', 'Nenhum embarque registrado ate o momento.');
    } else {
      embarques.forEach((embarque, index) => {
        const linhas = [
          ['Transporte', embarque.transportadora_nome || '-'],
          ['Despacho', fmtDateTime(embarque.data_embarque)],
          ['ETA', fmtDateTime(embarque.eta)],
          ['Status de recebimento', embarque.status_recebimento_embarque || 'Pendente'],
          ['Volumes', embarque.volumes || '-'],
        ];
        const embarqueHeight = drawCard(page.marginX, y, usableWidth, `Embarque ${index + 1}`, linhas);
        y += embarqueHeight + 5;
      });
    }

    if (pedido.observacoes) {
      drawSectionTitle('Observacoes');
      drawWrappedTextBlock('Anotacoes do pedido', pedido.observacoes);
    }

    if (pedido.historico) {
      drawSectionTitle('Historico consolidado');
      drawWrappedTextBlock('Eventos registrados', pedido.historico);
    }

    ensurePage(28);
    y += 8;
    doc.setDrawColor(209, 213, 219);
    doc.line(page.marginX, y, page.marginX + 70, y);
    doc.line(page.marginX + usableWidth - 70, y, page.marginX + usableWidth, y);
    setText(8, 'normal', [107, 114, 128]);
    drawText('Responsavel pela compra', page.marginX, y + 5);
    drawText('Gestor / Financeiro', page.marginX + usableWidth - 70, y + 5);
    drawText('Data: ____/____/________', page.marginX, y + 10);
    drawText('Data: ____/____/________', page.marginX + usableWidth - 70, y + 10);

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=pedido_${safe(pedido.numero || 'compra')}.pdf`,
      },
    });
  } catch (error) {
    console.error('ERRO:', error);
    return Response.json({ error: 'Erro ao gerar relatorio', message: error.message }, { status: 500 });
  }
});