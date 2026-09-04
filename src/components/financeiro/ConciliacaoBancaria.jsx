import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ArrowRightLeft, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import CorrigirDataLoteDialog from './CorrigirDataLoteDialog';
import { dataHoje } from '@/components/utils/dateUtils';
import {
  CONCILIACAO_LOTE_TAMANHO,
  agruparPorContaFinanceira,
  calcularValorReconciliadoItem,
  deltaSaldoConciliacao,
  processarEmLotes,
} from '@/lib/conciliacaoEmLote';
import {
  dataFinanceiraKey,
  hojeFinanceiroStr,
  passaFiltroPeriodo,
  periodoRangeFinanceiro,
  PERIODOS_DATA_PAGAMENTO,
  parseDataFinanceira,
} from '@/lib/filtroDataFinanceiro';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE } from './fluxo/financeiroP38';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIODOS_PREVISTA = [
  { v: 'vencidas', l: 'Vencidas' },
  { v: 'hoje', l: 'Hoje' },
  { v: 'semana', l: '7 dias' },
  { v: 'mes', l: 'Mês' },
  { v: 'futuras', l: 'Futuras' },
  { v: 'todas', l: 'Todas' },
  { v: 'personalizado', l: 'Personalizado' },
];

function getDataCampoConciliacao(l, campo) {
  if (campo === 'pagamento') return dataFinanceiraKey(l.data_pagamento);
  if (campo === 'liquidacao') return dataFinanceiraKey(l.data_liquidacao_efetiva);
  return dataFinanceiraKey(l.data_liquidacao_prevista || l.data_vencimento);
}

