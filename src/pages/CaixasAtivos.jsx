import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock, PackageCheck, Eye, EyeOff, Printer, Ticket, RefreshCw } from 'lucide-react';
import VisualizadorCaixa from '@/components/vendas/caixa/VisualizadorCaixa';
import ConsumoDetalheDialog from '@/components/caixa/ConsumoDetalheDialog';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import {
  fetchCaixaTurnoSnapshot,
  buildPainelCaixaResumo,
  filterRascunhosAguardando,
  fetchRascunhosAguardando,
} from '@/lib/caixaTurnoData';
import { P38MobileLine, P38MobileLineList, P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { caixaTypo } from '@/lib/caixaP38Theme';
import CaixaValorDisplay from '@/components/vendas/caixa/CaixaValorDisplay';

export default function CaixasAtivosPage() {
  const [turnosAtivos, setTurnosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [liquidezPorCaixa, setLiquidezPorCaixa] = useState({});
  const [turnoSelecionado, setTurnoSelecionado] = useState(null);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [rascunhoSelecionado, setRascunhoSelecionado] = useState(null);
  const [consumosHoje, setConsumosHoje] = useState([]);
  const [destinacoesExpandidas, setDestinacoesExpandidas] = useState({});
  const [showSenhasPage, setShowSenhasPage] = useState(false);
  const [consumoSelecionado, setConsumoSelecionado] = useState(null);

  useEffect(() => {
    loadTurnos();
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const loadTurnos = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const [turnos, contas, consumos, rascunhosRaw] = await Promise.all([
        base44.entities.TurnoCaixa.filter({ status: 'Aberto' }),
        base44.entities.ContasFinanceiras.list(),
        base44.entities.ConsumoInterno.list('-created_date'),
        fetchRascunhosAguardando(),
      ]);

      const turnosUnicos = turnos.filter((turno, index, array) =>
        array.findIndex(t => t.conta_caixa_pdv_id === turno.conta_caixa_pdv_id) === index
      );

      const rascunhosPendentesCaixa = filterRascunhosAguardando(rascunhosRaw, { exigirItens: true });

      const consumosDeHoje = consumos.filter(c => {
        const d = new Date(c.created_date);
        return d >= hoje;
      });
      setConsumosHoje(consumosDeHoje);

      const caixasPDV = contas.filter(c => c.ativo && (c.tipo === 'Caixa Físico' || c.tipo === 'Caixa PDV'));
      
      const liquidez = {};
      await Promise.all(
        caixasPDV.map(async (caixa) => {
          const turno = turnosUnicos.find((t) => t.conta_caixa_pdv_id === caixa.id);
          if (!turno) return;
          try {
            const snapshot = await fetchCaixaTurnoSnapshot({
              turno,
              caixa,
              incluirRascunhos: false,
            });
            liquidez[caixa.id] = buildPainelCaixaResumo(snapshot, {
              rascunhosPendentesCaixa,
            });
          } catch (error) {
            console.error(`Erro ao carregar caixa ${caixa.id}:`, error);
          }
        })
      );

      setLiquidezPorCaixa(liquidez);
      setTurnosAtivos(turnosUnicos);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar turnos:', error);
      setLoading(false);
    }
  };

  const handleSelecionarCaixa = async (turno) => {
    const caixa = await base44.entities.ContasFinanceiras.get(turno.conta_caixa_pdv_id);
    setCaixaSelecionado(caixa);
    setTurnoSelecionado(turno);
  };

  const consumosPorDestinacao = useMemo(() => {
    const map = {};
    consumosHoje.forEach(c => {
      const dest = c.destinacao || 'Sem destinação';
      if (!map[dest]) map[dest] = { total: 0, qtdItens: 0, registros: 0 };
      map[dest].total += c.valor_total || 0;
      map[dest].qtdItens += c.quantidade_total_itens || 0;
      map[dest].registros += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [consumosHoje]);

  const totalConsumoHoje = useMemo(() => consumosHoje.reduce((s, c) => s + (c.valor_total || 0), 0), [consumosHoje]);

  const anexosPorConsumoId = useMemo(() => {
    const mapa = {};
    consumosHoje.forEach((consumo) => {
      const anexos = [];
      if (consumo.assinatura_recolhedor_url) {
        anexos.push({
          id: `${consumo.id}-assinatura`,
          nome_arquivo: 'Assinatura',
          descricao: consumo.assinatura_recolhedor_nome || 'Assinatura do recolhedor',
          tipo_documento: 'Assinatura',
          url_drive: consumo.assinatura_recolhedor_url,
        });
      }
      if (Array.isArray(consumo.anexos)) {
        consumo.anexos.forEach((anexo, index) => {
          if (anexo?.url_drive) {
            anexos.push({
              id: anexo.id || `${consumo.id}-anexo-${index}`,
              nome_arquivo: anexo.nome_arquivo,
              descricao: anexo.descricao,
              tipo_documento: anexo.tipo_documento,
              url_drive: anexo.url_drive,
            });
          }
        });
      }
      mapa[consumo.id] = anexos;
    });
    return mapa;
  }, [consumosHoje]);

  const toggleDestinacao = (dest) => setDestinacoesExpandidas(prev => ({ ...prev, [dest]: !prev[dest] }));

  const imprimirRelatorioConsumo = async () => {
    const linhas = consumosPorDestinacao.map(([dest, data]) => {
      const itensAgrupados = {};
      consumosHoje
        .filter(c => (c.destinacao || 'Sem destinação') === dest)
        .forEach(c => (c.itens || []).forEach(it => {
          if (!itensAgrupados[it.produto_nome]) itensAgrupados[it.produto_nome] = { qtd: 0, subtotal: 0, unidade: it.unidade_medida || '' };
          itensAgrupados[it.produto_nome].qtd += it.quantidade || 0;
          itensAgrupados[it.produto_nome].subtotal += it.subtotal || 0;
        }));
      const itensHtml = Object.entries(itensAgrupados).map(([nome, v]) =>
        `<tr><td style="padding:2px 8px">${nome}</td><td style="padding:2px 8px;text-align:center">${v.qtd} ${v.unidade}</td><td style="padding:2px 8px;text-align:right">R$ ${v.subtotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`
      ).join('');
      return `<tr style="background:#f3f4f6"><td colspan="3" style="padding:6px 8px;font-weight:600">${dest} — R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})} (${data.registros} registro${data.registros>1?'s':''})</td></tr>${itensHtml}`;
    }).join('');
    const html = `<html><head><title>Consumo Interno — Hoje</title><style>body{font-family:sans-serif;font-size:13px;padding:16px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #e5e7eb}</style></head><body><h2 style="margin-bottom:8px">Consumo Interno — Hoje</h2><p style="margin-bottom:12px;color:#6b7280">Total: R$ ${totalConsumoHoje.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><table><tbody>${linhas}</tbody></table></body></html>`;
    try {
      await openPrintWindowOrShareHtml(html, `consumo-interno-${Date.now()}.html`, 'Consumo interno — hoje');
    } catch {
      /* popup bloqueado */
    }
  };

  const formatValor = (valor) => {
    const num = valor || 0;
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const senhasNaoProcessadas = useMemo(() => {
    const unicos = new Map();
    Object.values(liquidezPorCaixa).forEach((item) => {
      (item.senhasAguardando || []).forEach((rascunho) => {
        if (!unicos.has(rascunho.id)) unicos.set(rascunho.id, rascunho);
      });
    });
    return Array.from(unicos.values());
  }, [liquidezPorCaixa]);


  // Se já selecionou um caixa, mostra a view completa
  if (turnoSelecionado && caixaSelecionado) {
    return (
      <VisualizadorCaixa
        turnoAtivo={turnoSelecionado}
        caixaSelecionado={caixaSelecionado}
        onVoltar={() => { setTurnoSelecionado(null); setCaixaSelecionado(null); loadTurnos(); }}
      />
    );
  }

  // Tela de seleção de caixa
  return (
    <div className={`flex flex-col h-full min-h-0 bg-background ${caixaTypo.screen}`}>
      <div className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y p-4 md:p-6 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className={`${caixaTypo.title} text-2xl mb-2`}>Caixas Ativos</h1>
            <p className={caixaTypo.meta}>Visualize o balanço de caixas em operação</p>
          </div>
          <button data-pulse-sensor="caixas-ativos.atualizar" onClick={loadTurnos} className="p-3 rounded-2xl bg-card border border-border/40 shadow-sm hover:bg-muted transition-colors" style={{ minWidth: '48px', minHeight: '48px' }}>
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin" />
          </div>
        ) : turnosAtivos.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center shadow-sm border border-border/40">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className={`${caixaTypo.title} text-lg mb-2`}>Nenhum caixa aberto</h3>
            <p className={caixaTypo.meta}>Não há turnos ativos no momento</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
            <P38MobileLineList allViewports>
              {turnosAtivos.map((turno, index) => {
                const liq = liquidezPorCaixa[turno.conta_caixa_pdv_id];
                return (
                  <P38MobileLine
                    key={turno.id}
                    thinAccent
                    striped={index % 2 === 1}
                    accent="success"
                    onClick={() => handleSelecionarCaixa(turno)}
                    title={turno.conta_caixa_pdv_nome}
                    subtitle={liq?.turnoAberto ? (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <span>Liquidez:</span>
                        <CaixaValorDisplay valor={liq.liquidez} tone="neutral" signed={false} size="sm" />
                      </span>
                    ) : 'Turno aberto'}
                    meta={
                      liq ? (
                        <>
                          <P38StatusLabel tone="success">Aberto</P38StatusLabel>
                          <span className="inline-flex items-center gap-1">
                            Gaveta:
                            <CaixaValorDisplay valor={liq.dinheiroNaGaveta} tone="neutral" signed={false} size="sm" />
                          </span>
                        </>
                      ) : (
                        <P38StatusLabel tone="muted">Sem dados</P38StatusLabel>
                      )
                    }
                    value={liq ? <CaixaValorDisplay valor={liq.totalVendas} tone="success" signed size="sm" /> : '—'}
                    valueSub="vendas"
                  />
                );
              })}
            </P38MobileLineList>

              <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/40">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h2 className={caixaTypo.section}>Senhas aguardando caixa</h2>
                      <p className={caixaTypo.meta}>Acompanhe o volume pendente antes do processamento</p>
                    </div>
                  </div>
                  <button
                    onClick={() => senhasNaoProcessadas.length > 0 && setShowSenhasPage(true)}
                    className="text-right disabled:cursor-default"
                    disabled={senhasNaoProcessadas.length === 0}
                  >
                    <p className={`${caixaTypo.valueLg} text-foreground`}>{senhasNaoProcessadas.length}</p>
                    <p className={caixaTypo.meta}>pendente{senhasNaoProcessadas.length === 1 ? '' : 's'}</p>
                  </button>
                </div>

                {senhasNaoProcessadas.length === 0 ? (
                  <p className={`${caixaTypo.meta} text-center py-4`}>Nenhuma senha aguardando processamento.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/60 px-3 py-3">
                      <p className={caixaTypo.meta}>Senhas</p>
                      <p className={`${caixaTypo.valueLg} text-foreground`}>{senhasNaoProcessadas.length}</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 px-3 py-3">
                      <p className={caixaTypo.meta}>Valor</p>
                      <CaixaValorDisplay valor={senhasNaoProcessadas.reduce((s, item) => s + (item.valor_total || 0), 0)} tone="warning" signed={false} size="md" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Relatório de Consumo Interno do Dia */}
            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-muted-foreground" />
                  <h2 className={caixaTypo.section}>Consumo Interno — Hoje</h2>
                </div>
                <div className="flex items-center gap-2">
                  <CaixaValorDisplay valor={totalConsumoHoje} tone="danger" signed size="sm" />
                  {consumosPorDestinacao.length > 0 && (
                    <button onClick={imprimirRelatorioConsumo} className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Imprimir relatório consolidado">
                      <Printer className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              {consumosPorDestinacao.length === 0 ? (
                <p className={`${caixaTypo.meta} text-center py-4`}>Nenhum consumo registrado hoje.</p>
              ) : (
                <div className="space-y-2">
                  {consumosPorDestinacao.map(([dest, data]) => {
                    const expanded = destinacoesExpandidas[dest];
                    const registrosDestino = consumosHoje.filter(c => (c.destinacao || 'Sem destinação') === dest);
                    const itensAgrupados = {};
                    registrosDestino.forEach(c => (c.itens || []).forEach(it => {
                      if (!itensAgrupados[it.produto_nome]) itensAgrupados[it.produto_nome] = { qtd: 0, subtotal: 0, unidade: it.unidade_medida || '' };
                      itensAgrupados[it.produto_nome].qtd += it.quantidade || 0;
                      itensAgrupados[it.produto_nome].subtotal += it.subtotal || 0;
                    }));
                    return (
                      <div key={dest} className="rounded-xl bg-muted/50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{dest}</p>
                            <p className="text-xs text-muted-foreground">{data.registros} registro{data.registros > 1 ? 's' : ''} · {data.qtdItens} item(ns)</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <CaixaValorDisplay valor={data.total} tone="danger" signed size="sm" />
                            <button onClick={() => toggleDestinacao(dest)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                              {expanded ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="space-y-3 border-t border-border/40 px-4 pb-3 pt-2">
                            {Object.entries(itensAgrupados).map(([nome, v]) => (
                              <div key={nome} className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{nome}</span>
                                <span className="flex items-center gap-3">
                                  <span>{v.qtd} {v.unidade}</span>
                                  <span className="font-medium text-foreground/90">{formatValor(v.subtotal)}</span>
                                </span>
                              </div>
                            ))}
                            <div className="space-y-2 pt-2">
                              {registrosDestino.map((consumo) => (
                                <div key={consumo.id} className="flex items-center justify-between rounded-2xl bg-card px-3 py-3 shadow-sm border border-border/30">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{consumo.numero || 'Consumo interno'}</p>
                                    <p className="truncate text-xs text-muted-foreground">{consumo.usuario_solicitante_nome || consumo.created_by || '—'} · {consumo.interveniente_nome || consumo.interveniente || 'Sem interveniente'}</p>
                                  </div>
                                  <div className="ml-3 flex items-center gap-2">
                                    <CaixaValorDisplay valor={consumo.valor_total} tone="danger" signed size="sm" />
                                    <button
                                      type="button"
                                      onClick={() => setConsumoSelecionado(consumo)}
                                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-sm hover:bg-muted/80"
                                      aria-label="Ver detalhes do consumo"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

        {showSenhasPage && (
          <div className={`fixed inset-0 z-50 bg-background flex flex-col ${caixaTypo.screen}`}>
            <div className="flex items-center justify-between px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] bg-card border-b border-border/40 flex-shrink-0">
              <div>
                <div className={caixaTypo.meta}>Controle</div>
                <div className={`${caixaTypo.title} text-xl`}>Senhas aguardando caixa</div>
              </div>
              <button onClick={() => setShowSenhasPage(false)} className="p-2 hover:bg-muted rounded-xl text-muted-foreground text-sm font-medium">
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
              <div className="max-w-2xl mx-auto space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/40">
                    <p className={caixaTypo.meta}>Senhas</p>
                    <p className={`${caixaTypo.valueLg} text-foreground`}>{senhasNaoProcessadas.length}</p>
                  </div>
                  <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/40">
                    <p className={caixaTypo.meta}>Valor total</p>
                    <CaixaValorDisplay valor={senhasNaoProcessadas.reduce((s, item) => s + (item.valor_total || 0), 0)} tone="warning" signed={false} size="lg" />
                  </div>
                </div>

                <P38MobileLineList allViewports>
                  {senhasNaoProcessadas.map((rascunho, index) => (
                    <P38MobileLine
                      key={rascunho.id}
                      thinAccent
                      striped={index % 2 === 1}
                      accent="warning"
                      title={`Senha ${String(rascunho.senha_atendimento || '').slice(-4) || '----'}`}
                      subtitle={`${rascunho.cliente_nome || 'Avulso'} · ${rascunho.vendedor_nome || 'Sem vendedor'}`}
                      value={<CaixaValorDisplay valor={rascunho.valor_total} tone="warning" signed={false} size="sm" />}
                      trailing={
                        <button
                          type="button"
                          onClick={() => {
                            setShowSenhasPage(false);
                            setRascunhoSelecionado(rascunho);
                          }}
                          className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary"
                          aria-label="Ver senha"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      }
                    />
                  ))}
                </P38MobileLineList>
              </div>
            </div>
          </div>
        )}

        <ConsumoDetalheDialog
          open={!!consumoSelecionado}
          onOpenChange={(open) => !open && setConsumoSelecionado(null)}
          consumo={consumoSelecionado}
          anexos={consumoSelecionado ? (anexosPorConsumoId[consumoSelecionado.id] || []) : []}
        />

        {rascunhoSelecionado && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
            <div className="bg-card rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-border/40">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Senha</div>
                  <div className="text-3xl font-bold font-mono text-foreground">{String(rascunhoSelecionado.senha_atendimento || '').slice(-4) || '----'}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground/90">{rascunhoSelecionado.cliente_nome || 'Avulso'}</div>
                  <div className="text-xs text-muted-foreground">{rascunhoSelecionado.vendedor_nome || 'Sem vendedor'}</div>
                </div>
                <button onClick={() => setRascunhoSelecionado(null)} className="p-2 hover:bg-muted rounded-xl text-muted-foreground text-sm font-medium">
                  Fechar
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Itens</div>
                {(rascunhoSelecionado.itens || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground leading-snug">{item.produto_nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">R$ {(item.preco_unitario_praticado || 0).toFixed(2)} × {item.quantidade}</div>
                    </div>
                    <div className="text-sm font-semibold text-foreground flex-shrink-0">R$ {(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                ))}
                {rascunhoSelecionado.valor_desconto > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Desconto</span><span>-R$ {rascunhoSelecionado.valor_desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border/40">
                  <span>Total</span>
                  <CaixaValorDisplay valor={rascunhoSelecionado.valor_total || 0} tone="success" signed size="md" />
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}