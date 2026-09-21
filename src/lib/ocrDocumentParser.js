/**
 * Parsers locais de documentos brasileiros — zero LLM / zero custo.
 */

import {
  extrairCodigoPix,
  extrairCnpj,
  extrairDataVencimento,
  extrairLinhaDigitavel,
  extrairNumerosMonetariosLinha,
  extrairUnidadeMedida,
  limparLinhas,
  linhaPareceRodape,
  parseDataBrParaIso,
  parseNumeroBr,
  parseValorMonetarioTexto,
} from '@/lib/ocrTextUtils';
import {
  extrairNomeFornecedorPedido,
  linhaPareceMetadadoPedido,
  repartirTextoOcrPedido,
} from '@/lib/ocrPedidoNormalize';

function itemPareceValido(item) {
  if (!item?.descricao || item.descricao.length < 3) return false;
  if (item.descricao.length > 120) return false;
  if (linhaPareceMetadadoPedido(item.descricao)) return false;
  if (!Number.isFinite(item.quantidade) || item.quantidade <= 0 || item.quantidade > 50_000) return false;
  if (!Number.isFinite(item.preco_unitario) || item.preco_unitario <= 0 || item.preco_unitario > 500_000) return false;
  const total = item.quantidade * item.preco_unitario;
  if (total > 5_000_000) return false;
  return true;
}

/** Linha tabular Tintão/ERP: EMP QTD UND CÓDIGO DESCRIÇÃO … VR.UNIT TOTAL */
function parseLinhaItemPedidoTabular(linha) {
  const m = String(linha || '').match(
    /^(\d{1,2})\s+(\d+(?:[.,]\d+)?)\s+(M2|M²|CX|UN|UND|SC|PC|KG|LT|RL|BD|FD)\s+(\d{3,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d+)?)\s*$/i,
  );
  if (!m) return null;

  const descricao = m[5].replace(/\s+\d+\s*$/, '').trim();
  const item = {
    descricao,
    codigo: m[4],
    marca: '',
    quantidade: parseNumeroBr(m[2]) || 1,
    preco_unitario: parseNumeroBr(m[6]),
    unidade_medida_documento: m[3].toUpperCase().replace('M²', 'M2'),
  };
  return itemPareceValido(item) ? item : null;
}

function parseLinhaItemPedido(linha) {
  if (linhaPareceRodape(linha) || linhaPareceMetadadoPedido(linha) || linha.length < 8) return null;
  if (linha.length > 140) return null;
  if (/^(item|codigo|descricao|produto|qtd|quant|unit|valor|emp)\b/i.test(linha)) return null;

  const tabular = parseLinhaItemPedidoTabular(linha);
  if (tabular) return tabular;

  const valores = extrairNumerosMonetariosLinha(linha);
  if (!valores.length) return null;

  const preco_unitario = valores[valores.length - 1];
  let quantidade = valores.length >= 2 ? valores[valores.length - 2] : 1;
  if (quantidade > 10_000 && preco_unitario < quantidade) {
    quantidade = 1;
  }

  let resto = linha;
  for (const v of valores.slice(-2)) {
    resto = resto.replace(String(v).replace('.', ','), ' ').replace(String(v), ' ');
  }
  resto = resto.replace(/\d{1,3}(?:\.\d{3})*,\d{2}/g, ' ').trim();

  const codigoMatch = resto.match(/^(\d{1,2}\s+)?(\d{4,}|[A-Z]{0,3}\d{3,})/i);
  const codigo = codigoMatch ? String(codigoMatch[2] || '').trim() : '';
  let descricao = resto
    .replace(/^\d{1,2}\s+/, '')
    .replace(/^\d+(?:[.,]\d+)?\s+(?:M2|CX|UN|UND|SC|PC|KG)\s+/i, '')
    .replace(codigo, '')
    .trim();
  descricao = descricao.replace(/\s+\d+$/, '').trim();
  if (!descricao || descricao.length < 3) return null;

  const unidade = extrairUnidadeMedida(linha);

  const item = {
    descricao,
    codigo,
    marca: '',
    quantidade: quantidade > 0 ? quantidade : 1,
    preco_unitario,
    unidade_medida_documento: unidade,
  };
  return itemPareceValido(item) ? item : null;
}

/** Boleto / cobrança AGEFIN. */
export function parseBoletoDocumento(texto) {
  const linhas = limparLinhas(texto);
  const linha_digitavel = extrairLinhaDigitavel(texto);
  const codigo_pix_copia_cola = extrairCodigoPix(texto);
  const valor_pagamento = parseValorMonetarioTexto(texto);
  const data_vencimento = extrairDataVencimento(texto);

  let beneficiario = '';
  for (const linha of linhas) {
    if (/benefici[aá]rio|cedente|favorecido|sacado/i.test(linha)) {
      const nome = linha.replace(/^[^:]+:\s*/i, '').trim();
      if (nome.length >= 3) {
        beneficiario = nome.slice(0, 120);
        break;
      }
    }
  }
  if (!beneficiario) {
    beneficiario = linhas.find((l) => l.length > 8 && !linhaPareceRodape(l) && !/^\d+$/.test(l)) || '';
    beneficiario = beneficiario.slice(0, 120);
  }

  let descricao = beneficiario;
  for (const linha of linhas) {
    if (/instruc|demonstrativo|referente|competencia|descricao/i.test(linha)) {
      const d = linha.replace(/^[^:]+:\s*/i, '').trim();
      if (d.length >= 4) {
        descricao = d.slice(0, 160);
        break;
      }
    }
  }

  const competenciaLinha = linhas.find((l) => /compet[eê]ncia|refer[eê]ncia/i.test(l));
  const competencia = competenciaLinha ? (parseDataBrParaIso(competenciaLinha) || competenciaLinha.slice(0, 40)) : null;

  const confianca =
    (valor_pagamento && data_vencimento) || linha_digitavel || codigo_pix_copia_cola ? 'media' : 'baixa';

  return {
    descricao,
    beneficiario,
    valor_pagamento,
    data_vencimento,
    competencia,
    numero_parcela: null,
    linha_digitavel,
    codigo_pix_copia_cola,
    natureza_sugerida: /recorrente|mensal|compet/i.test(texto) ? 'Recorrente' : 'Único',
    confianca_leitura: confianca,
  };
}