export default function ConciliacaoBancaria({ contaId, contaNome, onClose, onConciliado }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selecionados, setSelecionados] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [dialogConfirm, setDialogConfirm] = useState(false);
  const [valorConfirmado, setValorConfirmado] = useState('');
  const [dataEfetiva, setDataEfetiva] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [processing, setProcessing] = useState(false);
  const [progressoLote, setProgressoLote] = useState({ atual: 0, total: 0 });
  const [todasContas, setTodasContas] = useState([]);
  const [mostrarConciliados, setMostrarConciliados] = useState(false);
  const [modoCorrigirData, setModoCorrigirData] = useState(false);
  const [showCorrigirData, setShowCorrigirData] = useState(false);
  const [dataCorrigir, setDataCorrigir] = useState(dataHoje());
  const [campoFiltroData, setCampoFiltroData] = useState('prevista');
  const [periodo, setPeriodo] = useState('mes');
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const { toast } = useToast();

  const camposFiltroDisponiveis = mostrarConciliados
    ? [
        { v: 'liquidacao', l: 'Liquidação' },
        { v: 'pagamento', l: 'Pagamento' },
      ]
    : [
        { v: 'prevista', l: 'Prevista' },
        { v: 'pagamento', l: 'Pagamento' },
      ];

  const periodosVisiveis = campoFiltroData === 'pagamento' ? PERIODOS_DATA_PAGAMENTO : PERIODOS_PREVISTA;

  const loadLancamentos = useCallback(async () => {
    setIsLoading(true);
    const baseFilter = contaId ? { conta_financeira_id: contaId } : {};
    const contasLista = await base44.entities.ContasFinanceiras.filter({ ativo: true });

    let dados = [];
    if (mostrarConciliados) {
      const [conciliados, ajustados] = await Promise.all([
        base44.entities.LancamentoFinanceiro.filter({ ...baseFilter, status_conciliacao: 'Conciliado' }),
        base44.entities.LancamentoFinanceiro.filter({ ...baseFilter, status_conciliacao: 'Ajustado' }),
      ]);
      dados = [...conciliados, ...ajustados];
    } else {
      dados = await base44.entities.LancamentoFinanceiro.filter({ ...baseFilter, status_conciliacao: 'Pendente' });
    }

    setLancamentos(
      dados.sort((a, b) => {
        const da = getDataCampoConciliacao(a, 'prevista') || '';
        const db = getDataCampoConciliacao(b, 'prevista') || '';
        return da.localeCompare(db);
      })
    );
    setTodasContas(contasLista);
    setSelecionados([]);
    setIsLoading(false);
  }, [contaId, mostrarConciliados]);

  useEffect(() => {
    loadLancamentos();
  }, [loadLancamentos]);

  const { s: ds, e: de } = useMemo(() => periodoRangeFinanceiro(periodo, cs, ce), [periodo, cs, ce]);

  const lancamentosFiltrados = useMemo(() => {
    const hojeStr = hojeFinanceiroStr();
    return lancamentos.filter((l) => {
      const dataStr = getDataCampoConciliacao(l, campoFiltroData);
      const dataDate = parseDataFinanceira(dataStr);
      if ((campoFiltroData === 'pagamento' || campoFiltroData === 'liquidacao') && !dataStr) return false;
      return passaFiltroPeriodo(dataStr, dataDate, periodo, ds, de, hojeStr);
    });
  }, [lancamentos, campoFiltroData, periodo, ds, de]);

  const grupos = useMemo(() => {
    const mapa = {};
    lancamentosFiltrados.forEach((l) => {
      const chave = getDataCampoConciliacao(l, campoFiltroData) || 'sem-data';
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(l);
    });
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b));
  }, [lancamentosFiltrados, campoFiltroData]);

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleGrupo = (data) => {
    const ids = grupos.find(([d]) => d === data)?.[1].map((l) => l.id) || [];
    const todosSelecionadosGrupo = ids.every((id) => selecionados.includes(id));
    if (todosSelecionadosGrupo) {
      setSelecionados((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelecionados((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleExpandido = (data) => {
    setExpandidos((prev) => ({ ...prev, [data]: !prev[data] }));
  };

  const selecionadosData = lancamentosFiltrados.filter((l) => selecionados.includes(l.id));
  const totalSelecionado = selecionadosData.reduce((s, l) => s + (l.valor_liquido || l.valor || 0), 0);
  const todosIds = lancamentosFiltrados.map((l) => l.id);
  const todosSelecionados = todosIds.length > 0 && todosIds.every((id) => selecionados.includes(id));

  const resumoContasSelecionadas = useMemo(() => {
    const mapa = agruparPorContaFinanceira(selecionadosData);
    return Object.entries(mapa)
      .filter(([id]) => id !== '_sem_conta')
      .map(([id, items]) => ({
        id,
        nome:
          items[0]?.conta_financeira_nome ||
          todasContas.find((c) => c.id === id)?.nome ||
          'Conta',
        total: items.reduce((s, l) => s + (l.valor_liquido || l.valor || 0), 0),
        qtd: items.length,
      }));
  }, [selecionadosData, todasContas]);

  const toggleSelecionarTodos = () => {
    setSelecionados(todosSelecionados ? [] : todosIds);
  };

  const handleCampoFiltroData = (campo) => {
    setCampoFiltroData(campo);
    if (campo === 'pagamento' && !PERIODOS_DATA_PAGAMENTO.some((p) => p.v === periodo)) {
      setPeriodo('mes');
      setCs('');
      setCe('');
    }
    if (campo === 'liquidacao' && !PERIODOS_DATA_PAGAMENTO.some((p) => p.v === periodo)) {
      setPeriodo('mes');
      setCs('');
      setCe('');
    }
    if (campo === 'prevista' && !PERIODOS_PREVISTA.some((p) => p.v === periodo)) {
      setPeriodo('mes');
      setCs('');
      setCe('');
    }
  };

  const setVisaoConciliados = (conciliados) => {
    setMostrarConciliados(conciliados);
    setCampoFiltroData(conciliados ? 'liquidacao' : 'prevista');
    setPeriodo('mes');
    setCs('');
    setCe('');
    setModoCorrigirData(false);
    setSelecionados([]);
  };

  const entrarModoCorrigirData = () => {
    if (modoCorrigirData) {
      setModoCorrigirData(false);
      setSelecionados([]);
      return;
    }
    setModoCorrigirData(true);
    setSelecionados([]);
    if (campoFiltroData === 'prevista') {
      setCampoFiltroData(mostrarConciliados ? 'liquidacao' : 'pagamento');
    }
  };

  const abrirConciliacao = () => {
    if (selecionados.length === 0) {
      toast({ title: 'Selecione ao menos um lançamento', variant: 'destructive' });
      return;
    }
    const semConta = selecionadosData.filter((l) => !l.conta_financeira_id);
    if (semConta.length > 0) {
      toast({
        title: 'Lançamentos sem conta vinculada',
        description: `${semConta.length} item(ns) não têm conta financeira. Vincule antes de conciliar.`,
        variant: 'destructive',
      });
      return;
    }
    setValorConfirmado(totalSelecionado.toFixed(2));
    setDialogConfirm(true);
  };

  const confirmarConciliacao = async () => {
    const idsSnapshot = [...selecionados];
    const itensSnapshot = lancamentosFiltrados.filter((l) => idsSnapshot.includes(l.id));
    if (itensSnapshot.length === 0) return;

    const valorReal = parseFloat(valorConfirmado);
    if (!Number.isFinite(valorReal) || valorReal <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setProgressoLote({ atual: 0, total: itensSnapshot.length });

    const grupoId = `CONC-${Date.now()}`;
    const dataEfetivaISO = dataEfetiva;
    const totalEsperado = totalSelecionado;

    try {
      const preparados = itensSnapshot.map((l) => {
        const { valor, status } = calcularValorReconciliadoItem(l, valorReal, totalEsperado);
        return { lancamento: l, valorReconciliado: valor, status };
      });

      const { erros, sucessos } = await processarEmLotes(
        preparados,
        CONCILIACAO_LOTE_TAMANHO,
        async ({ lancamento, valorReconciliado, status }) => {
          const eraAberto = lancamento.status !== 'Pago' && !lancamento.data_pagamento;
          const payload = {
            status_conciliacao: status,
            data_liquidacao_efetiva: dataEfetivaISO,
            conciliacao_grupo_id: grupoId,
          };
          if (eraAberto) {
            payload.status = 'Pago';
            payload.data_pagamento = dataEfetivaISO;
          }
          if (status === 'Ajustado') {
            payload.valor_liquido = valorReconciliado;
          }
          await base44.entities.LancamentoFinanceiro.update(lancamento.id, payload);
        },
        (atual, total) => setProgressoLote({ atual, total })
      );

      if (sucessos.length === 0) {
        throw new Error('Nenhum lançamento foi atualizado.');
      }

      const contasMutaveis = todasContas.map((c) => ({ ...c }));
      const deltaPorConta = {};

      for (const item of sucessos) {
        const { lancamento, valorReconciliado } = item;
        const contaIdItem = lancamento.conta_financeira_id;
        const delta = deltaSaldoConciliacao(lancamento, valorReconciliado);
        if (delta !== 0 && contaIdItem) {
          deltaPorConta[contaIdItem] = (deltaPorConta[contaIdItem] || 0) + delta;
        }
      }

      const contasParaAtualizar = Object.entries(deltaPorConta);
      for (let i = 0; i < contasParaAtualizar.length; i += CONCILIACAO_LOTE_TAMANHO) {
        const loteContas = contasParaAtualizar.slice(i, i + CONCILIACAO_LOTE_TAMANHO);
        await Promise.all(
          loteContas.map(([idConta, delta]) => {
            const conta = contasMutaveis.find((c) => c.id === idConta);
            if (!conta) return Promise.resolve();
            const novoSaldo = (conta.saldo_atual || 0) + delta;
            conta.saldo_atual = novoSaldo;
            return base44.entities.ContasFinanceiras.update(idConta, { saldo_atual: novoSaldo });
          })
        );
      }

      const qtdContas = Object.keys(deltaPorConta).length;
      const descricaoSucesso =
        erros.length > 0
          ? `${sucessos.length} de ${itensSnapshot.length} conciliado(s) — ${erros.length} falha(s)`
          : `${sucessos.length} lançamento(s) em ${qtdContas || resumoContasSelecionadas.length} conta(s) — ${fmt(valorReal)}`;

      toast({
        title: erros.length > 0 ? 'Conciliação parcial' : 'Conciliação realizada',
        description: descricaoSucesso,
        className: erros.length > 0 ? undefined : 'bg-green-50 text-green-800',
        variant: erros.length > 0 ? 'destructive' : 'default',
      });

      setDialogConfirm(false);
      setSelecionados([]);
      await loadLancamentos();
      onConciliado?.();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro na conciliação',
        description: error?.message || 'Não foi possível concluir a operação.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setProgressoLote({ atual: 0, total: 0 });
    }
  };

  const confirmarCorrigirData = async () => {
    const itensLote = selecionadosData;
    if (!dataCorrigir || itensLote.length === 0) return;

    const campoAtualizar = mostrarConciliados ? 'data_liquidacao_efetiva' : 'data_pagamento';

    setProcessing(true);
    setProgressoLote({ atual: 0, total: itensLote.length });
    try {
      const { erros, sucessos } = await processarEmLotes(
        itensLote,
        CONCILIACAO_LOTE_TAMANHO,
        async (lancamento) => {
          await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
            [campoAtualizar]: dataCorrigir,
          });
        },
        (atual, total) => setProgressoLote({ atual, total })
      );

      if (sucessos.length === 0) {
        throw new Error('Nenhum lançamento foi atualizado.');
      }

      const labelCampo = mostrarConciliados ? 'liquidação' : 'pagamento';
      toast({
        title: erros.length > 0 ? 'Correção parcial' : 'Datas corrigidas',
        description: erros.length > 0
          ? `${sucessos.length} de ${itensLote.length} data(s) de ${labelCampo} corrigida(s)`
          : `${sucessos.length} data(s) de ${labelCampo} atualizada(s).`,
        variant: erros.length > 0 ? 'destructive' : 'default',
      });

      setShowCorrigirData(false);
      setModoCorrigirData(false);
      setSelecionados([]);
      setDataCorrigir(dataHoje());
      await loadLancamentos();
      onConciliado?.();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao corrigir datas',
        description: error?.message || 'Não foi possível atualizar todos os lançamentos.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setProgressoLote({ atual: 0, total: 0 });
    }
  };

  const getStatusData = (dataStr) => {
    if (!dataStr || dataStr === 'sem-data') return { cor: 'text-muted-foreground', label: 'Sem data' };
    const d = parseISO(dataStr);
    if (isPast(d) && !isToday(d)) return { cor: 'text-red-500', label: 'Atrasado' };
    if (isToday(d)) return { cor: 'text-amber-500', label: 'Hoje' };
    return { cor: 'text-muted-foreground', label: format(d, 'dd/MM', { locale: ptBR }) };
  };

  const mostrarContaNoItem = !contaId;
  const corrigirTitulo = mostrarConciliados ? 'Corrigir data de liquidação' : 'Corrigir data de pagamento';
  const corrigirLabel = mostrarConciliados ? 'Nova data de liquidação efetiva' : 'Nova data de pagamento';
  const corrigirDescricao = mostrarConciliados
    ? 'Apenas a data de liquidação efetiva será alterada — saldos não mudam.'
    : 'Apenas a data de pagamento será alterada — saldos e contas não mudam.';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border/40" />
      </div>
    );
  }

  if (lancamentosFiltrados.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-green-500" />
        </div>
        <p className="font-medium text-foreground/90">
          {lancamentos.length === 0
            ? (mostrarConciliados ? 'Nenhum conciliado' : 'Nada pendente')
            : 'Nenhum lançamento neste filtro'}
        </p>
        <p className="text-sm text-muted-foreground">
          {lancamentos.length === 0
            ? (mostrarConciliados
              ? 'Não há lançamentos conciliados nesta conta.'
              : 'Todos os lançamentos desta conta estão conciliados.')
            : 'Ajuste o período ou o tipo de data nos filtros.'}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 pb-3">
      <div className="bg-muted/50/50 rounded-2xl p-4 flex items-start gap-3 border border-border/40">
        <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1 text-foreground/90">
            {mostrarConciliados ? 'Conciliados' : 'Como conciliar'}
          </p>
          <p className="text-xs leading-relaxed">
            {mostrarConciliados
              ? 'Visualize e corrija datas de liquidação em lote. Use o filtro por data de pagamento para achar um lote específico.'
              : `Selecione os lançamentos confirmados no extrato. Operações grandes são processadas em lotes de ${CONCILIACAO_LOTE_TAMANHO}.`}
          </p>
        </div>
      </div>

      <div className="max-h-[min(34vh,15rem)] space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-border/40 bg-card/60 p-3 [scrollbar-gutter:stable]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setVisaoConciliados(false)}
              className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${!mostrarConciliados ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setVisaoConciliados(true)}
              className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${mostrarConciliados ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
            >
              Conciliados
            </button>
          </div>
          <button
            type="button"
            onClick={entrarModoCorrigirData}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${modoCorrigirData ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
          >
            {modoCorrigirData ? 'Cancelar correção' : 'Corrigir data'}
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Filtrar por</p>
          <div className="flex flex-wrap gap-1.5">
            {camposFiltroDisponiveis.map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => handleCampoFiltroData(v)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${campoFiltroData === v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</p>
          <div className="flex flex-wrap gap-1.5">
            {periodosVisiveis.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setPeriodo(p.v)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${periodo === p.v ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE}`}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {periodo === 'personalizado' && (
          <div className="flex gap-2">
            <input
              autoComplete="off"
              type="date"
              value={cs}
              onChange={(e) => setCs(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-secondary/80 px-2.5 py-2 text-sm text-foreground outline-none dark:bg-[#383e47]"
            />
            <input
              autoComplete="off"
              type="date"
              value={ce}
              onChange={(e) => setCe(e.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-secondary/80 px-2.5 py-2 text-sm text-foreground outline-none dark:bg-[#383e47]"
            />
          </div>
        )}
      </div>
      </div>

      {modoCorrigirData && (
        <div className="shrink-0 mb-3 rounded-xl border border-border/40 bg-card/60 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{corrigirTitulo}</p>
              <p className="text-xs text-muted-foreground">
                {selecionadosData.length} de {lancamentosFiltrados.length} selecionado(s)
              </p>
              {selecionadosData.length > CONCILIACAO_LOTE_TAMANHO && (
                <p className="text-[10px] text-muted-foreground">
                  Serão processados em {Math.ceil(selecionadosData.length / CONCILIACAO_LOTE_TAMANHO)} lotes de {CONCILIACAO_LOTE_TAMANHO}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSelecionarTodos} className="rounded-xl text-xs">
                {todosSelecionados ? 'Limpar tudo' : 'Selecionar tudo'}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCorrigirData(true)}
                disabled={selecionadosData.length === 0}
                className="rounded-xl"
              >
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 px-1 pb-2">
        <div>
          <p className="text-xs font-semibold text-foreground/90">{contaNome || 'Todas as contas'}</p>
          <p className="text-[11px] text-muted-foreground">
            {lancamentosFiltrados.length} lançamento{lancamentosFiltrados.length !== 1 ? 's' : ''}{' '}
            {mostrarConciliados ? 'conciliado' : 'pendente'}
            {lancamentosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!modoCorrigirData && (
          <Button variant="ghost" size="sm" onClick={toggleSelecionarTodos} className="rounded-xl text-xs">
            {todosSelecionados ? 'Limpar tudo' : 'Selecionar tudo'}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
        {grupos.map(([data, items]) => {
          const totalGrupo = items.reduce((s, l) => s + (l.valor_liquido || l.valor || 0), 0);
          const idsDaData = items.map((l) => l.id);
          const todosSelecionadosGrupo = idsDaData.every((id) => selecionados.includes(id));
          const algumSelecionado = idsDaData.some((id) => selecionados.includes(id));
          const isExpanded = expandidos[data] !== false;
          const { cor, label } = getStatusData(data);

          return (
            <div key={data} className="bg-card rounded-2xl shadow-sm overflow-hidden border border-border/40">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpandido(data)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGrupo(data);
                  }}
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                    todosSelecionadosGrupo
                      ? 'bg-primary dark:bg-muted'
                      : algumSelecionado
                        ? 'bg-muted-foreground/40'
                        : 'border-2 border-border/40 dark:border-border/40'
                  }`}
                >
                  {(todosSelecionadosGrupo || algumSelecionado) && (
                    <Check className="w-3 h-3 text-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${cor}`}>{label}</span>
                    <span className="text-xs text-muted-foreground dark:text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} lançamento{items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{fmt(totalGrupo)}</p>
                </div>

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {isExpanded && (
                <div className="border-t border-border/40">
                  {items.map((l) => {
                    const isSel = selecionados.includes(l.id);
                    const dataPag = dataFinanceiraKey(l.data_pagamento);
                    const dataLiq = dataFinanceiraKey(l.data_liquidacao_efetiva);
                    return (
                      <div
                        key={l.id}
                        onClick={() => toggleSelecionado(l.id)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isSel
                            ? 'bg-muted/40 dark:bg-muted/30'
                            : 'hover:bg-muted/40/50 dark:hover:bg-primary/90/20'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSel ? 'bg-primary dark:bg-muted' : 'border-2 border-border/40'
                          }`}
                        >
                          {isSel && <Check className="w-2.5 h-2.5 text-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground/90 truncate">{l.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {mostrarContaNoItem && l.conta_financeira_nome
                              ? `${l.conta_financeira_nome} • `
                              : ''}
                            {l.forma_pagamento || l.forma_pagamento_tipo || '—'}
                            {dataPag ? ` • Pago ${format(parseISO(dataPag), 'dd/MM', { locale: ptBR })}` : ''}
                            {dataLiq ? ` • Liq. ${format(parseISO(dataLiq), 'dd/MM', { locale: ptBR })}` : ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {fmt(l.valor_liquido || l.valor)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {selecionados.length > 0 && !modoCorrigirData && !mostrarConciliados && (
        <div className="mt-3 shrink-0 rounded-2xl border border-border/40 bg-primary p-4 shadow-lg dark:bg-muted flex items-center justify-between gap-4">
          <div className="text-white">
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
              {resumoContasSelecionadas.length > 1
                ? ` · ${resumoContasSelecionadas.length} contas`
                : ''}
            </p>
            <p className="text-xl font-bold">{fmt(totalSelecionado)}</p>
          </div>
          <Button
            onClick={abrirConciliacao}
            className="bg-card text-foreground hover:bg-muted/40 gap-2 flex-shrink-0 rounded-xl font-medium shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Conciliar
          </Button>
        </div>
      )}

      <Dialog open={dialogConfirm} onOpenChange={setDialogConfirm}>
        <DialogContent className="flex max-h-[min(92vh,36rem)] w-[calc(100vw-1rem)] max-w-sm flex-col gap-0 overflow-hidden p-0 dark:border-border/40 dark:bg-muted">
          <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
            <DialogTitle className="text-foreground">Confirmar Conciliação</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-2 [scrollbar-gutter:stable]">
            <div className="bg-muted/40 dark:bg-muted rounded-xl p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                {selecionados.length} lançamento{selecionados.length > 1 ? 's' : ''} selecionado
                {selecionados.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm font-medium text-foreground/90">Total esperado: {fmt(totalSelecionado)}</p>
            </div>

            {resumoContasSelecionadas.length > 0 && (
              <div className="rounded-xl border border-border/40 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground/90">Contas vinculadas</p>
                {resumoContasSelecionadas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate pr-2">
                      {c.nome} ({c.qtd})
                    </span>
                    <span className="font-medium text-foreground shrink-0">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="text-foreground/90 text-sm">Valor real recebido</Label>
              <Input
                type="number"
                step="0.01"
                value={valorConfirmado}
                onChange={(e) => setValorConfirmado(e.target.value)}
                className="mt-1 dark:bg-muted dark:border-border/40"
                disabled={processing}
              />
              {parseFloat(valorConfirmado) !== totalSelecionado && (
                <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Divergência de {fmt(Math.abs(parseFloat(valorConfirmado || 0) - totalSelecionado))} — ajuste
                  proporcional por lançamento
                </p>
              )}
            </div>

            <div>
              <Label className="text-foreground/90 text-sm">Data do recebimento</Label>
              <Input
                type="date"
                value={dataEfetiva}
                onChange={(e) => setDataEfetiva(e.target.value)}
                className="mt-1 dark:bg-muted dark:border-border/40"
                disabled={processing}
              />
            </div>

            {processing && progressoLote.total > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Processando lote… {progressoLote.atual}/{progressoLote.total}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/40 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setDialogConfirm(false)}
              disabled={processing}
              className="dark:bg-muted dark:border-border/40"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarConciliacao}
              disabled={processing}
              className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground"
            >
              {processing ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CorrigirDataLoteDialog
        open={showCorrigirData}
        onOpenChange={setShowCorrigirData}
        dataPagamento={dataCorrigir}
        setDataPagamento={setDataCorrigir}
        selecionados={selecionadosData}
        onConfirm={confirmarCorrigirData}
        loading={processing}
        progresso={progressoLote}
        tamanhoLote={CONCILIACAO_LOTE_TAMANHO}
        titulo={corrigirTitulo}
        labelData={corrigirLabel}
        descricao={corrigirDescricao}
        itemLabel="selecionado(s)"
      />
    </div>
  );
}
