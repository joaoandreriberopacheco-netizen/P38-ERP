/**
 * Segunda passagem Groq: associa itens já extraídos ao catálogo (candidatos enxutos do cliente).
 */

import type { LlmUsage } from './llmTelemetry.ts';
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
}: {
  tipo: ImportMatchTipo;
  itens: ImportMatchItemInput[];
  catalogo_tsv: string;
  fornecedores_tsv?: string;
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
  const tsv = String(catalogo_tsv || '').trim();
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
