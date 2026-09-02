import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { formatCompetenciaLabel, isCompetenciaPlanejamento } from '@/lib/agefinPrevisaoCalculos';
import {
  abrirCompetenciasDoMes,
  abrirCompetenciaSerie,
  atualizarCentroCustoSerie,
  atualizarCompetenciaManual,
  desfazerAberturaCompetenciasDoMes,
  listarLancamentosCompetencia,
  removerSerie,
  salvarSerie,
  sincronizarLancamentoFinanceiro,
  subscribeSeriesStorageChanges,
} from '@/lib/agefinPrevisaoService';
import { MODO_CADASTRO_SERIE } from '@/lib/agefinPrevisaoCalculos';
import {
  criarParcelamento,
  listarParcelamentos,
  atualizarParcela,
  removerParcelamento,
} from '@/lib/agefinParcelamentoService';
import { parcelamentoAfetaSerieNoMes, montarCompetenciasVisaoComParcelas } from '@/lib/agefinParcelamentoCalculos';
import { invalidarCacheLancamentosFinanceiros } from '@/lib/lancamentoFinanceiroCache';
import { AGEFIN_PREVISAO_ROOT, agefinQueryKeys } from '../constants/queryKeys';

export function usePlanejamentoActions({
  competenciaMes,
  modelos,
  modelosMap,
  parcelamentos,
  contaPadrao,
  selectedComp,
  selectedModelo,
  setSelectedComp,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [salvandoParcelamento, setSalvandoParcelamento] = useState(false);
  const [removendoParcelamento, setRemovendoParcelamento] = useState(false);
  const [serieDialog, setSerieDialog] = useState(null);
  const [parcelamentoDialog, setParcelamentoDialog] = useState(false);
  const [precisaContas, setPrecisaContas] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: AGEFIN_PREVISAO_ROOT });
    queryClient.invalidateQueries({ queryKey: ['visao-financeira'] });
  }, [queryClient]);

  const invalidateLancamentos = useCallback(() => {
    invalidarCacheLancamentosFinanceiros();
    queryClient.invalidateQueries({ queryKey: [...AGEFIN_PREVISAO_ROOT, 'lancamentos'] });
    queryClient.invalidateQueries({ queryKey: agefinQueryKeys.recorrentes });
    queryClient.invalidateQueries({ queryKey: ['visao-financeira'] });
  }, [queryClient]);

  const refreshDepoisDeLancamentos = useCallback(() => {
    invalidateLancamentos();
    invalidate();
  }, [invalidateLancamentos, invalidate]);

  useEffect(() => {
    return subscribeSeriesStorageChanges(() => invalidate());
  }, [invalidate]);

  const invalidateCentros = useCallback(
    (lista) => {
      if (lista) {
        queryClient.setQueryData(agefinQueryKeys.centros, lista);
      }
      queryClient.invalidateQueries({ queryKey: agefinQueryKeys.centros });
      invalidate();
    },
    [queryClient, invalidate],
  );

  const refreshSelectedComp = useCallback(
    (visao) => {
      if (!selectedComp) return;
      if (selectedComp._modoParcela) {
        const par = visao.find(
          (c) =>
            c._modoParcela &&
            c._parcelamentoId === selectedComp._parcelamentoId &&
            c._parcelaNumero === selectedComp._parcelaNumero,
        );
        if (par) setSelectedComp(par);
        return;
      }
      if (selectedComp._fantasmaParcelamento) {
        const ghost = visao.find((c) => c._fantasmaParcelamento && c.serie_id === selectedComp.serie_id);
        if (ghost) setSelectedComp(ghost);
        return;
      }
      const atualizada = visao.find((c) => c.serie_id === selectedComp.serie_id && !c._modoParcela);
      if (atualizada) setSelectedComp(atualizada);
    },
    [selectedComp, setSelectedComp],
  );

  const recarregarVisaoMes = useCallback(async () => {
    const lancs = await listarLancamentosCompetencia(competenciaMes);
    const parcs = await listarParcelamentos();
    return montarCompetenciasVisaoComParcelas(competenciaMes, modelos, lancs, parcs);
  }, [competenciaMes, modelos]);

  const handleAbrirMes = async () => {
    const serieAlvo = isCompetenciaPlanejamento(selectedComp) ? selectedComp.serie_id : null;
    setSaving(true);
    try {
      const { criados, pulados } = await abrirCompetenciasDoMes(competenciaMes);
      refreshDepoisDeLancamentos();
      if (serieAlvo) {
        const visao = await recarregarVisaoMes();
        const real = visao.find((c) => c.serie_id === serieAlvo);
        if (real) setSelectedComp(real);
        else if (modelosMap[serieAlvo]) setSelectedComp(visao.find((c) => c.serie_id === serieAlvo));
      }
      const msg = criados.length ? `${criados.length} conta(s) aberta(s).` : 'Nenhuma conta fixa cadastrada.';
      const extra = pulados.length ? ` ${pulados.length} já existente(s).` : '';
      toast({ title: 'Mês aberto', description: msg + extra });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDesfazerAbrirMes = async () => {
    if (
      !window.confirm(
        `Desfazer abertura de ${formatCompetenciaLabel(competenciaMes)}?\n\nRemove apenas lançamentos gerados automaticamente, sem boleto e não pagos.`,
      )
    )
      return;
    setSaving(true);
    try {
      const { total, removidas, bloqueadas } = await desfazerAberturaCompetenciasDoMes(competenciaMes);
      if (selectedComp && removidas.some((r) => r.id === selectedComp.id)) setSelectedComp(null);
      refreshDepoisDeLancamentos();
      if (!total) {
        toast({ title: 'Nada para desfazer', description: 'Este mês ainda não foi aberto.' });
        return;
      }
      toast({
        title: 'Abertura desfeita',
        description: `${removidas.length} removida(s) · ${bloqueadas.length} preservada(s)`,
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSerie = async (payload) => {
    setSaving(true);
    try {
      const isParcelada = payload.modo_cadastro === MODO_CADASTRO_SERIE.PARCELADA;
      const competenciaOrigem =
        String(payload.competencia_inicio_parcelas || competenciaMes || '').slice(0, 7) ||
        competenciaMes;

      const serieSalva = await salvarSerie(
        {
          ...payload,
          modo_cadastro: isParcelada ? MODO_CADASTRO_SERIE.PARCELADA : MODO_CADASTRO_SERIE.RECORRENTE,
        },
        payload.id ? { competenciaMinima: competenciaMes } : {},
      );

      if (isParcelada && payload._criarParcelamento) {
        await criarParcelamento({
          serieId: serieSalva.id,
          competenciaOrigem,
          valorOriginal: Number(payload.valor_previsto) || 0,
          jurosMulta: 0,
          totalParcelas: Math.max(2, Number(payload.total_parcelas) || 2),
          diaVencimento: Number(payload.dia_vencimento) || 10,
          modelo: serieSalva,
        });
        await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.parcelamentos });
      }

      setSerieDialog(null);
      invalidate();
      const freq = payload.frequencia || 'Mensal';
      toast({
        title: isParcelada ? 'Conta parcelada salva' : payload.id ? 'Cadastro atualizado' : 'Conta salva',
        description: isParcelada
          ? `${payload.total_parcelas || 2} parcelas a partir de ${formatCompetenciaLabel(competenciaOrigem)}.`
          : payload.id
            ? `A partir de ${formatCompetenciaLabel(competenciaMes)} — meses anteriores não mudam.`
            : freq === 'Anual'
              ? 'Conta anual cadastrada — aparece no bloco Anual e no mês de vencimento.'
              : 'Ela já entra na programação e na projeção.',
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSerie = async (serie) => {
    if (!window.confirm(`Remover "${serie.nome}" da agenda? A programação deixa de incluí-la.`)) return;
    setSaving(true);
    try {
      queryClient.setQueryData(agefinQueryKeys.modelos, (old) =>
        (old || []).filter((s) => s.id !== serie.id),
      );
      await removerSerie(serie.id, serie);
      queryClient.invalidateQueries({ queryKey: agefinQueryKeys.modelos });
      queryClient.invalidateQueries({ queryKey: [...AGEFIN_PREVISAO_ROOT, 'lancamentos'] });
      queryClient.invalidateQueries({ queryKey: agefinQueryKeys.recorrentes });
      queryClient.invalidateQueries({ queryKey: ['visao-financeira'] });
      toast({ title: 'Removida da agenda', description: 'Lançamentos em aberto cancelados no financeiro.' });
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: agefinQueryKeys.modelos });
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMoverSerieCentro = async (serie, centro, onDone) => {
    setSaving(true);
    try {
      await atualizarCentroCustoSerie(serie.id, centro);
      invalidate();
      toast({ title: 'Centro atualizado' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
      onDone?.();
    }
  };

  const handleSyncFinanceiro = async () => {
    if (!selectedComp || !contaPadrao || !selectedModelo) {
      setPrecisaContas(true);
      toast({ title: 'Configure uma conta financeira', variant: 'destructive' });
      return;
    }
    setSyncing(true);
    try {
      await sincronizarLancamentoFinanceiro(selectedComp, {
        contaFinanceiraId: contaPadrao.id,
        modelo: selectedModelo,
      });
      refreshDepoisDeLancamentos();
      toast({ title: 'Enviado ao financeiro', description: 'Lançamento previsto criado/atualizado.' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCriarParcelamento = async (payload) => {
    setSalvandoParcelamento(true);
    try {
      await criarParcelamento(payload);
      await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.parcelamentos });
      setParcelamentoDialog(false);
      const visao = await recarregarVisaoMes();
      refreshSelectedComp(visao);
      toast({
        title: 'Conta parcelada',
        description: `${payload.totalParcelas} parcelas criadas a partir de ${formatCompetenciaLabel(payload.competenciaOrigem)}.`,
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoParcelamento(false);
    }
  };

  const handleSalvarParcela = async ({ parcelamentoId, parcelaNumero, valor, dataVencimento, diaVencimento }) => {
    if (!selectedComp) return;
    setSalvandoManual(true);
    try {
      await atualizarParcela(parcelamentoId, parcelaNumero, { valor, dataVencimento, diaVencimento });
      await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.parcelamentos });
      const visao = await recarregarVisaoMes();
      refreshSelectedComp(visao);
      toast({ title: 'Parcela atualizada' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoManual(false);
    }
  };

  const handleRemoverParcelamento = async () => {
    if (!selectedComp?._parcelamentoId) return;
    if (!window.confirm('Desfazer parcelamento? As parcelas deixam de aparecer na previsão.')) return;
    setRemovendoParcelamento(true);
    try {
      await removerParcelamento(selectedComp._parcelamentoId);
      await queryClient.invalidateQueries({ queryKey: agefinQueryKeys.parcelamentos });
      setSelectedComp(null);
      toast({ title: 'Parcelamento removido' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setRemovendoParcelamento(false);
    }
  };

  const handleSalvarManual = async ({ valor, dataVencimento, diaVencimento }) => {
    if (!selectedComp) return;
    setSalvandoManual(true);
    try {
      await atualizarCompetenciaManual({
        competencia: selectedComp,
        modelo: selectedModelo,
        valor,
        dataVencimento,
        diaVencimento,
      });
      refreshDepoisDeLancamentos();
      const visao = await recarregarVisaoMes();
      refreshSelectedComp(visao);
      toast({
        title: 'Salvo',
        description: 'Valor e vencimento gravados só neste mês.',
      });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoManual(false);
    }
  };

  const handleAbrirSerieNoMes = async () => {
    if (!selectedComp || !selectedModelo) return;
    setSaving(true);
    try {
      await abrirCompetenciaSerie(selectedModelo, competenciaMes);
      refreshDepoisDeLancamentos();
      const visao = await recarregarVisaoMes();
      refreshSelectedComp(visao);
      toast({ title: 'Conta aberta no mês' });
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleVincularBoleto = async (onOpenImportador) => {
    if (!selectedComp) return;

    if (isCompetenciaPlanejamento(selectedComp) && !selectedComp.lancamento_id && selectedModelo) {
      setSaving(true);
      try {
        const lf = await abrirCompetenciaSerie(selectedModelo, competenciaMes);
        refreshDepoisDeLancamentos();
        const visao = await recarregarVisaoMes();
        refreshSelectedComp(visao);
        onOpenImportador(lf?.id || null);
      } catch (e) {
        toast({ title: 'Erro', description: e.message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
      return;
    }

    onOpenImportador(selectedComp.lancamento_id || null);
  };

  const podeParcelarConta =
    selectedComp &&
    !selectedComp._fantasmaParcelamento &&
    !selectedComp._modoParcela &&
    !parcelamentoAfetaSerieNoMes(parcelamentos, selectedComp.serie_id, competenciaMes);

  return {
    saving,
    syncing,
    salvandoManual,
    salvandoParcelamento,
    removendoParcelamento,
    serieDialog,
    setSerieDialog,
    parcelamentoDialog,
    setParcelamentoDialog,
    precisaContas,
    setPrecisaContas,
    invalidateCentros,
    refreshDepoisDeLancamentos,
    recarregarVisaoMes,
    refreshSelectedComp,
    handleAbrirMes,
    handleDesfazerAbrirMes,
    handleSaveSerie,
    handleDeleteSerie,
    handleMoverSerieCentro,
    handleSyncFinanceiro,
    handleCriarParcelamento,
    handleSalvarParcela,
    handleRemoverParcelamento,
    handleSalvarManual,
    handleAbrirSerieNoMes,
    handleVincularBoleto,
    podeParcelarConta,
  };
}
