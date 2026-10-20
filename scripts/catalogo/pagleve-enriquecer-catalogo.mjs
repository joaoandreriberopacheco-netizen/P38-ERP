#!/usr/bin/env node
/**
 * Imagens + preços + embalagem para catálogo PagLeve (template Tintão).
 * npm run catalogo:enriquecer-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readJson, snapshotPath, writeJson } from '../lib/catalogoPaths.mjs';
import {
  buildSnapshot as buildFormigresSnapshot,
  fetchAllProdutos as fetchFormigresProdutos,
  findInSnapshot as findInFormigresSnapshot,
  loadSnapshotFromFile,
} from '../lib/formigresSnapshot.mjs';
import {
  buildSnapshot as buildCarmeloSnapshot,
  fetchAllProdutos as fetchCarmeloProdutos,
} from '../lib/carmeloFiorSnapshot.mjs';
import { extractImagensFromDetalhe, fetchProdutoDetalhe } from '../lib/formigresCatalog.mjs';
import { extractImagensFromProduto } from '../lib/carmeloFiorCatalog.mjs';
import {
  parseCarmeloGaleriaCatalogoFromHtml,
  parseCarmeloImagensFromHtml,
} from '../lib/carmeloPaginaProduto.mjs';
import {
  filterReachableImageUrls,
  isPlaceholderImageUrl,
  mapUrlsToImagensCatalogo,
  probeImageUrlOk,
} from '../lib/catalogoImagemUrl.mjs';
import { resolveEmbalagemFormigres } from '../lib/formigresEmbalagem.mjs';
import { resolvePrecoPagLeve, produtoPrecoFromItem } from '../lib/pagleveTabelaPrecos.mjs';
import { loadPrecosSiah, resolvePrecoSiah } from '../lib/paglevePrecosSiah.mjs';
import { parseLumePortfolioHtml } from '../lib/lumePaginaProduto.mjs';
const UA = 'P38-PagLeve-catalogo/1.0';
const CLASSIF_DIR = path.join(process.cwd(), 'files', 'pagleve', 'classificacao');
const PATTERN = /^pagleve-estoque-\d{4}-\d{2}-\d{2}\.json$/;

function findLatestClassif() {
  const custom = process.argv.find((a, i) => process.argv[i - 1] === '--json');
  if (custom && fs.existsSync(custom)) return custom;
  const files = fs.readdirSync(CLASSIF_DIR).filter((f) => PATTERN.test(f)).sort().reverse();
  return files[0] ? path.join(CLASSIF_DIR, files[0]) : null;
}

function curlGet(url) {
  const tls = String(url).includes('lumeceramica.com.br') ? '-k ' : '';
  try {
    return execSync(`curl ${tls}-sL --max-time 25 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function pickRochaImage(html, slug) {
  const og = metaOg(html, 'og:image');
  if (og && !og.includes('_og/')) return og;
  const re = new RegExp(
    `https://api\\.portalgruporocha\\.com\\.br/storage/images/${slug}[^"'\\s]+\\.(webp|jpg|png)`,
    'i',
  );
  const m = html.match(re);
  return m ? m[0] : og || '';
}

function rochaSlugFromUrl(url) {
  const m = String(url).match(/portalgruporocha\.com\.br\/produtos\/([a-z0-9-]+)/i);
  return m?.[1] || '';
}

function formigresIdFromUrl(url) {
  const m = String(url).match(/formigres\.com\.br\/produto\/(\d+)/i);
  return m?.[1] || '';
}

function classifOf(item) {
  return {
    linha: item.linha,
    subtipo: item.subtipo,
    variante_lisa: item.variante_lisa,
  };
}

const EMPTY_SNAP = { produtos: [] };

async function ensureFormigresSnapshot() {
  const file = snapshotPath('formigres');
  let snap = loadSnapshotFromFile(readJson(file));
  if (snap) return snap;
  try {
    console.error('Snapshot Formigres em falta — a buscar API…');
    const raw = await fetchFormigresProdutos();
    snap = buildFormigresSnapshot(raw);
    writeJson(file, snap);
    return snap;
  } catch (err) {
    console.error('Formigres snapshot indisponível:', err.message);
    return EMPTY_SNAP;
  }
}

async function ensureCarmeloSnapshot() {
  const file = snapshotPath('arielle');
  const existing = loadSnapshotFromFile(readJson(file));
  if (existing?.produtos?.length) return existing;
  try {
    console.error('Snapshot Carmelo Fior (grupo) em falta — a buscar API…');
    const raw = await fetchCarmeloProdutos();
    const snap = buildCarmeloSnapshot(raw);
    writeJson(file, snap);
    return snap;
  } catch (err) {
    console.error('Carmelo snapshot indisponível:', err.message);
    return existing || EMPTY_SNAP;
  }
}

function carmeloSlugFromUrl(url = '') {
  const m = String(url).match(/carmelofior\.com\.br\/produto\/([a-z0-9-]+)/i);
  return m?.[1] || '';
}

function isCarmeloFiorItem(item) {
  if (item.fabricante_grupo === 'Carmelo Fior') return true;
  const url = String(item.produto_url || '');
  if (url.includes('carmelofior.com.br')) return true;
  const marca = String(item.marca_nome || '').toLowerCase();
  return /^(cecafi|idealle|arielle|fiorano|fioranno|pisoforte)\b/.test(marca);
}

function isLumeItem(item) {
  if (item.fabricante_grupo === 'Lume Cerâmica') return true;
  const url = String(item.produto_url || '');
  return url.includes('lumeceramica.com.br');
}

function mapImagens(urls) {
  return mapUrlsToImagensCatalogo(urls);
}

async function sanitizeImagensList(imagens = []) {
  const urls = imagens.map((i) => i?.url).filter((u) => u && !isPlaceholderImageUrl(u));
  const ok = await filterReachableImageUrls(urls, { probe: probeImageUrlOk });
  if (!ok.length) return [];
  const byUrl = new Map(imagens.map((i) => [i.url, i]));
  return ok.map((url, idx) => {
    const prev = byUrl.get(url);
    return {
      url,
      tipo: prev?.tipo || (idx === 0 ? 'principal' : idx === 1 ? 'ambiente' : 'detalhe'),
    };
  });
}

async function enrichImagens(item, ctx) {
  let imagem_url = item.imagem_url || '';
  let imagens = item.imagens?.length ? [...item.imagens] : [];
  const url = item.produto_url || '';
  let pageHtml = '';

  if (!imagem_url && url) {
    pageHtml = curlGet(url);
    const og = metaOg(pageHtml, 'og:image');
    if (og) {
      imagem_url = og;
      imagens = mapImagens([og]);
    }
  }

  const fgId = item.formigres_id || formigresIdFromUrl(url);
  if (fgId) {
    const p = ctx.formigresById.get(String(fgId));
    if (p?.imagem_url) imagem_url = p.imagem_url;
    if (!imagens.length) {
      try {
        const det = await fetchProdutoDetalhe(fgId);
        const imgs = extractImagensFromDetalhe(det || p);
        if (imgs.length) imagens = imgs;
      } catch {
        if (p?.imagem_url) imagens = mapImagens([p.imagem_url]);
      }
    }
    if (!item.formigres_id) item.formigres_id = fgId;
    return { imagem_url, imagens, formigres_id: fgId };
  }

  if (isCarmeloFiorItem(item)) {
    const slug = carmeloSlugFromUrl(url);
    const snapRaw = slug && ctx.carmeloBySlug?.get(slug);
    if (snapRaw && !imagem_url) {
      const imgs = extractImagensFromProduto(snapRaw);
      if (imgs.length) {
        imagens = imgs;
        imagem_url = imgs[0]?.url || imagem_url;
      }
    }

    const html = pageHtml || (url ? curlGet(url) : '');
    if (html) pageHtml = html;
    const galeria = parseCarmeloGaleriaCatalogoFromHtml(html);
    if (galeria.length) {
      imagens = galeria.slice(0, 6);
      imagem_url = galeria[0]?.url || imagem_url;
    } else {
      const gallery = parseCarmeloImagensFromHtml(html);
      if (gallery.length) {
        imagem_url = gallery[0];
        imagens = mapImagens(gallery.slice(0, 6));
      }
    }
  }

  if (!imagem_url && isCarmeloFiorItem(item)) {
    const desc = `${item.formato} ${item.descricao}`;
    const { match } = findInFormigresSnapshot(ctx.carmeloSnap, desc, {
      minScore: 30,
      requireFormato: true,
    });
    if (match) {
      const prod = ctx.carmeloRawById?.get(String(match.id));
      if (prod) {
        const imgs = extractImagensFromProduto(prod);
        if (imgs.length) {
          imagens = imgs;
          imagem_url = imgs[0]?.url || imagem_url;
        } else if (match.imagem_url) {
          imagem_url = match.imagem_url;
          imagens = mapImagens([match.imagem_url]);
        }
      }
    }
  }

  if (!imagem_url && url.includes('portalgruporocha.com.br')) {
    const slug = rochaSlugFromUrl(url);
    const html = pageHtml || curlGet(url);
    const img = pickRochaImage(html, slug);
    if (img) {
      imagem_url = img;
      imagens = mapImagens([img]);
    }
  }

  if (isLumeItem(item) && url.includes('lumeceramica.com.br/portfolio-item')) {
    const html = pageHtml || curlGet(url);
    const ficha = parseLumePortfolioHtml(html, url);
    if (ficha?.imagens?.length) {
      const score = (u) => {
        if (/-F\d+\.(jpe?g|png|webp)/i.test(u)) return 30;
        if (/Perfil-Site/i.test(u)) return 20;
        if (/destaque/i.test(u)) return 5;
        return 10;
      };
      const picks = [...ficha.imagens].sort((a, b) => score(b) - score(a)).slice(0, 6);
      imagens = mapImagens(picks);
      imagem_url = picks[0] || ficha.imagem_url || imagem_url;
    } else if (ficha?.imagem_url) {
      imagem_url = ficha.imagem_url;
      imagens = mapImagens([ficha.imagem_url]);
    }
  }

  if (!imagem_url && url) {
    const html = pageHtml || curlGet(url);
    const og = metaOg(html, 'og:image');
    if (og) {
      imagem_url = og;
      imagens = mapImagens([og]);
    }
    const extra = html.match(/https:\/\/[^"'\s]+\.(webp|jpg|jpeg|png)/gi) || [];
    const gallery = [...new Set([og, ...extra].filter(Boolean))].slice(0, 6);
    if (gallery.length > 1) imagens = mapImagens(gallery);
  }

  imagens = await sanitizeImagensList(imagens);
  imagem_url = imagens[0]?.url || (imagem_url && !isPlaceholderImageUrl(imagem_url) && probeImageUrlOk(imagem_url) ? imagem_url : '');
  if (!imagem_url && imagens.length) imagem_url = imagens[0].url;

  return { imagem_url, imagens };
}

function enrichPrecoEmbalagem(item, ctx) {
  const classif = classifOf(item);
  let prodSnapshot = null;
  const fgId = item.formigres_id || formigresIdFromUrl(item.produto_url);
  if (fgId && ctx.formigresById.has(String(fgId))) {
    prodSnapshot = ctx.formigresById.get(String(fgId));
  } else if (item.fabricante_grupo === 'Grupo Formigres') {
    const { match } = findInFormigresSnapshot(ctx.formigresSnap, item.descricao, {
      minScore: 32,
      requireFormato: true,
    });
    if (match) {
      prodSnapshot = match;
      item.formigres_id = match.id;
    }
  }

  const siah = ctx.precosSiah ? resolvePrecoSiah(item, ctx.precosSiah) : { preco_m2: null };
  let preco = siah.preco_m2;
  let preco_fonte = siah.fonte || null;
  if (preco == null) {
    const fb = resolvePrecoPagLeve(
      { ...item, fabricante_grupo: item.fabricante_grupo },
      classif,
      prodSnapshot,
    );
    preco = fb.preco;
    preco_fonte = fb.preco != null ? 'tabela_formigres' : null;
  }
  const embProd = prodSnapshot || produtoPrecoFromItem(item);
  const emb = resolveEmbalagemFormigres(embProd);
  const m2 = item.m2_por_caixa ?? emb.m2_por_caixa ?? null;

  return {
    preco_m2: preco ?? item.preco_m2,
    preco_fonte,
    codigo_siah: siah.codigo_siah || item.codigo_siah || '',
    m2_por_caixa: m2,
    caixas_por_palete: item.caixas_por_palete ?? emb.caixas_por_palete ?? null,
    m2_por_palete: item.m2_por_palete ?? emb.m2_por_palete ?? null,
    peso_kg_caixa: item.peso_kg_caixa ?? emb.peso_kg_caixa ?? null,
    peso_kg_palete: item.peso_kg_palete ?? emb.peso_kg_palete ?? null,
    formigres_id: item.formigres_id || fgId || '',
  };
}

async function main() {
  const onlyMissing = process.argv.includes('--only-missing');
  const refreshImagens = process.argv.includes('--refresh-imagens');
  const onlyCarmelo = process.argv.includes('--only-carmelo');
  const jsonPath = findLatestClassif();
  if (!jsonPath) {
    console.error('Classificação PagLeve não encontrada. Rode catalogo:classificar-pagleve');
    process.exit(1);
  }
  const payload = readJson(jsonPath);
  const formigresSnap = await ensureFormigresSnapshot();
  const carmeloSnap = await ensureCarmeloSnapshot();
  const carmeloRawById = new Map((carmeloSnap.produtos || []).map((p) => [String(p.id), p]));
  const carmeloBySlug = new Map();
  for (const p of carmeloSnap.produtos || []) {
    const slug = p.slug || carmeloSlugFromUrl(p.produto_url);
    if (slug) carmeloBySlug.set(slug, p);
  }

  const formigresById = new Map((formigresSnap.produtos || []).map((p) => [String(p.id), p]));
  const precosSiah = loadPrecosSiah();
  if (!precosSiah) {
    console.error('Aviso: precos-siah-fornecedor.json em falta. Rode: npm run catalogo:extrair-precos-pagleve');
  }
  const ctx = { formigresSnap, carmeloSnap, formigresById, carmeloRawById, carmeloBySlug, precosSiah };

  const itens = [];
  let comFoto = 0;
  let comPreco = 0;
  for (let i = 0; i < payload.itens.length; i++) {
    const item = { ...payload.itens[i] };
    if (onlyCarmelo && !isCarmeloFiorItem(item)) {
      itens.push(item);
      if (item.imagem_url) comFoto += 1;
      if (item.preco_m2 != null && item.preco_m2 > 0) comPreco += 1;
      continue;
    }
    if (onlyMissing && !refreshImagens && item.imagem_url && item.preco_m2 != null && item.preco_m2 > 0) {
      itens.push(item);
      if (item.imagem_url) comFoto += 1;
      if (item.preco_m2 > 0) comPreco += 1;
      continue;
    }
    const precoEmb = enrichPrecoEmbalagem(item, ctx);
    Object.assign(item, precoEmb);
    const imgs = await enrichImagens(item, ctx);
    Object.assign(item, imgs);
    if (item.imagem_url) comFoto += 1;
    if (item.preco_m2 != null && item.preco_m2 > 0) comPreco += 1;
    itens.push(item);
    if ((i + 1) % 40 === 0) console.error(`… ${i + 1}/${payload.itens.length}`);
  }

  const out = { ...payload, itens, enriquecidoEm: new Date().toISOString() };
  fs.writeFileSync(jsonPath, `${JSON.stringify(out, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    json: jsonPath,
    itens: itens.length,
    comFoto,
    comPreco,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
