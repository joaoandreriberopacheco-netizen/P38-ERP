/**
 * URLs de imagem Stam / revendedores para o mix de fechaduras (2026).
 * Loja oficial (loja.stam.com.br) bloqueia curl no Cloud Agent — fontes alternativas com EAN confirmado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS_DIR = path.join(ROOT, 'docs', 'assets', 'fechaduras-stam');

/** @type {Record<string, { url: string, fonte: string, fonte_ref: string, local?: string }>} */
export const STAM_FECHADURA_IMAGENS = {
  'N60-DE4': {
    url: 'https://images.tcdn.com.br/img/img_prod/1180995/fechadura_803_33_gorje_externa_oxidado_1099_1_0de4db8c11cd41d12de90939831c5577.jpg',
    fonte: 'import',
    fonte_ref: 'rombaldimoveis:803/33-oxidado',
    local: '01-803-33-oxidado.jpg',
  },
  '9O8-0JI': {
    url: 'https://cdntravaforte.adsomos.com.br/image/cache/data/Produtos/FE/FECHADURA-STAM-FANO-803-21-REDONDA-EXTERNA-INOX-POLIDO-COR-NO-DEFINIDA-16D12D82-1-800x800.jpg',
    fonte: 'import',
    fonte_ref: 'travaforte:803/21-inox',
    local: '02-803-21-inox.jpg',
  },
  'JQ6-7GN': {
    url: 'https://portalfechaduras.com.br/wp-content/uploads/2022/06/fechadura-stam-preta-externa.jpg',
    fonte: 'import',
    fonte_ref: 'portalfechaduras:803/33-preto-fosco',
    local: '03-803-33-preto-fosco.jpg',
  },
  'BK1-L8K': {
    url: 'https://coelhodistribuidor.agilecdn.com.br/8499_1.jpg',
    fonte: 'import',
    fonte_ref: 'coelhodistribuidor:1801/21-oxidado',
    local: '04-1801-21-oxidado.jpg',
  },
  'VZL-3J2': {
    url: 'https://hiperfer.cdn.magazord.com.br/img/2021/08/produto/9790/3542-fechadura-externa-fano-803-10-espelho-oxidado-stam.jpg',
    fonte: 'import',
    fonte_ref: 'hiperfer:803/10-oxidado',
    local: '05-803-10-oxidado.jpg',
  },
  ENROLAR: {
    url: 'https://casacardao.agilecdn.com.br/17085.jpg',
    fonte: 'import',
    fonte_ref: 'casacardao:porta-enrolar-200',
    local: '06-porta-enrolar.jpg',
  },
  '0EK-Y4Z': {
    url: 'https://www.ferragenssaocarlos.com.br/media/catalog/product/f/e/ferragens-sao-carlos-imagem-fechadura-para-banheiro-inox-cromado-823-03-stam-31823-3.jpeg',
    fonte: 'import',
    fonte_ref: 'ferragenssaocarlos:823/03-inox',
    local: '07-823-03-banheiro.jpeg',
  },
  'YKQ-42N': {
    url: 'https://images.tcdn.com.br/img/img_prod/1324197/fechadura_externa_cromada_classic_40mm_roseta_quad_3100_stam_767_1_268ac1559824c4560e0deac0dc493e7f.jpg',
    fonte: 'import',
    fonte_ref: 'comercialivaipora:3100-inox',
    local: '08-3100-inox.jpg',
  },
};

/**
 * @param {string} codigoInterno
 * @param {{ item?: number }} [opts]
 */
export function resolveStamFechaduraImagem(codigoInterno, opts = {}) {
  const key = codigoInterno === null && opts.item === 6 ? 'ENROLAR' : codigoInterno;
  const entry = STAM_FECHADURA_IMAGENS[key];
  if (!entry) return null;

  const localPath = entry.local ? path.join(ASSETS_DIR, entry.local) : null;
  const hasLocal = localPath && fs.existsSync(localPath);

  return {
    url: entry.url,
    fonte: entry.fonte,
    fonte_ref: entry.fonte_ref,
    resolver: 'stam-revendedor',
    local_path: hasLocal ? localPath : null,
  };
}
