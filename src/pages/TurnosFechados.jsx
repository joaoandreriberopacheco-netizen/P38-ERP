import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import VisualizadorCaixa from '@/components/vendas/caixa/VisualizadorCaixa';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';
import { P38MobileLine, P38MobileLineList, P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { caixaTypo, conferenciaTone, caixaSpinner, caixaIconBtn } from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';

export default function TurnosFechadosPage() {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [turnoSelecionado, setTurnoSelecionado] = useState(null);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [reabrindo, setReabrindo] = useState(false);

  useEffect(() => {
    loadData();
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const turnosFechados = await base44.entities.TurnoCaixa.filter(
        { status: 'Fechado' },
        '-data_fechamento',
        100
      );
      setTurnos(turnosFechados);
    } catch (error) {
      console.error('Erro ao carregar turnos fechados:', error);
      toast.error('Não foi possível carregar os turnos fechados');
    }
    setLoading(false);
  };

  const turnosFiltrados = turnos.filter((t) => {
    const termo = busca.trim().toLowerCase();
    const matchBusca =
      !termo ||
      (t.numero || '').toLowerCase().includes(termo) ||
      (t.conta_caixa_pdv_nome || '').toLowerCase().includes(termo) ||
      (t.usuario_abertura_nome || '').toLowerCase().includes(termo) ||
      (t.usuario_fechamento_nome || '').toLowerCase().includes(termo);
    const matchData = !filtroData || (t.data_abertura || '').startsWith(filtroData);
    return matchBusca && matchData;
  });

  const handleSelecionarTurno = async (turno) => {
    try {
      const caixa = await base44.entities.ContasFinanceiras.get(turno.conta_caixa_pdv_id);
      setCaixaSelecionado(caixa);
      setTurnoSelecionado(turno);
    } catch (error) {
      console.error('Erro ao abrir turno:', error);
      toast.error('Não foi possível abrir o turno selecionado');
    }
  };

  const handleReabrirTurno = async (turno) => {
    void runOperacaoAuthBypass((authData) => executarReabertura(authData, turno));
  };

  const executarReabertura = async (authData, turno) => {
    setReabrindo(true);
    try {
      const turnosAbertos = await base44.entities.TurnoCaixa.filter({
        conta_caixa_pdv_id: turno.conta_caixa_pdv_id,
        status: 'Aberto',
      });

      if (turnosAbertos.length > 0) {
        toast.error('Reabertura bloqueada', {
          description: `Existe outro turno aberto (${turnosAbertos[0].numero}) neste caixa. Feche-o antes de reabrir este turno.`,
          duration: 5000,
        });
        return;
      }

      const todasContas = await base44.entities.ContasFinanceiras.list();
      const caixaPDV = todasContas.find((c) => c.id === turno.conta_caixa_pdv_id);
      const caixaGeral = todasContas.find((c) => c.is_caixa_geral === true);
      const dinheiroConferido = turno.dinheiro_conferido || 0;

      if (caixaPDV && caixaGeral && dinheiroConferido > 0) {
        await base44.entities.ContasFinanceiras.update(caixaPDV.id, {
          saldo_atual: caixaPDV.saldo_atual + dinheiroConferido,
        });
        await base44.entities.ContasFinanceiras.update(caixaGeral.id, {
          saldo_atual: caixaGeral.saldo_atual - dinheiroConferido,
        });

        await base44.entities.MovimentosCaixa.create({
          numero: `MCX-ESTORNO-${String(Date.now()).slice(-5)}`,
          tipo: 'Reforço',
          valor: dinheiroConferido,
          observacao: `Estorno de fechamento - Reabertura do turno ${turno.numero}`,
          conta_id: caixaPDV.id,
          turno_caixa_id: turno.id,
          usuario_responsavel_id: currentUser?.id,
          usuario_responsavel_nome: currentUser?.full_name,
        });
      }

      await base44.entities.TurnoCaixa.update(turno.id, {
        status: 'Aberto',
        data_fechamento: null,
        usuario_fechamento_id: null,
        usuario_fechamento_nome: null,
        observacoes:
          (turno.observacoes || '') +
          `\n[REABERTURA] ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })} - Autorizado por ${authData.intervenienteName} (${authData.operationCode})`,
      });

      toast.success('Turno reaberto com sucesso!', {
        description: `Turno ${turno.numero} reaberto. Autorizado por: ${authData.intervenienteName}`,
      });

      setTurnoSelecionado(null);
      setCaixaSelecionado(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao reabrir turno:', error);
      toast.error('Erro ao reabrir turno', { description: error.message });
    } finally {
      setReabrindo(false);
    }
  };

  if (turnoSelecionado && caixaSelecionado) {
    return (
      <VisualizadorCaixa
        turnoAtivo={turnoSelecionado}
        caixaSelecionado={caixaSelecionado}
        modoFechado
        onVoltar={() => {
          setTurnoSelecionado(null);
          setCaixaSelecionado(null);
          loadData();
        }}
        onSolicitarReabertura={() => handleReabrirTurno(turnoSelecionado)}
        reabrindo={reabrindo}
      />
    );
  }

  return (
    <div className={`h-full min-h-0 flex flex-col bg-background ${caixaTypo.screen}`}>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-4 md:p-6 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className={`${caixaTypo.title} text-2xl mb-2 flex items-center gap-2`}>
              <Lock className="w-6 h-6 text-muted-foreground dark:text-[#A8B56E]" />
              Turnos Fechados
            </h1>
            <p className={caixaTypo.meta}>
              Consulte o balanço e a conferência de turnos encerrados
            </p>
          </div>
          <button
            onClick={loadData}
            className={caixaIconBtn}
            style={{ minWidth: '48px', minHeight: '48px' }}
            aria-label="Atualizar lista"
          >
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-pulse-sensor="turnos-fechados.busca"
              placeholder="Buscar turno, caixa ou operador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 p38-search-field border-0"
            />
          </div>
          <Input
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
            className="w-full sm:w-44 p38-search-field border-0"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className={caixaSpinner} />
          </div>
        ) : turnosFiltrados.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center shadow-sm border border-border/40">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className={`${caixaTypo.title} text-lg mb-2`}>Nenhum turno fechado</h3>
            <p className={caixaTypo.meta}>
              {busca || filtroData ? 'Ajuste os filtros para ver outros resultados' : 'Não há turnos encerrados no momento'}
            </p>
          </div>
        ) : (
          <>
            <P38MobileLineList allViewports>
              {turnosFiltrados.map((turno, index) => {
                const diferenca = turno.diferenca || 0;
                const diffOk = Math.abs(diferenca) < 0.01;
                const diffTone = conferenciaTone({ temDiferenca: !diffOk, diferenca });
                return (
                  <P38MobileLine
                    key={turno.id}
                    thinAccent
                    striped={index % 2 === 1}
                    accent={diffOk ? 'muted' : diferenca > 0 ? 'success' : 'danger'}
                    palette="caixa"
                    onClick={() => handleSelecionarTurno(turno)}
                    title={turno.conta_caixa_pdv_nome || turno.numero}
                    subtitle={`${turno.numero} · ${turno.usuario_abertura_nome || '—'}`}
                    meta={
                      <>
                        <P38StatusLabel tone="muted" palette="caixa">Fechado</P38StatusLabel>
                        <span>
                          {turno.data_fechamento
                            ? format(new Date(turno.data_fechamento), 'dd/MM HH:mm', { locale: ptBR })
                            : '—'}
                        </span>
                        {!diffOk && (
                          <span className="inline-flex items-center gap-1">
                            Dif.:
                            <CaixaValorDisplay valor={diferenca} tone={diffTone} signed size="sm" />
                          </span>
                        )}
                      </>
                    }
                    value={<CaixaValorDisplay valor={turno.total_vendas} tone="success" signed size="sm" />}
                    valueSub="vendas"
                  />
                );
              })}
            </P38MobileLineList>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
