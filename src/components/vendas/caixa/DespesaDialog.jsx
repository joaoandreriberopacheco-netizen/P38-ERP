import React, { useEffect, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { caixaClasses } from '@/lib/caixaP38Theme';
import LancamentoValeFolha from '@/components/financeiro/fluxo/LancamentoValeFolha';
import { SeletorCategoria, useCategorias } from '@/components/financeiro/fluxo/DialogCategoria';
import TagsInput from '@/components/financeiro/fluxo/TagsInput';
import { resolverPreferenciasLancamento } from '@/lib/lancamentoPreferencias';

export default function DespesaDialog({
  open, onOpenChange,
  despesaStep, setDespesaStep,
  descricaoDespesa, setDescricaoDespesa,
  categoriaDespesa, categoriaIdDespesa, onCategoriaChange,
  tagsDespesa, setTagsDespesa,
  valorDespesaNum, setValorDespesaNum,
  contaCaixaPDV,
  onSalvar,
  salvando,
  formatarValorExibicao,
  isValeFolha,
  onValeFolhaToggle,
  valeFolhaModeloId,
  onValeFolhaPessoaChange,
  pessoasFolha,
  loadingPessoasFolha,
}) {
  const { toast } = useToast();
  const tone = caixaClasses('danger');
  const valorRef = React.useRef(null);
  const { categorias, reload: reloadCategorias } = useCategorias();
  const prefsAplicadas = useRef(false);

  useEffect(() => {
    if (!open) {
      prefsAplicadas.current = false;
      return;
    }
    if (categorias.length > 0 && !prefsAplicadas.current) {
      const prefs = resolverPreferenciasLancamento('Despesa', { categorias });
      if (prefs.categoria) onCategoriaChange(prefs.categoria, prefs.categoriaId);
      prefsAplicadas.current = true;
    }
  }, [open, categorias, onCategoriaChange]);

  const handleValorChange = (e) => {
    let nums = e.target.value.replace(/\D/g, '') || '0';
    setValorDespesaNum(formatarValorExibicao(parseInt(nums) / 100));
  };

  const validarValeAntesSalvar = () => {
    if (isValeFolha && !valeFolhaModeloId) {
      toast({ title: 'Selecione quem vai receber o vale', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleValorKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = parseFloat((valorDespesaNum || '0').replace(/\./g, '').replace(',', '.')) || 0;
      if (v <= 0) { toast({ title: "Informe um valor maior que zero.", variant: "destructive" }); return; }
      if (!validarValeAntesSalvar()) return;
      if (!salvando) onSalvar(valorDespesaNum);
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      let nums = (valorDespesaNum || '0,00').replace(/\D/g, '');
      nums = nums.slice(0, -1) || '0';
      setValorDespesaNum(formatarValorExibicao(parseInt(nums) / 100));
    }
  };

  const fecharDialog = () => {
    onOpenChange(false);
    setDespesaStep('obs');
    setValorDespesaNum('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) fecharDialog(); }}>
      <CaixaDialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
        <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
          <button
            onClick={() => {
              if (despesaStep === 'valor') setDespesaStep('obs');
              else fecharDialog();
            }}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}>
            <ArrowLeft className="w-6 h-6 text-foreground/90" />
          </button>
          <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">Registrar Despesa</h2>
          <div className="w-10" />
        </div>

        <div className="flex-1 flex flex-col p-5 gap-3 overflow-y-auto">
          {despesaStep === 'obs' && (
            <>
              <div className="bg-card rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tone.well}`}>
                    <DollarSign className={`w-5 h-5 ${tone.icon}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{contaCaixaPDV?.nome}</div>
                    <div className="text-xs text-muted-foreground">Valor será debitado deste caixa</div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-4 shadow-sm">
                <label className="text-xs text-muted-foreground block mb-2">Descrição *</label>
                <textarea
                  autoFocus
                  rows={3}
                  placeholder="Ex: Gasolina, Sacolas, Material de limpeza..."
                  value={descricaoDespesa}
                  onChange={(e) => setDescricaoDespesa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (descricaoDespesa.trim()) {
                        setDespesaStep('valor');
                        setTimeout(() => valorRef.current?.focus(), 100);
                      }
                    }
                  }}
                  className="w-full resize-none bg-transparent border-0 focus:outline-none text-base text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                />
              </div>

              <SeletorCategoria
                tipo="Despesa"
                value={categoriaDespesa}
                onChange={onCategoriaChange}
                categorias={categorias}
                onCriada={reloadCategorias}
              />

              <TagsInput
                tags={tagsDespesa}
                onChange={setTagsDespesa}
                defaultExpanded={false}
              />

              <LancamentoValeFolha
                ativo={isValeFolha}
                onAtivoChange={onValeFolhaToggle}
                pessoaId={valeFolhaModeloId}
                onPessoaChange={onValeFolhaPessoaChange}
                pessoas={pessoasFolha}
                carregando={loadingPessoasFolha}
              />

              <button
                onClick={() => {
                  if (!descricaoDespesa.trim()) { toast({ title: "Informe a descrição.", variant: "destructive" }); return; }
                  if (isValeFolha && !valeFolhaModeloId) {
                    toast({ title: 'Selecione quem vai receber o vale', variant: 'destructive' });
                    return;
                  }
                  setDespesaStep('valor');
                  setTimeout(() => valorRef.current?.focus(), 100);
                }}
                className={`w-full h-14 rounded-2xl font-semibold text-base shadow-sm flex-shrink-0 ${tone.btn}`}
                style={{ minHeight: '56px' }}>
                Próximo →
              </button>
            </>
          )}

          {despesaStep === 'valor' && (
            <>
              <div className="bg-card rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center gap-2 flex-1">
                <div className="text-xs text-muted-foreground text-center">{descricaoDespesa}</div>
                {categoriaDespesa && (
                  <div className="text-[11px] text-muted-foreground">{categoriaDespesa}</div>
                )}
                <div className="text-xs text-muted-foreground">R$</div>
                <input autoComplete="off"
                  ref={valorRef}
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={valorDespesaNum || '0,00'}
                  onChange={handleValorChange}
                  onKeyDown={handleValorKeyDown}
                  onFocus={(e) => e.target.select()}
                  className={`text-5xl font-bold font-glacial text-center bg-transparent border-0 focus:outline-none w-full ${tone.text}`}
                  style={{ caretColor: 'transparent' }}
                />
              </div>

              <button
                onClick={() => {
                  const v = parseFloat((valorDespesaNum || '0').replace(/\./g, '').replace(',', '.')) || 0;
                  if (v <= 0) { toast({ title: "Informe um valor maior que zero.", variant: "destructive" }); return; }
                  if (!validarValeAntesSalvar()) return;
                  if (!salvando) onSalvar(valorDespesaNum);
                }}
                disabled={salvando}
                className={`w-full h-14 rounded-2xl font-semibold text-base shadow-sm flex-shrink-0 ${tone.btn} disabled:opacity-60 disabled:cursor-not-allowed`}
                style={{ minHeight: '56px' }}>
                {salvando ? 'Processando...' : 'Confirmar'}
              </button>
            </>
          )}
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}
