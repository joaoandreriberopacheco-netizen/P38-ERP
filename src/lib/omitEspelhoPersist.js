/** Campos espelho JSON — não gravar na entidade; linhas vivem em *Item (SQL). */
export const PEDIDO_COMPRA_ESPELHO_KEYS = ['itens', 'embarques_registrados'];

export const EMBARQUE_ESPELHO_KEYS = ['itens', 'itens_embarcados'];

export const PEDIDO_VENDA_ESPELHO_KEYS = ['itens'];

export const CONFERENCIA_ESPELHO_KEYS = ['itens_conferidos'];

export function omitKeys(obj = {}, keys = []) {
  const out = { ...obj };
  keys.forEach((k) => {
    delete out[k];
  });
  return out;
}

export function omitPedidoCompraEspelho(obj = {}) {
  return omitKeys(obj, PEDIDO_COMPRA_ESPELHO_KEYS);
}

export function omitEmbarqueEspelho(obj = {}) {
  return omitKeys(obj, EMBARQUE_ESPELHO_KEYS);
}

export function omitPedidoVendaEspelho(obj = {}) {
  return omitKeys(obj, PEDIDO_VENDA_ESPELHO_KEYS);
}

export function omitConferenciaEspelho(obj = {}) {
  return omitKeys(obj, CONFERENCIA_ESPELHO_KEYS);
}
