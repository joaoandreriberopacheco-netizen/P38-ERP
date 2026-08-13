/**
 * Ponte Torre de controle → Fluxo de caixa (novo lançamento): preserva comprovante para anexar após salvar.
 */

import { createPageUrl } from '@/utils';

const TTL_MS = 30 * 60 * 1000;

export const STORAGE_LANCAMENTO_TORRE_BRIDGE = 'p38_lancamento_torre_v1';
export const STORAGE_TORRE_RETURN = 'p38_torre_return_v1';

/** Marca que o fluxo veio da Torre (para voltar em vez de ficar no Fluxo de Caixa). */
export function marcarFluxoLancamentoTorre() {
  try {
    sessionStorage.setItem(STORAGE_TORRE_RETURN, JSON.stringify({ ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function limparFluxoLancamentoTorre() {
  try {
    sessionStorage.removeItem(STORAGE_TORRE_RETURN);
  } catch {
    /* ignore */
  }
}

export function temFluxoLancamentoTorreAtivo() {
  try {
    const raw = sessionStorage.getItem(STORAGE_TORRE_RETURN);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return !(ts && Date.now() - Number(ts) > TTL_MS);
  } catch {
    return false;
  }
}

/** @deprecated Preferir concluirFluxoTorreCompartilhamento após salvar na Torre. */
export function voltarParaTorreControle() {
  limparFluxoLancamentoTorre();
  window.location.href = createPageUrl('AnexoCompartilhado');
}

/**
 * Termina o fluxo iniciado pela Torre (partilha → novo lançamento):
 * tenta fechar o P38 / voltar à app anterior; senão vai à Home.
 */
export function concluirFluxoTorreCompartilhamento() {
  limparFluxoLancamentoTorre();
  try {
    sessionStorage.removeItem(STORAGE_LANCAMENTO_TORRE_BRIDGE);
  } catch {
    /* ignore */
  }

  try {
    window.close();
  } catch {
    /* ignore — muitos browsers bloqueiam close() */
  }

  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.go(-1);
    return;
  }

  window.location.replace(createPageUrl('Home'));
}

export async function navegarParaNovoLancamentoTorre(arquivoEntry, { valor, descricao, tipoDocumento = 'Comprovante' } = {}) {
  marcarFluxoLancamentoTorre();
  try {
    const file = arquivoEntry?.file;
    if (file) {
      await guardarArquivoParaLancamentoTorre(file, arquivoEntry.nome, arquivoEntry.tipo, tipoDocumento);
    }
  } catch (e) {
    console.warn('[Torre→Lançamento] não foi possível guardar cópia do arquivo:', e);
  }

  const params = new URLSearchParams();
  params.set('novo', '1');
  params.set('tipo', 'Despesa');
  if (valor != null && Number.isFinite(Number(valor))) {
    params.set('valor', String(valor));
  }
  if (descricao) {
    params.set('descricao', String(descricao).slice(0, 120));
  }
  params.set('torre_anexo', '1');

  window.location.href = `${createPageUrl('FluxoCaixa')}?${params.toString()}`;
}

export function guardarArquivoParaLancamentoTorre(file, nome, tipo, tipoDocumento = 'Comprovante') {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        sessionStorage.setItem(
          STORAGE_LANCAMENTO_TORRE_BRIDGE,
          JSON.stringify({
            nome: nome || file.name || 'comprovante',
            tipo: tipo || file.type || 'application/octet-stream',
            tipoDocumento: String(tipoDocumento || 'Comprovante').trim() || 'Comprovante',
            base64,
            ts: Date.now(),
          })
        );
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export function consumirArquivoLancamentoTorreDoBridge() {
  try {
    const raw = sessionStorage.getItem(STORAGE_LANCAMENTO_TORRE_BRIDGE);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_LANCAMENTO_TORRE_BRIDGE);
    const parsed = JSON.parse(raw);
    const { nome, tipo, base64, ts, tipoDocumento } = parsed;
    if (ts && Date.now() - Number(ts) > TTL_MS) return null;
    if (!base64) return null;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: tipo || 'application/octet-stream' });
    const file = new File([blob], nome || 'comprovante', {
      type: tipo || blob.type || 'application/octet-stream',
      lastModified: Date.now(),
    });
    return {
      file,
      tipoDocumento: String(tipoDocumento || 'Comprovante').trim() || 'Comprovante',
    };
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_LANCAMENTO_TORRE_BRIDGE);
    } catch (_) {}
    return null;
  }
}

export function temAnexoLancamentoTorrePendente() {
  try {
    return Boolean(sessionStorage.getItem(STORAGE_LANCAMENTO_TORRE_BRIDGE));
  } catch {
    return false;
  }
}
