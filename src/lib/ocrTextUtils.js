/** Utilitários compartilhados para parsers OCR locais (sem LLM). */

export function limparLinhas(texto) {
  return String(texto || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function parseNumeroBr(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseValorMonetarioTexto(texto) {
  const raw = String(texto || '');
  if (!raw.trim()) return null;

  const candidatos = [];
  const padroes = [
    /r\$\s*([\d.]+,\d{2})/gi,
    /valor(?:\s+do\s+documento|\s+a\s+pagar|\s+total)?[:\s]+r?\$?\s*([\d.]+,\d{2})/gi,
    /([\d]{1,3}(?:\.[\d]{3})+,\d{2})/g,
    /([\d]+,\d{2})/g,
  ];

  for (const re of padroes) {
    let m;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(raw)) !== null) {
      const bruto = m[1] || m[0];
      const n = parseNumeroBr(bruto);
      if (n != null && n > 0 && n < 1e9) candidatos.push(n);
    }
  }

  if (!candidatos.length) return null;
  return candidatos.sort((a, b) => b - a)[0];
}

export function extrairCnpj(texto) {
  const s = String(texto || '');
  const labeled = s.match(/CNP[J]?:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{3,4}-\d{2})/i);
  if (labeled?.[1]) return labeled[1];
  // Exige pontuação — evita confundir código de barras (13 dígitos) com CNPJ.
  const m = s.match(/\d{2}\.\d{3}\.\d{3}\/\d{3,4}-\d{2}/);
  return m ? m[0] : '';
}

export function extrairTodosCnpjs(texto) {
  const matches = String(texto || '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || [];
  return [...new Set(matches)];
}

export function parseDataBrParaIso(texto) {
  const s = String(texto || '');
  const m = s.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  let [, dd, mm, yyyy] = m;
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function extrairDataVencimento(texto) {
  const linhas = limparLinhas(texto);
  for (const linha of linhas) {
    if (!/vencimento|venc\.|data de pagamento/i.test(linha)) continue;
    const iso = parseDataBrParaIso(linha);
    if (iso) return iso;
  }
  for (const linha of linhas) {
    if (/emissao|processamento|competencia/i.test(linha)) continue;
    const iso = parseDataBrParaIso(linha);
    if (iso) return iso;
  }
  return null;
}

export function extrairLinhaDigitavel(texto) {
  const compacto = String(texto || '').replace(/\s+/g, ' ');
  const candidatos = compacto.match(/[\d.\s-]{40,}/g) || [];
  for (const bloco of candidatos) {
    const digits = bloco.replace(/\D/g, '');
    if (digits.length >= 44 && digits.length <= 48) {
      return digits;
    }
  }
  const all = String(texto || '').replace(/\D/g, '');
  const m = all.match(/\d{44,48}/);
  return m ? m[0] : '';
}

export function extrairCodigoPix(texto) {
  const s = String(texto || '');
  const pix = s.match(/00020[0-9A-Za-z]{20,}/);
  if (pix) return pix[0];
  const linhaLonga = s.split(/\s+/).find((t) => t.length >= 50 && /^[0-9A-Za-z]+$/.test(t));
  return linhaLonga || '';
}

export function linhaPareceRodape(linha) {
  const s = String(linha || '');
  return /^(total|subtotal|desconto|frete|icms|iss|pis|cofins|valor\s+total|pagina|página|nf-?e|chave\s+de\s+acesso|cnpj|cpf|inscricao|qtd\.?\s+total|total\s+itens|peso\s+itens|qtd\s+itens|orçamento|observa)/i.test(s)
    || /pedido\s+de\s+venda|data\s+de\s+emiss|previs[aã]o\s+de\s+entrega/i.test(s);
}

export function extrairNumerosMonetariosLinha(linha) {
  const matches = String(linha || '').match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+[,.]\d+/g) || [];
  return matches.map(parseNumeroBr).filter((n) => n != null && n >= 0);
}

export function extrairUnidadeMedida(linha) {
  const m = String(linha || '').match(/\b(UN|UND|UNID|CX|CAIXA|M2|M²|M3|KG|G|LT|L|PC|PÇ|PCT|RL|BD|SC|FD)\b/i);
  return m ? m[1].toUpperCase().replace('M²', 'M2') : '';
}
