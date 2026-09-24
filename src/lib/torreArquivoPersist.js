/**
 * Persistência do arquivo na Torre de controle (mobile/PWA).
 * sessionStorage + cache em memória — sobrevive remount e troca de etapa.
 */

const STORAGE_KEY = 'p38_torre_arquivo_v1';
const TTL_MS = 30 * 60 * 1000;
const MAX_BASE64_BYTES = 2_500_000;

let memoriaCache = null;

function agora() {
  return Date.now();
}

export function limparArquivoTorrePersistido() {
  memoriaCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

function lerPayloadBruto() {
  try {
    if (memoriaCache) return memoriaCache;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.ts && agora() - Number(parsed.ts) > TTL_MS) {
      limparArquivoTorrePersistido();
      return null;
    }
    memoriaCache = parsed;
    return parsed;
  } catch {
    limparArquivoTorrePersistido();
    return null;
  }
}

function payloadParaEntrada({ nome, tipo, base64, texto }) {
  if (texto) {
    return {
      file: null,
      previewUrl: null,
      nome: nome || 'Texto colado',
      tipo: tipo || 'text/plain',
      texto: String(texto),
    };
  }
  if (!base64) return null;
  const bin = atob(base64);
  if (bin.length > MAX_BASE64_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: tipo || 'application/octet-stream' });
  const safeName = nome || 'documento';
  let file;
  try {
    file = new File([blob], safeName, {
      type: tipo || blob.type || 'application/octet-stream',
      lastModified: agora(),
    });
  } catch {
    file = blob;
  }
  const previewUrl = URL.createObjectURL(blob);
  return { file, previewUrl, nome: safeName, tipo: tipo || blob.type };
}

/**
 * @param {Blob|File} blob
 * @param {string} fileName
 * @param {string} [tipo]
 */
export async function persistirArquivoTorre(blob, fileName, tipo) {
  if (!blob) return false;
  try {
    const bytes = await blob.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) return false;
    if (bytes.byteLength > MAX_BASE64_BYTES) {
      console.warn('[Torre] arquivo grande — persistência sessionStorage omitida');
      return false;
    }
    const b64 = btoa(
      new Uint8Array(bytes).reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
    );
    const payload = {
      nome: fileName || blob.name || 'arquivo',
      tipo: tipo || blob.type || 'application/octet-stream',
      base64: b64,
      ts: agora(),
    };
    memoriaCache = payload;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('[Torre] persistir arquivo:', e);
    return false;
  }
}

export function persistirTextoTorre(texto, nome = 'Texto colado', tipo = 'text/plain') {
  const valor = String(texto || '').trim();
  if (!valor) return false;
  try {
    const payload = {
      nome,
      tipo,
      texto: valor,
      ts: agora(),
    };
    memoriaCache = payload;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Restaura entrada da Torre sem remover (seguro para remount). */
export function restaurarArquivoTorre() {
  const parsed = lerPayloadBruto();
  if (!parsed) return null;
  return payloadParaEntrada(parsed);
}
