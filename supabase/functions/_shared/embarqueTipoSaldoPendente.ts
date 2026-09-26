export const EMBARQUE_TIPO_SALDO_PENDENTE = 'Pendente';
export const EMBARQUE_TIPO_SALDO_PENDENTE_LEGADO = 'Necessidade';

export function embarqueIsSaldoPendente(tipo: unknown): boolean {
  const t = String(tipo ?? 'Embarque').trim();
  return t === EMBARQUE_TIPO_SALDO_PENDENTE || t === EMBARQUE_TIPO_SALDO_PENDENTE_LEGADO;
}

export function embarqueTipoSaldoPendenteParaGravar(): string {
  return EMBARQUE_TIPO_SALDO_PENDENTE;
}
