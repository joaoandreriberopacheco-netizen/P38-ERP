// Integrações Core (substituem base44.integrations.Core.*)
import { serviceClient } from './auth.ts';
import type { LlmUsage } from './llmTelemetry.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';

async function resendEmail(to: string, subject: string, text: string) {
  const key = env('RESEND_API_KEY');
  if (!key) throw new Error('RESEND_API_KEY não configurado');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('RESEND_FROM') || 'P38 ERP <no-reply@p38.app>',
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Email falhou: ${await res.text()}`);
  return { success: true };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isPdfUrl(url: string, mime = ''): boolean {
  const lower = url.toLowerCase();
  return /\.pdf(\?|$)/.test(lower) || mime.includes('pdf');
}

function isImageUrl(url: string, mime = ''): boolean {
  if (mime.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)(\?|$)/i.test(url);
}

function parseSupabaseStorageObjectUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const publicMatch = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (publicMatch) {
      return {
        bucket: decodeURIComponent(publicMatch[1]),
        path: decodeURIComponent(publicMatch[2]),
      };
    }
    const signedMatch = parsed.pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (signedMatch) {
      return {
        bucket: decodeURIComponent(signedMatch[1]),
        path: decodeURIComponent(signedMatch[2]),
      };
    }
  } catch {
    // segue para null
  }
  return null;
}

async function downloadStorageObjectBytes(
  bucket: string,
  path: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const client = serviceClient();
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || `Arquivo não encontrado em ${bucket}/${path}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const mimeType = (data.type || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
  return { bytes, mimeType };
}

async function buildVisionContentParts(
  prompt: string,
  fileUrls: string[],
  wantsJson: boolean,
): Promise<unknown[]> {
  const text = wantsJson ? `${prompt}\n\nResponda somente com JSON válido.` : prompt;
  const parts: unknown[] = [{ type: 'text', text }];

  for (const url of fileUrls) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Não foi possível ler o arquivo para análise (${res.status})`);
    }
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    if (isPdfUrl(url, mime)) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const base64 = bytesToBase64(bytes);
      parts.push({
        type: 'file',
        file: {
          filename: 'documento.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        },
      });
      continue;
    }

    if (isImageUrl(url, mime)) {
      parts.push({
        type: 'image_url',
        image_url: { url, detail: 'high' },
      });
      continue;
    }

    // Fallback: tenta como imagem (URLs sem extensão, ex. storage Supabase)
    parts.push({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    });
  }

  return parts;
}

function parseInvokeLlmContent(content: string, wantsJson: boolean): unknown {
  if (!wantsJson) return { result: content };
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // segue para fallback
      }
    }
    return { result: content };
  }
}

function resolveGeminiApiKey(): string {
  return env('GEMINI_API_KEY') || env('GOOGLE_API_KEY');
}

function resolveGeminiModel(useVision: boolean): string {
  if (env('GEMINI_MODEL')) return env('GEMINI_MODEL');
  // gemini-2.0-flash foi descontinuado (404 em jul/2026); 3.6 para PDF/imagem, lite para texto.
  return useVision ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
}

async function fetchFileInlineData(url: string): Promise<{ mimeType: string; data: string }> {
  let res: Response | null = null;
  try {
    res = await fetch(url);
  } catch {
    res = null;
  }

  if (res?.ok) {
    let mimeType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (isPdfUrl(url, mimeType)) mimeType = 'application/pdf';
      else if (isImageUrl(url, mimeType)) mimeType = 'image/jpeg';
      else mimeType = 'application/octet-stream';
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { mimeType, data: bytesToBase64(bytes) };
  }

  const parsed = parseSupabaseStorageObjectUrl(url);
  if (parsed) {
    const { bytes, mimeType } = await downloadStorageObjectBytes(parsed.bucket, parsed.path);
    let effectiveMime = mimeType;
    if (!effectiveMime || effectiveMime === 'application/octet-stream') {
      if (isPdfUrl(url, effectiveMime) || parsed.path.toLowerCase().endsWith('.pdf')) {
        effectiveMime = 'application/pdf';
      } else if (isImageUrl(url, effectiveMime)) {
        effectiveMime = 'image/jpeg';
      }
    }
    return { mimeType: effectiveMime, data: bytesToBase64(bytes) };
  }

  const status = res?.status || 'rede';
  throw new Error(`Não foi possível ler o arquivo para análise (${status})`);
}

async function invokeGeminiLLM({
  prompt,
  file_urls,
  response_json_schema,
  model,
}: {
  prompt: string;
  model?: string;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
}) {
  const key = resolveGeminiApiKey();
  if (!key) throw new Error('GEMINI_API_KEY não configurado');

  const fileUrls = Array.isArray(file_urls) ? file_urls.filter(Boolean) : [];
  const wantsJson = Boolean(response_json_schema);
  const effectiveModel = model || resolveGeminiModel(fileUrls.length > 0);

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  parts.push({
    text: wantsJson ? `${prompt}\n\nResponda somente com JSON válido.` : prompt,
  });

  for (const url of fileUrls) {
    const inline = await fetchFileInlineData(url);
    parts.push({ inlineData: inline });
  }

  const generationConfig: Record<string, unknown> = {};
  if (wantsJson) {
    generationConfig.responseMimeType = 'application/json';
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(effectiveModel)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig,
    }),
  });

  if (!res.ok) throw new Error(`Gemini: ${await res.text()}`);
  const json = await res.json();
  const content = (json.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text || '')
    .join('');
  const meta = json.usageMetadata || {};
  const inputTokens = Number(meta.promptTokenCount) || 0;
  const outputTokens = Number(meta.candidatesTokenCount) || 0;
  const usage: LlmUsage = {
    provider: 'gemini',
    model: effectiveModel,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: Number(meta.totalTokenCount) || inputTokens + outputTokens,
  };
  return {
    data: parseInvokeLlmContent(content, wantsJson),
    usage,
  };
}

async function invokeOpenAiLLM({
  prompt,
  model,
  file_urls,
  response_json_schema,
}: {
  prompt: string;
  model?: string;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
}) {
  const key = env('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY não configurado');

  const fileUrls = Array.isArray(file_urls) ? file_urls.filter(Boolean) : [];
  const wantsJson = Boolean(response_json_schema);
  const useVision = fileUrls.length > 0;
  const effectiveModel = model || (useVision ? 'gpt-4o' : 'gpt-4o-mini');

  const body: Record<string, unknown> = {
    model: effectiveModel,
    messages: [
      {
        role: 'user',
        content: useVision
          ? await buildVisionContentParts(prompt, fileUrls, wantsJson)
          : (wantsJson ? `${prompt}\n\nResponda somente com JSON válido.` : prompt),
      },
    ],
  };

  if (wantsJson) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`);
  const json = await res.json();
  const content = String(json.choices?.[0]?.message?.content ?? '');
  const usage: LlmUsage = {
    provider: 'openai',
    model: effectiveModel,
    input_tokens: Number(json.usage?.prompt_tokens) || 0,
    output_tokens: Number(json.usage?.completion_tokens) || 0,
    total_tokens: Number(json.usage?.total_tokens) || 0,
  };
  return {
    data: parseInvokeLlmContent(content, wantsJson),
    usage,
  };
}

