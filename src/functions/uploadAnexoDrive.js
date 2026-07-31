import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { uploadAnexoDriveSupabase } from '@/lib/anexosSupabase';
import { fileBlobToBase64 } from '@/lib/uploadAnexoReferencia';
import { invokeFunction } from './_invokeHelper';

/**
 * Upload de anexo — Supabase Storage no browser; legado Base44 via edge.
 * Aceita `file` (Blob/File) ou `file_base64`.
 */
export async function uploadAnexoDrive(body = {}) {
  const payload = { ...body };

  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const result = await uploadAnexoDriveSupabase({ supabase, body: payload });
      return { data: result };
    }
  }

  if (!payload.file_base64 && payload.file instanceof Blob) {
    payload.file_base64 = await fileBlobToBase64(payload.file);
  }
  delete payload.file;
  return invokeFunction('uploadAnexoDrive', payload);
}
