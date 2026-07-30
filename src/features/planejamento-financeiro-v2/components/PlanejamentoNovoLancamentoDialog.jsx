import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NovoLancamentoDialog from '@/components/financeiro/NovoLancamentoDialog';
import { useToast } from '@/components/ui/use-toast';
import { listarCategoriasDespesa } from '@/lib/budgetService';
import { listarCentrosCustoRegistros } from '@/lib/agefinPrevisaoService';
import { agefinQueryKeys } from '../constants/queryKeys';
import { persistirOverlayPlanejamentoAposLancamento } from '../lib/planejamentoLancamentoBridge';

export default function PlanejamentoNovoLancamentoDialog({ open, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [centroCusto, setCentroCusto] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');

  const categoriasQuery = useQuery({
    queryKey: agefinQueryKeys.categorias,
    queryFn: listarCategoriasDespesa,
    enabled: open,
    staleTime: 60_000,
  });

  const centrosQuery = useQuery({
    queryKey: agefinQueryKeys.centros,
    queryFn: listarCentrosCustoRegistros,
    enabled: open,
    staleTime: 60_000,
  });

  const reloadCategorias = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.categorias });
  }, [queryClient]);

  const reloadCentros = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.centros });
  }, [queryClient]);

  const handleClose = () => {
    setCentroCusto('');
    setCentroCustoId('');
    onClose?.();
  };

  const handleSaved = async (resultado) => {
    try {
      if (resultado?.is_recorrente && resultado?.grupo_lancamento_id) {
        await persistirOverlayPlanejamentoAposLancamento({
          grupo_lancamento_id: resultado.grupo_lancamento_id,
          descricao: resultado.descricao,
          valor: resultado.valor,
          categoria_id: resultado.categoria_id,
          categoria: resultado.categoria,
          centro_custo: centroCusto,
          centro_custo_id: centroCustoId,
          frequencia: resultado.frequencia,
          data_vencimento: resultado.data_vencimento,
        });
      }
    } catch (error) {
      console.warn('[planejamento] overlay após lançamento:', error);
      toast({
        title: 'Lançamento salvo, mas planejamento não sincronizou',
        description: error?.message || 'Tente abrir a conta na previsão e salvar de novo.',
        variant: 'destructive',
      });
    }
    setCentroCusto('');
    setCentroCustoId('');
    await onSaved?.(resultado);
  };

  return (
    <NovoLancamentoDialog
      open={open}
      onClose={handleClose}
      onSaved={handleSaved}
      tipoInicial="Despesa"
      modoPlanejamento
      centroCusto={centroCusto}
      centroCustoId={centroCustoId}
      onCentroCustoChange={(v) => {
        if (v && typeof v === 'object') {
          setCentroCusto(v.nome || '');
          setCentroCustoId(v.id || '');
          return;
        }
        setCentroCusto(typeof v === 'string' ? v : '');
        setCentroCustoId('');
      }}
      centrosCustoRegistros={centrosQuery.data ?? []}
      onCentrosCustoChange={reloadCentros}
      categoriasDespesa={categoriasQuery.data ?? []}
      onCategoriasDespesaChange={reloadCategorias}
    />
  );
}
