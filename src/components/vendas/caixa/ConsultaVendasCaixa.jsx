import React, { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import CaixaValorDisplay, { formatCaixaR } from '@/components/vendas/caixa/CaixaValorDisplay';
import { caixaTypo } from '@/lib/caixaP38Theme';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { formatCommercialQuantity } from '@/lib/productUnits';
import { formatarDataHora } from '@/components/utils/dateUtils';
import FormaPagamentoBadges from '@/components/vendas/FormaPagamentoBadges';
import TrocaCaixaCard from '@/components/vendas/caixa/TrocaCaixaCard';
import {
  partitionVendasConsultaCaixa,
} from '@/lib/substituicoesVendaCaixa';

/** Coluna Qtd (cima) + Un (baixo) + barra vertical — como relatório de compras / margem mobile */
function ConsultaQtdUnCol({ qtd, unidade, accent = 'success' }) {
  const dotClass = accent === 'muted' ? p38Accent.muted.dot : p38Table.accentDot;
  return (
    <div className="relative w-[3.25rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1.5 py-2.5 text-right">
      <span className={`absolute left-0 top-3 ${dotClass}`} aria-hidden />
      <p className="text-base font-din-1451 tabular-nums text-foreground leading-none">
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={`${caixaTypo.labelSm} mt-1.5 leading-none truncate`}>
        {(unidade || 'UN').toUpperCase()}
      </p>
    </div>
  );
}

function resolvePrecoUnitarioEfetivo({ quantidade, total, precoLista, descontoUnitario }) {
  const qtd = Number(quantidade) || 0;
  const totalNum = Number(total);
  if (qtd > 0 && Number.isFinite(totalNum)) {
    return roundToTwoDecimals(totalNum / qtd);
  }
  const preco = Number(precoLista) || 0;
  const desconto = Number(descontoUnitario) || 0;
  return roundToTwoDecimals(preco - desconto);
}

function ConsultaProdutoRow({
  quantidade,
  unidade,
  nome,
  valorTotal,
  precoLista,
  descontoUnitario,
  striped = false,
  accent = 'success',
  hideValor = false,
}) {
  const borderClass = accent === 'muted' ? p38Accent.muted.border : p38Accent.success.border;
  const precoEfetivo = resolvePrecoUnitarioEfetivo({
    quantidade,
    total: valorTotal,
    precoLista,
    descontoUnitario,
  });
  const precoTabela = Number(precoLista) || 0;
  const temDesconto = precoTabela > precoEfetivo + 0.009;

  return (
    <div
      className={cn(
        p38Table.mobileLineThin,
        borderClass,
        'flex min-w-0',
        striped && 'bg-secondary/15 dark:bg-secondary/20',
      )}
    >
      <ConsultaQtdUnCol qtd={quantidade} unidade={unidade} accent={accent} />
      <div className="flex-1 min-w-0 py-2 pr-3 pl-2">
        <p className={cn(p38Table.mobileLineTitle, 'line-clamp-3 leading-snug')}>{nome}</p>
        <div className="flex items-baseline justify-between gap-3 mt-1">
          <p className={`${caixaTypo.meta} normal-case tabular-nums min-w-0`}>
            {temDesconto && (
              <span className="line-through text-muted-foreground/70 mr-1.5">
                {formatCaixaR(precoTabela)}
              </span>
            )}
            <span className="text-foreground/90">{formatCaixaR(precoEfetivo)} un.</span>
          </p>
          {!hideValor && (
            <div className="shrink-0">
              <CaixaValorDisplay
                valor={valorTotal}
                tone={accent === 'muted' ? 'neutral' : 'success'}
                signed={accent !== 'muted'}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

function TrocaResumoLinha({ venda, meta, onVerDetalhes }) {
  return <TrocaCaixaCard venda={venda} meta={meta} onVerDetalhes={onVerDetalhes} />;
}

export default function ConsultaVendasCaixa({
  vendasFinalizadas = [],
  metaPorPedidoId = {},
  onVerDetalhes,
  contextLabel = 'Consulta do turno',
  emptyMessage = 'Nenhuma venda finalizada no turno',
}) {
  const [modo, setModo] = useState('produto');

  const { trocas, normais } = useMemo(
    () => partitionVendasConsultaCaixa(vendasFinalizadas, metaPorPedidoId),
    [vendasFinalizadas, metaPorPedidoId]
  );

  const produtosAgregados = useMemo(() => aggregateByProduto(normais), [normais]);
  const vendasOrdenadas = useMemo(() => sortByComprovante(normais), [normais]);
  const trocasOrdenadas = useMemo(() => sortByComprovante(trocas), [trocas]);

  const totalGeral = useMemo(
    () => roundToTwoDecimals(vendasFinalizadas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0)),
    [vendasFinalizadas]
  );

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
        <div className="flex rounded-2xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => setModo('produto')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'produto' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por produto
          </button>
          <button
            type="button"
            onClick={() => setModo('comprovante')}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl ${caixaTypo.tab} transition-colors ${modo === 'comprovante' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Por comprovante
          </button>
        </div>
      </div>

      {modo === 'produto' ? (
        <div className="space-y-4">
          {trocasOrdenadas.length > 0 && (
            <div className="space-y-2">
              <p className={`${caixaTypo.labelSm} px-1 text-amber-800 dark:text-amber-300`}>
                Trocas — entrada no caixa ({trocasOrdenadas.length})
              </p>
              <div className="space-y-2">
                {trocasOrdenadas.map((venda) => (
                  <TrocaResumoLinha
                    key={venda.id}
                    venda={venda}
                    meta={metaPorPedidoId[venda.id]}
                    onVerDetalhes={onVerDetalhes}
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
              <p className={`${caixaTypo.labelSm} px-1 text-amber-800 dark:text-amber-300`}>
                Trocas — entrada no caixa ({trocasOrdenadas.length})
              </p>
              {trocasOrdenadas.map((venda) => (
                <TrocaCaixaCard
                  key={venda.id}
                  venda={venda}
                  meta={metaPorPedidoId[venda.id]}
                  onVerDetalhes={onVerDetalhes}
                />
              ))}
            </div>
          )}
          {vendasOrdenadas.length > 0 && (
            <div className="space-y-3">
              {trocasOrdenadas.length > 0 && (
                <p className={`${caixaTypo.labelSm} px-1`}>Vendas ({vendasOrdenadas.length})</p>
              )}
              {vendasOrdenadas.map((venda) => (
                <div key={venda.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onVerDetalhes?.(venda)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className={`${p38Table.mobileLineTitle} truncate`}>{venda.numero}</p>
                      <p className={`${p38Table.mobileLineSubtitle} truncate`}>
                        {venda.cliente_nome || 'Avulso'}
                        {venda.created_date ? ` · ${formatarDataHora(venda.created_date).split(' ')[1] || ''}` : ''}
                      </p>
                      <FormaPagamentoBadges pagamentos={venda.pagamentos} className="mt-1.5" size="xs" />
                    </div>
                    <CaixaValorDisplay valor={venda.valor_total} tone="success" size="sm" />
                  </button>
                  <P38MobileLineList allViewports className="rounded-none border-0">
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
