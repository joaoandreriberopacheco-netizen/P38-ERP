// Integrações Core (substituem base44.integrations.Core.*)
import { serviceClient } from './auth.ts';

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
  return env('GEMINI_MODEL') || (useVision ? 'gemini-2.0-flash' : 'gemini-2.0-flash');
}

async function fetchFileInlineData(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Não foi possível ler o arquivo para análise (${res.status})`);
  }
  let mimeType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    if (isPdfUrl(url)) mimeType = 'application/pdf';
    else if (isImageUrl(url)) mimeType = 'image/jpeg';
    else mimeType = 'application/octet-stream';
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { mimeType, data: bytesToBase64(bytes) };
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
  return parseInvokeLlmContent(content, wantsJson);
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
  return parseInvokeLlmContent(content, wantsJson);
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
      const { data: pub } = client.storage.from(b || bucket).getPublicUrl(data.path);
      return { file_url: pub.publicUrl, path: data.path };
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
