import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Minus, Plus, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPrecoPisoCustoUnidade, parsePrecoDigitado } from '@/lib/orcamentoPrecoTabela';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Diálogo centralizado: quantidade, embalagem/unidade e preço livre.
 * Usado no orçamento da tabela de preços e no orçamento rápido (FAB).
 */
export default function ProdutoQuantidadeDialog({
  produto,
  preco,
  qtdAtual = 0,
  unidadeSelecionada,
  unitOptions = [],
  onConfirm,
  onClose,
  embedded = false,
  overlayClassName = 'z-[80]',
  selectContentClassName = 'z-[90]',
  confirmLabel = 'Confirmar',
  dialogTitleId = 'produto-quantidade-dialog-title',
}) {
  const [qtd, setQtd] = useState(qtdAtual > 0 ? String(qtdAtual) : '1');
  const [selectedUnitCode, setSelectedUnitCode] = useState(unidadeSelecionada?.unidade || produto?.unidade_principal || 'UN');
  const [precoEditado, setPrecoEditado] = useState(String(preco ?? ''));
  const [precoErro, setPrecoErro] = useState('');
  const inputRef = useRef(null);
  const precoRef = useRef(null);
  const precoLivre = produto?.preco_livre || false;
  const selectedUnit =
    unitOptions.find((opt) => opt.unidade === selectedUnitCode)
    || unidadeSelecionada
    || unitOptions[0]
    || { unidade: produto?.unidade_principal || 'UN', fator_conversao: 1, valor_unitario: preco };
  const unitPrice = selectedUnit?.valor_unitario ?? preco;
  const precoPisoCusto = getPrecoPisoCustoUnidade(produto, selectedUnit);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setPrecoEditado(String(unitPrice ?? ''));
    setPrecoErro('');
  }, [unitPrice, selectedUnitCode]);

  const qtdNum = parseFloat(qtd.replace(',', '.')) || 0;
  const precoParsed = parsePrecoDigitado(precoEditado);
  const precoFinal = precoLivre
    ? (Number.isFinite(precoParsed) ? precoParsed : unitPrice)
    : unitPrice;
  const total = qtdNum * precoFinal;

  const handleConfirm = () => {
    if (qtdNum <= 0) return;
    if (precoLivre) {
      if (!Number.isFinite(precoParsed)) {
        setPrecoErro('Informe um preço válido');
        precoRef.current?.focus();
        return;
      }
      if (precoParsed < precoPisoCusto) {
        setPrecoErro(`Mínimo: R$ ${fmtR(precoPisoCusto)} (custo)`);
        precoRef.current?.focus();
        return;
      }
    }
    setPrecoErro('');
    onConfirm(qtdNum, precoLivre ? precoFinal : undefined, selectedUnit);
  };

  const handlePrecoBlur = () => {
    if (!precoLivre) return;
    if (!Number.isFinite(precoParsed)) {
      setPrecoEditado(String(unitPrice ?? ''));
      setPrecoErro('');
      return;
    }
    if (precoParsed < precoPisoCusto) {
      setPrecoEditado(String(unitPrice ?? ''));
      setPrecoErro(`Mínimo: R$ ${fmtR(precoPisoCusto)} (custo)`);
      return;
    }
    setPrecoErro('');
  };

  const handleQtdKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (precoLivre) {
        setTimeout(() => precoRef.current?.focus(), 50);
      } else {
        handleConfirm();
      }
    }
  };

  const positionClass = embedded ? 'absolute' : 'fixed';

  const dialog = (
    <div
      className={`${positionClass} inset-0 flex items-center justify-center p-4 pointer-events-auto isolate ${overlayClassName}`}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/50 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-md bg-card rounded-3xl shadow-2xl max-h-[min(90dvh,640px)] overflow-y-auto pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-start justify-between gap-3 mb-3">
            <ProdutoThumb produto={produto} size="md" roundedClassName="rounded-2xl" asDiv />
            <div className="min-w-0 flex-1">
              <p id={dialogTitleId} className="text-[15px] font-semibold text-foreground line-clamp-3">{produto.nome}</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                R$ {fmtR(unitPrice)} / {selectedUnit?.unidade || produto.unidade_principal || 'UN'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {unitOptions.length > 1 && (
            <div className="mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Embalagem</p>
              <Select value={selectedUnitCode} onValueChange={setSelectedUnitCode}>
                <SelectTrigger className="h-11 bg-muted/50 border-0 rounded-xl">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent className={selectContentClassName}>
                  {unitOptions.map((opt) => (
                    <SelectItem key={opt.unidade} value={opt.unidade}>
                      {opt.unidade} · R$ {fmtR(opt.valor_unitario)} · fator {opt.fator_conversao || 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Quantidade</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQtd((prev) => {
                  const n = Math.max(0, (parseFloat(prev.replace(',', '.')) || 0) - 1);
                  return String(n % 1 === 0 ? n : n.toFixed(2));
                })}
                className="w-11 h-11 rounded-full bg-muted flex items-center justify-center active:bg-muted dark:active:bg-muted flex-shrink-0"
              >
                <Minus className="w-4 h-4 text-muted-foreground" />
              </button>

              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                enterKeyHint={precoLivre ? 'next' : 'done'}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleQtdKeyDown}
                className="flex-1 text-center text-2xl font-bold h-12 bg-muted/50 border-0 shadow-none focus-visible:ring-0 text-foreground rounded-2xl"
                placeholder="0"
              />

              <button
                type="button"
                onClick={() => setQtd((prev) => {
                  const n = (parseFloat(prev.replace(',', '.')) || 0) + 1;
                  return String(n % 1 === 0 ? n : n.toFixed(2));
                })}
                className="w-11 h-11 rounded-full bg-background dark:bg-muted flex items-center justify-center active:opacity-70 flex-shrink-0"
              >
                <Plus className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>

          {precoLivre && (
            <div className="mb-4">
              <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wide mb-1.5">Preço livre</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <input
                  autoComplete="off"
                  ref={precoRef}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={precoEditado}
                  onChange={(e) => { setPrecoEditado(e.target.value); setPrecoErro(''); }}
                  onBlur={handlePrecoBlur}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); } }}
                  className="w-full pl-9 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-right border border-amber-200 dark:border-amber-800 focus:ring-1 focus:ring-amber-300 dark:focus:ring-amber-600 text-amber-900 dark:text-amber-100 font-semibold"
                />
              </div>
              {precoErro && (
                <p className="text-[11px] text-red-500 mt-1">{precoErro}</p>
              )}
            </div>
          )}

          {qtdNum > 0 && (
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground tabular-nums">R$ {fmtR(total)}</span>
            </div>
          )}

          <div className="flex gap-2 pb-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {qtdAtual > 0 && (
              <button
                type="button"
                onClick={() => onConfirm(0)}
                className="w-11 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0 active:bg-red-100"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-muted text-muted-foreground text-sm font-medium active:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={qtdNum <= 0}
              className="flex-1 h-12 rounded-2xl bg-background dark:bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return dialog;
  return createPortal(dialog, document.body);
}
