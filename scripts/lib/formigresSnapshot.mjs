/**
 * Snapshot + match local Formigres (catálogo B).
 */
import {
  FORMIGRES_BASE,
  normFmt,
  parseDesc,
  scoreMatch,
  stripAccents,
} from './formigresCatalog.mjs';

const UA = 'P38-ERP-catalogo-local/1.0';

export const FABRICANTE = {
  slug: 'formigres',
  nome: 'Formigres',
  site: FORMIGRES_BASE,
  categoria: 'revestimentos',
};

function tokenizeTitulo(titulo) {
  return stripAccents(titulo)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
}

export function normalizeProduto(raw) {
  const imagem = raw.imagem || raw.imagem_url || '';
  const imagemRel = imagem.startsWith('http') ? imagem.replace(FORMIGRES_BASE, '') : imagem;
  const imagemAmb = raw.imagem_ambiente || raw.imagem_amb_url || '';

  return {
    id: String(raw.id),
    titulo: raw.titulo || '',
    formato: normFmt(raw.formato || raw.titulo),
    acabamento: raw.acabamento || '',
    acabamento_info: raw.acabamento_info || '',
    marca_id: raw.marca_id || '',
    marca_nome: raw.marca_nome || raw.informacao_linha || '',
    tipo: raw.tipo || '',
    referencia: raw.referencia || '',
    categoria: raw.categoria || '',
    imagem_url: imagemRel ? absUrl(imagemRel) : '',
    imagem_amb_url: imagemAmb ? absUrl(imagemAmb) : '',
    produto_url: `${FORMIGRES_BASE}/produto/${raw.id}`,
    busca_tokens: tokenizeTitulo(raw.titulo || ''),
  };
}

export function absUrl(rel) {
  if (!rel) return '';
  return rel.startsWith('http') ? rel : FORMIGRES_BASE + (rel.startsWith('/') ? rel : `/${rel}`);
}

/** Busca catálogo completo (1 request — q vazio devolve ~1500 itens). */
export async function fetchAllProdutos() {
  const res = await fetch(`${FORMIGRES_BASE}/api/busca.php?q=`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Formigres API ${res.status}`);
  const data = await res.json();
  return data.produtos || [];
}

export function buildSnapshot(produtosRaw) {
  const produtos = produtosRaw.map(normalizeProduto);
  const por_formato = {};
  for (const p of produtos) {
    const fmt = p.formato || '—';
    if (!por_formato[fmt]) por_formato[fmt] = [];
    por_formato[fmt].push(p.id);
  }

  return {
    fabricante: FABRICANTE.slug,
    exportedAt: new Date().toISOString(),
    source: `${FORMIGRES_BASE}/api/busca.php?q=`,
    count: produtos.length,
    produtos,
    por_formato,
  };
}

export function loadSnapshotFromFile(snapshot) {
  if (!snapshot?.produtos?.length) return null;
  return snapshot;
}

/** Match offline contra snapshot (mesmo score do formigresCatalog). */
export function findInSnapshot(snapshot, desc, { minScore = 30, requireFormato = true } = {}) {
  const parsed = parseDesc(desc);
  const produtos = snapshot.produtos || [];

  const pool = requireFormato && parsed.formato
    ? produtos.filter((p) => p.formato === parsed.formato)
    : produtos;

  let best = null;
  let bestScore = -999;
  for (const p of pool) {
    const prod = {
      ...p,
      titulo: p.titulo,
      formato: p.formato ? `${p.formato}cm` : '',
      imagem_url: p.imagem_url,
    };
    const sc = scoreMatch(prod, parsed);
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }

  if (!best || bestScore < minScore) {
    return { parsed, match: null, score: bestScore, reason: 'sem_match', pool: pool.length };
  }

  return {
    parsed,
    match: best,
    score: bestScore,
    reason: null,
    pool: pool.length,
  };
}
