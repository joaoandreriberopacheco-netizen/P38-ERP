/**
 * Normaliza texto OCR de pedidos/orçamentos (PDFs que saem como bloco único).
 */

import { limparLinhas } from '@/lib/ocrTextUtils';

const METADADO_PEDIDO_RE = new RegExp(
  'pedido\\s+de\\s+venda|data\\s+de\\s+emiss|previs[aã]o\\s+de\\s+entrega|'
  + 'e-?mail:|vendedor:|fone:|cnp[jp]:|inscri|observa|qtd\\.?\\s+total|'
  + 'total\\s+itens|subtotal|pagamento|emp\\.?\\s+qtd|vr\\.?\\s+unit|'
  + 'fabricante|margarita|manaus|tintaomanaus',
  'i',
);

export function linhaPareceMetadadoPedido(linha) {
  const s = String(linha || '').trim();
  if (!s) return true;
  if (s.length > 160) return true;
  if (METADADO_PEDIDO_RE.test(s)) return true;
  if (/^(emp|qtd|und|c[oó]digo|descri)/i.test(s)) return true;
  return false;
}

/** Insere quebras de linha onde o layout do pedido Tintão/ERP costuma ter colunas. */
export function repartirTextoOcrPedido(texto) {
  let t = String(texto || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');

  // Quebras antes de blocos conhecidos
  t = t.replace(/\s+(PEDIDO\s+DE\s+VENDA)/gi, '\n$1');
  t = t.replace(/\s+(NRO?:?\s*\d+)/gi, '\n$1');
  t = t.replace(/\s+(EMP\.?\s+QTD)/gi, '\n$1');
  t = t.replace(/\s+(DATA\s+DE\s+EMISS[AÃ]O)/gi, '\n$1');
  t = t.replace(/\s+(PREVIS[AÃ]O\s+DE\s+ENTREGA)/gi, '\n$1');
  t = t.replace(/\s+(QTD\.?\s+TOTAL)/gi, '\n$1');
  t = t.replace(/\s+(TOTAL\s+ITENS)/gi, '\n$1');
  t = t.replace(/\s+(SUBTOTAL)/gi, '\n$1');
  t = t.replace(/\s+(TOTAL\s+R\$)/gi, '\n$1');
  t = t.replace(/\s+(OBSERVA[CÇ][AÃ]O)/gi, '\n$1');
  t = t.replace(/\s+(CNP[J]?:)/gi, '\n$1');

  // Linha de item típica: EMP QTD UND CÓDIGO … (ex.: 1 119,5 M2 12345 …)
  t = t.replace(
    /\s+(\d{1,2})\s+(\d{1,3}(?:[.,]\d{1,3})?)\s+(M2|M²|CX|UN|UND|SC|PC|KG|LT|RL|BD|FD)\s+(\d{3,})\s+/gi,
    '\n$1 $2 $3 $4 ',
  );

  return t;
}

export function extrairNomeFornecedorPedido(texto) {
  const flat = String(texto || '').replace(/\s+/g, ' ').trim();
  const antesPedido = flat.match(/^(.{4,80}?)\s+PEDIDO\s+DE\s+VENDA/i);
  if (antesPedido?.[1]) {
    return antesPedido[1].replace(/\s+NRO?:?\s*\d+.*$/i, '').trim().slice(0, 120);
  }

  const linhas = limparLinhas(repartirTextoOcrPedido(texto));
  const candidata = linhas.find(
    (l) => l.length >= 6
      && l.length <= 80
      && !linhaPareceMetadadoPedido(l)
      && !/^\d+$/.test(l)
      && !/\d{2}\.\d{3}\.\d{3}/.test(l),
  );
  return candidata ? candidata.slice(0, 120) : '';
}

export function extrairCnpjFlex(texto) {
  const s = String(texto || '');
  const labeled = s.match(/CNP[J]?:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{3,4}-\d{2})/i);
  if (labeled?.[1]) return labeled[1];

  const m = s.match(/\d{2}\.\d{3}\.\d{3}\/\d{3,4}-\d{2}/);
  return m ? m[0] : '';
}
