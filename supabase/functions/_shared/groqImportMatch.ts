/**
 * Segunda passagem Groq: associa itens já extraídos ao catálogo (candidatos enxutos do cliente).
 */

import type { LlmUsage } from './llmTelemetry.ts';
import { createP38Client } from './p38Client.ts';
import {
  callGroqChat,
  resolveGroqApiKey,
  resolveGroqModel,
  MODEL_CANDIDATES,
} from './groqOcrStruct.ts';

export type ImportMatchTipo = 'pedido_compra' | 'cotacao_pdf';

export type ImportMatchItemInput = {
  indice: number;
  descricao: string;
  codigo?: string;
  marca?: string;
  quantidade?: number | null;
  preco_unitario?: number | null;
};

type ProdutoLike = Record<string, unknown> & { id?: string };

function normalizeMatchText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function produtoLabel(p: ProdutoLike): string {
  const parts = [1, 2, 3, 4, 5]
    .map((i) => p[`campo_hierarquico_${i}`])
    .filter((v) => v != null && String(v).trim());
  if (parts.length) return parts.map(String).join(' ');
  return String(p.nome || '');
}

function produtoSearchText(p: ProdutoLike): string {
  return normalizeMatchText(
    [
      p.nome,
      p.marca,
      p.codigo_interno,
      p.campo_hierarquico_1,
      p.campo_hierarquico_2,
      p.campo_hierarquico_3,
      p.campo_hierarquico_4,
      p.campo_hierarquico_5,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function tokenizeDescricao(text: string): string[] {
  return normalizeMatchText(text)
    .replace(/[,;:/|()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function compactProdutosTsv(produtos: ProdutoLike[], maxNome = 96): string {
  return produtos
    .map((p) => {
      const id = String(p.id || '').trim();
      const codigo = String(p.codigo_interno || '').replace(/\|/g, '/').trim();
      let nome = produtoLabel(p).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
      if (maxNome > 0 && nome.length > maxNome) nome = `${nome.slice(0, maxNome - 1)}…`;
      const marca = String(p.marca || '').replace(/\|/g, '/').trim();
      return `${id}|${codigo}|${nome}|${marca}`;
    })
    .filter((line) => line.split('|')[0])
    .join('\n');
}

async function carregarProdutosAtivos(): Promise<ProdutoLike[]> {
  const base44 = await createP38Client(new Request('https://p38.internal'));
  const batch = await base44.asServiceRole.entities.Produto.filter(
    { tipo: 'Produto', ativo: true },
    '-created_date',
    8000,
  );
  return Array.isArray(batch) ? batch : [];
}

/** Monta candidatos no servidor — evita crash no browser (mobile) ao importar. */
export async function buildCatalogTsvForMatchOnServer(
  itens: ImportMatchItemInput[],
  { maxTotal = 320, maxScan = 8000 } = {},
): Promise<string> {
  const produtos = await carregarProdutosAtivos();
  if (!produtos.length) return '';

  const tokenSet = new Set<string>();
  for (const item of itens) {
    for (const t of tokenizeDescricao(item.descricao || '')) tokenSet.add(t);
  }

  let pool = produtos;
  if (tokenSet.size && produtos.length > maxScan) {
    const scored: { p: ProdutoLike; hits: number }[] = [];
    for (const p of produtos) {
      const searchable = produtoSearchText(p);
      let hits = 0;
      for (const t of tokenSet) {
        if (searchable.includes(t)) hits += 1;
      }
      if (hits > 0) scored.push({ p, hits });
    }
    scored.sort((a, b) => b.hits - a.hits);
    pool = scored.slice(0, maxScan).map((x) => x.p);
    if (pool.length < 40) pool = produtos.slice(0, maxScan);
  } else if (produtos.length > maxScan) {
    pool = produtos.slice(0, maxScan);
  }

  const byId = new Map<string, ProdutoLike>();
  for (const item of itens) {
    const tokens = tokenizeDescricao(item.descricao || '');
    if (!tokens.length) continue;
    const ranked: { p: ProdutoLike; score: number }[] = [];
    for (const p of pool) {
      const searchable = produtoSearchText(p);
      let score = 0;
      for (const t of tokens) {
        if (searchable.includes(t)) score += 1;
      }
      if (score > 0) ranked.push({ p, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    for (const { p } of ranked.slice(0, 18)) {
      if (p.id) byId.set(String(p.id), p);
    }
  }

  const list = [...byId.values()].slice(0, maxTotal);
  return compactProdutosTsv(list.length ? list : pool.slice(0, maxTotal));
}

function trimBlock(text: string, max = 24_000): string {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[… catálogo truncado …]`;
}

function buildMatchPrompt(
  tipo: ImportMatchTipo,
  itens: ImportMatchItemInput[],
  catalogoTsv: string,
  fornecedoresTsv: string,
): string {
  const itensJson = JSON.stringify(itens, null, 0);
  const docLabel = tipo === 'cotacao_pdf' ? 'cotação/orçamento' : 'pedido de compra';

  return `Você associa linhas de um ${docLabel} brasileiro ao catálogo interno da loja de materiais.

REGRAS DE MATCH (produtos):
- Correspondência SEMÂNTICA: ignore maiúsculas, acentos, abreviações (CIM→cimento, AC-III→AC3, ARGAM→argamassa).
- produto_id_match = id exato da coluna 1 do catálogo TSV abaixo, ou string vazia se não houver par claro.
- NÃO use o código numérico do fornecedor no PDF como id do catálogo — só o id da coluna 1.
- Não force match genérico (ex.: outro porcelanato qualquer). Prefira vazio a errado.
- confianca: "alta" só com certeza; "media" com boa similaridade; "baixa" se duvidoso.
- fornecedor.id_match = id exato da lista de fornecedores, ou vazio.

FORNECEDORES (id|nome|cnpj):
${fornecedoresTsv || '(nenhum)'}

CATÁLOGO — candidatos prováveis (id|codigo|nome|marca):
${trimBlock(catalogoTsv)}

ITENS DO DOCUMENTO (JSON — campo "indice" deve ser repetido na resposta):
${itensJson}

Responda APENAS JSON válido:
{
  "fornecedor": { "id_match": "" },
  "itens": [
    { "indice": 0, "produto_id_match": "", "confianca": "alta|media|baixa" }
  ]
}`;
}

export async function matchImportCatalogoGroq({
  tipo,
  itens,
  catalogo_tsv,
  fornecedores_tsv = '',
  montar_catalogo_no_servidor = false,
}: {
  tipo: ImportMatchTipo;
  itens: ImportMatchItemInput[];
  catalogo_tsv: string;
  fornecedores_tsv?: string;
  montar_catalogo_no_servidor?: boolean;
}): Promise<{ dados: unknown; usage: LlmUsage; model: string }> {
  if (!resolveGroqApiKey()) {
    throw new Error(
      'Match com IA indisponível. Configure GROQ_API_KEY no Supabase → Edge Functions → Secrets.',
    );
  }
  const lista = Array.isArray(itens) ? itens : [];
  if (!lista.length) {
    throw new Error('Nenhum item para associar ao catálogo.');
  }
  let tsv = String(catalogo_tsv || '').trim();
  if (montar_catalogo_no_servidor || !tsv || tsv === '(nenhum)') {
    tsv = await buildCatalogTsvForMatchOnServer(lista);
  }
  if (!tsv || tsv === '(nenhum)') {
    throw new Error('Catálogo de candidatos vazio para match.');
  }

  const prompt = buildMatchPrompt(tipo, lista, tsv, String(fornecedores_tsv || ''));
  const envModel = resolveGroqModel();
  const models = [envModel, ...MODEL_CANDIDATES.filter((m) => m !== envModel)];

  let lastErr: Error | null = null;
  for (const model of models) {
    try {
      const { data, usage } = await callGroqChat(model, prompt);
      return { dados: data, usage, model: usage.model };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      const retry = /model.*not found|does not exist/i.test(msg) || /HTTP 404/.test(msg);
      if (!retry) throw lastErr;
    }
  }
  throw lastErr ?? new Error('Nenhum modelo Groq disponível para match.');
}

export function parseMatchResponse(raw: unknown): {
  fornecedor_id_match: string;
  itens: Array<{ indice: number; produto_id_match: string; confianca: string }>;
} {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const forn = obj.fornecedor && typeof obj.fornecedor === 'object'
    ? (obj.fornecedor as Record<string, unknown>)
    : {};
  const fornecedor_id_match = String(forn.id_match || forn.id || '').trim();

  const rows = Array.isArray(obj.itens) ? obj.itens : [];
  const itens = rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const indice = Number(r.indice);
      if (!Number.isFinite(indice) || indice < 0) return null;
      const conf = String(r.confianca || '').toLowerCase().trim();
      const confianca = conf === 'alta' || conf === 'media' || conf === 'baixa' ? conf : 'baixa';
      return {
        indice,
        produto_id_match: String(r.produto_id_match || r.produto_id || '').trim(),
        confianca,
      };
    })
    .filter(Boolean) as Array<{ indice: number; produto_id_match: string; confianca: string }>;

  return { fornecedor_id_match, itens };
}
