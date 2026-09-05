import React from 'react';
import { Wallet } from 'lucide-react';
import ContaFinanceiraRow from './ContaFinanceiraRow';
import { FinanceiroGrupo, FinanceiroListaEstado } from './FinanceiroListaShared';
import { getSaldoExibicaoConta } from '@/lib/saldoContaFinanceira';

export default function ListaContasFinanceiras({
  grupos,
  loading,
  pendenciasMap = {},
  saldosCalculados = null,
  saldosProntos = false,
  onExtrato,
  onEdit,
  onAjuste,
  onConciliar,
}) {
  return (
    <FinanceiroListaEstado
      loading={loading}
      loadingMessage="Carregando contas e saldos…"
      vazio={!loading && grupos.length === 0}
      vazioMensagem="Nenhuma conta encontrada"
      vazioIcon={Wallet}
    >
      {grupos.map(({ k, label, items }) => {
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
            {items.map((conta, index) => (
              <ContaFinanceiraRow
                key={conta.id}
                conta={conta}
                pendencias={pendenciasMap[conta.id] || 0}
                saldosCalculados={saldosCalculados}
                saldosProntos={saldosProntos}
                striped={index % 2 === 1}
                onExtrato={onExtrato}
                onEdit={onEdit}
                onAjuste={onAjuste}
                onConciliar={onConciliar}
              />
            ))}
          </FinanceiroGrupo>
        );
      })}
    </FinanceiroListaEstado>
  );
}
