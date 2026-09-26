/**
 * Embarque de saldo pós-recepção (antigo tipo «Necessidade»).
 * Valor canónico gravado: Pendente. «Necessidade» permanece legível até migração na BD.
 */

export const EMBARQUE_TIPO_SALDO_PENDENTE = 'Pendente';

/** @deprecated Valor legado — ainda aceite em leitura */
export const EMBARQUE_TIPO_SALDO_PENDENTE_LEGADO = 'Necessidade';

export function isEmbarqueSaldoPendente(embarqueOrTipo) {
  const tipo =
    embarqueOrTipo && typeof embarqueOrTipo === 'object'
      ? embarqueOrTipo.tipo
      : embarqueOrTipo;
  const t = String(tipo ?? 'Embarque').trim();
  return t === EMBARQUE_TIPO_SALDO_PENDENTE || t === EMBARQUE_TIPO_SALDO_PENDENTE_LEGADO;
}

export function isEmbarqueReal(embarqueOrTipo) {
  return !isEmbarqueSaldoPendente(embarqueOrTipo);
}

/** Tipo a gravar em novos splits pós-recepção */
export function embarqueTipoSaldoPendenteParaGravar() {
  return EMBARQUE_TIPO_SALDO_PENDENTE;
}
