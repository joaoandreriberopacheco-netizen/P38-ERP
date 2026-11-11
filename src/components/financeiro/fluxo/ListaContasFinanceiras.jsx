import React from 'react';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import ContaFinanceiraRow from './ContaFinanceiraRow';
import { FinanceiroGrupo, FinanceiroListaEstado } from './FinanceiroListaShared';
import { P38_EXTRATO_V8_DAY_CARD, P38_FIELD_SURFACE } from './financeiroP38';
import { getSaldoExibicaoConta } from '@/lib/saldoContaFinanceira';

function renderContaRows({
  items,
  pendenciasMap,
  saldosCalculados,
  saldosProntos,
  onExtrato,
  onEdit,
  onAjuste,
  onConciliar,
  listaUnificada = false,
  extratoMobile = false,
}) {
  return items.map((conta, index) => (
    <ContaFinanceiraRow
      key={conta.id}
      conta={conta}
      pendencias={pendenciasMap[conta.id] || 0}
      saldosCalculados={saldosCalculados}
      saldosProntos={saldosProntos}
      striped={index % 2 === 1}
      listaUnificada={listaUnificada}
      extratoMobile={extratoMobile}
      onExtrato={onExtrato}
      onEdit={onEdit}
      onAjuste={onAjuste}
      onConciliar={onConciliar}
    />
  ));
}

export default function ListaContasFinanceiras({
  grupos,
  contasFlat = null,
  loading,
  pendenciasMap = {},
  saldosCalculados = null,
  saldosProntos = false,
  onExtrato,
  onEdit,
  onAjuste,
  onConciliar,
  extratoMobile = false,
}) {
  const listaUnificada = Array.isArray(contasFlat);
  const vazio = !loading && (listaUnificada ? contasFlat.length === 0 : grupos.length === 0);

  return (
    <FinanceiroListaEstado
      loading={loading}
      loadingMessage="Carregando contas e saldos…"
      vazio={vazio}
      vazioMensagem="Nenhuma conta encontrada"
      vazioIcon={Wallet}
      flushBottom={listaUnificada}
    >
      {listaUnificada ? (
        extratoMobile ? (
          <div className={cn('min-w-0 w-full max-w-full overflow-hidden', P38_EXTRATO_V8_DAY_CARD)}>
            {renderContaRows({
              items: contasFlat,
              pendenciasMap,
              saldosCalculados,
              saldosProntos,
              onExtrato,
              onEdit,
              onAjuste,
              onConciliar,
              listaUnificada: true,
              extratoMobile: true,
            })}
          </div>
        ) : (
          <P38MobileLineList
            allViewports
            className={cn(
              'min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-border/50 dark:border-white/10',
              P38_FIELD_SURFACE,
            )}
          >
            {renderContaRows({
              items: contasFlat,
              pendenciasMap,
              saldosCalculados,
              saldosProntos,
              onExtrato,
              onEdit,
              onAjuste,
              onConciliar,
              listaUnificada: true,
            })}
          </P38MobileLineList>
        )
      ) : grupos.map(({ k, label, items }) => {
        const totalGrupo = saldosProntos && saldosCalculados
          ? items.reduce(
            (acc, c) => acc + getSaldoExibicaoConta(c, saldosCalculados),
            0,
          )
          : null;
        const positivo = (totalGrupo ?? 0) >= 0;

        return (
          <FinanceiroGrupo
            key={k}
            label={label}
            receitas={saldosProntos && totalGrupo != null ? (positivo ? totalGrupo : 0) : 0}
            despesas={saldosProntos && totalGrupo != null ? (positivo ? 0 : Math.abs(totalGrupo)) : 0}
            ocultarTotais={!saldosProntos}
            card
          >
            {renderContaRows({
              items,
              pendenciasMap,
              saldosCalculados,
              saldosProntos,
              onExtrato,
              onEdit,
              onAjuste,
              onConciliar,
            })}
          </FinanceiroGrupo>
        );
      })}
    </FinanceiroListaEstado>
  );
}
