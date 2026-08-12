import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  FileDown,
  Printer,
  Scale,
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { printOrShareElementAsPdf } from '@/lib/mobilePrintAndShare';
import { dataHoje, dataMenosDiasSistema, boundsMesCivil, formatarDataHora, formatarSoData, inicioSemanaCivilDesdeYmd, toLocalDateKey } from '@/components/utils/dateUtils';
import { getDataAncoraFluxoKey } from '@/lib/lancamentoFinanceiroStatus';
import {
  DATA_CORTE_HISTORICO_PADRAO,
  lerPreferenciasCorteHistorico,
  passaFiltroCorteHistorico,
} from '@/lib/filtroDataFinanceiro';
import {
  fetchLancamentosExtratoConta,
  fetchMovimentosExtratoConta,
} from '@/lib/fetchLancamentosExtratoAgefin';
import { roundToTwoDecimals, sortLancamentosPorDescricao } from '@/lib/financialUtils';
import KpiExtratoConta from '@/components/financeiro/fluxo/KpiExtratoConta';
import FiltrosExtratoConta, { PERIODOS_EXTRATO } from '@/components/financeiro/fluxo/FiltrosExtratoConta';
import ListaExtratoConta from '@/components/financeiro/fluxo/ListaExtratoConta';
import FinanceiroListaMeta, { FinanceiroSummaryChip } from '@/components/financeiro/fluxo/FinanceiroListaMeta';
import { formatFinanceiroGrupoLabel } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import AjusteSaldoDialog from '@/components/config/AjusteSaldoDialog';
import {
  buildMapaContrapartesTransferencia,
  calcularSaldoContaAposDataCorte,
  calcularSaldoContaFinanceira,
  contaUsaRegraCaixaPDV,
  getDataMovimentoCaixa,
  idsMovimentosComLancamentoFinanceiro,
  movimentoParticipaExtrato,
  totaisEntradaSaidaMovimentos,
} from '@/lib/saldoContaFinanceira';
import { reconciliarSaldoCaixaPDVSemTurnoAberto, backfillLancamentosMovimentosCaixaPDV } from '@/lib/contaDestinoCaixaPDV';

function getDataKeyMovimentoExtrato(mov) {
  if (mov?.origem === 'movimento' || (mov?.conta_id && !mov?.conta_financeira_id)) {
    const raw = getDataMovimentoCaixa(mov);
    return raw ? toLocalDateKey(raw) : null;
  }
  return getDataAncoraFluxoKey(mov);
}

function intervaloExtratoYmd(periodo, cs, ce) {
  const hoje = dataHoje();
  const [ano, mes] = hoje.split('-').map(Number);
  if (periodo === 'hoje') return { inicio: hoje, fim: hoje };
  if (periodo === 'ontem') {
    const ontem = dataMenosDiasSistema(1);
    return { inicio: ontem, fim: ontem };
  }
  if (periodo === 'semana') {
    return { inicio: inicioSemanaCivilDesdeYmd(hoje), fim: hoje };
  }
  if (periodo === 'mes') {
    const { start, end } = boundsMesCivil(ano, mes - 1);
    return { inicio: start, fim: end };
  }
  if (periodo === 'todos') return { inicio: null, fim: hoje };
  if (periodo === 'personalizado' && cs && ce) {
    return { inicio: String(cs).slice(0, 10), fim: String(ce).slice(0, 10) };
  }
  return { inicio: null, fim: hoje };
}

function passaIntervaloExtratoYmd(dataKey, inicio, fim) {
  if (!dataKey) return false;
  if (inicio && dataKey < inicio) return false;
  if (fim && dataKey > fim) return false;
  return true;
}

