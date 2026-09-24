import { readShareBlobBackup } from '@/lib/pwaShareBlobBackup';

/** Hidrata o cartão da Torre a partir do backup (antes do React / polling). */
export function buildTorreArquivoFromSharePreload() {
  if (typeof window === 'undefined') return null;
  const claimed = readShareBlobBackup();
  if (!claimed?.blob?.size) return null;

  const blob = claimed.blob;
  const fileName = claimed.name || 'arquivo';
  let fileObj;
  try {
    fileObj = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
  } catch (_) {
    fileObj = blob;
  }

  return {
    arquivo: {
      file: fileObj,
      previewUrl: URL.createObjectURL(blob),
      nome: fileName,
      tipo: blob.type || 'application/octet-stream',
    },
    claim: claimed,
  };
}
