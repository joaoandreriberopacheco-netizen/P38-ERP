import React, { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaConsultaCard, caixaChipActive, caixaChipInactive, caixaChipTrack, caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { formatarDataHora } from '@/components/utils/dateUtils';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';
import TrocaCaixaCard from '@/components/vendas/caixa/TrocaCaixaCard';
import { ConsultaProdutoRow } from '@/components/vendas/caixa/ConsultaProdutoRow';
import VendaValorResumo from '@/components/vendas/caixa/VendaValorResumo';
import {
  partitionVendasConsultaCaixa,
} from '@/lib/substituicoesVendaCaixa';
import {
  isPagamentoMistoParaForma,
  valorFormaPagamentoNoPedido,
} from '@/lib/formasPagamentoCaixa';

function horaDaVenda(venda) {
  if (!venda?.created_date) return '';
  return formatarDataHora(venda.created_date).split(' ')[1] || '';
}

function parseNumeroComprovante(numero) {
  const digits = String(numero || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function aggregateByProduto(vendas) {
  const map = new Map();
  (vendas || []).forEach((venda) => {
    (venda.itens || []).forEach((item) => {
      const key = item.produto_id || item.produto_nome || 'sem-id';
      const qtd = Number(item.quantidade) || 0;
      const total = Number(item.total) || roundToTwoDecimals((Number(item.preco_unitario_praticado) || 0) * qtd);
      const prev = map.get(key) || {
        key,
        nome: item.produto_nome || 'Produto',
        unidade: item.unidade_medida || 'UN',
        quantidade: 0,
        total: 0,
      };
      prev.quantidade += qtd;
      prev.total = roundToTwoDecimals(prev.total + total);
      map.set(key, prev);
    });
  });
  return [...map.values()].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
}

function sortByComprovante(vendas) {
  return [...(vendas || [])].sort((a, b) => {
    const na = parseNumeroComprovante(a.numero);
    const nb = parseNumeroComprovante(b.numero);
    if (na !== nb) return na - nb;
    return String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR');
  });
}

function TrocaResumoLinha({ venda, meta }) {
  return <TrocaCaixaCard venda={venda} meta={meta} />;
}

export default function ConsultaVendasCaixa({
  vendasFinalizadas = [],
  metaPorPedidoId = {},
  contextLabel = 'Consulta do turno',
  emptyMessage = 'Nenhuma venda finalizada no turno',
  formaPagamentoKey = null,
  formaPagamentoLabel = null,
  totalFormaPagamento = null,
  forcarModoComprovante = false,
}) {
  const [modo, setModo] = useState('comprovante');
  const modoEfetivo = forcarModoComprovante || formaPagamentoKey ? 'comprovante' : modo;

  const { trocas, normais } = useMemo(
    () => partitionVendasConsultaCaixa(vendasFinalizadas, metaPorPedidoId),
    [vendasFinalizadas, metaPorPedidoId]
  );

  const produtosAgregados = useMemo(() => aggregateByProduto(normais), [normais]);
  const vendasOrdenadas = useMemo(() => sortByComprovante(normais), [normais]);
  const trocasOrdenadas = useMemo(() => sortByComprovante(trocas), [trocas]);

  const totalGeral = useMemo(() => {
    if (formaPagamentoKey && totalFormaPagamento != null) {
      return roundToTwoDecimals(totalFormaPagamento);
    }
    return roundToTwoDecimals(vendasFinalizadas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0));
  }, [vendasFinalizadas, formaPagamentoKey, totalFormaPagamento]);

  const totalTrocas = useMemo(
    () => roundToTwoDecimals(trocas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0)),
    [trocas]
  );

  if (vendasFinalizadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Receipt className="w-10 h-10 text-muted-foreground mb-3" />
        <p className={caixaTypo.meta}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className={caixaTypo.labelSm}>{contextLabel}</p>
          <CaixaValorDisplay valor={totalGeral} tone="success" size="lg" />
          <p className={`${caixaTypo.meta} mt-1`}>
            {normais.length} venda{normais.length === 1 ? '' : 's'}
            {trocas.length > 0
              ? ` · ${trocas.length} troca${trocas.length === 1 ? '' : 's'} (${formatCaixaR(totalTrocas)} no caixa)`
              : ''}
          </p>
        </div>
        {!forcarModoComprovante && (
          <div className={`flex rounded-2xl p-1 gap-1 ${caixaChipTrack}`}>
            <button
              type="button"
              onClick={() => setModo('produto')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'produto' ? caixaChipActive : caixaChipInactive}`}
            >
              Por produto
            </button>
            <button
              type="button"
              onClick={() => setModo('comprovante')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'comprovante' ? caixaChipActive : caixaChipInactive}`}
            >
              Por comprovante
            </button>
          </div>
        )}
      </div>

      {modoEfetivo === 'produto' ? (
        <div className="space-y-4">
          {trocasOrdenadas.length > 0 && (
            <div className="space-y-2">
              <p className={`${caixaTypo.labelSm} px-1`}>
                Trocas ({trocasOrdenadas.length})
              </p>
              <div className="space-y-2">
                {trocasOrdenadas.map((venda) => (
                  <TrocaResumoLinha
                    key={venda.id}
                    venda={venda}
                    meta={metaPorPedidoId[venda.id]}
                  />
                ))}
              </div>
            </div>
          )}
          {produtosAgregados.length > 0 ? (
            <div className="space-y-2">
              {trocasOrdenadas.length > 0 && (
                <p className={`${caixaTypo.labelSm} px-1`}>Vendas por produto</p>
              )}
              <P38MobileLineList allViewports className="rounded-lg">
                {produtosAgregados.map((p, index) => (
                  <ConsultaProdutoRow
                    key={p.key}
                    quantidade={p.quantidade}
                    unidade={p.unidade}
                    nome={p.nome}
                    valorTotal={p.total}
                    striped={index % 2 === 1}
                  />
                ))}
              </P38MobileLineList>
            </div>
          ) : trocasOrdenadas.length > 0 ? (
            <p className={`${caixaTypo.meta} px-1`}>Sem vendas normais no turno — apenas trocas.</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {trocasOrdenadas.length > 0 && (
            <div className="space-y-3">
              <p className={`${caixaTypo.labelSm} px-1`}>
                Trocas ({trocasOrdenadas.length})
              </p>
              {trocasOrdenadas.map((venda) => (
                <TrocaCaixaCard
                  key={venda.id}
                  venda={venda}
                  meta={metaPorPedidoId[venda.id]}
                />
              ))}
            </div>
          )}
          {vendasOrdenadas.length > 0 && (
            <div className="space-y-3">
              {trocasOrdenadas.length > 0 && (
                <p className={`${caixaTypo.labelSm} px-1`}>Vendas ({vendasOrdenadas.length})</p>
              )}
              {vendasOrdenadas.map((venda) => {
                const pagamentoMisto = formaPagamentoKey
                  ? isPagamentoMistoParaForma(venda, formaPagamentoKey)
                  : false;
                const valorForma = formaPagamentoKey && pagamentoMisto
                  ? valorFormaPagamentoNoPedido(venda, formaPagamentoKey)
                  : null;
                const hora = horaDaVenda(venda);

                return (
                <div key={venda.id} className={caixaConsultaCard}>
                  <div className="w-full flex items-start justify-between gap-2 px-4 py-3 border-b border-border/40 dark:border-white/10 overflow-visible">
                    <div className="min-w-0 flex-1">
                      <p className={`${p38Table.mobileLineTitle} flex items-center gap-1.5 min-w-0`}>
                        <span className="truncate">{venda.numero}</span>
                        {hora ? (
                          <span className={`${p38Table.mobileLineSubtitle} shrink-0`}>
                            · {hora}
                          </span>
                        ) : null}
                      </p>
                      <p className={`${p38Table.mobileLineSubtitle} truncate`}>
                        {venda.cliente_nome || 'Avulso'}
                      </p>
                      <FormaPagamentoBadges pagamentos={venda.pagamentos} className="mt-1.5" size="xs" />
                    </div>
                    <VendaValorResumo
                      venda={venda}
                      size="sm"
                      valorDestaque={valorForma}
                      formaPagamentoLabel={formaPagamentoLabel}
                      pagamentoMisto={pagamentoMisto}
                    />
                  </div>
                  <P38MobileLineList allViewports className="rounded-none border-0 overflow-hidden rounded-b-2xl">
                    {(venda.itens || []).map((item, idx) => (
                      <ConsultaProdutoRow
                        key={`${venda.id}-${idx}`}
                        quantidade={item.quantidade}
                        unidade={item.unidade_medida}
                        nome={item.produto_nome}
                        valorTotal={item.total || (Number(item.preco_unitario_praticado) || 0) * (Number(item.quantidade) || 0)}
                        precoLista={item.preco_unitario_praticado}
                        descontoUnitario={item.desconto_unitario}
                        striped={idx % 2 === 1}
                        accent="muted"
                      />
                    ))}
                  </P38MobileLineList>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
