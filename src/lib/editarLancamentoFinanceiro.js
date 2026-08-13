import { base44 as defaultClient } from '@/api/base44Client';
import { dataHoje, datetimeLocalParaISO, vencimentoComMesmoDiaNoMes } from '@/components/utils/dateUtils';
import { lancamentoMesmoRamoRecorrencia } from '@/lib/agefinLancamentosRecorrencia';
import {
  ordemLancamentoFoiPersistida,
  prepararPayloadOrdemLancamento,
  resolverDataLancamentoInput,
} from '@/lib/lancamentoOrdemMeta';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { sincronizarSaldosAposAlteracao } from '@/lib/sincronizarSaldoContasFinanceiras';
import { normalizeDataText } from '@/lib/normalizeDataText';
import { lancamentoEhValeFolha, sincronizarValeFolhaComLancamento } from '@/lib/folhaValeFluxo';

function loteRecorrenciaAmbiguo(lancamento, grupo) {
  const refAtual = lancamento.referencia_id || '';
  const grupoId = lancamento.grupo_lancamento_id || '';
  const competenciaAtual = (lancamento.data_vencimento || '').slice(0, 7);
  const mesmaCompetencia = (grupo || []).filter(
    (l) =>
      (l.data_vencimento || '').slice(0, 7) === competenciaAtual &&
      l.id !== lancamento.id &&
      l.status !== 'Cancelado',
  );
  if (!mesmaCompetencia.length) return false;
  if (!refAtual || refAtual === grupoId) return true;
  return mesmaCompetencia.some(
    (l) => (l.referencia_id || '') !== refAtual || (l.referencia_tipo || '') !== (lancamento.referencia_tipo || ''),
  );
}

function buildMetaPayload(lancamento, dataLancamentoInput, tags = []) {
  const original = resolverDataLancamentoInput(lancamento);
  if (!dataLancamentoInput || dataLancamentoInput === original) return {};
  const payload = prepararPayloadOrdemLancamento({
    dataLancamento: datetimeLocalParaISO(dataLancamentoInput),
    tags: tags.length ? tags : lancamento.tags,
  });
  return payload || {};
}

/**
 * Persiste alterações de um lançamento existente (espelha regras do detalhe legado).
 */
