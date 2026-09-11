/**
 * Fotos oficiais Japi (VTEX lojajapi.com.br) — cubas de apoio.
 * @see https://www.lojajapi.com.br/api/catalog_system/pub/products/search?ft={RefId}
 */
export const JAPI_CUBA_IMAGENS = {
  CSQ4: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/163094/CSQ4.jpg?v=637502241562400000',
    fonte_ref: 'japivtex:CSQ4',
  },
  CSQ3: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/174614/CSQ3.jpg?v=638786738939300000',
    fonte_ref: 'japivtex:CSQ3',
  },
  JCUBABN: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/174645/JCUBABN.jpg?v=638786742908400000',
    fonte_ref: 'japivtex:JCUBABN',
  },
  JCUBARD: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/177381/JCUBARD_.jpg?v=638884559487600000',
    fonte_ref: 'japivtex:JCUBARD',
  },
  JCUBAMO: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/174573/jcubamo.jpg?v=638786735279330000',
    fonte_ref: 'japivtex:JCUBAMO',
  },
  JCUBAV: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/174582/JCUBAV.jpg?v=638786736317700000',
    fonte_ref: 'japivtex:JCUBAV',
  },
  JCUBAC: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/174653/JCUBAC.jpg?v=638786743543900000',
    fonte_ref: 'japivtex:JCUBAC',
  },
  CSR0: {
    url: 'https://japisa.vteximg.com.br/arquivos/ids/172669/CSR0.jpg?v=638681447953930000',
    fonte_ref: 'japivtex:CSR0',
  },
};

const IMAGEM_REF_ALIASES = {
  JCUBAR: 'JCUBARD',
};

/**
 * @param {string} refJapi — ref cadastro (campo_hierarquico_4)
 * @param {{ refImagemJapi?: string }} [opts]
 */
export function resolveJapiCubaImagem(refJapi, opts = {}) {
  const explicit = opts.refImagemJapi || opts.ref_imagem_japi;
  const keys = [
    explicit,
    refJapi,
    IMAGEM_REF_ALIASES[String(refJapi || '').toUpperCase()],
  ]
    .filter(Boolean)
    .map((k) => String(k).toUpperCase());

  for (const key of keys) {
    const hit = JAPI_CUBA_IMAGENS[key];
    if (hit?.url) {
      return {
        url: hit.url,
        fonte: 'import',
        fonte_ref: hit.fonte_ref,
      };
    }
  }
  return null;
}