export default function ExtratoContaPage() {
  const [conta, setConta] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [movimentosCaixa, setMovimentosCaixa] = useState([]);
  /** Base completa para saldo quando há corte histórico (lista exibida pode ser recortada). */
  const [lancsSaldoBase, setLancsSaldoBase] = useState([]);
  const [movsSaldoBase, setMovsSaldoBase] = useState([]);
  const [contas, setContas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [dialogType, setDialogType] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ajusteDialogOpen, setAjusteDialogOpen] = useState(false);
  const [mostrarHistoricoAnterior, setMostrarHistoricoAnterior] = useState(
    () => lerPreferenciasCorteHistorico().mostrarHistoricoAnterior,
  );
  const [dataCorteHistorico, setDataCorteHistorico] = useState(
    () => lerPreferenciasCorteHistorico().dataCorte || DATA_CORTE_HISTORICO_PADRAO,
  );
  const { toast } = useToast();

  const [formLancamento, setFormLancamento] = useState({
    tipo: 'Receita',
    descricao: '',
    valor: 0,
    categoria: 'Outros',
    data_vencimento: format(new Date(), 'yyyy-MM-dd'),
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pago'
  });

  const [formTransferencia, setFormTransferencia] = useState({
    conta_destino_id: '',
    valor: 0,
    descricao: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contaId = params.get('id');
    if (contaId) {
      loadExtrato(contaId);
    }
  }, []);

  const loadExtrato = async (contaId) => {
    setIsLoading(true);
    try {
      const prefsCorte = lerPreferenciasCorteHistorico();
      setMostrarHistoricoAnterior(prefsCorte.mostrarHistoricoAnterior);
      setDataCorteHistorico(prefsCorte.dataCorte || DATA_CORTE_HISTORICO_PADRAO);

      const hoje = dataHoje();
      const dataFim = hoje;
      const dataInicio = !prefsCorte.mostrarHistoricoAnterior && prefsCorte.dataCorte
        ? prefsCorte.dataCorte
        : format(subMonths(new Date(`${hoje}T12:00:00`), 24), 'yyyy-MM-dd');

      const [contaData, contasData] = await Promise.all([
        base44.entities.ContasFinanceiras.filter({ id: contaId }),
        base44.entities.ContasFinanceiras.list(),
      ]);

      if (contaData.length > 0) {
        const contaAtual = contaData[0];
        const isCaixaGeral = contaAtual.is_caixa_geral === true;

        setConta(contaAtual);
        setContas(contasData);

        let lancamentosFiltrados = await fetchLancamentosExtratoConta({
          contaId,
          isCaixaGeral,
          dataInicio,
          dataFim,
        });
        let movsFiltrados = isCaixaGeral
          ? []
          : await fetchMovimentosExtratoConta({ contaId, dataInicio, dataFim });

        const backfill = await backfillLancamentosMovimentosCaixaPDV(base44, contasData);
        if (backfill) {
          lancamentosFiltrados = await fetchLancamentosExtratoConta({
            contaId,
            isCaixaGeral,
            dataInicio,
            dataFim,
          });
          if (!isCaixaGeral) {
            movsFiltrados = await fetchMovimentosExtratoConta({ contaId, dataInicio, dataFim });
          }
        }

        setLancamentos(lancamentosFiltrados);
        setMovimentosCaixa(movsFiltrados);

        let lancsDisplay = lancamentosFiltrados;

        const reconciliou = await reconciliarSaldoCaixaPDVSemTurnoAberto(
          base44,
          contaAtual,
          contasData,
          lancamentosFiltrados,
          movsFiltrados,
        );

        if (reconciliou) {
          lancsDisplay = await fetchLancamentosExtratoConta({
            contaId,
            isCaixaGeral,
            dataInicio,
            dataFim,
          });
          setLancamentos(lancsDisplay);
        }

        let lancsSaldo = lancsDisplay;
        let movsSaldo = movsFiltrados;

        if (!prefsCorte.mostrarHistoricoAnterior && prefsCorte.dataCorte) {
          const [lancsFull, movsFull] = await Promise.all([
            base44.entities.LancamentoFinanceiro.list(),
            base44.entities.MovimentosCaixa.list(),
          ]);
          lancsSaldo = lancsFull;
          movsSaldo = movsFull;
          setLancsSaldoBase(lancsFull);
          setMovsSaldoBase(movsFull);
        } else {
          setLancsSaldoBase([]);
          setMovsSaldoBase([]);
        }

        const saldo = !prefsCorte.mostrarHistoricoAnterior && prefsCorte.dataCorte
          ? calcularSaldoContaAposDataCorte(contaAtual, lancsSaldo, movsSaldo, prefsCorte.dataCorte)
          : calcularSaldoContaFinanceira(contaAtual, lancsSaldo, movsSaldo);

        if (Math.abs(saldo - Number(contaAtual.saldo_atual || 0)) > 0.009) {
          await base44.entities.ContasFinanceiras.update(contaAtual.id, { saldo_atual: saldo });
          setConta({ ...contaAtual, saldo_atual: saldo });
        } else if (contaUsaRegraCaixaPDV(contaAtual) && Math.abs(saldo) <= 0.009) {
          await base44.entities.ContasFinanceiras.update(contaAtual.id, { saldo_atual: 0 });
          setConta({ ...contaAtual, saldo_atual: 0 });
        }
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar extrato",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLancamento = async () => {
    try {
      const lancamentoData = {
        ...formLancamento,
        valor: parseFloat(formLancamento.valor),
        conta_financeira_id: conta.id,
        observacoes: `Lançamento manual via conta ${conta.nome}`
      };

      await base44.entities.LancamentoFinanceiro.create(lancamentoData);

      await loadExtrato(conta.id);

      toast({
        title: "Lançamento registrado",
        description: `${formLancamento.tipo} de ${formatCurrency(formLancamento.valor)} registrada`,
        className: "bg-green-100 text-green-800"
      });

      setDialogType(null);
      loadExtrato(conta.id);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSaveTransferencia = async () => {
    try {
      const valor = parseFloat(formTransferencia.valor);
      const contaDestino = contas.find(c => c.id === formTransferencia.conta_destino_id);

      if (!contaDestino) {
        toast({ title: "Selecione uma conta de destino", variant: "destructive" });
        return;
      }

      // Cria saída na conta origem
      await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Despesa',
        descricao: `Transferência para ${contaDestino.nome}: ${formTransferencia.descricao}`,
        valor: valor,
        categoria: 'Outros',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pago',
        conta_financeira_id: conta.id,
        observacoes: `Transferência de ${conta.nome} para ${contaDestino.nome}`
      });

      // Cria entrada na conta destino
      await base44.entities.LancamentoFinanceiro.create({
        tipo: 'Receita',
        descricao: `Transferência de ${conta.nome}: ${formTransferencia.descricao}`,
        valor: valor,
        categoria: 'Outros',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pago',
        conta_financeira_id: contaDestino.id,
        observacoes: `Transferência de ${conta.nome} para ${contaDestino.nome}`
      });

      toast({
        title: "Transferência realizada",
        description: `${formatCurrency(valor)} transferido para ${contaDestino.nome}`,
        className: "bg-green-100 text-green-800"
      });

      setDialogType(null);
      await loadExtrato(conta.id);
    } catch (error) {
      toast({
        title: "Erro ao transferir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value) => {
    return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const openDialog = (type) => {
    setDialogType(type);
    setFabOpen(false);
    
    if (type === 'receita' || type === 'despesa') {
      setFormLancamento({
        tipo: type === 'receita' ? 'Receita' : 'Despesa',
        descricao: '',
        valor: 0,
        categoria: 'Outros',
        data_vencimento: format(new Date(), 'yyyy-MM-dd'),
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pago'
      });
    } else if (type === 'transferencia') {
      setFormTransferencia({
        conta_destino_id: '',
        valor: 0,
        descricao: ''
      });
    }
  };

  const getDataMovimento = (mov) => mov.data_pagamento || mov.data_vencimento || mov.data_movimento || mov.created_date;
  const chaveDiaMovimento = (mov) => getDataKeyMovimentoExtrato(mov) || toLocalDateKey(getDataMovimento(mov));
  const participaDoSaldo = (mov) => movimentoParticipaExtrato(mov, conta);
  const passaCorteHistorico = (mov) => passaFiltroCorteHistorico(getDataKeyMovimentoExtrato(mov), {
    mostrarHistoricoAnterior,
    dataCorte: dataCorteHistorico,
  });

  const movimentosJaNoFinanceiro = useMemo(
    () => idsMovimentosComLancamentoFinanceiro(lancamentos),
    [lancamentos],
  );

  // Combina e ordena movimentações (PDV: só o que compõe dinheiro na gaveta)
  const todasMovimentacoes = [
    ...lancamentos.map(l => ({ ...l, origem: 'lancamento' })),
    ...movimentosCaixa
      .filter((m) => !movimentosJaNoFinanceiro.has(String(m.id)))
      .map(m => ({ ...m, origem: 'movimento' }))
  ]
    .filter((mov) => participaDoSaldo(mov))
    .filter(passaCorteHistorico)
    .sort((a, b) => new Date(getDataMovimento(a)) - new Date(getDataMovimento(b)));

  const { inicio: inicioYmd, fim: fimYmd } = intervaloExtratoYmd(filtroPeriodo, dataInicio, dataFim);
  const movimentacoesNoPeriodo = todasMovimentacoes.filter((m) => (
    passaIntervaloExtratoYmd(chaveDiaMovimento(m), inicioYmd, fimYmd)
  ));

  const movimentacoesFiltradas = movimentacoesNoPeriodo.filter(m => {
    if (!searchTerm) return true;
    const termo = searchTerm.toLowerCase();
    return (
      m.descricao?.toLowerCase().includes(termo) ||
      m.tipo?.toLowerCase().includes(termo) ||
      m.categoria?.toLowerCase().includes(termo)
    );
  });

  // Agrupa por dia e calcula saldos
  const movimentacoesPorDia = movimentacoesFiltradas.reduce((acc, mov) => {
    const dia = chaveDiaMovimento(mov);
    if (!dia) return acc;
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push(mov);
    return acc;
  }, {});

  const diasOrdenados = Object.keys(movimentacoesPorDia).sort((a, b) => new Date(b) - new Date(a));

  const lancsParaSaldo = lancsSaldoBase.length ? lancsSaldoBase : lancamentos;
  const movsParaSaldo = movsSaldoBase.length ? movsSaldoBase : movimentosCaixa;

  // Saldo canónico (mesma regra da lista de contas / corte histórico)
  const saldoReal = conta
    ? (!mostrarHistoricoAnterior && dataCorteHistorico
        ? calcularSaldoContaAposDataCorte(conta, lancsParaSaldo, movsParaSaldo, dataCorteHistorico)
        : calcularSaldoContaFinanceira(conta, lancsParaSaldo, movsParaSaldo))
    : 0;

  const movimentacoesAposPeriodo = todasMovimentacoes.filter((m) => {
    const dataKey = chaveDiaMovimento(m);
    return fimYmd && dataKey > fimYmd && participaDoSaldo(m);
  });

  const totalEntradasAposPeriodo = totaisEntradaSaidaMovimentos(
    movimentacoesAposPeriodo.filter(participaDoSaldo),
    conta,
  ).entradas;
  const totalSaidasAposPeriodo = totaisEntradaSaidaMovimentos(
    movimentacoesAposPeriodo.filter(participaDoSaldo),
    conta,
  ).saidas;

  const saldoNoFimDoPeriodo = saldoReal - totalEntradasAposPeriodo + totalSaidasAposPeriodo;

  const totalEntradasPeriodo = totaisEntradaSaidaMovimentos(
    movimentacoesNoPeriodo.filter(participaDoSaldo),
    conta,
    {
      contasSel: conta ? [conta.id] : null,
      mapaContrapartes: buildMapaContrapartesTransferencia(lancamentos),
      todosLancamentos: lancamentos,
    },
  ).entradas;
  const totalSaidasPeriodo = totaisEntradaSaidaMovimentos(
    movimentacoesNoPeriodo.filter(participaDoSaldo),
    conta,
    {
      contasSel: conta ? [conta.id] : null,
      mapaContrapartes: buildMapaContrapartesTransferencia(lancamentos),
      todosLancamentos: lancamentos,
    },
  ).saidas;

  let saldoAcumulado = saldoNoFimDoPeriodo - totalEntradasPeriodo + totalSaidasPeriodo;

  const mapaContrapartesExtrato = buildMapaContrapartesTransferencia(lancamentos);
  const optsTotaisExtrato = {
    contasSel: conta ? [conta.id] : null,
    mapaContrapartes: mapaContrapartesExtrato,
    todosLancamentos: lancamentos,
  };

  const diasComSaldo = diasOrdenados.reverse().map(dia => {
    const saldoAnterior = saldoAcumulado;
    const movimentacoesDia = movimentacoesPorDia[dia];
    const movsSaldo = movimentacoesDia.filter(participaDoSaldo);

    const { entradas: totalEntradas, saidas: totalSaidas } = totaisEntradaSaidaMovimentos(
      movsSaldo,
      conta,
      optsTotaisExtrato,
    );

    saldoAcumulado = saldoAcumulado + totalEntradas - totalSaidas;

    return {
      dia,
      movimentacoes: movimentacoesDia,
      saldoAnterior,
      saldoFinal: saldoAcumulado,
      totalEntradas,
      totalSaidas,
    };
  }).reverse();

  const saldoCalculado = saldoReal;

  const diasExibicao = useMemo(() => {
    return diasComSaldo.map((diaData) => ({
      ...diaData,
      movimentacoes: sortLancamentosPorDescricao(diaData.movimentacoes),
    }));
  }, [diasComSaldo]);

  const normalizeMov = (mov) => {
    const data = getDataMovimento(mov);
    let tipo = mov.tipo;
    if (tipo === 'Reforço') tipo = 'Receita';
    if (tipo === 'Sangria') tipo = 'Despesa';
    return {
      ...mov,
      tipo,
      data_pagamento: data,
      data_vencimento: data,
      status: mov.status || 'Pago',
    };
  };

  const grupos = useMemo(() => {
    const hStr = dataHoje();
    const oStr = dataMenosDiasSistema(1);
    return diasExibicao.map((diaData) => ({
      k: diaData.dia,
      label: formatFinanceiroGrupoLabel(diaData.dia, hStr, oStr),
      items: diaData.movimentacoes.map(normalizeMov),
      totais: {
        r: diaData.totalEntradas,
        d: diaData.totalSaidas,
        entrou: diaData.totalEntradas,
        saiu: diaData.totalSaidas,
        liquidoOperacional: roundToTwoDecimals(diaData.totalEntradas - diaData.totalSaidas),
        saldoAcumulado: roundToTwoDecimals(diaData.saldoFinal),
      },
    }));
  }, [diasExibicao]);

  const totalMovimentacoes = movimentacoesFiltradas.length;
  const kpisExtrato = useMemo(() => ({
    entradas: totalEntradasPeriodo,
    saidas: totalSaidasPeriodo,
    saldo: saldoCalculado,
    saldoPeriodo: roundToTwoDecimals(totalEntradasPeriodo - totalSaidasPeriodo),
  }), [totalEntradasPeriodo, totalSaidasPeriodo, saldoCalculado]);

  const periodoLabel = PERIODOS_EXTRATO.find((p) => p.v === filtroPeriodo)?.l || 'Período';
  const hasActiveFilters = filtroPeriodo !== 'mes' || !!dataInicio || !!dataFim;

  // Funções de exportação
  const exportarCSV = () => {
    const csvContent = [
      ['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Saldo'],
      ...movimentacoesFiltradas.map(m => [
        formatarDataHora(getDataMovimento(m)),
        m.descricao || m.tipo,
        m.tipo,
        m.categoria || '-',
        (m.valor || 0).toFixed(2),
        ''
      ])
    ].map(row => row.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `extrato_${conta.nome}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const imprimir = () => {
    if (!conta) return;
    void printOrShareElementAsPdf('extrato-print-root', {
      formato: 'a4',
      fileBaseName: `extrato-${String(conta.nome || 'conta').replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}`,
      title: `Extrato ${conta.nome}`,
      onDesktopPrint: () => window.print(),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border/40 dark:border-white"></div>
      </div>
    );
  }

  if (!conta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Conta não encontrada</p>
          <Button onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="extrato-print-root" className="w-full min-w-0 max-w-full space-y-2 pb-[var(--p38-scroll-pad-below-nav)] font-din-1451 bg-background">
      <div className="min-w-0 max-w-full space-y-1.5">
        {/* Mobile */}
        <div className="flex flex-col gap-1.5 md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              className="h-8 w-8 shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold leading-none text-foreground font-glacial">{conta.nome}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {conta.is_caixa_pdv ? 'Dinheiro na gaveta' : conta.tipo}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5 no-pdf-capture">
              <button
                type="button"
                onClick={() => setAjusteDialogOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
                aria-label="Ajustar saldo"
              >
                <Scale className="h-4 w-4 text-foreground/90" />
              </button>
              <button
                type="button"
                onClick={exportarCSV}
                className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
                aria-label="Exportar CSV"
              >
                <FileDown className="h-4 w-4 text-foreground/90" />
              </button>
              <button
                type="button"
                onClick={imprimir}
                className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
                aria-label="Imprimir"
              >
                <Printer className="h-4 w-4 text-foreground/90" />
              </button>
            </div>
          </div>
          <KpiExtratoConta
            kpis={kpisExtrato}
            layout="stack"
            saldoLabel={contaUsaRegraCaixaPDV(conta) ? 'Saldo na gaveta' : 'Saldo na conta'}
          />
        </div>

        {/* Desktop */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="h-8 w-8" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-2xl font-semibold leading-none text-foreground font-glacial">{conta.nome}</p>
              <p className="text-xs text-muted-foreground">
                {conta.is_caixa_pdv ? 'Dinheiro na gaveta' : conta.tipo}
              </p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <KpiExtratoConta
              kpis={kpisExtrato}
              layout="inline"
              saldoLabel={contaUsaRegraCaixaPDV(conta) ? 'Saldo na gaveta' : 'Saldo na conta'}
            />
          </div>
          <div className="flex shrink-0 gap-1 no-pdf-capture">
            <button
              type="button"
              onClick={() => setAjusteDialogOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
              aria-label="Ajustar saldo"
            >
              <Scale className="h-4 w-4 text-foreground/90" />
            </button>
            <button
              type="button"
              onClick={exportarCSV}
              className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
              aria-label="Exportar CSV"
            >
              <FileDown className="h-4 w-4 text-foreground/90" />
            </button>
            <button
              type="button"
              onClick={imprimir}
              className="flex h-8 w-8 items-center justify-center rounded-lg p38-field-surface border-0"
              aria-label="Imprimir"
            >
              <Printer className="h-4 w-4 text-foreground/90" />
            </button>
          </div>
        </div>
      </div>

      <FiltrosExtratoConta
        search={searchTerm}
        onSearch={setSearchTerm}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        periodo={filtroPeriodo}
        onPeriodo={setFiltroPeriodo}
        cs={dataInicio}
        ce={dataFim}
        onCs={setDataInicio}
        onCe={setDataFim}
      />

      <FinanceiroListaMeta
        total={totalMovimentacoes}
        totalLabel={totalMovimentacoes === 1 ? 'movimentação' : 'movimentações'}
        hasActiveFilters={hasActiveFilters || !!searchTerm}
        onLimparFiltros={() => {
          setFiltroPeriodo('mes');
          setDataInicio('');
          setDataFim('');
          setSearchTerm('');
        }}
        summaryChips={
          <>
            {!mostrarHistoricoAnterior && dataCorteHistorico && (
              <FinanceiroSummaryChip>Movimentos desde {formatarSoData(dataCorteHistorico)}</FinanceiroSummaryChip>
            )}
            {filtroPeriodo !== 'mes' && <FinanceiroSummaryChip>{periodoLabel}</FinanceiroSummaryChip>}
            {searchTerm && <FinanceiroSummaryChip>Busca</FinanceiroSummaryChip>}
          </>
        }
      />

      <ListaExtratoConta grupos={grupos} loading={isLoading} />

      <AjusteSaldoDialog
        open={ajusteDialogOpen}
        onOpenChange={setAjusteDialogOpen}
        conta={conta}
        saldoCalculado={saldoCalculado}
        onSaved={() => loadExtrato(conta.id)}
      />

      {fabOpen && (
        <div className="fixed inset-0 z-[54] bg-muted/55 backdrop-blur-[2px]" onClick={() => setFabOpen(false)} />
      )}
      <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 lg:right-6">
        {fabOpen && (
          <>
            <button
              type="button"
              onClick={() => openDialog('receita')}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-nowrap transition-transform active:scale-95 dark:bg-primary dark:text-primary-foreground"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Receita
            </button>
            <button
              type="button"
              onClick={() => openDialog('despesa')}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-nowrap transition-transform active:scale-95 dark:bg-primary dark:text-primary-foreground"
            >
              <ArrowUpRight className="h-4 w-4" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => openDialog('transferencia')}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-nowrap transition-transform active:scale-95 dark:bg-primary dark:text-primary-foreground"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transf.
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          className={`flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-xl transition-all active:scale-95 ${fabOpen ? 'rotate-45 bg-[#383e47]' : 'bg-[#4a5240] dark:bg-[#a4ce33]'}`}
        >
          <Plus className={`h-6 w-6 ${fabOpen ? 'text-white' : 'text-white dark:text-[#1f1d22]'}`} />
        </button>
      </div>

      {/* Dialog Receita/Despesa */}
      <Dialog open={dialogType === 'receita' || dialogType === 'despesa'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="flex max-h-[min(92vh,36rem)] min-h-0 flex-col gap-0 overflow-hidden dark:border-border/40 dark:bg-muted sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-foreground">
              {dialogType === 'receita' ? 'Nova Receita' : 'Nova Despesa'}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-gutter:stable]">
            <div>
              <Label className="text-foreground/90">Descrição</Label>
              <Input
                placeholder="Ex: Venda de produto, Pagamento de fornecedor..."
                value={formLancamento.descricao}
                onChange={(e) => setFormLancamento({ ...formLancamento, descricao: e.target.value })}
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground/90">Valor</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formLancamento.valor}
                onChange={(e) => setFormLancamento({ ...formLancamento, valor: e.target.value })}
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground/90">Categoria</Label>
              <Select 
                value={formLancamento.categoria} 
                onValueChange={(v) => setFormLancamento({ ...formLancamento, categoria: v })}
              >
                <SelectTrigger className="dark:bg-muted dark:border-border/40 dark:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  <SelectItem value="Venda de Produto">Venda de Produto</SelectItem>
                  <SelectItem value="Prestação de Serviço">Prestação de Serviço</SelectItem>
                  <SelectItem value="Compra de Mercadoria">Compra de Mercadoria</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                  <SelectItem value="Salários">Salários</SelectItem>
                  <SelectItem value="Impostos">Impostos</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 pt-4 dark:border-border/50">
            <Button variant="outline" onClick={() => setDialogType(null)} className="dark:bg-muted dark:border-border/40">
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveLancamento} 
              className={dialogType === 'receita' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Transferência */}
      <Dialog open={dialogType === 'transferencia'} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="flex max-h-[min(92vh,32rem)] min-h-0 flex-col gap-0 overflow-hidden dark:border-border/40 dark:bg-muted sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-foreground">Nova Transferência</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 [scrollbar-gutter:stable]">
            <div>
              <Label className="text-foreground/90">Conta de Destino</Label>
              <Select 
                value={formTransferencia.conta_destino_id} 
                onValueChange={(v) => setFormTransferencia({ ...formTransferencia, conta_destino_id: v })}
              >
                <SelectTrigger className="dark:bg-muted dark:border-border/40 dark:text-foreground">
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  {contas.filter(c => c.id !== conta.id && c.ativo).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/90">Valor</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formTransferencia.valor}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, valor: e.target.value })}
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground/90">Descrição</Label>
              <Input
                placeholder="Ex: Reforço de caixa, Sangria..."
                value={formTransferencia.descricao}
                onChange={(e) => setFormTransferencia({ ...formTransferencia, descricao: e.target.value })}
                className="dark:bg-muted dark:border-border/40 dark:text-foreground"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 pt-4 dark:border-border/50">
            <Button variant="outline" onClick={() => setDialogType(null)} className="dark:bg-muted dark:border-border/40">
              Cancelar
            </Button>
            <Button onClick={handleSaveTransferencia} className="bg-blue-600 hover:bg-blue-700">
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}