export async function salvarEdicaoLancamentoFinanceiro({
  base44 = defaultClient,
  lancamento,
  contas,
  descricao,
  valorNumerico,
  dataVencimento,
  observacoes = '',
  categoria,
  categoriaId,
  centroCusto = '',
  centroCustoId = '',
  tags,
  contaId,
  realizado,
  dataPagamento,
  dataLancamentoInput,
  escopoCadastro = 'apenas_esta',
  escopoPagamento = 'apenas_esta',
}) {
  const isPagoOriginal = isLancamentoPago(lancamento);
  const isCartaoReceber =
    lancamento.tipo === 'Receita' &&
    ['Cartão Débito', 'Cartão Crédito'].includes(lancamento.forma_pagamento_tipo);
  const valorLiquidoOriginal = parseFloat(lancamento.valor_liquido ?? lancamento.valor) || 0;
  const proporcaoLiquida = (lancamento.valor || 0) > 0 ? valorLiquidoOriginal / lancamento.valor : 1;
  const houveAlteracaoValor = Math.abs(valorNumerico - (parseFloat(lancamento.valor) || 0)) > 0.009;

  const venAtual = (dataVencimento || '').slice(0, 10) || (lancamento.data_vencimento || '').slice(0, 10);
  const descricaoNorm = normalizeDataText((descricao || '').trim()) || lancamento.descricao;
  const cadastroPayload = {
    descricao: descricaoNorm,
    valor: valorNumerico,
    valor_liquido: isCartaoReceber
      ? parseFloat((valorNumerico * proporcaoLiquida).toFixed(2))
      : valorNumerico,
    observacoes: normalizeDataText(observacoes || ''),
    data_vencimento: venAtual,
    categoria: normalizeDataText(categoria),
    categoria_id: categoriaId || '',
    centro_custo: normalizeDataText(centroCusto || ''),
    centro_custo_id: centroCustoId || '',
    tags: tags || [],
  };

  const cadastroDirty =
    (lancamento.descricao || '').trim() !== descricaoNorm ||
    Math.abs((parseFloat(lancamento.valor) || 0) - valorNumerico) > 0.009 ||
    (lancamento.data_vencimento || '').slice(0, 10) !== venAtual ||
    (lancamento.observacoes || '') !== cadastroPayload.observacoes ||
    (lancamento.categoria || '') !== cadastroPayload.categoria ||
    (lancamento.centro_custo || '') !== cadastroPayload.centro_custo ||
    (lancamento.centro_custo_id || '') !== cadastroPayload.centro_custo_id ||
    JSON.stringify(lancamento.tags || []) !== JSON.stringify(tags || []);

  const conta = contas.find((c) => c.id === contaId);
  const pagamentoPayload = (() => {
    if (realizado && !isPagoOriginal) {
      return {
        status: 'Pago',
        data_pagamento: dataPagamento || dataHoje(),
        status_conciliacao: 'Pendente',
        conta_financeira_id: contaId,
        conta_financeira_nome: conta?.nome,
      };
    }
    if (!realizado && isPagoOriginal) {
      return { status: 'Em Aberto', data_pagamento: null };
    }
    if (realizado && isPagoOriginal) {
      return {
        data_pagamento: dataPagamento || lancamento.data_pagamento || dataHoje(),
        conta_financeira_id: contaId,
        conta_financeira_nome: conta?.nome,
      };
    }
    return {};
  })();

  const pagamentoDirty =
    realizado !== isPagoOriginal ||
    (realizado && (dataPagamento || dataHoje()) !== (lancamento.data_pagamento || dataHoje())) ||
    (realizado && contaId !== (lancamento.conta_financeira_id || ''));

  const metaPayload = buildMetaPayload(lancamento, dataLancamentoInput, tags || []);
  const baseUpdate = {
    ...(cadastroDirty ? cadastroPayload : {}),
    ...pagamentoPayload,
    ...metaPayload,
  };

  if (Object.keys(baseUpdate).length === 0) {
    return { updated: lancamento, changed: false };
  }

  const svc = base44.entities.LancamentoFinanceiro;

  if (
    pagamentoDirty &&
    lancamento.is_recorrente &&
    lancamento.grupo_lancamento_id &&
    escopoPagamento !== 'apenas_esta' &&
    realizado &&
    !isPagoOriginal
  ) {
    const grupo = await svc.filter({ grupo_lancamento_id: lancamento.grupo_lancamento_id });
    if (loteRecorrenciaAmbiguo(lancamento, grupo)) {
      throw new Error('Conta parecida na mesma competência. Use "apenas esta" para evitar atualização indevida.');
    }
    const hStr = lancamento.data_vencimento || '';
    const alvos = grupo
      .filter((l) => {
        if (l.status === 'Pago') return false;
        if (escopoPagamento === 'todas') return true;
        if (escopoPagamento === 'futuras') return (l.data_vencimento || '') >= hStr;
        if (escopoPagamento === 'passadas') return (l.data_vencimento || '') <= hStr;
        return false;
      })
      .filter((l) => lancamentoMesmoRamoRecorrencia(lancamento, l));
    for (const l of alvos) {
      await svc.update(l.id, {
        status: 'Pago',
        data_pagamento: dataPagamento || dataHoje(),
        status_conciliacao: 'Pendente',
        conta_financeira_id: contaId,
        conta_financeira_nome: conta?.nome,
        ...(l.id === lancamento.id ? metaPayload : {}),
      });
      if (lancamentoEhValeFolha(l)) {
        try {
          await sincronizarValeFolhaComLancamento({
            ...l,
            status: 'Pago',
            data_pagamento: dataPagamento || dataHoje(),
            conta_financeira_id: contaId,
            conta_financeira_nome: conta?.nome,
          });
        } catch {
          /* não bloqueia pagamento */
        }
      }
    }
    await sincronizarSaldosAposAlteracao(base44, [contaId, ...alvos.map((l) => l.conta_financeira_id)]);
    const updated = alvos.find((l) => l.id === lancamento.id) || lancamento;
    return { updated, changed: true, batchCount: alvos.length };
  }

  if (cadastroDirty && lancamento.is_recorrente && lancamento.grupo_lancamento_id && escopoCadastro !== 'apenas_esta') {
    const grupo = await svc.filter({ grupo_lancamento_id: lancamento.grupo_lancamento_id });
    if (loteRecorrenciaAmbiguo(lancamento, grupo)) {
      throw new Error('Há contas parecidas nesta competência. Para segurança, guarde só esta conta.');
    }
    const hStr = (lancamento.data_vencimento || '').slice(0, 10);
    const alvos = (grupo || [])
      .filter((l) => {
        if (l.status === 'Pago') return false;
        if (escopoCadastro === 'todas') return true;
        if (escopoCadastro === 'futuras') return (l.data_vencimento || '').slice(0, 10) >= hStr;
        return false;
      })
      .filter((l) => lancamentoMesmoRamoRecorrencia(lancamento, l));

    for (const l of alvos) {
      const novaData =
        l.id === lancamento.id
          ? cadastroPayload.data_vencimento
          : vencimentoComMesmoDiaNoMes(dataVencimento || l.data_vencimento, l.data_vencimento);
      await svc.update(l.id, {
        ...cadastroPayload,
        ...(l.id === lancamento.id ? metaPayload : {}),
        data_vencimento: novaData,
      });
    }
    const updated = alvos.find((l) => l.id === lancamento.id) || lancamento;
    return { updated, changed: true, batchCount: alvos.length };
  }

  let updated = await svc.update(lancamento.id, baseUpdate);
  if (metaPayload.codigo_lancamento && !ordemLancamentoFoiPersistida(updated, metaPayload.codigo_lancamento)) {
    updated = await svc.update(lancamento.id, { tags: metaPayload.tags });
  }
  if (pagamentoDirty || houveAlteracaoValor) {
    await sincronizarSaldosAposAlteracao(base44, [contaId, lancamento.conta_financeira_id]);
  }
  if (lancamentoEhValeFolha(updated || lancamento)) {
    try {
      await sincronizarValeFolhaComLancamento(updated || { ...lancamento, ...baseUpdate });
    } catch {
      /* não bloqueia edição do lançamento */
    }
  }
  return { updated, changed: true };
}

export function precisaEscopoRecorrenciaPagamento(lancamento, realizado) {
  return (
    !!lancamento?.is_recorrente &&
    !!lancamento?.grupo_lancamento_id &&
    realizado &&
    !isLancamentoPago(lancamento)
  );
}

export function precisaEscopoRecorrenciaCadastro(lancamento) {
  return !!lancamento?.is_recorrente && !!lancamento?.grupo_lancamento_id;
}
