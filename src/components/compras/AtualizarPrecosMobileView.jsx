import { useState } from 'react';
import { ChevronDown, ChevronRight, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { P38_FIELD_SURFACE, P38_KPI_SHELL } from '@/components/financeiro/fluxo/financeiroP38';
import {
  P38MobileLine,
  P38MobileLineList,
  P38MobileMetric,
} from '@/components/ui/p38-mobile-line';
import {
  COMPRAS_CHIP_ACTIVE,
  COMPRAS_CHIP_INACTIVE,
  COMPRAS_CTA,
  COMPRAS_PILL,
  comprasAccentBorderClass,
} from '@/lib/comprasEmbarquesPalette';
import { cn } from '@/lib/utils';
import {
  buildPurchaseUnitOptions,
  formatUnitConversion,
  hasAlternativeUnits,
} from '@/lib/productUnits';

function ComprasStatusPill({ tone = 'muted', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-normal whitespace-nowrap',
        COMPRAS_PILL[tone] ?? COMPRAS_PILL.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}

const INPUT_SURFACE =
  'h-10 border-0 shadow-none bg-background dark:bg-[#26262e] rounded-lg text-sm tabular-nums';

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sanitizeTwoDecimalInput = (value) => {
  const raw = String(value ?? '');
  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  const isNegative = cleaned.includes('-');
  const unsigned = cleaned.replace(/-/g, '');
  const hasComma = unsigned.includes(',');
  const hasDot = unsigned.includes('.');
  const separator = hasComma ? ',' : hasDot ? '.' : null;
  if (separator) {
    const parts = unsigned.split(separator);
    const integerPart = (parts.shift() || '').replace(/[,.]/g, '');
    const decimalPart = parts.join('').replace(/[,.]/g, '');
    const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
    return `${isNegative ? '-' : ''}${normalizedInteger}${separator}${decimalPart.slice(0, 2)}`;
  }
  const normalizedInteger = unsigned.replace(/[,.]/g, '').replace(/^0+(?=\d)/, '') || '0';
  return `${isNegative ? '-' : ''}${normalizedInteger}`;
};

function diffTone(item) {
  if (!item.temDiferenca) return 'muted';
  return item.diferencaCusto > 0 ? 'danger' : 'success';
}

function MobileProdutoCard({
  item,
  expanded,
  onToggleExpand,
  selecionado,
  onToggleSelect,
  striped,
  inp,
  setInp,
  costs,
  unidadeVisualizacao,
  onCostBlur,
  onDescontoPctBlur,
  onDescontoPctBlurDirect,
  onMarkupBlur,
  onPrecoBlur,
  getItemSubtitulo,
  onOpenUnitSelector,
}) {
  const [custosAbertos, setCustosAbertos] = useState(false);
  const descontoPct = costs[item.produto_id]?.desconto_pct || 0;
  const precoVenda = (costs[item.produto_id]?.preco_venda_padrao || 0) * item.multDisplay;
  const custoExib = item.novoCusto * item.multDisplay;
  const tone = diffTone(item);

  const unidadeLabel =
    unidadeVisualizacao === 'comercial' && item.fatorExibicao > 1 && item.unidadeComercialLegenda
      ? item.unidadeComercialLegenda
      : item.unidadeBase;

  return (
    <div className="min-w-0">
      <P38MobileLine
        striped={striped}
        accent="none"
        className={comprasAccentBorderClass(tone)}
        onClick={onToggleExpand}
        title={item.produto_nome}
        subtitle={getItemSubtitulo?.(item) || `Un. ${unidadeLabel}`}
        meta={
          <>
            {item.temDiferenca ? (
              <ComprasStatusPill tone={item.diferencaCusto > 0 ? 'danger' : 'success'}>
                {item.diferencaCusto > 0 ? '+' : '-'}R$ {fmt(Math.abs(item.diferencaCusto * item.multDisplay))}
              </ComprasStatusPill>
            ) : (
              <ComprasStatusPill tone="muted">Sem alteração</ComprasStatusPill>
            )}
            <ComprasStatusPill tone="info">Venda</ComprasStatusPill>
          </>
        }
        value={`R$ ${fmt(precoVenda)}`}
        valueSub={`Custo R$ ${fmt(custoExib)}`}
        trailing={
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {item.temDiferenca ? (
              <Checkbox checked={selecionado} onCheckedChange={onToggleSelect} className="mr-0.5" />
            ) : null}
            <button
              type="button"
              className="p-1 text-muted-foreground"
              onClick={onToggleExpand}
              aria-label={expanded ? 'Recolher' : 'Expandir'}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        }
      />

      {expanded ? (
        <div className={cn(P38_FIELD_SURFACE, 'rounded-b-lg px-3 py-3 space-y-3 border-t border-border/40 dark:border-white/10')}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {unidadeLabel}
            </span>
            {hasAlternativeUnits(item.produto) && buildPurchaseUnitOptions(item.produto).length > 1 ? (
              <button
                type="button"
                className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 hover:underline inline-flex items-center gap-1"
                onClick={() => onOpenUnitSelector(item)}
              >
                <Boxes className="w-3 h-3" aria-hidden />
                Trocar unidade
              </button>
            ) : null}
          </div>
          {unidadeVisualizacao === 'comercial' && item.fatorExibicao > 1 && item.unidadeComercialLegenda ? (
            <p className="text-[10px] text-muted-foreground -mt-2">
              {formatUnitConversion({ unidade: item.unidadeComercialLegenda, fator_conversao: item.fatorExibicao }, item.unidadeBase)}
            </p>
          ) : null}

          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            <P38MobileMetric label="Compra" value={`R$ ${inp(item.produto_id, 'valor_compra') || '0,00'}`} />
            <P38MobileMetric label="Avaria" value={`${inp(item.produto_id, 'avaria_percentual') || '0'}%`} />
            <P38MobileMetric label="Markup" value={`${inp(item.produto_id, 'markup') || '0'}%`} tone="info" />
            <P38MobileMetric label="Venda" value={`R$ ${fmt(precoVenda)}`} tone="info" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compra</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={inp(item.produto_id, 'valor_compra')}
                onChange={(e) => setInp(item.produto_id, 'valor_compra', e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => onCostBlur(item.produto_id, 'valor_compra')}
                className={INPUT_SURFACE}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1">
                <Label className={cn('text-[10px] font-semibold uppercase tracking-wide', descontoPct < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                  {descontoPct < 0 ? 'Acréscimo %' : 'Desconto %'}
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    const rawInput = inp(item.produto_id, 'desconto_pct');
                    const currentTyped = Math.round((parseFloat(String(rawInput).replace(',', '.')) || 0) * 100) / 100;
                    const currentState = costs[item.produto_id]?.desconto_pct || 0;
                    const baseValue = currentTyped || currentState;
                    const flipped = baseValue === 0 ? (currentState < 0 ? 1 : -1) : -baseValue;
                    setInp(item.produto_id, 'desconto_pct', String(Math.round(flipped * 100) / 100));
                    onDescontoPctBlurDirect(item.produto_id, flipped);
                  }}
                  className="text-[9px] font-semibold text-muted-foreground"
                >
                  ⇄
                </button>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={inp(item.produto_id, 'desconto_pct')}
                onChange={(e) => setInp(item.produto_id, 'desconto_pct', sanitizeTwoDecimalInput(e.target.value))}
                onFocus={(e) => e.target.select()}
                onBlur={() => onDescontoPctBlur(item.produto_id)}
                className={INPUT_SURFACE}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Avaria %</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={inp(item.produto_id, 'avaria_percentual')}
                onChange={(e) => setInp(item.produto_id, 'avaria_percentual', e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => onCostBlur(item.produto_id, 'avaria_percentual')}
                className={INPUT_SURFACE}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Markup %</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={inp(item.produto_id, 'markup')}
                onChange={(e) => setInp(item.produto_id, 'markup', e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => onMarkupBlur(item.produto_id)}
                className={INPUT_SURFACE}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Venda</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={inp(item.produto_id, 'preco')}
                onChange={(e) => setInp(item.produto_id, 'preco', e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => onPrecoBlur(item.produto_id)}
                className={cn(INPUT_SURFACE, 'font-bold')}
              />
            </div>
          </div>

          <Collapsible open={custosAbertos} onOpenChange={setCustosAbertos}>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full flex items-center justify-between text-[11px] text-muted-foreground py-1 uppercase tracking-wide font-semibold">
                <span>Custos adicionais</span>
                {custosAbertos ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: 'Frete', field: 'custo_frete_padrao' },
                  { label: 'Imp 1', field: 'custo_imposto1_padrao' },
                  { label: 'Imp 2', field: 'custo_imposto2_padrao' },
                  { label: 'Outros', field: 'custo_outros_padrao' },
                ].map(({ label, field }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={inp(item.produto_id, field)}
                      onChange={(e) => setInp(item.produto_id, field, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => onCostBlur(item.produto_id, field)}
                      className={INPUT_SURFACE}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}
    </div>
  );
}

export default function AtualizarPrecosMobileView({
  secoesRender,
  costs,
  inputs,
  setInputs,
  selecionados,
  onToggleSelect,
  onSelecionarTodos,
  qtdComDiferenca,
  totalItens = 0,
  unidadeVisualizacao,
  onCostBlur,
  onDescontoPctBlur,
  onDescontoPctBlurDirect,
  onMarkupBlur,
  onPrecoBlur,
  onMarkupBlurDirect,
  getItemSubtitulo,
  onOpenUnitSelector,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [markupIgualar, setMarkupIgualar] = useState('');

  const inp = (produtoId, field) => inputs[`${produtoId}_${field}`] ?? '';
  const setInp = (produtoId, field, val) => setInputs((prev) => ({ ...prev, [`${produtoId}_${field}`]: val }));

  const todosItens = secoesRender.flatMap((sec) => sec.items);
  const idsSelecionados = todosItens
    .filter((item) => item.temDiferenca && selecionados[item.produto_id])
    .map((item) => item.produto_id);
  const alvoIgualar = idsSelecionados.length
    ? idsSelecionados
    : todosItens.filter((item) => item.temDiferenca).map((item) => item.produto_id);

  const aplicarMarkupIgual = () => {
    const markup = parseFloat(String(markupIgualar).replace(',', '.')) || 0;
    if (!alvoIgualar.length) return;
    alvoIgualar.forEach((produtoId) => {
      setInp(produtoId, 'markup', String(Math.round(markup * 100) / 100));
      onMarkupBlurDirect(produtoId, markup);
    });
  };

  let lineIndex = 0;

  return (
    <div className="space-y-3 font-din-1451 min-w-0">
      <div className={cn(P38_KPI_SHELL, 'space-y-2')}>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {totalItens} produto(s)
          </p>
          {qtdComDiferenca > 0 ? (
            <ComprasStatusPill tone="warning">{qtdComDiferenca} com alteração</ComprasStatusPill>
          ) : (
            <ComprasStatusPill tone="muted">Revisão</ComprasStatusPill>
          )}
        </div>

        {qtdComDiferenca > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Igualar markup</p>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={onSelecionarTodos}>
                Selecionar alterados
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 40"
                value={markupIgualar}
                onChange={(e) => setMarkupIgualar(e.target.value)}
                className={cn(INPUT_SURFACE, 'flex-1 h-11')}
              />
              <Button
                type="button"
                size="sm"
                className={cn('h-11 shrink-0 px-4 font-semibold', COMPRAS_CTA)}
                onClick={aplicarMarkupIgual}
                disabled={!markupIgualar}
              >
                Aplicar
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {secoesRender.map((secao) => (
        <div key={secao.label || 'all'} className="space-y-2 min-w-0">
          {secao.label ? (
            <div className="flex items-center justify-between border-b border-border/50 dark:border-white/10 px-1 py-2 gap-2">
              <p className="text-sm font-bold uppercase tracking-wide text-foreground/80 truncate min-w-0">
                {secao.label}
              </p>
              <ComprasStatusPill tone="info">{secao.items.length} itens</ComprasStatusPill>
            </div>
          ) : null}

          <P38MobileLineList>
            {secao.items.map((item) => {
              const striped = lineIndex % 2 === 1;
              lineIndex += 1;
              return (
                <MobileProdutoCard
                  key={item.produto_id}
                  item={item}
                  striped={striped}
                  expanded={expandedId === item.produto_id}
                  onToggleExpand={() => setExpandedId((prev) => (prev === item.produto_id ? null : item.produto_id))}
                  selecionado={!!selecionados[item.produto_id]}
                  onToggleSelect={() => onToggleSelect(item.produto_id)}
                  inp={inp}
                  setInp={setInp}
                  costs={costs}
                  unidadeVisualizacao={unidadeVisualizacao}
                  onCostBlur={onCostBlur}
                  onDescontoPctBlur={onDescontoPctBlur}
                  onDescontoPctBlurDirect={onDescontoPctBlurDirect}
                  onMarkupBlur={onMarkupBlur}
                  onPrecoBlur={onPrecoBlur}
                  getItemSubtitulo={getItemSubtitulo}
                  onOpenUnitSelector={onOpenUnitSelector}
                />
              );
            })}
          </P38MobileLineList>
        </div>
      ))}
    </div>
  );
}

