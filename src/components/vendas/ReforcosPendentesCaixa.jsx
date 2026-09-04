import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  confirmarReforcoPendenteCaixaPDV,
  ensureReforcosPendentesCaixaPDV,
  listarReforcosPendentesCaixaPDV,
} from '@/lib/reforcoPendenteCaixaPDV';

export default function ReforcosPendentesCaixa({
  turnoAtivo,
  contaCaixa,
  currentUser,
  onConfirmado,
}) {
  const [pendentes, setPendentes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [step, setStep] = useState('info');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadPendentes = useCallback(async () => {
    if (!contaCaixa?.id) return;
    try {
      await ensureReforcosPendentesCaixaPDV(base44, contaCaixa.id);
      const rows = await listarReforcosPendentesCaixaPDV(base44, contaCaixa.id);
      setPendentes(rows);
    } catch (error) {
      console.error('[ReforcosPendentesCaixa] erro ao carregar:', error);
    }
  }, [contaCaixa?.id]);

  useEffect(() => {
    if (!turnoAtivo?.id || !contaCaixa?.id) return;
    loadPendentes();
    const timer = setInterval(loadPendentes, 15000);
    return () => clearInterval(timer);
  }, [turnoAtivo?.id, contaCaixa?.id, loadPendentes]);

  const handleAbrir = (movimento) => {
    setSelected(movimento);
    setStep('info');
    setShowDialog(true);
  };

  const handleConfirmar = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await confirmarReforcoPendenteCaixaPDV(base44, {
        movimento: selected,
        turnoAtivo,
        currentUser,
      });
      toast({
        title: '✓ Reforço confirmado!',
        description: `R$ ${(selected.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entrou na gaveta.`,
        className: 'bg-emerald-100 text-emerald-800',
        duration: 2500,
      });
      setShowDialog(false);
      setSelected(null);
      await loadPendentes();
      onConfirmado?.();
    } catch (error) {
      toast({
        title: 'Erro ao confirmar reforço',
        description: error.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  if (!pendentes.length) return null;

  const formatValor = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <>
      <div className="fixed top-36 right-4 z-40 bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-700 rounded-2xl p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-lime-100 dark:bg-lime-900/40 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-lime-700 dark:text-lime-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-lime-900 dark:text-lime-100">
              {pendentes.length} reforço{pendentes.length !== 1 ? 's' : ''} aguardando
            </h3>
            <p className="text-xs text-lime-800 dark:text-lime-200 mt-1">
              Transferência do financeiro — confirme o dinheiro na gaveta
            </p>
            <button
              type="button"
              onClick={() => handleAbrir(pendentes[0])}
              className="mt-3 text-xs font-medium text-lime-800 dark:text-lime-200 hover:text-lime-950 dark:hover:text-white underline"
            >
              Aceitar agora →
            </button>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-full w-full h-full m-0 p-0 rounded-none bg-background flex flex-col">
          <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (step === 'confirmacao') setStep('info');
                else setShowDialog(false);
              }}
              className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ArrowLeft className="w-6 h-6 text-foreground/90" />
            </button>
            <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">
              Confirmar reforço de caixa
            </h2>
            <div className="w-10" />
          </div>

          {selected && (
            <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
              {step === 'info' && (
                <>
                  <div className="bg-card rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Número</span>
                      <span className="font-mono font-semibold text-foreground">{selected.numero}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Origem</span>
                      <span className="text-sm text-foreground text-right max-w-[60%]">
                        {selected.observacao || 'Transferência financeira'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Caixa</span>
                      <span className="font-semibold text-foreground">{contaCaixa?.nome}</span>
                    </div>
                  </div>

                  <div className="bg-lime-50 dark:bg-lime-900/20 border-2 border-lime-200 dark:border-lime-700 rounded-2xl p-6 shadow-sm">
                    <div className="text-xs text-lime-700 dark:text-lime-300 mb-2">Valor a entrar na gaveta</div>
                    <div className="text-4xl font-bold text-lime-800 dark:text-lime-200 font-glacial">
                      {formatValor(selected.valor)}
                    </div>
                    <p className="text-xs text-lime-700 dark:text-lime-300 mt-2">
                      O financeiro já registrou a saída do banco. Confirme só depois de contar o dinheiro físico.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('confirmacao')}
                    className="w-full h-14 rounded-2xl font-semibold text-white text-base shadow-sm bg-lime-700 hover:bg-lime-800 transition-colors"
                    style={{ minHeight: '56px' }}
                  >
                    Prosseguir para confirmação →
                  </button>
                </>
              )}

              {step === 'confirmacao' && (
                <>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700 rounded-2xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-[#4A5D23] dark:text-[#a4ce33]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                          Confirmação do operador
                        </h3>
                        <p className="text-xs text-[#4A5D23] dark:text-[#a4ce33] mt-1">
                          {currentUser?.full_name}, confirme que o valor está na gaveta do {contaCaixa?.nome}.
                        </p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-[#4A5D23] dark:text-[#a4ce33] font-glacial text-center py-4">
                      {formatValor(selected.valor)}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('info')}
                      disabled={loading}
                      className="flex-1 h-14 rounded-2xl font-semibold text-foreground/90 bg-muted hover:bg-muted transition-colors disabled:opacity-50"
                      style={{ minHeight: '56px' }}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmar}
                      disabled={loading}
                      className="flex-1 h-14 rounded-2xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      style={{ minHeight: '56px' }}
                    >
                      {loading ? 'Confirmando...' : 'Aceitar reforço'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
