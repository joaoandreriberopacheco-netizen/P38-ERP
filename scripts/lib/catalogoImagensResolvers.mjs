/**
 * Resolve imagens do catálogo P38 — Formigres, Cerbras, Japi/Lorenzetti/Tigre.
 */
import {
  extractImagensFromDetalhe,
  fetchProdutoDetalhe,
  findBestMatch,
} from './formigresCatalog.mjs';
import { findBestMatch as findCerbras } from './cerbrasCatalog.mjs';
import {
  buildSnapshot,
  fetchAllProdutos as fetchFormigresCatalog,
  findInSnapshot,
} from './formigresSnapshot.mjs';
import { resolveMixProdutoImagem } from './mixInventarioImagens.mjs';

let formigresSnapshot = null;

export async function preloadFormigresSnapshot() {
  if (formigresSnapshot) return formigresSnapshot;
  formigresSnapshot = buildSnapshot(await fetchFormigresCatalog());
  return formigresSnapshot;
}

export function isCeramicaProduto(produto) {
  const nome = String(produto?.nome || '').trim();
  const h1 = String(produto?.campo_hierarquico_1 || '').toUpperCase();
  const cat = String(produto?.categoria_nome || '');
  if (/^(PISO|REVESTIMENTO|REV\.?)\b/i.test(nome)) return true;
  if (h1 === 'PISO' || h1 === 'REVESTIMENTO') return true;
  if (cat.startsWith('E -')) return /^(PISO|REVEST|REV\.?)/i.test(nome);
  return false;
}

export function isHidraulicaAcabamento(produto) {
  const cat = String(produto?.categoria_nome || '');
  if (!cat.startsWith('H -')) return false;
  const blob = `${produto?.nome || ''} ${produto?.marca || ''}`.toLowerCase();
  return /torneir|chuveir|ducha|registro|valvula|sifao|cuba|misturador|monocomando/.test(blob);
}

export async function resolveCeramicaImagens(nome, { snapshot } = {}) {
  const snap = snapshot || await preloadFormigresSnapshot();

  const offline = findInSnapshot(snap, nome, { minScore: 30, requireFormato: true });
  let match = offline.match;
  let score = offline.score;
  let resolver = 'formigres-snapshot';

  if (!match) {
    const online = await findBestMatch(nome, { requireFormatoSite: false, minScore: 30 });
    match = online.match;
    score = online.score;
    resolver = 'formigres-api';
  }

  if (!match) {
    const cer = await findCerbras(nome);
    if (cer.match?.imagem) {
      return {
        imagens: [{ url: cer.match.imagem, tipo: 'principal', ordem: 0, principal: true }],
        fonte: 'import',
        fonte_ref: cer.match.url || cer.match.titulo,
        resolver: 'cerbras-site',
        score: cer.score,
      };
    }
    return null;
  }

  const detalhe = await fetchProdutoDetalhe(match.id);
  const imagens = extractImagensFromDetalhe(detalhe);
  if (!imagens.length && match.imagem_url) {
    imagens.push({ url: match.imagem_url, tipo: 'principal', ordem: 0, principal: true });
  }
  if (!imagens.length) return null;

  return {
    imagens,
    fonte: 'formigres',
    fonte_ref: String(match.id),
    resolver,
    score,
    titulo: detalhe?.titulo || match.titulo,
  };
}

export function resolveHidraulicaImagem(produto) {
  const hit = resolveMixProdutoImagem(produto);
  if (!hit?.url) return null;
  return {
    imagens: [{ url: hit.url, tipo: 'principal', ordem: 0, principal: true }],
    fonte: hit.fonte || 'import',
    fonte_ref: hit.fonte_ref,
    resolver: hit.resolver,
  };
}

export function shouldTryResolve(produto) {
  if (isCeramicaProduto(produto)) return true;
  if (isHidraulicaAcabamento(produto)) return true;
  const nome = String(produto.nome || '');
  const marca = String(produto.marca || '');
  if (/japi/i.test(nome) || /japi/i.test(marca)) return true;
  if (/lorenzetti|tigre/i.test(marca)) return true;
  if (/torneir|chuveir|ducha|cuba|misturador|monocomando/i.test(nome)) return true;
  return false;
}

export async function resolveCatalogoProdutoImagens(produto, { snapshot } = {}) {
  if (!shouldTryResolve(produto)) return null;

  if (isCeramicaProduto(produto)) {
    const ceramica = await resolveCeramicaImagens(produto.nome, { snapshot });
    if (ceramica) return ceramica;
  }

  if (isHidraulicaAcabamento(produto) || String(produto.categoria_nome || '').startsWith('H -')) {
    const hid = resolveHidraulicaImagem(produto);
    if (hid) return hid;
  }

  const hid = resolveHidraulicaImagem(produto);
  if (hid) return hid;

  return null;
}
