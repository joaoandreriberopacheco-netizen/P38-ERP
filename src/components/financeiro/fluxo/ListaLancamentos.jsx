import React from 'react';
import { Scale } from 'lucide-react';
import FinanceiroLancRow from './FinanceiroLancRow';
import { FinanceiroGrupo, FinanceiroListaEstado } from './FinanceiroListaShared';
import { P38_EXTRATO_V8_DAY_LIST_GAP } from './financeiroP38';

export default function ListaLancamentos({
  grupos,
  loading,
  onRow,
  emSelecao = false,
  selecionados = [],
  onToggleSelecionado,
  extratoMobile = false,
  contasSel = null,
}) {
  return (
    <FinanceiroListaEstado
      loading={loading}
      vazio={!loading && grupos.length === 0}
      vazioMensagem="Nenhum lançamento encontrado"
      vazioIcon={Scale}
      listClassName={extratoMobile ? P38_EXTRATO_V8_DAY_LIST_GAP : undefined}
    >
      {grupos.map(({ k, label, items, totais = {} }) => (
        <FinanceiroGrupo
          key={k}
          grupoKey={k}
          label={label}
          balancoDia={!extratoMobile}
          extratoV8={extratoMobile}
          receitas={totais.entrou ?? totais.r ?? 0}
          despesas={totais.saiu ?? totais.d ?? 0}
          liquido={totais.liquidoOperacional ?? totais.liquido ?? 0}
          saldoAcumulado={totais.saldoAcumulado}
        >
          {items.map((l, index) => (
            <FinanceiroLancRow
              key={l.id}
              l={l}
              onClick={onRow}
              striped={index % 2 === 1}
              dimProgramada={!!l._isProgramada}
              dataField={l._isProgramada ? 'vencimento' : 'auto'}
              emSelecao={emSelecao && !!l._isProgramada}
              selecionado={selecionados.includes(l.id)}
              onToggleSelecionado={onToggleSelecionado}
              extratoMobile={extratoMobile}
              contasSel={contasSel}
            />
          ))}
        </FinanceiroGrupo>
      ))}
    </FinanceiroListaEstado>
  );
}
