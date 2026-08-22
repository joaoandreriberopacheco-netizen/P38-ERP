/**
 * Incefra — busca por código PD (slug conhecido + tentativa de página).
 */
export const INCEFRA_BASE = 'https://www.incefra.com.br';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

/** Slugs confirmados publicamente (PD-xxxxx). */
const PD_SLUGS = {
  'PD-33010': 'revestimento-ceramico-pd-33010',
  'PD-35709': 'revestimento-ceramico-pd-35709',
  'PD-45029': 'revestimento-ceramico-pd-45029',
  'PD-45079': 'revestimento-ceramico-pd-45079',
  'PD-35199': 'revestimento-ceramico-pd-35199',
  'PD-35739': 'revestimento-ceramico-pd-35739',
  'PD-45389': 'revestimento-ceramico-pd-45389',
};

function extractImgFromHtml(html) {
  const m = String(html || '').match(/https:\/\/www\.incefra\.com\.br\/cache\/[^"'\\]+\.(jpg|png)/i);
  return m ? m[0] : '';
}

export async function findByPdCode(pdCode) {
  const code = String(pdCode || '').toUpperCase();
  if (!code.startsWith('PD-')) return { match: null, reason: 'codigo_invalido' };

  const slug = PD_SLUGS[code] || `revestimento-ceramico-${code.toLowerCase()}`;
  const url = `${INCEFRA_BASE}/produto/${slug}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      return {
        match: {
          titulo: code,
          url,
          imagem: '',
          formato: '45x45',
          acabamento: /BRILH/i.test(code) ? 'BRILHANTE' : /ACET|GRANILH/i.test(code) ? 'ACETINADO' : '',
        },
        reason: 'pagina_indisponivel',
      };
    }
    const html = await res.text();
    const imagem = extractImgFromHtml(html);
    const tituloMatch = html.match(/<h1[^>]*>\s*([^<]+)/i);
    const titulo = tituloMatch ? tituloMatch[1].trim() : code;
    return {
      match: {
        titulo,
        url,
        imagem,
        formato: '45x45',
        acabamento: /Brilhante/i.test(html) ? 'BRILHANTE'
          : /Acetinado|Granilhado/i.test(html) ? 'ACETINADO'
          : '',
      },
      reason: null,
    };
  } catch {
    return {
      match: { titulo: code, url, imagem: '', formato: '45x45', acabamento: '' },
      reason: 'erro_fetch',
    };
  }
}
