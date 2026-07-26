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
      response_json_schema,
    }: {
      prompt: string;
      model?: string;
      response_json_schema?: unknown;
    }) {
      const key = env('OPENAI_API_KEY');
      if (!key) throw new Error('OPENAI_API_KEY não configurado na Edge Function p38-core');

      const wantsJson = Boolean(response_json_schema);
      const payload: Record<string, unknown> = {
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: wantsJson
              ? 'Responde apenas com JSON válido, sem markdown nem texto extra.'
              : 'You are a helpful assistant.',
          },
          { role: 'user', content: prompt },
        ],
      };
      if (wantsJson) {
        payload.response_format = { type: 'json_object' };
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`);
      const json = await res.json();
      const content = String(json.choices?.[0]?.message?.content ?? '').trim();
      if (wantsJson) {
        try {
          return JSON.parse(content);
        } catch {
          throw new Error('OpenAI não devolveu JSON válido');
        }
      }
      return { result: content };
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
