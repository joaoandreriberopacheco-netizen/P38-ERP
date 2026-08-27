import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { getLinhaAbcdLetter } from '@/lib/sugestaoCompraTree';
import {
  sugestaoProjecaoEstoque30dNegativa,
  sugestaoProjecaoEstoque30dTexto,
} from '@/lib/calcularSugestaoCompraVelocidade';
import {
  resolveSugestaoEstoqueEfetivoBase,
  resolveSugestaoQuantidadeVitrine,
} from '@/lib/sugestaoCompraVitrineDisplay';

const VALUES_GRID = 'grid grid-cols-3 gap-x-1.5 min-w-0';
const BODY_TEXT = 'font-din-1451 text-base tablet-landscape:text-lg font-light leading-none';
const HEADER_LABEL = `${BODY_TEXT} uppercase tracking-tight text-right text-muted-foreground min-w-0 truncate`;
const AXIS_COL_W = '3.25rem';
const ROW_PL = 'pl-2.5';
const AXIS_LEFT = 'calc(0.625rem + 3.25rem)';
const DESC_PL_AFTER_LINE = 12;
const NOME_TYPO =
  'text-[12px] font-light leading-relaxed uppercase break-words [overflow-wrap:anywhere]';

const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function SacredAxis() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-[10] w-0 border-l border-border/50 dark:border-white/20"
      style={{ left: AXIS_LEFT }}
      aria-hidden
    />
  );
}

function AxisColShell({ children, className = '' }) {
  return (
    <div
      className={cn('relative shrink-0 pr-1.5 pt-3 pb-3 text-right self-stretch', className)}
      style={{ width: AXIS_COL_W }}
    >
      {children}
    </div>
  );
}

function stockToneFromLinha(linha) {
  const estoque = linha?.sugestao?.estoque_atual ?? linha?.produto?.estoque_atual ?? 0;
  if (estoque <= 0) return 'danger';
  if (sugestaoProjecaoEstoque30dNegativa(linha?.sugestao)) return 'warning';
  const gap = Number(linha?.sugestao?.gap_ponto_futuro_base);
  if (Number.isFinite(gap) && gap > 0) return 'warning';
  const ponto = linha?.sugestao?.ponto_pedido ?? 0;
  if (ponto > 0 && estoque < ponto) return 'warning';
  return 'success';
}

function accentDotClass(tone) {
  if (tone === 'danger') return p38Accent.danger.dot;
  if (tone === 'warning') return p38Accent.warning.dot;
  if (tone === 'muted') return p38Accent.muted.dot;
  return p38Accent.success.dot;
}

function AbcdBadge({ letter }) {
  const value = String(letter || '').toUpperCase();
  if (!value) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[8px] font-bold bg-muted text-muted-foreground shrink-0">
      {value}
    </span>
  );
}

/** Coluna esquerda: estoque + UN (igual catálogo). */
function EstoqueUnCol({ quantidade, unidade, stockTone = 'success' }) {
  return (
    <AxisColShell>
      <div className="flex items-start justify-end gap-1 min-w-0">
        <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', accentDotClass(stockTone))} aria-hidden />
        <div className="min-w-0 text-right">
          <p className={cn(BODY_TEXT, 'tabular-nums leading-none text-foreground')}>{fmtN(quantidade)}</p>
          <p className={cn(BODY_TEXT, 'mt-1.5 uppercase text-muted-foreground leading-none truncate')}>{unidade}</p>
        </div>
      </div>
    </AxisColShell>
  );
}

