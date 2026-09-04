import { toLocalDateKey } from '@/components/utils/dateUtils';
import { embarqueRecepcaoDocumentalCompleta } from '@/lib/embarqueLogisticaHelpers';

const RECEPCAO_HISTORICO_DATA_RE = /\|\s*Data:\s*(\d{4}-\d{2}-\d{2})/i;

/** Extrai data de recepção gravada no histórico do pedido (RecepcionarEmbarque). */
export function parseDataRecepcaoEmbarqueDoHistorico(historico = '', codigoReferencia = '') {
  if (!historico) return null;
  const needle = String(codigoReferencia || '').trim().toUpperCase();
  const linhas = String(historico).split('\n');
  for (const linha of linhas) {
    if (!/RECEPÇÃO EMBARQUE/i.test(linha)) continue;
    if (needle && !linha.toUpperCase().includes(needle)) continue;
    const match = linha.match(RECEPCAO_HISTORICO_DATA_RE);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Data de recebimento do split — só para cards concluídos. */
export function getEmbarqueDataRecebimento(card = {}) {
  if (card._display_status !== 'Concluído') return null;

  const embarque = card._embarque;
  const codigoRef = embarque?.codigo_exibicao || card._display_code || '';

  const fromHistorico = parseDataRecepcaoEmbarqueDoHistorico(card.historico, codigoRef);
  if (fromHistorico) return fromHistorico;

  if (embarque?.updated_date && embarqueRecepcaoDocumentalCompleta(embarque)) {
    return toLocalDateKey(embarque.updated_date);
  }

  if (card.data_conclusao) return toLocalDateKey(card.data_conclusao);
  if (card.data_chegada) return toLocalDateKey(card.data_chegada);

  return null;
}

export function recebimentoMatchesFilter(card, inicial, final) {
  if (!inicial && !final) return true;
  const dataRec = getEmbarqueDataRecebimento(card);
  if (!dataRec) return false;
  if (inicial && dataRec < inicial) return false;
  if (final && dataRec > final) return false;
  return true;
}
