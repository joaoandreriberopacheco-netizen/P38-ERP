/**
 * Fallback OCR: texto já extraído localmente → Groq (Llama free tier) estrutura JSON.
 * 1 documento ≈ 1 request. Sem imagem/PDF — só texto.
 */

import type { LlmUsage } from './llmTelemetry.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

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

Regras:
- Use números decimais com ponto (ex.: 4.28), não vírgula.
- CNPJ só se aparecer formatado (XX.XXX.XXX/XXXX-XX); nunca invente.
- Extraia TODOS os itens de produto que encontrar; ignore cabeçalhos e totais.
- quantidade e preco_unitario devem ser > 0 quando houver item.
- Se não houver itens, devolva "itens": [].

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

  const primaryModel = resolveGroqModel();
  const prompt = buildPrompt(tipo, trimmed);

  try {
    const { data, usage } = await callGroqChat(primaryModel, prompt);
    return { dados: data, usage, model: usage.model };
  } catch (primaryErr) {
    if (primaryModel === FALLBACK_MODEL) throw primaryErr;
    const { data, usage } = await callGroqChat(FALLBACK_MODEL, prompt);
    return { dados: data, usage, model: usage.model };
  }
}
