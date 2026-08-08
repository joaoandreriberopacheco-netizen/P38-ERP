import { useState } from 'react';
import { ChevronDown, ChevronRight, Boxes, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  buildPurchaseUnitOptions,
  formatUnitConversion,
  hasAlternativeUnits,
} from '@/lib/productUnits';

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

function MobileProdutoCard({
  item,
  expanded,
  onToggleExpand,
  selecionado,
  onToggleSelect,
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

  const unidadeLabel =
    unidadeVisualizacao === 'comercial' && item.fatorExibicao > 1 && item.unidadeComercialLegenda
      ? item.unidadeComercialLegenda
      : item.unidadeBase;

  return (
    <Collapsible open={expanded} onOpenChange={onToggleExpand}>
      <div className={`rounded-2xl border bg-card shadow-sm overflow-hidden ${item.temDiferenca ? 'border-border/60' : 'border-border/40'}`}>
        <div className="flex items-stretch gap-2 p-3">
          {item.temDiferenca ? (
            <div className="flex items-center pt-0.5">
              <Checkbox checked={selecionado} onCheckedChange={onToggleSelect} />
            </div>
          ) : (
            <div className="w-4 shrink-0" aria-hidden />
          )}

          <CollapsibleTrigger asChild>
            <button type="button" className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{item.produto_nome}</div>
              {getItemSubtitulo?.(item) ? (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{getItemSubtitulo(item)}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  Custo <span className="font-semibold text-foreground tabular-nums">R$ {fmt(item.novoCusto * item.multDisplay)}</span>
                </span>
                <span className="text-muted-foreground">
                  Venda <span className="font-semibold text-foreground tabular-nums">R$ {fmt((costs[item.produto_id]?.preco_venda_padrao || 0) * item.multDisplay)}</span>
                </span>
                {item.temDiferenca ? (
                  <span className={`inline-flex items-center gap-0.5 font-medium ${item.diferencaCusto > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {item.diferencaCusto > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {item.diferencaCusto > 0 ? '+' : '-'}R$ {fmt(Math.abs(item.diferencaCusto * item.multDisplay))}
                  </span>
                ) : null}
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleTrigger asChild>
            <button type="button" className="shrink-0 self-start p-1 text-muted-foreground" aria-label={expanded ? 'Recolher' : 'Expandir'}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/30">
            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Unidade · {unidadeLabel}
              </span>
              {hasAlternativeUnits(item.produto) && buildPurchaseUnitOptions(item.produto).length > 1 ? (
                <button
                  type="button"
                  className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  onClick={() => onOpenUnitSelector(item)}
                >
                  <Boxes className="w-3 h-3" aria-hidden />
                  Trocar
                </button>
              ) : null}
            </div>
            {unidadeVisualizacao === 'comercial' && item.fatorExibicao > 1 && item.unidadeComercialLegenda ? (
              <p className="text-[10px] text-muted-foreground -mt-2">
                {formatUnitConversion({ unidade: item.unidadeComercialLegenda, fator_conversao: item.fatorExibicao }, item.unidadeBase)}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase">Compra</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={inp(item.produto_id, 'valor_compra')}
                  onChange={(e) => setInp(item.produto_id, 'valor_compra', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => onCostBlur(item.produto_id, 'valor_compra')}
                  className="h-10 text-sm font-medium rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <Label className={`text-[10px] font-medium uppercase ${descontoPct < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
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
                  className="h-10 text-sm font-medium rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase">Markup %</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={inp(item.produto_id, 'markup')}
                  onChange={(e) => setInp(item.produto_id, 'markup', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => onMarkupBlur(item.produto_id)}
                  className="h-10 text-sm font-medium rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase">Venda</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={inp(item.produto_id, 'preco')}
                  onChange={(e) => setInp(item.produto_id, 'preco', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => onPrecoBlur(item.produto_id)}
                  className="h-10 text-sm font-bold rounded-xl"
                />
              </div>
            </div>

            <Collapsible open={custosAbertos} onOpenChange={setCustosAbertos}>
              <CollapsibleTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between text-xs text-muted-foreground py-1">
                  <span>Custos adicionais (frete, impostos…)</span>
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
                    { label: 'Avaria %', field: 'avaria_percentual' },
                  ].map(({ label, field }) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase">{label}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={inp(item.produto_id, field)}
                        onChange={(e) => setInp(item.produto_id, field, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => onCostBlur(item.produto_id, field)}
                        className="h-10 text-sm rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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

  return (
    <div className="space-y-3">
      {qtdComDiferenca > 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Igualar markup</p>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={onSelecionarTodos}>
              Selecionar alterados
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Aplica o mesmo markup % nos produtos selecionados (ou em todos com alteração, se nenhum estiver marcado).
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 40"
              value={markupIgualar}
              onChange={(e) => setMarkupIgualar(e.target.value)}
              className="h-10 flex-1 rounded-xl text-sm"
            />
            <Button type="button" size="sm" className="h-10 shrink-0 px-4" onClick={aplicarMarkupIgual} disabled={!markupIgualar}>
              Aplicar
            </Button>
          </div>
        </div>
      ) : null}

      {secoesRender.map((secao) => (
        <div key={secao.label || 'all'} className="space-y-2">
          {secao.label ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
              {secao.label}
            </p>
          ) : null}
          {secao.items.map((item) => (
            <MobileProdutoCard
              key={item.produto_id}
              item={item}
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
          ))}
        </div>
      ))}
    </div>
  );
}
