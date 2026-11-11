import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { dataHoje } from '@/components/utils/dateUtils';
import { montarCorteDiarioMapa, ordenarContasCorteDiario } from '@/lib/corteDiarioMapa';
import { contasIdsFiltroFluxoPadrao } from '@/lib/filtroDataFinanceiro';
import BalanceteDiaFiltros from './BalanceteDiaFiltros';
import CorteDiarioPainel from './CorteDiarioPainel';

function contasPadraoCorte(contas = []) {
  const ids = contasIdsFiltroFluxoPadrao(contas);
  if (ids.length) return ids;
  return contas.filter((c) => c.ativo !== false).map((c) => c.id);
}

export default function CorteDiarioDialog({
  open,
  onOpenChange,
  contas = [],
  lancamentos = [],
  movimentos = [],
  initialDia = null,
  initialContasSel = null,
  abrirDiretoNoMapa = false,
  mostrarHistoricoAnterior = false,
  dataCorteHistorico = null,
}) {
  const [etapa, setEtapa] = useState('config');
  const [dia, setDia] = useState(dataHoje());
  const [contasSel, setContasSel] = useState([]);

  const contasOrdenadas = useMemo(
    () => ordenarContasCorteDiario(contas.filter((c) => c.ativo !== false)),
    [contas],
  );

  useEffect(() => {
    if (!open) {
      setEtapa('config');
      return;
    }
    const diaInicial = initialDia || dataHoje();
    setDia(diaInicial);
    const padrao = initialContasSel?.length ? initialContasSel : contasPadraoCorte(contas);
    setContasSel(padrao);
    setEtapa(abrirDiretoNoMapa && padrao.length ? 'painel' : 'config');
  }, [open, contas, initialDia, initialContasSel, abrirDiretoNoMapa]);

  const mapa = useMemo(() => {
    if (etapa !== 'painel' || !contasSel.length || !dia) return null;
    return montarCorteDiarioMapa({
      contas,
      lancamentos,
      movimentos,
      contasSel,
      dataInicio: dia,
      dataFim: dia,
      mostrarHistoricoAnterior,
      dataCorteHistorico,
    });
  }, [etapa, contas, lancamentos, movimentos, contasSel, dia, mostrarHistoricoAnterior, dataCorteHistorico]);

  const emitirMapa = () => {
    if (!contasSel.length || !dia) return;
    setEtapa('painel');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setEtapa('config');
      }}
    >
      <DialogContent
        overlayClassName="z-[100]"
        className={`z-[100] flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden border-0 p-0 shadow-2xl ${
          etapa === 'painel'
            ? 'h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-[min(96rem,calc(100vw-1rem))]'
            : 'w-[calc(100vw-1rem)] max-w-lg'
        } rounded-[28px] bg-card`}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/30 px-5 pb-3 pt-5 text-left">
          <div className="flex items-center gap-2">
            {etapa === 'painel' && (
              <button
                type="button"
                onClick={() => setEtapa('config')}
                className="balancete-no-print flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted/50"
                aria-label="Voltar à configuração"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <DialogTitle className="flex items-center gap-2 font-glacial text-xl text-foreground">
                <LayoutGrid className="h-5 w-5" />
                Balancete diário
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                {etapa === 'painel'
                  ? 'Corte de um dia — palitos em T, pronto para impressão A4.'
                  : 'Escolha o dia e as contas, depois emita o balancete.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {etapa === 'config' ? (
            <div className="space-y-5">
              <BalanceteDiaFiltros
                dia={dia}
                onDia={setDia}
                contas={contasOrdenadas}
                contasSel={contasSel}
                onContasSel={setContasSel}
              />

              <Button
                type="button"
                className="w-full rounded-2xl"
                disabled={!contasSel.length || !dia}
                onClick={emitirMapa}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Emitir balancete
              </Button>
            </div>
          ) : (
            <CorteDiarioPainel mapa={mapa} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
