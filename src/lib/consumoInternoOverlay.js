/** Camadas do fluxo de consumo interno — abaixo dos atalhos globais (~80020). */
export const CONSUMO_FORM_SHELL_Z = 'z-[70000]';
/** Seletor de produto, assinatura e fundo de diálogos auxiliares sobre o formulário. */
export const CONSUMO_FORM_OVERLAY_Z = 'z-[70010]';
/** Conteúdo de diálogo Radix acima do overlay do formulário. */
export const CONSUMO_FORM_DIALOG_CONTENT_Z = 'z-[70011]';
/** Comprovante / minuta após salvar — acima do formulário. */
export const CONSUMO_FORM_COMPROVANTE_Z = 'z-[70020]';

/** Remove entrada de histórico do overlay antes de fechar o formulário por sucesso (evita history.back indesejado). */
export function dismissConsumoOverlayHistory() {
  try {
    if (typeof window !== 'undefined' && window.history.state?.p38_overlay) {
      window.history.replaceState({}, '');
    }
  } catch {
    /* ignore */
  }
}
