/**
 * Fallback OCR: texto já extraído localmente → Groq (Llama free tier) estrutura JSON.
 * 1 documento ≈ 1 request. Sem imagem/PDF — só texto.
 */

import type { LlmUsage } from './llmTelemetry.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';

/** Modelos ativos na Groq (evitar IDs Llama antigos que retornam 404). */
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const FALLBACK_MODEL = 'qwen/qwen3.8-27b';
const MODEL_CANDIDATES = [DEFAULT_MODEL, FALLBACK_MODEL, 'openai/gpt-oss-120b'];

export type OcrStructTipo =
  | 'pedido_compra'
  | 'cotacao_pdf'
  | 'lista_foto'
  | 'boleto_agefin'
  | 'comprovante';

function resolveGroqApiKey(): string {
  return env('GROQ_API_KEY') || '';
}

function resolveGroqModel(): string {
  return env('GROQ_OCR_MODEL') || DEFAULT_MODEL;
}

function trimTexto(texto: string, max = 28_000): string {
  const t = String(texto || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[… texto truncado …]`;
}

function schemaHintPorTipo(tipo: OcrStructTipo): string {
  switch (tipo) {
    case 'pedido_compra':
      return `{
  "fornecedor": { "nome_identificado": "string", "cnpj_identificado": "string ou vazio" },
  "itens": [
    {
      "descricao": "string",
      "codigo": "string",
      "marca": "string ou vazio",
      "quantidade": number,
      "preco_unitario": number,
      "unidade_medida_documento": "UN|M2|CX|KG|etc"
    }
  ]
}`;
    case 'cotacao_pdf':
      return `{
  "fornecedor": { "nome_identificado": "string", "cnpj_identificado": "string ou vazio" },
  "financeiro": {
    "subtotal": number,
    "desconto_global": number,
    "total_final": number,
    "desconto_comercial": 0,
    "desconto_suframa": 0
  },
  "itens": [
    {
      "descricao_pdf": "string",
      "codigo_pdf": "string",
      "marca_pdf": "string ou vazio",
      "quantidade_pdf": number,
      "preco_unitario_pdf": number
    }
  ]
}`;
    case 'lista_foto':
      return `{
  "itens": [
    {
      "texto_identificado": "string",
      "quantidade_escrita": "string ou null",
      "confianca": "alta|media|baixa"
    }
  ]
}`;
    case 'boleto_agefin':
      return `{
  "descricao": "string",
  "beneficiario": "string",
  "valor_pagamento": number ou null,
  "data_vencimento": "YYYY-MM-DD ou null",
  "competencia": "string ou null",
  "linha_digitavel": "string ou vazio",
  "codigo_pix_copia_cola": "string ou vazio",
  "natureza_sugerida": "Único|Recorrente",
  "confianca_leitura": "alta|media|baixa"
}`;
    case 'comprovante':
      return `{
  "valor": number ou null,
  "descricao": "string",
  "data_pagamento": "YYYY-MM-DD ou null",
  "origem": "groq_fallback"
}`;
    default:
      return '{}';
  }
}

function buildPrompt(tipo: OcrStructTipo, texto: string): string {
  const schema = schemaHintPorTipo(tipo);
  return `Você estrutura documentos comerciais brasileiros (pedidos, orçamentos, boletos, comprovantes).
Responda APENAS com JSON válido, sem markdown, sem comentários.

Tipo de documento: ${tipo}

Lógica universal (independente do ERP ou fornecedor):
- Cada linha de produto tem: descrição legível, quantidade comercial, preço unitário (ou derive unitário = total da linha ÷ quantidade).
- "quantidade" é a coluna QTDE/QTY da tabela (ex.: 80 barras), NÃO confundir com medidas dentro da descrição (ex.: 8,00 MM, 12,0 M).
- Valide: quantidade × preço unitário ≈ total da linha (tolerância ~2%).
- Ignore colunas fiscais (ICMS, IPI, peso, data prevista) e totais do rodapé.
- Não dependa de layout fixo: encontre a tabela pelo significado das colunas, não pelo nome do sistema.

Regras:
- Use números decimais com ponto (ex.: 4.28), não vírgula.
- CNPJ só se aparecer formatado (XX.XXX.XXX/XXXX-XX); nunca invente.
- Extraia TODOS os itens de produto que encontrar; ignore cabeçalhos e totais.
- quantidade e preco_unitario devem ser > 0 quando houver item.
- O campo mais importante é "descricao": nome completo do produto, marca, embalagem (ex.: "MASSA ACRILICA BD 20KG HIPERCOR").
- "codigo" é opcional (referência do fornecedor; ignore se não houver).
- Não invente código de barras/EAN; foque no texto legível da descrição + quantidade + preço unitário.
- Extraia TODOS os itens de produto; ignore cabeçalhos, subtotais, rodapés e frete.
- Se não houver itens, devolva "itens": [].
- Planilhas Excel/CSV: identifique a linha de cabeçalho pelo significado (descrição/produto, quantidade, preço unitário); ignore colunas de total, imposto e frete; cada linha de dados é um item.
- Layouts de PDF variam (MaxAndroid, Tintão, MASS, ERP genérico): use quantidade × preço unitário ≈ total da linha quando ambíguo.

Schema esperado:
${schema}

Texto do documento (OCR local):
---
${trimTexto(texto)}
---`;
}

function parseJsonContent(content: string): unknown {
  const raw = String(content || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Resposta da IA não é JSON válido.');
  }
}

async function callGroqChat(
  model: string,
  prompt: string,
): Promise<{ data: unknown; usage: LlmUsage }> {
  const key = resolveGroqApiKey();
  if (!key) {
    throw new Error(
      'Fallback IA indisponível. Configure GROQ_API_KEY no Supabase → Edge Functions → Secrets (tier gratuito Groq).',
    );
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Você extrai dados estruturados de documentos brasileiros. Responda somente JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      json?.error?.message ||
      json?.message ||
      `Groq HTTP ${res.status}`;
    const retryable = res.status === 429 || /rate limit|quota/i.test(String(errMsg));
    throw new Error(
      retryable
        ? 'Limite gratuito da IA atingido. Tente novamente em alguns minutos ou preencha manualmente.'
        : errMsg,
    );
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq devolveu resposta vazia.');

  const usage: LlmUsage = {
    provider: 'groq',
    model: String(json?.model || model),
    input_tokens: Number(json?.usage?.prompt_tokens) || 0,
    output_tokens: Number(json?.usage?.completion_tokens) || 0,
    total_tokens: Number(json?.usage?.total_tokens) || 0,
  };

  return { data: parseJsonContent(content), usage };
}

export async function structurarDocumentoOcrGroq({
  texto,
  tipo,
}: {
  texto: string;
  tipo: OcrStructTipo;
}): Promise<{ dados: unknown; usage: LlmUsage; model: string }> {
  const trimmed = String(texto || '').trim();
  if (!trimmed) {
    throw new Error('Texto em falta para estruturação na nuvem.');
  }

  const envModel = resolveGroqModel();
  const models = [
    envModel,
    ...MODEL_CANDIDATES.filter((m) => m !== envModel),
  ];
  const prompt = buildPrompt(tipo, trimmed);

  let lastErr: Error | null = null;
  for (const model of models) {
    try {
      const { data, usage } = await callGroqChat(model, prompt);
      return { dados: data, usage, model: usage.model };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const msg = lastErr.message;
      const retry =
        /model.*not found|does not exist/i.test(msg) || /HTTP 404/.test(msg);
      if (!retry) throw lastErr;
    }
  }
  throw lastErr ?? new Error('Nenhum modelo Groq disponível.');
}
