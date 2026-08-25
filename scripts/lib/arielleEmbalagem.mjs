/**
 * Embalagem Arielle — reutiliza Formigres com aliases de formato Carmel Fior.
 */
import { resolveEmbalagemFormigres } from './formigresEmbalagem.mjs';
import { normFmt } from './formigresCatalog.mjs';

const EMBALAGEM_ALIASES = {
  '83x83': '88x88',
  '84x84': '88x88',
  '67x67': '66x66',
  '68x68': '66x66',
  '54x54': '50x50',
  '57x57': '50x50',
  '37x59': '33x59',
  '36x58': '33x59',
  '38x75': '34x60',
  '37x74': '34x60',
  '62x62': '61x61',
  '75x75': '66x66',
  '74x74': '66x66',
  '90x90': '88x88',
  '80x80': '88x88',
  '56x100': '60x120',
  '41x90': '34x60',
  '31x60': '34x60',
  '31x31': '32x45',
  '32x57': '32x45',
  '32x60': '34x60',
  '20x60': '34x60',
};

export function resolveEmbalagemArielle(prod) {
  const fmtOrig = normFmt(prod?.formato || prod?.titulo || '');
  const fmt = EMBALAGEM_ALIASES[fmtOrig] || fmtOrig;
  return resolveEmbalagemFormigres({ ...prod, formato: fmt });
}
