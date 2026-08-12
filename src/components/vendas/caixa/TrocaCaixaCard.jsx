import React from 'react';
import { Badge } from '@/components/ui/badge';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { p38Table } from '@/lib/p38TableSurfaces';
import { caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';
import { formatarDataHora } from '@/components/utils/dateUtils';
import { resolveResumoTrocaCaixa } from '@/lib/substituicoesVendaCaixa';
import { ConsultaProdutoRow } from '@/components/vendas/caixa/ConsultaProdutoRow';

function chipRetorno() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 mr-1.5 border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 align-middle"
    >
      Retorno
    </Badge>
  );
}

function chipLevou() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 mr-1.5 border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-300 align-middle"
    >
      Levou
    </Badge>
  );
}

export default function TrocaCaixaCard({ venda, meta, onVerDetalhes }) {
  const resumo = resolveResumoTrocaCaixa(venda, meta);
  const hora = venda.created_date ? formatarDataHora(venda.created_date).split(' ')[1] || '' : '';
  const linhas = [
    ...resumo.itensRetorno.map((item, idx) => ({
      key: `ret-${idx}`,
      kind: 'retorno',
      item,
      striped: idx % 2 === 1,
    })),
    ...resumo.itensLevou.map((item, idx) => ({
      key: `lev-${idx}`,
      kind: 'levou',
      item,
      striped: (resumo.itensRetorno.length + idx) % 2 === 1,
    })),
  ];

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onVerDetalhes?.(venda)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={`${p38Table.mobileLineTitle} truncate`}>{venda.numero}</p>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-300"
            >
              Troca
            </Badge>
            {resumo.devolucaoNumero && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-mono border-red-300 text-red-700 dark:border-red-700 dark:text-red-300"
              >
                {resumo.devolucaoNumero}
              </Badge>
            )}
            <FormaPagamentoBadges pagamentos={venda.pagamentos} size="xs" />
          </div>
          <p className={`${p38Table.mobileLineSubtitle} truncate`}>
            {venda.cliente_nome || 'Avulso'}
            {hora ? ` · ${hora}` : ''}
            {resumo.pedidoOrigem ? ` · origem ${resumo.pedidoOrigem}` : ''}
          </p>
        </div>
        <CaixaValorDisplay valor={resumo.entradaCaixa} tone="success" size="sm" />
      </button>

      {linhas.length > 0 && (
        <P38MobileLineList allViewports className="rounded-none border-0">
          {linhas.map(({ key, kind, item, striped }) => {
            const qtd = Number(item.quantidade) || 0;
            const unit = Number(item.preco_unitario) || 0;
            const total = Number(item.total) || unit * qtd;
            return (
              <ConsultaProdutoRow
                key={key}
                quantidade={qtd}
                unidade={item.unidade_medida || 'UN'}
                nome={item.produto_nome}
                valorTotal={kind === 'retorno' ? -Math.abs(total) : total}
                precoLista={unit}
                descontoUnitario={0}
                striped={striped}
                accent={kind === 'retorno' ? 'muted' : 'success'}
                nomePrefix={kind === 'retorno' ? chipRetorno() : chipLevou()}
              />
            );
          })}
        </P38MobileLineList>
      )}

      {resumo.creditoDevolucao > 0 && (
        <div className={`px-4 py-2.5 ${caixaTypo.meta}`}>
          <div className="flex justify-between gap-3">
            <span>Crédito do retorno</span>
            <span className="tabular-nums text-red-700 dark:text-red-400">
              − {formatCaixaR(resumo.creditoDevolucao)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