export function buildCoreIntegrations() {
  const bucket = env('SUPABASE_ANEXOS_BUCKET') || 'anexos';

  return {
    async SendEmail({ to, subject, body }: { to: string; subject: string; body: string }) {
      return resendEmail(to, subject, body);
    },

    async UploadFile({ file, path, bucket: b }: { file: Uint8Array | ArrayBuffer; path: string; bucket?: string }) {
      const client = serviceClient();
      const bytes = file instanceof Uint8Array ? file : new Uint8Array(file);
      const { data, error } = await client.storage.from(b || bucket).upload(path, bytes, {
        upsert: true,
        contentType: 'application/octet-stream',
      });
      if (error) throw new Error(error.message);
      const bucketName = b || bucket;
      const { data: signed, error: signError } = await client.storage
        .from(bucketName)
        .createSignedUrl(data.path, 3600);
      if (!signError && signed?.signedUrl) {
        return { file_url: signed.signedUrl, path: data.path, bucket: bucketName };
      }
      const { data: pub } = client.storage.from(bucketName).getPublicUrl(data.path);
      return { file_url: pub.publicUrl, path: data.path, bucket: bucketName };
    },

    async UploadPrivateFile({ file, path, bucket: b }: { file: Uint8Array | ArrayBuffer; path: string; bucket?: string }) {
      return buildCoreIntegrations().UploadFile({ file, path, bucket: b });
    },

    async CreateFileSignedUrl({ path, bucket: b, expiresIn = 3600 }: { path: string; bucket?: string; expiresIn?: number }) {
      const client = serviceClient();
      const { data, error } = await client.storage.from(b || bucket).createSignedUrl(path, expiresIn);
      if (error) throw new Error(error.message);
      return { signed_url: data.signedUrl };
    },

    async InvokeLLM({
      prompt,
      model,
      file_urls,
      response_json_schema,
    }: {
      prompt: string;
      model?: string;
      file_urls?: string[];
      response_json_schema?: Record<string, unknown>;
    }) {
      const geminiKey = resolveGeminiApiKey();
      const openAiKey = env('OPENAI_API_KEY');
      if (geminiKey) {
        return invokeGeminiLLM({ prompt, model, file_urls, response_json_schema });
      }
      if (openAiKey) {
        return invokeOpenAiLLM({ prompt, model, file_urls, response_json_schema });
      }
      throw new Error(
        'Nenhum provedor de IA configurado. Defina GEMINI_API_KEY (recomendado) ou OPENAI_API_KEY no Supabase → Edge Functions → Secrets.',
      );
    },

    async GenerateImage({ prompt }: { prompt: string }) {
      const key = env('OPENAI_API_KEY');
      if (!key) throw new Error('OPENAI_API_KEY não configurado');
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
      });
      if (!res.ok) throw new Error(`OpenAI image: ${await res.text()}`);
      const json = await res.json();
      return { url: json.data?.[0]?.url ?? '' };
    },

    async ExtractDataFromUploadedFile(_args: Record<string, unknown>) {
      throw new Error('ExtractDataFromUploadedFile: use parser dedicado na Edge Function de importação');
    },
  };
}
