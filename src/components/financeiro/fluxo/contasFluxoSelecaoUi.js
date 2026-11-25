import {
  contasIdsFiltroFluxoPadrao,
  contasSelEfetivoFluxo,
  contasSelModoTodasContas,
} from '@/lib/filtroDataFinanceiro';

/** Estado UI do filtro/seletor de contas no Fluxo (`[]` = padrão operacional). */
export function contaMarcadaNoFluxo(id, contasSel = [], contasPicker = []) {
  const efetivos = new Set(contasSelEfetivoFluxo(contasSel, contasPicker));
  return efetivos.has(id);
}

export function selecaoContasFluxoEhPadrao(contasSel = [], contasPicker = []) {
  if (!contasSel?.length) return true;
  const padrao = new Set(contasIdsFiltroFluxoPadrao(contasPicker));
  if (contasSel.length !== padrao.size) return false;
  return contasSel.every((id) => padrao.has(id));
}

export function selecaoContasFluxoEhTodas(contasSel = [], contasAtivas = []) {
  return contasSelModoTodasContas(contasSel, contasAtivas);
}

export function filtroContasFluxoAtivo(contasSel = [], contasPicker = [], contasAtivas = []) {
  if (selecaoContasFluxoEhPadrao(contasSel, contasPicker)) return false;
  if (selecaoContasFluxoEhTodas(contasSel, contasAtivas)) return false;
  return true;
}

export function toggleContaFluxoSelecao(id, contasSel = [], contasPicker = []) {
  const padrao = contasIdsFiltroFluxoPadrao(contasPicker);
  const allPickerIds = contasPicker.map((c) => c.id);
  const efetivos = contasSelEfetivoFluxo(contasSel, contasPicker);
  const setEf = new Set(efetivos);
  const base = contasSel?.length ? [...contasSel] : [...padrao];

  if (setEf.has(id)) {
    const next = base.filter((x) => x !== id);
    if (!next.length) return [];
    const padraoSet = new Set(padrao);
    if (next.length === padraoSet.size && next.every((x) => padraoSet.has(x))) return [];
    return next;
  }

  const next = [...new Set([...base, id])];
  if (next.length >= allPickerIds.length) return allPickerIds;
  return next;
}

export function marcarPadraoContasFluxo() {
  return [];
}

export function marcarTodasContasFluxo(contasAtivas = []) {
  return (contasAtivas || []).filter((c) => c?.ativo !== false).map((c) => c.id);
}
