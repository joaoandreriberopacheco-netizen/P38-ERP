import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import {
  History,
  Loader2,
  ArrowUp,
  ArrowDown,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Wallet,
  X,
  ListFilter,
  ArrowDownAZ,
  ArrowUpAZ,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import {
  agruparLinhasPorDia,
  buildExtratoItensVirtuais,
  calcularExtratoComSaldo,
  deltaQuantidadeMovimento,
  movimentacaoPassaFiltros,
  textoReferenciaTipo,
  textoTerceiroEnvolvido,
  rotuloTerceiroEnvolvido,
} from '@/components/produtos/produtoHistoricoEstoque';
import { formatEstoqueApresentacao, normalizeAlternativeUnits } from '@/lib/productUnits';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { p38Table } from '@/lib/p38TableSurfaces';
import {
  getVirtualPadding,
  measureVirtualItem,
  P38_VIRTUAL_MIN_ROWS,
  P38_VIRTUAL_OVERSCAN,
} from '@/lib/p38VirtualList';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/components/utils';

const P38_FIELD =
  'h-11 rounded-lg border-0 bg-secondary/80 shadow-none focus-visible:ring-1 focus-visible:ring-border/60 dark:bg-[#26262e]';
const P38_BTN =
  'h-11 rounded-lg border border-border/40 bg-card font-medium shadow-sm dark:border-white/10 dark:bg-[#26262e]';
/** Acima do Drawer (z-310) para o dropdown não ficar atrás do painel de filtros */
const FILTRO_SELECT_CONTENT =
  'z-[320] max-h-[min(50vh,20rem)] border border-border/40 bg-popover shadow-lg dark:border-white/10 dark:bg-[#2d333b]';

/** Larguras + posições left (px) para colunas sticky alinhadas */
const STICKY_COL = {
  dataW: 124,
  docW: 132,
  saldoW: 88,
  docLeft: 124,
  saldoLeft: 124 + 132,
};

const VIRTUAL_DAY_ESTIMATE = 64;
const VIRTUAL_MOV_ESTIMATE = 92;
const VIRTUAL_TABLE_ROW_ESTIMATE = 44;

function formatQtd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function movimentoAccent(tipo) {
  return tipo === 'Entrada' ? 'success' : 'danger';
}

function formatDataHoraMov(mov) {
  if (!mov?.created_date) return '—';
  const d = new Date(mov.created_date);
  return `${format(d, 'dd/MM/yy')} ${format(d, 'HH:mm')}`;
}

function descricaoMovimento(mov) {
  return mov.referencia_numero || mov.documento_referencia || mov.referencia_id || textoReferenciaTipo(mov);
}

function formatDiaLabel(dia) {
  if (dia === 'sem-data') return 'Sem data';
  return format(new Date(`${dia}T12:00:00`), "dd 'de' MMM yyyy");
}

function ExtratoDiaHeader({ dia, count, saldoFimDia }) {
  return (
    <div className={p38Table.catalogMobileHeader}>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{formatDiaLabel(dia)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {count} movimento{count === 1 ? '' : 's'}
          </p>
        </div>
        {saldoFimDia != null ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Saldo no dia</p>
            <p className={`font-glacial text-base font-bold tabular-nums ${p38Accent.success.text}`}>
              {formatQtd(saldoFimDia)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ExtratoMovimentoLine({ mov, saldoApos, striped, estoqueAuxiliar, fatorAuxiliar }) {
  const isEntrada = mov.tipo === 'Entrada';
  const delta = deltaQuantidadeMovimento(mov);
  const origem = textoReferenciaTipo(mov);
  const terceiro = textoTerceiroEnvolvido(mov);
  const rotuloTerceiro = rotuloTerceiroEnvolvido(mov);
  const documento = descricaoMovimento(mov);
  const total = (mov.quantidade || 0) * (mov.custo_unitario || 0);
  const qtdShow =
    estoqueAuxiliar && fatorAuxiliar
      ? `${formatQtd((Number(mov.quantidade) || 0) / fatorAuxiliar)} ${estoqueAuxiliar.sigla}`
      : null;

  const metaParts = [
    <P38StatusLabel key="tipo" tone={movimentoAccent(mov.tipo)}>
      {mov.tipo}
    </P38StatusLabel>,
  ];
  if (origem && origem !== mov.tipo) {
    metaParts.push(
      <span key="origem" className="truncate text-[10px] text-muted-foreground">
        {origem}
      </span>
    );
  }
  if (mov.usuario_responsavel) {
    metaParts.push(
      <span key="resp" className="truncate text-[10px] text-muted-foreground">
        {mov.usuario_responsavel}
      </span>
    );
  }

  const subtitleParts = [formatDataHoraMov(mov)];
  if (total > 0) {
    subtitleParts.push(`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  if (qtdShow) subtitleParts.push(qtdShow);

  return (
    <P38MobileLine
      striped={striped}
      accent={p38AccentKeyFromTone(movimentoAccent(mov.tipo))}
      title={
        <>
          <span className="uppercase">{documento}</span>
          {terceiro ? (
            <span className="mt-1 block text-sm font-medium normal-case tracking-normal text-foreground">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {rotuloTerceiro}:{' '}
              </span>
              {terceiro}
            </span>
          ) : null}
        </>
      }
      subtitle={subtitleParts.join(' · ')}
      meta={metaParts}
      value={
        <span className={`font-semibold tabular-nums ${isEntrada ? p38Accent.success.text : p38Accent.danger.text}`}>
          {delta >= 0 ? '+' : ''}
          {formatQtd(delta)}
        </span>
      }
      valueSub={
        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
          Saldo {saldoApos != null ? formatQtd(saldoApos) : '—'}
        </span>
      }
    />
  );
}

function ExtratoMobileScroll({ children, parentRef, className }) {
  return (
    <P38MobileLineList
      ref={parentRef}
      className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-none border-0 bg-transparent [-webkit-overflow-scrolling:touch] ${className || ''}`}
    >
      {children}
    </P38MobileLineList>
  );
}

function ExtratoMobileLista({ itensVirtuais, estoqueAuxiliar, fatorAuxiliar }) {
  return (
    <ExtratoMobileScroll>
      {itensVirtuais.map((item, index) =>
        item.kind === 'day' ? (
          <ExtratoDiaHeader
            key={item.key}
            dia={item.dia}
            count={item.count}
            saldoFimDia={item.saldoFimDia}
          />
        ) : (
          <ExtratoMovimentoLine
            key={item.key}
            mov={item.mov}
            saldoApos={item.saldoApos}
            striped={item.idx % 2 === 1}
            estoqueAuxiliar={estoqueAuxiliar}
            fatorAuxiliar={fatorAuxiliar}
          />
        )
      )}
    </ExtratoMobileScroll>
  );
}

function ExtratoMobileVirtualizado({ itensVirtuais, estoqueAuxiliar, fatorAuxiliar }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: itensVirtuais.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (itensVirtuais[index]?.kind === 'day' ? VIRTUAL_DAY_ESTIMATE : VIRTUAL_MOV_ESTIMATE),
    getItemKey: (index) => itensVirtuais[index]?.key ?? index,
    measureElement: measureVirtualItem,
    overscan: P38_VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <ExtratoMobileScroll parentRef={parentRef}>
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualRow) => {
          const item = itensVirtuais[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {item.kind === 'day' ? (
                <ExtratoDiaHeader
                  dia={item.dia}
                  count={item.count}
                  saldoFimDia={item.saldoFimDia}
                />
              ) : (
                <ExtratoMovimentoLine
                  mov={item.mov}
                  saldoApos={item.saldoApos}
                  striped={item.idx % 2 === 1}
                  estoqueAuxiliar={estoqueAuxiliar}
                  fatorAuxiliar={fatorAuxiliar}
                />
              )}
            </div>
          );
        })}
      </div>
    </ExtratoMobileScroll>
  );
}

function ExtratoTabelaDesktop({ linhasParaExibir, estoqueAuxiliar, fatorAuxiliar }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
      <table className="w-max min-w-[920px] border-collapse text-left text-[11px] sm:text-xs">
        <TableHeader className={`sticky top-0 z-30 ${p38Table.header}`}>
          <TableRow className="border-b hover:bg-transparent">
            <TableHead
              className={`sticky top-0 z-[45] h-10 whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`}
              style={{ left: 0, minWidth: STICKY_COL.dataW, width: STICKY_COL.dataW }}
            >
              Data
            </TableHead>
            <TableHead
              className={`sticky top-0 z-[45] h-10 whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`}
              style={{ left: STICKY_COL.docLeft, minWidth: STICKY_COL.docW, width: STICKY_COL.docW }}
            >
              Documento
            </TableHead>
            <TableHead
              className={`sticky top-0 z-[45] h-10 border-b border-r border-border/40 px-2 py-2 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.2)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] ${p38Table.head}`}
              style={{ left: STICKY_COL.saldoLeft, minWidth: STICKY_COL.saldoW, width: STICKY_COL.saldoW }}
            >
              Saldo após
            </TableHead>
            <TableHead className={`h-10 min-w-[5.5rem] whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`}>
              Origem
            </TableHead>
            <TableHead className={`h-10 min-w-[7rem] border-b px-2 py-2 ${p38Table.head}`}>Cliente / terceiro</TableHead>
            <TableHead className={`h-10 min-w-[3.25rem] border-b px-2 py-2 ${p38Table.head}`}>Tipo</TableHead>
            <TableHead className={`h-10 min-w-[4rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Movimento</TableHead>
            <TableHead className={`h-10 min-w-[4.5rem] border-b px-2 py-2 text-right ${p38Table.head}`}>P. un.</TableHead>
            <TableHead className={`h-10 min-w-[4.5rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Total R$</TableHead>
            <TableHead className={`h-10 min-w-[6rem] border-b px-2 py-2 ${p38Table.head}`}>Responsável</TableHead>
            <TableHead className={`h-10 min-w-[3.25rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Qtd</TableHead>
            <TableHead className={`h-10 min-w-[7rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Qtd (show)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhasParaExibir.map(({ mov, saldoApos }, idx) => (
            <ExtratoTabelaLinha
              key={mov.id != null ? mov.id : `mov-${idx}`}
              mov={mov}
              saldoApos={saldoApos}
              estoqueAuxiliar={estoqueAuxiliar}
              fatorAuxiliar={fatorAuxiliar}
            />
          ))}
        </TableBody>
      </table>
    </div>
  );
}

function ExtratoTabelaLinha({ mov, saldoApos, estoqueAuxiliar, fatorAuxiliar }) {
  const isEntrada = mov.tipo === 'Entrada';
  const delta = deltaQuantidadeMovimento(mov);
  const total = (mov.quantidade || 0) * (mov.custo_unitario || 0);
  const documento = mov.referencia_numero || mov.documento_referencia || mov.referencia_id || '—';
  const terceiro = textoTerceiroEnvolvido(mov) || '—';
  const origem = textoReferenciaTipo(mov);
  const stickyBg = 'bg-background group-hover:bg-secondary/25 dark:group-hover:bg-secondary/30';

  return (
    <TableRow className={`group ${p38Table.row}`}>
      <TableCell
        className={`sticky z-20 whitespace-nowrap border-b border-border/40 px-2 py-2 tabular-nums ${stickyBg}`}
        style={{ left: 0, minWidth: STICKY_COL.dataW, width: STICKY_COL.dataW }}
      >
        {formatDataHoraMov(mov)}
      </TableCell>
      <TableCell
        className={`sticky z-20 max-w-[132px] truncate border-b border-border/40 px-2 py-2 font-medium ${stickyBg}`}
        style={{ left: STICKY_COL.docLeft, minWidth: STICKY_COL.docW, width: STICKY_COL.docW }}
        title={String(documento)}
      >
        {documento}
      </TableCell>
      <TableCell
        className={`sticky z-20 border-b border-r border-border/40 px-2 py-2 text-right font-glacial text-sm font-bold tabular-nums shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.45)] ${p38Table.cellAccent} ${stickyBg}`}
        style={{ left: STICKY_COL.saldoLeft, minWidth: STICKY_COL.saldoW, width: STICKY_COL.saldoW }}
      >
        {saldoApos != null ? formatQtd(saldoApos) : '—'}
      </TableCell>
      <TableCell className="border-b border-border/40 px-2 py-2">
        <Badge
          className={`max-w-[8rem] truncate rounded-full border-0 text-[9px] ${
            isEntrada
              ? 'bg-[#4a5240]/10 text-[#4a5240] dark:bg-[#a4ce33]/15 dark:text-[#a4ce33]'
              : 'bg-red-500/10 text-red-700 dark:bg-red-950/40 dark:text-red-400'
          }`}
          title={origem}
        >
          {origem}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[10rem] truncate border-b border-border/40 px-2 py-2 text-muted-foreground" title={terceiro}>
        {terceiro}
      </TableCell>
      <TableCell className="whitespace-nowrap border-b border-border/40 px-2 py-2">{mov.tipo}</TableCell>
      <TableCell
        className={`border-b border-border/40 px-2 py-2 text-right font-semibold tabular-nums ${
          isEntrada ? p38Accent.success.text : p38Accent.danger.text
        }`}
      >
        {delta >= 0 ? '+' : ''}
        {formatQtd(delta)}
      </TableCell>
      <TableCell className="border-b border-border/40 px-2 py-2 text-right tabular-nums">
        {mov.custo_unitario > 0
          ? `R$ ${Number(mov.custo_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : '—'}
      </TableCell>
      <TableCell
        className={`border-b border-border/40 px-2 py-2 text-right tabular-nums ${
          isEntrada ? p38Accent.success.text : p38Accent.danger.text
        }`}
      >
        {total > 0 ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
      </TableCell>
      <TableCell className="max-w-[7rem] truncate border-b border-border/40 px-2 py-2 text-muted-foreground">
        {mov.usuario_responsavel || '—'}
      </TableCell>
      <TableCell className="border-b border-border/40 px-2 py-2 text-right tabular-nums">
        {formatQtd(mov.quantidade)}
      </TableCell>
      <TableCell className="border-b border-border/40 px-2 py-2 text-right tabular-nums text-muted-foreground">
        {estoqueAuxiliar && fatorAuxiliar
          ? `${formatQtd((Number(mov.quantidade) || 0) / fatorAuxiliar)} ${estoqueAuxiliar.sigla}`
          : '—'}
      </TableCell>
    </TableRow>
  );
}

function ExtratoTabelaVirtualizada({ linhasParaExibir, estoqueAuxiliar, fatorAuxiliar }) {
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: linhasParaExibir.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_TABLE_ROW_ESTIMATE,
    getItemKey: (index) => linhasParaExibir[index]?.mov?.id ?? index,
    measureElement: measureVirtualItem,
    overscan: P38_VIRTUAL_OVERSCAN,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const { paddingTop, paddingBottom } = getVirtualPadding(virtualItems, rowVirtualizer.getTotalSize());

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
    >
      <P38TableShell className="overflow-visible">
        <table className="w-max min-w-[920px] border-collapse text-left text-[11px] sm:text-xs">
          <TableHeader className={`sticky top-0 z-30 ${p38Table.header}`}>
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className={`sticky top-0 z-[45] h-10 whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`} style={{ left: 0, minWidth: STICKY_COL.dataW, width: STICKY_COL.dataW }}>
                Data
              </TableHead>
              <TableHead className={`sticky top-0 z-[45] h-10 whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`} style={{ left: STICKY_COL.docLeft, minWidth: STICKY_COL.docW, width: STICKY_COL.docW }}>
                Documento
              </TableHead>
              <TableHead className={`sticky top-0 z-[45] h-10 border-b border-r border-border/40 px-2 py-2 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.2)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)] ${p38Table.head}`} style={{ left: STICKY_COL.saldoLeft, minWidth: STICKY_COL.saldoW, width: STICKY_COL.saldoW }}>
                Saldo após
              </TableHead>
              <TableHead className={`h-10 min-w-[5.5rem] whitespace-nowrap border-b px-2 py-2 ${p38Table.head}`}>Origem</TableHead>
              <TableHead className={`h-10 min-w-[7rem] border-b px-2 py-2 ${p38Table.head}`}>Cliente / terceiro</TableHead>
              <TableHead className={`h-10 min-w-[3.25rem] border-b px-2 py-2 ${p38Table.head}`}>Tipo</TableHead>
              <TableHead className={`h-10 min-w-[4rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Movimento</TableHead>
              <TableHead className={`h-10 min-w-[4.5rem] border-b px-2 py-2 text-right ${p38Table.head}`}>P. un.</TableHead>
              <TableHead className={`h-10 min-w-[4.5rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Total R$</TableHead>
              <TableHead className={`h-10 min-w-[6rem] border-b px-2 py-2 ${p38Table.head}`}>Responsável</TableHead>
              <TableHead className={`h-10 min-w-[3.25rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Qtd</TableHead>
              <TableHead className={`h-10 min-w-[7rem] border-b px-2 py-2 text-right ${p38Table.head}`}>Qtd (show)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 ? (
              <tr aria-hidden>
                <td colSpan={12} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            ) : null}
            {virtualItems.map((virtualRow) => {
              const linha = linhasParaExibir[virtualRow.index];
              return (
                <ExtratoTabelaLinha
                  key={linha.mov?.id ?? virtualRow.key}
                  mov={linha.mov}
                  saldoApos={linha.saldoApos}
                  estoqueAuxiliar={estoqueAuxiliar}
                  fatorAuxiliar={fatorAuxiliar}
                />
              );
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden>
                <td colSpan={12} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            ) : null}
          </TableBody>
        </table>
      </P38TableShell>
    </div>
  );
}

export default function ProdutoHistoricoEstoqueTab({
  movimentacoes = [],
  estoqueAtual = 0,
  produto = null,
  loading = false,
  onRefresh,
  chromeExpanded = true,
}) {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [refTipo, setRefTipo] = useState('todos');
  const [dataIni, setDataIni] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [ordem, setOrdem] = useState('desc');
  const [sortAlpha, setSortAlpha] = useState('az');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const isMobile = useCompactShell();

  const filtros = useMemo(
    () => ({ busca, tipoFiltro, refTipo, dataIni, dataFim }),
    [busca, tipoFiltro, refTipo, dataIni, dataFim]
  );

  const extrato = useMemo(
    () => calcularExtratoComSaldo(movimentacoes, estoqueAtual),
    [movimentacoes, estoqueAtual]
  );

  const tiposRefUnicos = useMemo(() => {
    const s = new Set();
    (movimentacoes || []).forEach((m) => {
      const t = m?.referencia_tipo;
      if (t && String(t).trim()) s.add(String(t).trim());
    });
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [movimentacoes]);

  const linhasParaExibir = useMemo(() => {
    const pass = extrato.linhas.filter(({ mov }) => movimentacaoPassaFiltros(mov, filtros));
    pass.sort((a, b) => {
      const ta = new Date(a.mov?.created_date || 0).getTime();
      const tb = new Date(b.mov?.created_date || 0).getTime();
      const cmp = ta - tb;
      return ordem === 'asc' ? cmp : -cmp;
    });
    return pass;
  }, [extrato.linhas, filtros, ordem]);

  const diasExtratoMobile = useMemo(() => {
    const dias = agruparLinhasPorDia(linhasParaExibir, ordem);
    if (!isMobile) return dias;
    return dias.map(({ dia, linhas: linhasDia }) => ({
      dia,
      linhas: [...linhasDia].sort((a, b) => {
        const da = descricaoMovimento(a.mov).toLocaleLowerCase('pt-BR');
        const db = descricaoMovimento(b.mov).toLocaleLowerCase('pt-BR');
        const cmp = da.localeCompare(db, 'pt-BR');
        return sortAlpha === 'az' ? cmp : -cmp;
      }),
    }));
  }, [linhasParaExibir, ordem, isMobile, sortAlpha]);

  const itensVirtuaisMobile = useMemo(
    () => buildExtratoItensVirtuais(diasExtratoMobile),
    [diasExtratoMobile]
  );

  const shouldVirtualizeMobile = itensVirtuaisMobile.length >= P38_VIRTUAL_MIN_ROWS;
  const shouldVirtualizeDesktop = linhasParaExibir.length >= P38_VIRTUAL_MIN_ROWS;

  const temFiltrosExtras =
    tipoFiltro !== 'todos' || refTipo !== 'todos' || Boolean(dataIni) || Boolean(dataFim);

  const estoqueAuxiliar = useMemo(() => formatEstoqueApresentacao(produto), [produto]);
  const fatorAuxiliar = useMemo(() => {
    if (!estoqueAuxiliar?.sigla) return null;
    const alt = normalizeAlternativeUnits(produto).find((u) => u.unidade === estoqueAuxiliar.sigla);
    const fator = Number(alt?.fator_conversao) || 0;
    return fator > 0 ? fator : null;
  }, [produto, estoqueAuxiliar]);

  const limparFiltros = useCallback(() => {
    setTipoFiltro('todos');
    setRefTipo('todos');
    setDataIni('');
    setDataFim('');
  }, []);

  const searchRowMobile = (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Documento, cliente, origem…"
          className={`${P38_FIELD} h-11 rounded-2xl pl-9 pr-9`}
        />
        {busca ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setBusca('')}
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setFiltrosAbertos(true)}
        className={cn(
          'relative h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-colors',
          temFiltrosExtras
            ? 'bg-primary/15 text-primary dark:bg-muted dark:text-foreground'
            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
        )}
        aria-label="Filtros do extrato"
      >
        <ListFilter className="h-4 w-4" />
        {temFiltrosExtras ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#4a5240] dark:bg-[#a4ce33]" />
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => setSortAlpha((o) => (o === 'az' ? 'za' : 'az'))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted"
        aria-label={sortAlpha === 'az' ? 'Ordenar Z–A' : 'Ordenar A–Z'}
        title={sortAlpha === 'az' ? 'A–Z' : 'Z–A'}
      >
        {sortAlpha === 'az' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {/* Resumo P38 — colapsa no mobile ao descer a lista */}
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
          'desktop-layout:max-h-none desktop-layout:opacity-100',
          isMobile && (chromeExpanded ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0')
        )}
        aria-hidden={isMobile && !chromeExpanded}
      >
        <div className="p38-panel">
          <div className="p38-panel__accent-bar" aria-hidden />
          <div className="p38-panel__body">
            <div className="mb-3 flex items-start justify-end desktop-layout:hidden">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => onRefresh?.()}
                disabled={loading}
                aria-label="Atualizar extrato"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="min-w-0">
                <p className={p38Table.mobileMicroLabel}>Estoque (sistema)</p>
                <p className={`mt-1 flex items-center gap-1.5 font-glacial text-xl font-semibold tabular-nums ${p38Accent.success.text}`}>
                  <Wallet className="h-4 w-4 shrink-0" />
                  {formatQtd(estoqueAtual)}
                </p>
                {estoqueAuxiliar ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    ~{formatQtd(estoqueAuxiliar.quantidade)} {estoqueAuxiliar.sigla}
                    {estoqueAuxiliar.rotulo ? ` (${estoqueAuxiliar.rotulo})` : ''}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <p className={p38Table.mobileMicroLabel}>Movimentos</p>
                <p className="mt-1 font-glacial text-xl font-semibold tabular-nums text-foreground">
                  {linhasParaExibir.length}
                  <span className="text-xs font-normal text-muted-foreground"> / {movimentacoes.length}</span>
                </p>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className={p38Table.mobileMicroLabel}>Saldo antes (est.)</p>
                <p className="mt-1 font-glacial text-xl font-semibold tabular-nums text-foreground">
                  {formatQtd(extrato.saldoInicial)}
                </p>
              </div>
            </div>
            {Math.abs(extrato.divergencia) > 0.0001 ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                Atenção: a soma das movimentações não fecha exatamente com o estoque atual. Pode haver
                ajustes manuais ou registros antigos fora do histórico.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile — busca + filtro + ordem sempre visíveis */}
      <div className="desktop-layout:hidden shrink-0">{searchRowMobile}</div>

      {/* Desktop — barra busca + ações */}
      <div className="hidden shrink-0 flex-col gap-2 sm:flex-row sm:items-center desktop-layout:flex">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Documento, cliente, origem…"
            className={`${P38_FIELD} pl-9 pr-9`}
          />
          {busca ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" className={`${P38_BTN} flex-1 sm:flex-initial`} onClick={() => setOrdem((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {ordem === 'asc' ? <ArrowUp className="mr-1.5 h-4 w-4" /> : <ArrowDown className="mr-1.5 h-4 w-4" />}
            {ordem === 'asc' ? 'Antigo' : 'Recente'}
          </Button>
          <Button type="button" variant="outline" className={`relative ${P38_BTN} flex-1 sm:flex-initial`} onClick={() => setFiltrosAbertos(true)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Filtros
            {temFiltrosExtras ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#4a5240] text-[8px] font-bold text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]">
                ·
              </span>
            ) : null}
          </Button>
          <Button type="button" variant="outline" className={P38_BTN} onClick={() => onRefresh?.()} disabled={loading} aria-label="Atualizar extrato">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Drawer open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <DrawerContent className="rounded-t-2xl border-0 bg-card px-4 pb-8 dark:bg-[#2d333b]">
          <DrawerHeader className="px-0 pb-2 text-left">
            <DrawerTitle className="font-glacial text-foreground">Filtros do extrato</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className={`mt-1 h-12 ${P38_FIELD}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={FILTRO_SELECT_CONTENT}>
                  <SelectItem value="todos">Entrada e saída</SelectItem>
                  <SelectItem value="Entrada">Somente entrada</SelectItem>
                  <SelectItem value="Saída">Somente saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Origem (referência)</Label>
              <Select value={refTipo} onValueChange={setRefTipo}>
                <SelectTrigger className={`mt-1 h-12 ${P38_FIELD}`}>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className={FILTRO_SELECT_CONTENT}>
                  <SelectItem value="todos">Todas</SelectItem>
                  {tiposRefUnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className={`mt-1 h-12 ${P38_FIELD}`} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={`mt-1 h-12 ${P38_FIELD}`} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className={`h-12 flex-1 ${P38_BTN}`} onClick={limparFiltros}>
                Limpar
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 rounded-lg bg-[#4a5240] text-white hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22] dark:hover:bg-[#a4ce33]/90"
                onClick={() => setFiltrosAbertos(false)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {loading ? (
        <div className="flex min-h-[12rem] flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : linhasParaExibir.length === 0 ? (
        <div className="flex min-h-[12rem] flex-1 flex-col justify-center rounded-xl border border-border/40 bg-muted/30 py-14 text-center dark:border-white/10">
          <History className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground/90">
            {movimentacoes.length === 0 ? 'Nenhuma movimentação registrada' : 'Nenhum resultado com estes filtros'}
          </p>
          {movimentacoes.length > 0 ? (
            <Button type="button" variant="link" className="mt-2 text-xs" onClick={() => { setBusca(''); limparFiltros(); }}>
              Redefinir filtros
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Extrato mobile — único scroll (virtualizado quando ≥50 itens) */}
          <div className={`${p38Table.shellFlat} desktop-layout:hidden flex min-h-0 flex-1 flex-col overflow-hidden`}>
            {shouldVirtualizeMobile ? (
              <ExtratoMobileVirtualizado
                itensVirtuais={itensVirtuaisMobile}
                estoqueAuxiliar={estoqueAuxiliar}
                fatorAuxiliar={fatorAuxiliar}
              />
            ) : (
              <ExtratoMobileLista
                itensVirtuais={itensVirtuaisMobile}
                estoqueAuxiliar={estoqueAuxiliar}
                fatorAuxiliar={fatorAuxiliar}
              />
            )}
          </div>

          {/* Tabela desktop */}
          <div className={`${p38Table.shellFlat} hidden min-h-0 flex-1 flex-col overflow-hidden desktop-layout:flex`}>
            <p className="shrink-0 border-b border-border/40 bg-muted/40 px-3 py-2 text-[10px] leading-snug text-muted-foreground dark:border-white/10">
              Colunas fixas: data, documento e saldo. Deslize para a direita para ver origem, valores e responsável.
            </p>
            {shouldVirtualizeDesktop ? (
              <ExtratoTabelaVirtualizada
                linhasParaExibir={linhasParaExibir}
                estoqueAuxiliar={estoqueAuxiliar}
                fatorAuxiliar={fatorAuxiliar}
              />
            ) : (
              <ExtratoTabelaDesktop
                linhasParaExibir={linhasParaExibir}
                estoqueAuxiliar={estoqueAuxiliar}
                fatorAuxiliar={fatorAuxiliar}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
