import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CorteDiarioContaT from './CorteDiarioContaT';
import CorteDiarioSeta, { CorteDiarioArcos } from './CorteDiarioSeta';
import './balanceteDiarioPrint.css';

function formatPeriodoLabel(dataInicio, dataFim) {
  if (!dataInicio && !dataFim) return 'Todo o período';
  if (dataInicio === dataFim) {
    try {
      return format(parseISO(dataInicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dataInicio;
    }
  }
  return `${dataInicio} até ${dataFim}`;
}

function buildTransferencias(contas) {
  const links = [];
  contas.forEach((origem) => {
    origem.saidas?.forEach((saida) => {
      if (!saida.isTransferencia || !saida.transferenciaDestinoId) return;
      const destino = contas.find((c) => c.contaId === saida.transferenciaDestinoId);
      if (!destino) return;
      links.push({
        id: `${origem.contaId}-${saida.id}-${destino.contaId}`,
        origemId: origem.contaId,
        destinoId: destino.contaId,
        origemNome: origem.contaNome,
        destinoNome: destino.contaNome,
        valor: saida.valor,
      });
    });
  });
  return links;
}

function agregarPorPar(links) {
  const map = new Map();
  links.forEach((link) => {
    const key = `${link.origemId}→${link.destinoId}`;
    const prev = map.get(key) || { ...link, valor: 0 };
    prev.valor = Math.round((prev.valor + link.valor) * 100) / 100;
    map.set(key, prev);
  });
  return map;
}

/** Larguras para arcos SVG — proporcional ao nº de contas no ecrã largo. */
function dimensoesPalitosFluidos(numContas) {
  const n = Math.max(1, numContas);
  const cardWidth = Math.max(160, Math.min(280, Math.floor(900 / n)));
  const arrowWidth = Math.max(28, Math.min(48, Math.floor(40 - n * 2)));
  return { cardWidth, arrowWidth };
}

export default function CorteDiarioPainel({ mapa }) {
  const { contas = [], dataInicio, dataFim } = mapa || {};

  const transferencias = useMemo(() => buildTransferencias(contas), [contas]);
  const porPar = useMemo(() => agregarPorPar(transferencias), [transferencias]);

  const transferenciasArco = useMemo(
    () => transferencias.filter((link) => {
      const oi = contas.findIndex((c) => c.contaId === link.origemId);
      const di = contas.findIndex((c) => c.contaId === link.destinoId);
      return di > oi + 1;
    }),
    [transferencias, contas],
  );

  const somaPar = (origemId, destinoId) =>
    porPar.get(`${origemId}→${destinoId}`)?.valor || 0;

  const dims = useMemo(() => dimensoesPalitosFluidos(contas.length), [contas.length]);

  if (!contas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma movimentação encontrada para o dia e contas selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="balancete-no-print flex items-center justify-end">
        <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir A4
        </Button>
      </div>

      <div id="balancete-print-root" className="balancete-canvas space-y-3">
        <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2">
          <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
            Balancete diário
          </p>
          <p className="font-glacial text-sm font-semibold text-foreground">
            {formatPeriodoLabel(dataInicio, dataFim)}
          </p>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <CorteDiarioArcos
            contas={contas}
            links={transferenciasArco}
            cardWidth={dims.cardWidth}
            arrowWidth={dims.arrowWidth}
            compact={false}
          />
          <div className="balancete-map-row">
            {contas.map((conta, index) => {
              const proxima = contas[index + 1];
              const valorSeta = proxima ? somaPar(conta.contaId, proxima.contaId) : 0;

              return (
                <React.Fragment key={conta.contaId}>
                  <CorteDiarioContaT conta={conta} compact={false} />
                  {proxima && (
                    <CorteDiarioSeta valor={valorSeta} ativa={valorSeta > 0} compact={false} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