function SugestaoCompraMobileColumnHeader({ className = '' }) {
  return (
    <div className={cn(p38Table.catalogMobileHeader, 'relative', className)}>
      <SacredAxis />
      <div className={cn('relative flex min-w-0 py-3.5 pr-10', ROW_PL)}>
        <AxisColShell className="!py-2">
          <p className={HEADER_LABEL}>EST.</p>
          <p className={cn(HEADER_LABEL, 'mt-1.5')}>UN</p>
        </AxisColShell>
        <div className="flex-1 min-w-0 overflow-hidden" style={{ paddingLeft: DESC_PL_AFTER_LINE }}>
          <div className={VALUES_GRID}>
            <p className={HEADER_LABEL}>MÉD.</p>
            <p className={HEADER_LABEL}>P.FUT.</p>
            <p className={HEADER_LABEL}>QTD</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function stopRowToggle(e) {
  e.stopPropagation();
}

function QtdInput({ linha, disp, onQuantidadeLinhaChange }) {
  const qty = disp?.quantidade ?? 0;
  const unidade = disp?.unidade || '';
  const [localQty, setLocalQty] = useState(() => String(qty));

  useEffect(() => {
    setLocalQty(String(qty));
  }, [linha.id, qty]);

  const commit = () => {
    const parsed = Number(String(localQty).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setLocalQty(String(qty));
      return;
    }
    onQuantidadeLinhaChange?.(linha, parsed);
  };

  return (
    <div
      className="flex items-center justify-end gap-0.5 min-w-0"
      onClick={stopRowToggle}
      onPointerDown={stopRowToggle}
      onTouchStart={stopRowToggle}
    >
      <Input
        type="text"
        inputMode="decimal"
        aria-label={`Quantidade sugerida para ${linha.label}`}
        value={localQty}
        onChange={(e) => setLocalQty(e.target.value)}
        onBlur={commit}
        onFocus={stopRowToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        className="h-9 min-w-[3rem] w-full max-w-[4.75rem] px-1.5 text-right text-base tabular-nums font-medium rounded-md border border-border/50 bg-muted/60 dark:bg-muted/40 shadow-none focus-visible:ring-2 focus-visible:ring-teal-400/80"
      />
      {unidade ? (
        <span className="text-[9px] uppercase text-muted-foreground shrink-0 w-6 truncate text-right">
          {unidade}
        </span>
      ) : null}
    </div>
  );
}

function resolveEstoqueVitrineColuna(linha, sugestao, produto, incluirPedidosAprovados) {
  const { estoqueBase } = resolveSugestaoEstoqueEfetivoBase(produto, sugestao, {
    incluirPedidosAprovados,
    quantidadePendente: linha.quantidade_pendente,
  });
  const disp = resolveSugestaoQuantidadeVitrine(produto, estoqueBase);
  return {
    quantidade: disp.quantidade ?? 0,
    unidade: disp.unidade || produto?.unidade_principal || 'UN',
  };
}

function SugestaoCatalogRow({
  linha,
  disp,
  selecionado,
  onToggleSelecionado,
  onQuantidadeLinhaChange,
  fornecedorSelect,
  incluirPedidosAprovados,
}) {
  const sugestao = linha.sugestao;
  const produto = linha.produto;
  const isGrupo = linha.tipo === 'grupo';
  const estoqueCol = resolveEstoqueVitrineColuna(linha, sugestao, produto, incluirPedidosAprovados);
  const media30d = sugestao?.media_30d_texto || '—';
  const pontoFuturo = sugestaoProjecaoEstoque30dTexto(sugestao);
  const projNeg = sugestaoProjecaoEstoque30dNegativa(sugestao);
  const abcd = getLinhaAbcdLetter(linha);
  const stockTone = stockToneFromLinha(linha);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        p38Table.catalogMobileRow,
        'relative flex min-w-0 max-w-full touch-pan-y py-4 active:bg-secondary/20',
        selecionado && 'bg-teal-50/40 dark:bg-teal-950/20',
      )}
      onClick={() => onToggleSelecionado?.(!selecionado)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleSelecionado?.(!selecionado);
        }
      }}
    >
      <SacredAxis />
      <div className={cn('flex flex-1 min-w-0 items-stretch', ROW_PL)}>
        <EstoqueUnCol
          quantidade={estoqueCol.quantidade}
          unidade={estoqueCol.unidade}
          stockTone={stockTone}
        />

        <div
          className="flex-1 min-w-0 overflow-hidden py-1 pr-1"
          style={{ paddingLeft: DESC_PL_AFTER_LINE }}
        >
          <div className="min-h-[3rem] mb-2 min-w-0 overflow-hidden">
            <div className="flex items-start gap-1 min-w-0">
              <p lang="pt-BR" className={cn('line-clamp-3 flex-1 min-w-0', NOME_TYPO, 'text-foreground/90')}>
                {linha.label}
              </p>
              <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                <AbcdBadge letter={abcd} />
                {isGrupo ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <Layers className="w-2.5 h-2.5" />
                    {linha.skus?.length ?? 0}
                  </span>
                ) : null}
              </div>
            </div>
            {!isGrupo && produto?.codigo_interno ? (
              <p className="mt-0.5 text-[10px] font-mono truncate text-muted-foreground">
                #{produto.codigo_interno}
              </p>
            ) : null}
          </div>

          <div className={VALUES_GRID}>
            <p className={cn(BODY_TEXT, 'tabular-nums text-right truncate text-muted-foreground')}>
              {media30d}
            </p>
            <p
              className={cn(
                BODY_TEXT,
                'tabular-nums text-right truncate',
                projNeg ? 'text-rose-600 dark:text-rose-400 font-normal' : 'text-muted-foreground',
              )}
            >
              {pontoFuturo}
            </p>
            <div className="min-w-0 overflow-hidden">
              <QtdInput
                linha={linha}
                disp={disp}
                onQuantidadeLinhaChange={onQuantidadeLinhaChange}
              />
            </div>
          </div>

          <div
            className="mt-2 min-w-0 overflow-hidden"
            onClick={stopRowToggle}
            onPointerDown={stopRowToggle}
            onTouchStart={stopRowToggle}
          >
            {fornecedorSelect}
          </div>
        </div>
      </div>

      <div
        className="flex w-10 shrink-0 items-start justify-center pt-4 pr-2"
        onClick={stopRowToggle}
        onPointerDown={stopRowToggle}
        onTouchStart={stopRowToggle}
      >
        <Checkbox
          checked={selecionado}
          onCheckedChange={(c) => onToggleSelecionado?.(!!c)}
          className="h-4 w-4"
        />
      </div>
    </div>
  );
}

export function SugestaoCompraMobileScrollShell({ chrome, children }) {
  const scrollRef = useRef(null);

  return (
    <div
      ref={scrollRef}
      className="flex flex-col flex-1 min-h-0 h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-[5.25rem]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {chrome}
      <SugestaoCompraMobileColumnHeader className="sticky top-0 z-30 border-x border-border/40 dark:border-white/10 shadow-sm" />
      {children}
    </div>
  );
}

export default function SugestaoCompraMobileCatalog({
  linhas = [],
  selectedItems = {},
  onToggleSelected,
  sugestaoDisplayLinha,
  onQuantidadeLinhaChange,
  renderFornecedorSelect,
  incluirPedidosAprovados = false,
}) {
  return (
    <>
      {linhas.map((linha) => (
        <SugestaoCatalogRow
          key={linha.id}
          linha={linha}
          disp={sugestaoDisplayLinha?.(linha)}
          selecionado={!!selectedItems[linha.id]}
          onToggleSelecionado={(checked) => onToggleSelected?.(linha.id, checked)}
          onQuantidadeLinhaChange={onQuantidadeLinhaChange}
          fornecedorSelect={renderFornecedorSelect?.(linha)}
          incluirPedidosAprovados={incluirPedidosAprovados}
        />
      ))}
    </>
  );
}