/** Pedido de compra / orçamento fornecedor. */
export function parsePedidoCompraDocumento(texto) {
  const textoNormalizado = repartirTextoOcrPedido(texto);
  const cnpj = extrairCnpj(textoNormalizado);
  const nome = extrairNomeFornecedorPedido(textoNormalizado);
  const itens = [];

  for (const linha of limparLinhas(textoNormalizado)) {
    const item = parseLinhaItemPedido(linha);
    if (item) itens.push(item);
  }

  return {
    fornecedor: {
      nome_identificado: nome,
      cnpj_identificado: cnpj,
    },
    itens,
  };
}

/** Cotação PDF — itens + totais financeiros. */
export function parseCotacaoPdfDocumento(texto) {
  const base = parsePedidoCompraDocumento(texto);
  const linhas = limparLinhas(texto);

  let subtotal = null;
  let total_final = null;
  let desconto_global = null;

  for (const linha of linhas) {
    const lower = linha.toLowerCase();
    const valores = extrairNumerosMonetariosLinha(linha);
    if (!valores.length) continue;
    const v = valores[valores.length - 1];

    if (/total\s+(da\s+)?nf|total\s+final|valor\s+total\s+a\s+pagar|total\s+nota/i.test(lower)) {
      total_final = v;
    } else if (/total\s+bruto|sub\s*total|total\s+produtos/i.test(lower)) {
      subtotal = v;
    } else if (/desconto/i.test(lower) && !/suframa|icms/i.test(lower)) {
      desconto_global = (desconto_global || 0) + v;
    }
  }

  if (total_final == null) total_final = parseValorMonetarioTexto(texto);
  if (subtotal == null && total_final != null) subtotal = total_final;
  if (desconto_global == null && subtotal != null && total_final != null && subtotal > total_final) {
    desconto_global = subtotal - total_final;
  }

  const itens = base.itens.map((item) => ({
    descricao_pdf: item.descricao,
    codigo_pdf: item.codigo,
    marca_pdf: item.marca,
    quantidade_pdf: item.quantidade,
    preco_unitario_pdf: item.preco_unitario,
  }));

  return {
    fornecedor: base.fornecedor,
    financeiro: {
      subtotal: subtotal ?? 0,
      desconto_global: desconto_global ?? 0,
      total_final: total_final ?? 0,
      desconto_comercial: 0,
      desconto_suframa: 0,
    },
    itens,
  };
}

/** Lista manuscrita / foto — uma linha por item. */
export function parseListaFotoDocumento(texto) {
  const itens = [];

  for (const linha of limparLinhas(texto)) {
    if (linhaPareceRodape(linha) || linha.length < 3) continue;

    const mQtdPrefix = linha.match(/^(\d+(?:[,.]\d+)?)\s*(cx|un|m2|kg|lt|pc|pct|rl|bd|sc)?\s+(.+)$/i);
    const mQtdSuffix = linha.match(/^(.+?)\s+(\d+(?:[,.]\d+)?)\s*(cx|un|m2|kg|lt|pc|pct|rl|bd|sc)?$/i);

    if (mQtdPrefix) {
      itens.push({
        texto_identificado: mQtdPrefix[3].trim(),
        quantidade_escrita: `${mQtdPrefix[1]}${mQtdPrefix[2] || ''}`,
        confianca: 'media',
      });
      continue;
    }

    if (mQtdSuffix) {
      itens.push({
        texto_identificado: mQtdSuffix[1].trim(),
        quantidade_escrita: `${mQtdSuffix[2]}${mQtdSuffix[3] || ''}`,
        confianca: 'media',
      });
      continue;
    }

    itens.push({
      texto_identificado: linha,
      quantidade_escrita: null,
      confianca: 'baixa',
    });
  }

  return { itens };
}

/** Comprovante bancário (PIX/TED). */
export function parseComprovanteDocumento(texto) {
  const valor = parseValorMonetarioTexto(texto);
  const linhas = limparLinhas(texto);

  let descricao = '';
  for (const linha of linhas) {
    if (/favorecido|benefici[aá]rio|destinat[aá]rio|para:|recebedor/i.test(linha)) {
      descricao = linha.replace(/^[^:]+:\s*/i, '').slice(0, 120);
      break;
    }
  }
  if (!descricao) {
    descricao = linhas.find((l) => l.length > 4 && !/^r\$/i.test(l))?.slice(0, 120) || '';
  }

  let data_pagamento = null;
  for (const linha of linhas) {
    if (/data|pagamento|transfer/i.test(linha)) {
      data_pagamento = parseDataBrParaIso(linha);
      if (data_pagamento) break;
    }
  }

  if (!valor && !descricao) return null;
  return { valor, descricao, data_pagamento, origem: 'ocr_local' };
}
