import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaixaDialogContent } from '@/components/vendas/caixa/CaixaDialogContent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Monitor, Lock, X, ChevronRight, ArrowLeft } from 'lucide-react';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { selectAllOnFocus, focusAndSelect } from '@/lib/inputFocusUtils';
import {
  caixaTurnoQueryKey,
  fetchCaixaTurnoSnapshot,
  buildPainelCaixaResumo,
} from '@/lib/caixaTurnoData';
import { findTurnoAbertoParaCaixa, turnoAbertoMaisAntigo } from '@/lib/turnoCaixaAberto';
import { getCachedUserSession } from '@/lib/userSessionCache';
import { QUICK_ACCESS_NESTED_DIALOG_CLASS } from '@/lib/quickAccessOverlay';
import CaixaRecebimentosResumoLinhas from '@/components/vendas/caixa/CaixaRecebimentosResumoLinhas';

function normalizeCaixaId(id) {
  return String(id ?? '').trim();
}

function isCaixaAutorizado(caixaId, autorizados = []) {
  const key = normalizeCaixaId(caixaId);
  return autorizados.some((id) => normalizeCaixaId(id) === key);
}

export default function SeletorCaixaPDV({ open, onSelect, currentUser, onClose, elevatedStack = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [caixasDisponiveis, setCaixasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState('');
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [showSaldoDialog, setShowSaldoDialog] = useState(false);
  const [liquidezPorCaixa, setLiquidezPorCaixa] = useState({});
  const [descricaoSaldo, setDescricaoSaldo] = useState('');
  const [abrirTurnoLoading, setAbrirTurnoLoading] = useState(false);
  const saldoInputRef = useRef(null);
  const turnosAbertosRef = useRef([]);
  const loadGenerationRef = useRef(0);

  const parseSaldoInicial = useCallback((valor) => {
    if (!valor) return 0;
    const normalized = valor.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? roundToTwoDecimals(parsed) : NaN;
  }, []);

  const focusSaldoInput = useCallback(() => {
    focusAndSelect(saldoInputRef.current);
  }, []);

  useEffect(() => {
    if (!showSaldoDialog) return undefined;
    const timer = window.setTimeout(() => focusSaldoInput(), 150);
    return () => window.clearTimeout(timer);
  }, [showSaldoDialog, focusSaldoInput]);

  const handleSaldoChange = (e) => {
    let numbers = e.target.value.replace(/\D/g, '');
    if (numbers.length > 10) numbers = numbers.slice(0, 10);
    
    if (!numbers) {
      setSaldoInicial('');
      return;
    }
    
    // Se tem menos de 3 dígitos, padroniza para mostrar centavos
    const fullNumber = numbers.padStart(3, '0');
    const integerPart = fullNumber.slice(0, -2).replace(/^0+/, '') || '0';
    const decimalPart = fullNumber.slice(-2);
    const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setSaldoInicial(`${formatted},${decimalPart}`);
  };

  useEffect(() => {
    if (!open) return;
    loadCaixas();
  }, [open, currentUser]);

  const findTurnoAbertoParaCaixaCached = useCallback(async (caixaId) => {
    const cached = turnoAbertoMaisAntigo(turnosAbertosRef.current, caixaId);
    if (cached) return cached;
    return findTurnoAbertoParaCaixa(caixaId);
  }, []);

  const enrichLiquidezEmBackground = useCallback(
    async (caixasAutorizados, todosTurnos, generation) => {
      const comTurno = caixasAutorizados.filter((caixa) =>
        todosTurnos.some((t) => t.conta_caixa_pdv_id === caixa.id)
      );

      for (const caixa of comTurno) {
        if (loadGenerationRef.current !== generation) return;

        const turnoAberto = turnoAbertoMaisAntigo(todosTurnos, caixa.id);
        if (!turnoAberto) continue;

        try {
          const snapshot = await fetchCaixaTurnoSnapshot({
            turno: turnoAberto,
            caixa,
            incluirRascunhos: true,
            rascunhoExigirItens: false,
          });

          if (loadGenerationRef.current !== generation) return;

          queryClient.setQueryData(
            [...caixaTurnoQueryKey(turnoAberto.id, caixa.id), 'live', 'sem-itens'],
            snapshot
          );

          const resumo = buildPainelCaixaResumo(snapshot);
          setLiquidezPorCaixa((prev) => ({
            ...prev,
            [caixa.id]: {
              turnoAberto: true,
              saldoInicial: resumo.saldoInicial,
              totalVendas: resumo.totalVendas,
              liquidez: resumo.liquidez,
              recebimentos: resumo.recebimentos,
              loadingDetalhes: false,
            },
          }));
        } catch (error) {
          if (loadGenerationRef.current !== generation) return;
          console.warn(`[SeletorCaixaPDV] liquidez em background (${caixa.id}):`, error?.message || error);
          setLiquidezPorCaixa((prev) => ({
            ...prev,
            [caixa.id]: {
              ...(prev[caixa.id] || { turnoAberto: true }),
              loadingDetalhes: false,
            },
          }));
        }
      }
    },
    [queryClient]
  );

  const loadCaixas = async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setLoading(true);
    setLiquidezPorCaixa({});
    try {
      let user = currentUser;
      if (!user) {
        user = getCachedUserSession()?.user ?? null;
      }
      if (!user) {
        user = await base44.auth.me().catch(() => null);
      }
      if (!user) {
        setCaixasDisponiveis([]);
        setLoading(false);
        return;
      }
      const [todasContas, todosTurnos] = await Promise.all([
        base44.entities.ContasFinanceiras.list(),
        base44.entities.TurnoCaixa.filter({ status: 'Aberto' }),
      ]);

      if (loadGenerationRef.current !== generation) return;

      turnosAbertosRef.current = todosTurnos;

      const caixasPDV = todasContas.filter(c => 
        c.ativo && 
        (c.tipo === 'Caixa Físico' || c.tipo === 'Caixa PDV')
      );

      const liquidezBasica = {};
      for (const caixa of caixasPDV) {
        const turnoAberto = turnoAbertoMaisAntigo(todosTurnos, caixa.id);
        if (turnoAberto) {
          liquidezBasica[caixa.id] = {
            turnoAberto: true,
            saldoInicial: turnoAberto.saldo_inicial || 0,
            loadingDetalhes: true,
          };
        } else {
          liquidezBasica[caixa.id] = { turnoAberto: false };
        }
      }

      // Filtrar por permissão — PROTEÇÃO TOTAL
      // Usuário só vê caixas explicitamente autorizados (mesmo admin)
      const caixasAutorizados = user.caixas_pdv_autorizados_ids || user.caixas_vinculados || [];
      
      let caixasFiltrados;
      if (caixasAutorizados.length === 0) {
        // Se não tem nenhum caixa autorizado, não pode operar (proteção)
        caixasFiltrados = [];
      } else {
        // Vê APENAS os caixas autorizados (independente de admin ou não)
        caixasFiltrados = caixasPDV.filter((c) => isCaixaAutorizado(c.id, caixasAutorizados));
      }

      setLiquidezPorCaixa(liquidezBasica);
      setCaixasDisponiveis(caixasFiltrados);
      setLoading(false);

      void enrichLiquidezEmBackground(caixasFiltrados, todosTurnos, generation);
    } catch (error) {
      console.error('Erro ao carregar caixas:', error);
      setLoading(false);
    }
  };

  const handleSelecionarCaixa = async (caixa) => {
    const turnoAberto = await findTurnoAbertoParaCaixaCached(caixa.id);

    if (turnoAberto) {
      // Turno já existe, apenas conectar
      onSelect(caixa, turnoAberto, false);
    } else {
      // Precisa abrir novo turno — saldo inicial começa sempre em 0 (operador informa o fundo de troco)
      setCaixaSelecionado(caixa);
      setSaldoInicial('');
      setDescricaoSaldo('');
      setShowSaldoDialog(true);
    }
  };

  const handleAbrirTurno = async () => {
    if (abrirTurnoLoading) return;

    if (!currentUser?.id) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    const saldoFloat = parseSaldoInicial(saldoInicial);
    if (!Number.isFinite(saldoFloat) || saldoFloat < 0) {
      alert('Informe um saldo inicial válido.');
      return;
    }

    setAbrirTurnoLoading(true);
    try {
      const existente = await findTurnoAbertoParaCaixa(caixaSelecionado.id);
      if (existente?.id) {
        onSelect(caixaSelecionado, existente, false);
        setShowSaldoDialog(false);
        return;
      }

      const todosTurnos = await base44.entities.TurnoCaixa.list();
      const numeroTurno = `TC-${String((todosTurnos.length || 0) + 1).padStart(5, '0')}`;
      
      const novoTurno = await base44.entities.TurnoCaixa.create({
        numero: numeroTurno,
        conta_caixa_pdv_id: caixaSelecionado.id,
        conta_caixa_pdv_nome: caixaSelecionado.nome,
        usuario_abertura_id: currentUser.id,
        usuario_abertura_nome: currentUser.full_name,
        data_abertura: new Date().toISOString(),
        saldo_inicial: saldoFloat,
        status: 'Aberto',
        vendas_ids: [],
        movimentos_ids: [],
        despesas_ids: []
      });

      // Atualizar saldo da conta se diferente
      if (Math.abs(roundToTwoDecimals(caixaSelecionado.saldo_atual - saldoFloat)) > 0.01) {
        await base44.entities.ContasFinanceiras.update(caixaSelecionado.id, {
          saldo_atual: saldoFloat
        });
      }

      onSelect(caixaSelecionado, novoTurno, false);
      setShowSaldoDialog(false);
    } catch (error) {
      console.error('Erro ao abrir turno:', error);
      alert('Erro ao abrir turno: ' + error.message);
    } finally {
      setAbrirTurnoLoading(false);
    }
  };

  const elevatedDialogClass = elevatedStack ? QUICK_ACCESS_NESTED_DIALOG_CLASS : undefined;

  return (
    <>
      <Dialog open={open && !showSaldoDialog} onOpenChange={() => {}}>
        <CaixaDialogContent
          overlayClassName={elevatedDialogClass}
          className="max-w-2xl dark:bg-background"
          hideClose
        >
          <DialogHeader className="relative">
            <button
              onClick={() => onClose ? onClose() : navigate(-1)}
              className="absolute left-0 top-0 p-1.5 rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <DialogTitle className="text-xl text-center font-glacial">Selecione o Caixa</DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando caixas...</div>
          ) : caixasDisponiveis.length === 0 ? (
            <div className="py-12 text-center">
              <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Você não tem permissão para acessar nenhum caixa.
              </p>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2">
                Entre em contato com o administrador.
              </p>
              <button
                onClick={() => onClose ? onClose() : navigate(-1)}
                className="mt-6 px-6 py-2.5 bg-muted text-foreground/90 rounded-2xl text-sm font-medium hover:bg-muted dark:hover:bg-primary/90 transition-colors"
              >
                Voltar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {caixasDisponiveis.map(caixa => {
                const podeOperar = true;
                
                return (
                  <button
                    key={caixa.id}
                    onClick={() => handleSelecionarCaixa(caixa)}
                    className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-left border-2 border-transparent hover:border-border/40 dark:hover:border-border/40"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Monitor className="w-6 h-6 text-foreground/90" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-foreground font-glacial mb-1">
                          {caixa.nome}
                        </h3>
                        {liquidezPorCaixa[caixa.id]?.turnoAberto ? (
                          <div className="space-y-1.5">
                            {liquidezPorCaixa[caixa.id]?.loadingDetalhes ? (
                              <p className="text-xs font-medium text-primary">
                                Turno aberto · Carregando resumo…
                              </p>
                            ) : (
                              <>
                                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                                  Turno aberto
                                </p>
                                <CaixaRecebimentosResumoLinhas
                                  recebimentos={liquidezPorCaixa[caixa.id].recebimentos}
                                  compact
                                />
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sem turno aberto</p>
                        )}
                        {!podeOperar && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Lock className="w-3 h-3" />
                            <span>Somente visualização</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CaixaDialogContent>
      </Dialog>

      <Dialog open={showSaldoDialog} onOpenChange={() => {}}>
        <CaixaDialogContent
          overlayClassName={elevatedDialogClass}
          className="max-w-sm dark:bg-background border-0 p-0 shadow-2xl"
          hideClose
        >
          <div className="flex flex-col h-full">
            {/* Header com abas */}
            <div className="flex items-center justify-between px-4 pt-4 border-b border-border/40">
              <button
                onClick={() => setShowSaldoDialog(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-muted text-foreground/90 rounded-full text-sm font-medium"
                >
                  Abertura
                </button>
              </div>
              
              <div className="w-6" />
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
              {/* Campo VALOR — input visível para teclado nativo (mobile e desktop) */}
              <div className="text-center w-full">
                <p className="text-xs font-medium text-muted-foreground tracking-widest mb-4">
                  VALOR
                </p>

                <div
                  role="button"
                  tabIndex={-1}
                  onClick={focusSaldoInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      focusSaldoInput();
                    }
                  }}
                  className="w-full min-h-[88px] flex flex-col items-center justify-center rounded-2xl active:bg-muted/40 transition-colors cursor-text"
                  aria-label="Toque para informar o valor de abertura"
                >
                  <p className="text-sm text-muted-foreground mb-2">R$</p>
                  <input
                    ref={saldoInputRef}
                    autoComplete="off"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={saldoInicial}
                    onChange={handleSaldoChange}
                    onFocus={selectAllOnFocus}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAbrirTurno();
                      }
                    }}
                    placeholder="0,00"
                    className="w-full text-center text-6xl font-bold font-mono bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground caret-foreground"
                  />
                </div>
              </div>

              {/* Campo de descrição */}
              <div className="w-full">
                <Input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={descricaoSaldo}
                  onChange={(e) => setDescricaoSaldo(e.target.value)}
                  className="text-center text-foreground placeholder:text-muted-foreground border-0 border-b-2 border-border/60 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
            </div>

            {/* Botão Continuar */}
            <div className="px-6 pb-6">
              <Button
                type="button"
                onClick={handleAbrirTurno}
                disabled={abrirTurnoLoading}
                className="w-full h-14 bg-primary text-primary-foreground font-semibold rounded-3xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{abrirTurnoLoading ? 'Abrindo…' : 'Abrir Turno'}</span>
                {!abrirTurnoLoading && <ChevronRight className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </CaixaDialogContent>
      </Dialog>
    </>
  );
}