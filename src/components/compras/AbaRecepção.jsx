import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Play, AlertTriangle, CheckCircle, Clock, Warehouse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  criarMovimentosStockRecepcaoEmFalta,
  movimentoCombinaCodigoEmbarque,
} from '@/lib/movimentacaoRecepcaoCompra';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';
import { hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

function motivoEntradaCompraOk(mov) {
  const m = mov?.motivo;
  if (m == null || m === '') return true;
  if (m === 'Compra') return true;
  return String(m).toLowerCase() === 'compra';
}

export default function AbaRecepção({ pedido }) {
  const [movimentos, setMovimentos] = useState([]);
  const [isLoadingMovimentos, setIsLoadingMovimentos] = useState(false);
  const [pedidoAtual, setPedidoAtual] = useState(pedido);
  const [recebimentoSucesso, setRecebimentoSucesso] = useState(null);
  const [selectedEmbarque, setSelectedEmbarque] = useState(null);
  const [retificandoEmbId, setRetificandoEmbId] = useState(null);

  useEffect(() => {
    setPedidoAtual(pedido);
  }, [pedido]);

  const loadMovimentos = useCallback(async () => {
    if (!pedido?.id) return;
    setIsLoadingMovimentos(true);
    try {
      const pid = pedido.id;
      let movs = await base44.entities.MovimentacaoEstoque.filter(
        { referencia_tipo: 'PedidoCompra', referencia_id: pid },
        '-created_date',
        200
      );
      if (!movs?.length) {
        movs = await base44.entities.MovimentacaoEstoque.filter(
          { referencia_tipo: 'PedidoCompra', referencia_id: String(pid) },
          '-created_date',
          200
        );
      }
      if (!movs?.length && pedido.numero != null && pedido.numero !== '') {
        try {
          movs = await base44.entities.MovimentacaoEstoque.filter(
            {
              referencia_tipo: 'PedidoCompra',
              referencia_numero: String(pedido.numero),
            },
            '-created_date',
            200
          );
        } catch (e) {
          console.warn(
            'MovimentacaoEstoque: filtro por referencia_numero não aplicado.',
            e
          );
        }
      }
      setMovimentos(
        (movs || []).filter(
          (mov) => mov.tipo === 'Entrada' && motivoEntradaCompraOk(mov)
        )
      );
    } catch (error) {
      console.error('Erro ao carregar movimentos:', error);
    } finally {
      setIsLoadingMovimentos(false);
    }
  }, [pedido?.id, pedido?.numero]);

  useEffect(() => {
    if (pedido?.id) loadMovimentos();
  }, [pedido?.id, loadMovimentos]);

  useEffect(() => {
    if (!pedido?.id) return;
    const unsubscribe = base44.entities.PedidoCompra.subscribe((event) => {
      if (event.id === pedido.id && event.type === 'update') {
        setPedidoAtual(event.data);
      }
    });
    return unsubscribe;
  }, [pedido?.id]);

  useEffect(() => {
    if (!pedido?.id) return;
    const unsubscribe = base44.entities.MovimentacaoEstoque.subscribe((event) => {
      const d = event?.data || {};
      const rid = d.referencia_id;
      if (
        d.referencia_tipo === 'PedidoCompra' &&
        (rid === pedido.id || rid === String(pedido.id))
      ) {
        loadMovimentos();
      }
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [pedido?.id, loadMovimentos]);

  useEffect(() => {
    setSelectedEmbarque(null);
  }, [pedidoAtual?.embarques_registrados]);

  const handleRetificarStockEmbarque = useCallback(
    async (embarqueEl, codigoExibicaoVal, evt) => {
      evt?.preventDefault?.();
      evt?.stopPropagation?.();
      const id = embarqueEl?.id;
      if (!id) {
        toast.error('Embarque sem id — recarregue o pedido.');
        return;
      }
      setRetificandoEmbId(id);
      try {
        const pedidoRef = pedidoAtual || pedido;
        const n = await criarMovimentosStockRecepcaoEmFalta(base44, {
          pedido: pedidoRef,
          embarque: { ...embarqueEl, codigo_exibicao: codigoExibicaoVal },
          movimentosExistentes: movimentos,
        });
        if (n === 0) {
          toast.message('Nenhuma entrada nova', {
            description:
              'Já existem movimentos com este código de embarque ou as quantidades recebidas no documento estão a zero.',
          });
        } else {
          toast.success(`${n} entrada(s) em stock gerada(s).`);
          await invokeRecalcularConclusaoPedidoCompra(base44, pedidoRef?.id);
        }
        await loadMovimentos();
      } catch (err) {
        toast.error(err?.message || 'Falha ao gerar movimentos de stock.');
      } finally {
        setRetificandoEmbId(null);
      }
    },
    [pedido, pedidoAtual, movimentos, loadMovimentos]
  );

  const embarques = useMemo(() => {
    if (Array.isArray(pedidoAtual?._embarques)) return pedidoAtual._embarques.filter(Boolean);
    const raw = pedidoAtual?.embarques_registrados;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [pedidoAtual?._embarques, pedidoAtual?.embarques_registrados]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Recebido OK':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'Com Divergência':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'Recebido Parcial':
        return <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'Pendente': 'Aguardando Recebimento',
      'Recebido Parcial': 'Recebido Parcial',
      'Recebido OK': 'Recebido OK',
      'Com Divergência': 'Com Divergências'
    };
    return labels[status] || status;
  };

  if (embarques.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-base text-muted-foreground font-medium mb-1">
          Nenhum embarque registrado
        </p>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground">
          Adicione embarques na aba Logística para iniciar a recepção.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {embarques.map((embarque, idx) => {
        const statusRecebimento = embarque.status_recebimento || embarque.status_recebimento_embarque || 'Pendente';
        const dataEmbarque = embarque.data_embarque ? new Date(embarque.data_embarque).toLocaleDateString('pt-BR') : '-';
        const eta = embarque.eta ? new Date(embarque.eta).toLocaleDateString('pt-BR') : '-';
        const itensEmbarque = embarque.itens || embarque.itens_embarcados || [];
        const qtdItens = itensEmbarque.length || 0;
        const codigoExibicao = embarque.codigo_exibicao || `${pedidoAtual?.numero || pedido?.numero || '-----'}-${String.fromCharCode(65 + idx)}`;

        const movimentosDoEmbarque = movimentos.filter((mov) => {
          const porCodigoEmbarque =
            codigoExibicao && movimentoCombinaCodigoEmbarque(mov, codigoExibicao);
          if (porCodigoEmbarque) return true;
          const pidMov = mov.produto_id != null ? String(mov.produto_id) : '';
          const itemDoEmbarque = itensEmbarque.find(
            (item) =>
              (item.produto_id != null && String(item.produto_id) === pidMov) ||
              (item.produto_id_recebido_diferente != null &&
                String(item.produto_id_recebido_diferente) === pidMov)
          );
          return !!itemDoEmbarque;
        });

        const tinhaLinhasEmbarcadas = itensEmbarque.some(
          (it) => (Number(it.quantidade_embarcada) || 0) > 0
        );
        const alertaSemMovimentoAssociado =
          statusRecebimento !== 'Pendente' &&
          tinhaLinhasEmbarcadas &&
          movimentosDoEmbarque.length === 0;

        return (
          <button
            key={embarque.id || idx}
            onClick={() => setSelectedEmbarque(embarque)}
            className="w-full text-left bg-muted/50/50 hover:bg-muted rounded-2xl p-5 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Cabeçalho */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Embarque {codigoExibicao}
                  </h3>
                  <div className="flex-1" />
                  {getStatusIcon(statusRecebimento)}
                </div>

                {/* Info grid - 2 colunas */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Transportadora</p>
                    <p className="text-sm font-semibold text-foreground">{embarque.transportadora_nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Despacho</p>
                    <p className="text-sm font-semibold text-foreground">{dataEmbarque}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">ETA</p>
                    <p className="text-sm font-semibold text-foreground">{eta}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Itens</p>
                    <p className="text-sm font-semibold text-foreground">{qtdItens} produto(s)</p>
                  </div>
                </div>

                {/* Status badge */}
                <span className={`inline-block px-3 py-1.5 text-xs font-semibold rounded-full ${
                  statusRecebimento === 'Pendente'
                    ? 'bg-muted text-foreground/90'
                    : statusRecebimento === 'Recebido OK'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : statusRecebimento === 'Com Divergência'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {getStatusLabel(statusRecebimento)}
                </span>

                {alertaSemMovimentoAssociado && (
                  <div className="mt-2 flex flex-col gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-left">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 dark:text-amber-100 leading-snug">
                        Este embarque já não está pendente, mas não há movimento de stock ligado ao código{' '}
                        <span className="font-semibold">{codigoExibicao}</span>. Pode gerar as entradas a partir das
                        quantidades <span className="font-medium">recebidas</span> já gravadas no embarque.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start border-amber-300 bg-card text-amber-950 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-50 dark:border-amber-700 dark:hover:bg-amber-900/50"
                      disabled={retificandoEmbId === embarque.id}
                      onClick={(e) => handleRetificarStockEmbarque(embarque, codigoExibicao, e)}
                    >
                      {retificandoEmbId === embarque.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> A gerar…
                        </>
                      ) : (
                        'Gerar entrada em stock (retificar)'
                      )}
                    </Button>
                  </div>
                )}

                {movimentosDoEmbarque.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                      <Warehouse className="w-3 h-3" /> Movimento de Estoque
                      {isLoadingMovimentos ? (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" aria-hidden />
                      ) : null}
                    </p>
                    {movimentosDoEmbarque.map((mov) => (
                      <div key={mov.id} className="text-xs text-foreground/90 space-y-0.5">
                        <div>
                          <span className="font-medium">{mov.quantidade}</span> un. — {mov.produto_nome}
                        </div>
                        {mov.observacoes ? (
                          <div className="text-[11px] text-muted-foreground dark:text-muted-foreground pl-0 leading-snug">
                            {mov.observacoes}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                </div>

                {/* Ação - Play Icon */}
                <div className="flex items-center justify-center">
                {statusRecebimento === 'Pendente' ? (
                  <div className="w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted dark:hover:bg-muted transition-colors">
                    <Play className="w-5 h-5 text-muted-foreground fill-muted-foreground dark:fill-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {selectedEmbarque && (
        <RecepcionarEmbarque
          isOpen={!!selectedEmbarque}
          onClose={() => setSelectedEmbarque(null)}
          embarque={selectedEmbarque}
          pedido={pedidoAtual || pedido}
          onRecebido={async ({ recebimentoNumero } = {}) => {
            const pedidoId = (pedidoAtual || pedido)?.id;
            if (pedidoId) {
              const [atualizado, embarquesAtualizados] = await Promise.all([
                base44.entities.PedidoCompra.filter({ id: pedidoId }),
                base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }),
              ]);
              const embarquesHidratados = await hydrateEmbarquesPedidoFromSql(
                base44,
                pedidoId,
                embarquesAtualizados || [],
              );
              if (atualizado?.[0]) {
                setPedidoAtual({ ...atualizado[0], _embarques: embarquesHidratados });
              }
            }
            loadMovimentos();
            setRecebimentoSucesso({
              recebimentoNumero: recebimentoNumero || `REC-${(selectedEmbarque?.id || '').slice(-6)}`,
            });
          }}
          onRevertido={async () => {
            const pedidoId = (pedidoAtual || pedido)?.id;
            if (pedidoId) {
              const [atualizado, embarquesAtualizados] = await Promise.all([
                base44.entities.PedidoCompra.filter({ id: pedidoId }),
                base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }),
              ]);
              const embarquesHidratados = await hydrateEmbarquesPedidoFromSql(
                base44,
                pedidoId,
                embarquesAtualizados || [],
              );
              if (atualizado?.[0]) {
                setPedidoAtual({ ...atualizado[0], _embarques: embarquesHidratados });
              }
            }
            setSelectedEmbarque(null);
            await loadMovimentos();
            toast.success('Embarque pendente — pode receber de novo.');
          }}
        />
      )}

      {recebimentoSucesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-card shadow-xl p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Recebimento concluído com sucesso</h3>
              <p className="text-sm text-muted-foreground">Número do recebimento</p>
              <p className="text-base font-semibold text-foreground">{recebimentoSucesso.recebimentoNumero}</p>
            </div>
            <Button
              onClick={() => setRecebimentoSucesso(null)}
              className="w-full h-11 bg-background dark:bg-muted text-foreground hover:opacity-90 rounded-xl"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
