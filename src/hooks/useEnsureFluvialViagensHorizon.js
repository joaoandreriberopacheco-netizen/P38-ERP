import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ensureFluvialViagensHorizon } from '@/lib/ensureFluvialViagensHorizon';
import { p38Keys } from '@/lib/p38QueryConfig';
import {
  useLogisticaEventosQuery,
  useTransportadorasFluvialQuery,
} from '@/hooks/useP38Entities';

/**
 * Mantém a grade de viagens fluviais com ~3 meses à frente (gerarViagensTransportadora).
 * Usar em Boats e no Itinerário Fluvial para não depender só de abrir a aba Barcos.
 */
export function useEnsureFluvialViagensHorizon({ enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { data: transportadoras = [], isPending: transportadorasPending } = useTransportadorasFluvialQuery({
    enabled,
  });
  const { data: eventos = [], isPending: eventosPending } = useLogisticaEventosQuery({
    enabled,
  });

  useEffect(() => {
    if (!enabled || transportadorasPending || eventosPending || !transportadoras.length) return;

    let cancelled = false;

    (async () => {
      const result = await ensureFluvialViagensHorizon(transportadoras, eventos);
      if (cancelled || !result?.created) return;
      await queryClient.invalidateQueries({ queryKey: p38Keys.logistica.eventos() });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, transportadorasPending, eventosPending, transportadoras, eventos, queryClient]);
}
