import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Camera, CheckCircle2, FileText, FolderOpen, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceiroListaEstado } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import {
  P38_ACCENT,
  P38_FIELD_SURFACE,
  P38_FILTROS_STICKY,
  P38_KPI_SHELL,
} from '@/components/financeiro/fluxo/financeiroP38';
import { cn } from '@/lib/utils';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
  p38StatusTone,
} from '@/components/ui/p38-mobile-line';
import {
  COTACAO_STATUS_ANALISE,
  COTACAO_STATUS_RASCUNHO,
  cotacaoAccent,
  isCotacaoAberta,
  isCotacaoConcluida,
} from '@/lib/cotacaoExpressUtils';

function CotacaoExpressFab({ onNovaCotacao, onImportarFoto, criando }) {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 bottom-[var(--p38-scroll-pad-below-nav)] transition-[bottom] duration-300 ease-out desktop-layout:bottom-6 lg:right-8">
      {fabOpen && (
        <div className="mb-2 flex w-[min(calc(100vw-1.5rem),16.5rem)] flex-col items-stretch gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="justify-center rounded-full shadow-md"
            onClick={() => {
              setFabOpen(false);
              onImportarFoto();
            }}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Importar lista (OCR)
          </Button>
          <Button
            size="sm"
            className="justify-center rounded-full shadow-md"
            onClick={() => {
              setFabOpen(false);
              onNovaCotacao();
            }}
            disabled={criando}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nova cotação
          </Button>
        </div>
      )}
      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        onClick={() => setFabOpen((v) => !v)}
        aria-label={fabOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}

export default function CotacaoExpressHub({
  cotacoes = [],
  loading = false,
  hubView,
  onHubViewChange,
  onNovaCotacao,
  onImportarFoto,
  onAbrirCotacao,
  onExcluirCotacao,
  criando = false,
}) {
  const [busca, setBusca] = useState('');

  const abertas = useMemo(
    () => cotacoes.filter((c) => isCotacaoAberta(c.status)),
    [cotacoes],
  );
  const concluidas = useMemo(
    () => cotacoes.filter((c) => isCotacaoConcluida(c.status)),
    [cotacoes],
  );

  const rascunhos = abertas.filter((c) => c.status === COTACAO_STATUS_RASCUNHO);
  const emDisputa = abertas.filter((c) => c.status === COTACAO_STATUS_ANALISE);
  const totalItensAbertas = abertas.reduce((s, c) => s + (c.itens?.length || 0), 0);

  const listaBase = hubView === 'abertas' ? abertas : concluidas;
  const lista = useMemo(() => {
    if (!busca.trim()) return listaBase;
    const q = busca.toLowerCase();
    return listaBase.filter(
      (c) =>
        c.titulo?.toLowerCase().includes(q)
        || c.numero?.toLowerCase().includes(q),
    );
  }, [listaBase, busca]);

  const chips = [];
  if (rascunhos.length > 0) {
    chips.push(
      <FinanceiroSummaryChip key="rasc" className="text-muted-foreground">
        {rascunhos.length} em montagem
      </FinanceiroSummaryChip>,
    );
  }
  if (emDisputa.length > 0) {
    chips.push(
      <FinanceiroSummaryChip key="disp" className="text-cyan-800 dark:text-cyan-300">
        {emDisputa.length} em disputa
      </FinanceiroSummaryChip>,
    );
  }
  if (concluidas.length > 0) {
    chips.push(
      <FinanceiroSummaryChip key="conc" className="text-emerald-800 dark:text-emerald-300">
        {concluidas.length} concluída{concluidas.length !== 1 ? 's' : ''}
      </FinanceiroSummaryChip>,
    );
  }

  return (
    <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto pb-[calc(6.5rem+var(--p38-bottom-nav-total,0px))] md:pb-24">
      <div className={cn(P38_KPI_SHELL, 'space-y-2.5 sm:space-y-3 min-w-0')}>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Monte a lista · Dispute preços · Aprove e gere pedido de compra
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 rounded-xl px-2"
            onClick={onImportarFoto}
            title="Importar lista por OCR"
          >
            <Camera className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">OCR lista</span>
          </Button>
          <Button
            size="sm"
            className="h-10 gap-1.5 rounded-xl px-2"
            onClick={onNovaCotacao}
            disabled={criando}
            title="Nova cotação"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Nova</span>
          </Button>
        </div>

        <div className="space-y-2 border-t border-border/40 pt-2.5 sm:pt-3 min-w-0">
          <div className="rounded-xl bg-secondary/30 px-3 py-3 dark:bg-[#383e47]/40 sm:px-4 sm:py-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              Cotações abertas
            </p>
            <p
              className={cn(
                'mt-1 font-semibold tabular-nums leading-none tracking-tight',
                'text-[clamp(1.375rem,5.5vw,1.875rem)]',
                P38_ACCENT,
              )}
            >
              {abertas.length}
            </p>
            {totalItensAbertas > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {totalItensAbertas} produto{totalItensAbertas !== 1 ? 's' : ''} em cotação
              </p>
            )}
          </div>
          <FinanceiroListaMeta
            total={lista.length}
            totalLabel={lista.length === 1 ? 'cotação' : 'cotações'}
            summaryChips={chips}
            hasActiveFilters={Boolean(busca.trim())}
            onLimparFiltros={() => setBusca('')}
          />
        </div>
      </div>

      <Tabs value={hubView} onValueChange={onHubViewChange} className="w-full">
        <TabsList
          className={cn(
            'grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 md:flex md:flex-wrap',
            P38_FIELD_SURFACE,
          )}
        >
          <TabsTrigger
            value="abertas"
            className="min-h-[40px] min-w-0 gap-1.5 rounded-lg px-1.5 py-2 sm:px-2 md:flex-1"
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Abertas ({abertas.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="concluidas"
            className="min-h-[40px] min-w-0 gap-1.5 rounded-lg px-1.5 py-2 sm:px-2 md:flex-1"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Concluídas ({concluidas.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className={cn(P38_FILTROS_STICKY, 'space-y-2')}>
        <div className={cn('relative min-w-0 w-full rounded-xl', P38_FIELD_SURFACE)}>
          <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cotação"
            className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            aria-label="Buscar cotação"
          />
        </div>
      </div>

      <FinanceiroListaEstado
        loading={loading}
        vazio={lista.length === 0}
        vazioMensagem={
          hubView === 'abertas'
            ? (busca.trim() ? 'Nenhuma cotação aberta com esse filtro.' : 'Nenhuma cotação aberta. Use Nova ou o menu +.')
            : (busca.trim() ? 'Nenhuma cotação concluída com esse filtro.' : 'Nenhuma cotação concluída ainda.')
        }
        vazioIcon={FileText}
      >
        <P38MobileLineList allViewports>
          {lista.map((cotacao, index) => (
            <P38MobileLine
              key={cotacao.id}
              striped={index % 2 === 1}
              accent={p38AccentKeyFromTone(cotacaoAccent(cotacao.status))}
              onClick={() => onAbrirCotacao(cotacao)}
              title={cotacao.titulo}
              subtitle={cotacao.numero}
              meta={
                <>
                  <P38StatusLabel tone={p38StatusTone(cotacao.status)}>{cotacao.status}</P38StatusLabel>
                  <span>{cotacao.fornecedores?.length || 0} forn.</span>
                </>
              }
              value={`${cotacao.itens?.length || 0} prod.`}
              valueSub={
                cotacao.data_abertura
                  ? format(new Date(cotacao.data_abertura), 'dd/MM/yyyy')
                  : '—'
              }
              trailing={
                hubView === 'abertas' ? (
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExcluirCotacao(cotacao);
                    }}
                    aria-label="Excluir cotação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null
              }
            />
          ))}
        </P38MobileLineList>
      </FinanceiroListaEstado>

      <CotacaoExpressFab
        onNovaCotacao={onNovaCotacao}
        onImportarFoto={onImportarFoto}
        criando={criando}
      />
    </div>
  );
}
