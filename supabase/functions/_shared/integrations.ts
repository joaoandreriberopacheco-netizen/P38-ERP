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

function geminiVisionFallbackModels(primary: string): string[] {
  const chain = [primary, 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  return [...new Set(chain.filter(Boolean))];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGeminiRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503 || status === 504;
}

function humanizeGeminiApiError(status: number, body: string): string {
  const lower = String(body || '').toLowerCase();
  if (status === 503 || /unavailable|spike|overloaded|high demand|try again later/i.test(lower)) {
    return 'O Gemini está com pico de demanda agora. Aguarde 30–60 segundos e tente importar de novo.';
  }
  if (status === 429 || /quota|rate limit|resource exhausted/i.test(lower)) {
    return 'Limite de chamadas ao Gemini atingido. Aguarde um minuto e tente novamente.';
  }
  if (/billing|credit|prepay|payment/i.test(lower)) {
    return 'Créditos ou faturação do Gemini precisam de atenção no Google AI Studio.';
  }
  const snippet = String(body || '').trim().slice(0, 180);
  return snippet ? `Gemini (${status}): ${snippet}` : `Gemini indisponível (${status}). Tente novamente em instantes.`;
}

async function postGeminiGenerateContent(
  model: string,
  key: string,
  requestBody: Record<string, unknown>,
): Promise<Response> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const maxAttempts = 4;
  let lastStatus = 503;
  let lastBody = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (res.ok) return res;

    lastStatus = res.status;
    lastBody = await res.text();
    if (!isGeminiRetryableStatus(res.status) || attempt >= maxAttempts - 1) {
      throw new Error(humanizeGeminiApiError(res.status, lastBody));
    }
    await sleep(1500 * (2 ** attempt));
  }

  throw new Error(humanizeGeminiApiError(lastStatus, lastBody));
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

  const requestBody = {
    contents: [{ role: 'user', parts }],
    generationConfig,
  };

  const modelsToTry = fileUrls.length > 0
    ? geminiVisionFallbackModels(effectiveModel)
    : [effectiveModel];

  let lastError: Error | null = null;
  for (const modelName of modelsToTry) {
    try {
      const res = await postGeminiGenerateContent(modelName, key, requestBody);
      const json = await res.json();
      const content = (json.candidates?.[0]?.content?.parts ?? [])
        .map((part: { text?: string }) => part.text || '')
        .join('');
      const meta = json.usageMetadata || {};
      const inputTokens = Number(meta.promptTokenCount) || 0;
      const outputTokens = Number(meta.candidatesTokenCount) || 0;
      const usage: LlmUsage = {
        provider: 'gemini',
        model: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: Number(meta.totalTokenCount) || inputTokens + outputTokens,
      };
      return {
        data: parseInvokeLlmContent(content, wantsJson),
        usage,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      const retryable = /pico de demanda|limite de chamadas|503|429|504/i.test(error.message);
      if (!retryable || modelName === modelsToTry[modelsToTry.length - 1]) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Gemini indisponível. Tente novamente em instantes.');
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
      if (!geminiKey) {
        throw new Error(
          'Leitura com IA indisponível. Defina GEMINI_API_KEY (ou GOOGLE_API_KEY) no Supabase → Edge Functions → Secrets.',
        );
      }
      return invokeGeminiLLM({ prompt, model, file_urls, response_json_schema });
    },

    async GenerateImage(_args: { prompt: string }) {
      throw new Error(
        'Geração de imagem por IA não está disponível. Faça upload do logo ou imagem manualmente.',
      );
    },

    async ExtractDataFromUploadedFile(_args: Record<string, unknown>) {
      throw new Error('ExtractDataFromUploadedFile: use parser dedicado na Edge Function de importação');
    },
  };
}
