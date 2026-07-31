import { createSupabaseEntityLayer } from '@/integrations/p38/supabaseEntityLayer';
import { p38PublicEnv } from '@/lib/p38PublicEnv';

function anexosBucket() {
  return p38PublicEnv('VITE_SUPABASE_ANEXOS_BUCKET') || 'anexos';
}

function formatStorageUploadError(error) {
  const message = error?.message || String(error);
  const bucket = anexosBucket();
  if (/bucket not found/i.test(message)) {
    return (
      `Bucket de anexos "${bucket}" não existe no Supabase Storage. ` +
      'Aplique a migração supabase/migrations/045_storage_buckets.sql (npm run supabase:deploy).'
    );
  }
  if (/payload too large|entity too large|413/i.test(message)) {
    return 'Arquivo grande demais para anexar (limite 50 MB).';
  }
  return message;
}

function storagePathFromUrl(url) {
  const bucket = anexosBucket();
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = String(url || '').indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(String(url).slice(idx + marker.length));
}

function base64ToBytes(b64) {
  const binary = atob(String(b64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function resolveUploadBytes(body) {
  const file = body?.file;
  if (file instanceof Blob) {
    const buffer = await file.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      fileType: file.type || body?.file_type || 'application/octet-stream',
      fileName: file.name || body?.file_name || 'anexo',
    };
  }

  const fileBase64 = body?.file_base64;
  if (fileBase64) {
    return {
      bytes: base64ToBytes(fileBase64),
      fileType: body?.file_type || 'application/octet-stream',
      fileName: body?.file_name || 'anexo',
    };
  }

  throw new Error('Informe o arquivo (file) ou file_base64 para anexar.');
}

/**
 * Upload de anexo via Supabase Storage + AnexoDocumento (sem Edge Function).
 */
export async function uploadAnexoDriveSupabase({ supabase, body }) {
  if (!supabase) throw new Error('Supabase não configurado para upload de anexos.');

  const {
    referencia_tipo,
    referencia_id,
    referencia_numero,
    descricao,
    tipo_documento,
    origem = 'supabase_storage',
  } = body || {};

  if (!referencia_tipo || !referencia_id) {
    throw new Error('referencia_tipo e referencia_id são obrigatórios');
  }

  const { bytes, fileType, fileName } = await resolveUploadBytes(body);
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${referencia_tipo}/${referencia_id}/${crypto.randomUUID()}_${safeName}`;
  const bucket = anexosBucket();

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: fileType,
    upsert: false,
  });
  if (upErr) throw new Error(formatStorageUploadError(upErr));

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = pub.publicUrl;

  const entities = createSupabaseEntityLayer(null, supabase);
  const anexo = await entities.AnexoDocumento.create({
    descricao: descricao || safeName,
    mime_type: fileType,
    nome_arquivo: safeName,
    origem,
    referencia_id: String(referencia_id),
    referencia_numero: referencia_numero != null ? String(referencia_numero) : null,
    referencia_tipo: String(referencia_tipo),
    tipo_documento: tipo_documento || 'outro',
    url_drive: url,
    tamanho_bytes: String(bytes.length),
  });

  if (referencia_tipo === 'ContaPrevista') {
    const flags = { tem_anexo: true };
    const tipo = String(tipo_documento || '').toLowerCase();
    if (tipo === 'boleto') {
      flags.tem_boleto = true;
      flags.boleto_url = url;
    }
    if (tipo === 'comprovante') flags.tem_comprovante = true;
    await entities.ContaPrevista.update(referencia_id, flags);
  }

  return { success: true, anexo };
}

export async function listarAnexosSupabase({ supabase, body }) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { referencia_tipo, referencia_id } = body || {};
  if (!referencia_tipo || !referencia_id) {
    throw new Error('referencia_tipo e referencia_id são obrigatórios');
  }
  const entities = createSupabaseEntityLayer(null, supabase);
  const anexos = await entities.AnexoDocumento.filter({
    referencia_tipo,
    referencia_id: String(referencia_id),
  });
  return { anexos };
}

export async function deletarAnexoSupabase({ supabase, body }) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { anexo_id } = body || {};
  if (!anexo_id) throw new Error('anexo_id obrigatório');

  const entities = createSupabaseEntityLayer(null, supabase);
  const anexo = await entities.AnexoDocumento.get(anexo_id);
  if (!anexo) throw new Error('Anexo não encontrado');

  const path = storagePathFromUrl(anexo.url_drive);
  if (path) {
    const bucket = anexosBucket();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) console.warn('[P38] storage.remove anexo:', error.message);
  }

  await entities.AnexoDocumento.delete(anexo_id);

  if (anexo.referencia_tipo === 'ContaPrevista' && anexo.referencia_id) {
    const restantes = await entities.AnexoDocumento.filter({
      referencia_tipo: 'ContaPrevista',
      referencia_id: anexo.referencia_id,
    });
    const patch = {
      tem_anexo: restantes.length > 0,
      tem_boleto: restantes.some((a) => String(a.tipo_documento || '').toLowerCase() === 'boleto'),
      tem_comprovante: restantes.some((a) => String(a.tipo_documento || '').toLowerCase() === 'comprovante'),
    };
    if (!patch.tem_boleto) patch.boleto_url = null;
    await entities.ContaPrevista.update(anexo.referencia_id, patch);
  }

  return { success: true };
}
