/**
 * Regras para saber se um PedidoVenda entra no espelho do turno de caixa (PDV).
 *
 * Motivação: a lista "Vendas do Turno" não pode depender só de `pedido.turno_caixa_id`,
 * porque vendas podem ter sido finalizadas por outro fluxo (gestão, retificação) com
 * receitas já gravadas com `turno_caixa_id`, ou legado sem selo no pedido.
 */

export const STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA = [
  "Financeiro OK",
  "Pedido Concluído",
  "Em Separação",
  "Em Rota de Entrega",
];

/**
 * @param {Array<{ referencia_tipo?: string, referencia_id?: string }>} lancamentosReceita
 * @returns {Set<string>}
 */
export function buildPedidoIdsReceitasTurno(lancamentosReceita = []) {
  const set = new Set();
  for (const l of lancamentosReceita) {
    const tipo = String(l?.referencia_tipo || "")
      .trim()
      .toLowerCase();
    if (tipo !== "pedidovenda") continue;
    const id = l?.referencia_id;
    if (id) set.add(String(id));
  }
  return set;
}

/**
 * @param {object} pedido
 * @param {object} opts
 * @param {object} opts.turno — TurnoCaixa
 * @param {{ id?: string } | null} opts.caixa — Conta do PDV (mesmo id que `turno.conta_caixa_pdv_id`)
 * @param {string[]} [opts.statusOk]
 * @param {Set<string>|null} [opts.pedidoIdsDasReceitasDoTurno]
 * @param {boolean} [opts.incluirRetrocompatSemTurno=true] — só turnos abertos / sem data de fechamento
 */
export function isPedidoVendaNoTurnoCaixa(pedido, opts) {
  const {
    turno,
    caixa,
    statusOk = STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA,
    pedidoIdsDasReceitasDoTurno = null,
    incluirRetrocompatSemTurno = true,
  } = opts || {};

  if (!pedido || !turno) return false;
  if (!statusOk.includes(pedido.status)) return false;

  if (String(pedido.turno_caixa_id ?? "") === String(turno.id ?? "")) return true;
  if (String(pedido.dados?.turno_caixa_id ?? "") === String(turno.id ?? "")) return true;

  const vendasIds = Array.isArray(turno.vendas_ids)
    ? turno.vendas_ids
    : Array.isArray(turno.dados?.vendas_ids)
      ? turno.dados.vendas_ids
      : [];
  const pid = pedido.id != null ? String(pedido.id) : "";
  if (pid && vendasIds.some((vid) => String(vid) === pid)) return true;

  if (pedidoIdsDasReceitasDoTurno?.size && pid && pedidoIdsDasReceitasDoTurno.has(pid)) {
    return true;
  }

  if (!incluirRetrocompatSemTurno) return false;
  if (turno.data_fechamento) return false;
  if (pedido.turno_caixa_id || pedido.dados?.turno_caixa_id) return false;

  const contaTurno = String(turno.conta_caixa_pdv_id ?? "");
  const contaCaixa = String(caixa?.id ?? "");
  if (!contaTurno || contaTurno !== contaCaixa) return false;

  const dataAbertura = turno.data_abertura ? new Date(turno.data_abertura) : null;
  const raw = pedido.updated_date || pedido.created_date;
  const tPed = raw ? new Date(raw) : null;
  if (!tPed || Number.isNaN(tPed.getTime())) return false;
  if (dataAbertura && !Number.isNaN(dataAbertura.getTime()) && tPed < dataAbertura) return false;

  return true;
}
