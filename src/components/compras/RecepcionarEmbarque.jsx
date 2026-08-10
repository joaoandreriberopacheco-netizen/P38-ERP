import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, AlertTriangle, Package, Search, Plus, X, Play, Copy, Eye, EyeOff, Loader2, Undo2 } from 'lucide-react';
import { dataHoje, formatarLogTime } from '@/components/utils/dateUtils';
import { roundToTwoDecimals, formatQuantity } from '@/lib/financialUtils';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import { syncEmbarqueItemRecepcaoFallback } from '@/lib/syncEmbarqueItemRecepcaoFallback';
import {
  invokeRecalcularConclusaoPedidoCompra,
  invokeRecalcularEstoqueProduto,
} from '@/lib/p38StockRecalc';
import { buildMovimentacaoRecepcaoCompraPayload } from '@/lib/movimentacaoRecepcaoCompra';
import { reverterRecepcaoEmbarque } from '@/lib/reverterRecepcaoEmbarque';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';

function getItensDoEmbarque(embarque) {
  const baseItens = Array.isArray(embarque?.itens_embarcados) && embarque.itens_embarcados.length > 0
    ? embarque.itens_embarcados
    : (Array.isArray(embarque?.itens) ? embarque.itens : []);
  const statusRec = embarque?.status_recebimento || embarque?.status_recebimento_embarque || 'Pendente';
  const aguardandoRecepcao = !statusRec || statusRec === 'Pendente';

  return baseItens.map((item) => {
    const hasExplicitRecebida = item.quantidade_recebida != null && item.quantidade_recebida !== '';
    let quantidade_recebida;
    if (!aguardandoRecepcao) {
      quantidade_recebida = hasExplicitRecebida
        ? roundToTwoDecimals(Number(item.quantidade_recebida) || 0)
        : roundToTwoDecimals(Number(item.quantidade_embarcada) || 0);
    } else if (hasExplicitRecebida) {
      quantidade_recebida = roundToTwoDecimals(Number(item.quantidade_recebida) || 0);
    } else {
      // Embarque ainda «Pendente»: assumir entrada = embarcado até o utilizador ajustar (evita confirmar com zeros).
      quantidade_recebida = roundToTwoDecimals(Number(item.quantidade_embarcada) || 0);
    }
    return {
      ...item,
      quantidade_recebida,
    };
  });
}

export default function RecepcionarEmbarque({ isOpen, onClose, embarque, pedido, onRecebido, onRevertido }) {
  const { toast } = useToast();
  const [itens, setItens] = useState(() => getItensDoEmbarque(embarque));
  const [dataEntrada, setDataEntrada] = useState(() => dataHoje());
  const [showDivergenciaDialog, setShowDivergenciaDialog] = useState(false);
  const [showModoDialog, setShowModoDialog] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [searchProduto, setSearchProduto] = useState('');
  const [showNovoProduct, setShowNovoProduct] = useState(false);
  const [novoProduto, setNovoProduto] = useState({ nome: '', hierarquico_1: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [showCodigoConferencia, setShowCodigoConferencia] = useState(false);
  const [codigoConferencia, setCodigoConferencia] = useState('');
  const [showCodigoDecrypt, setShowCodigoDecrypt] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      base44.entities.Produto.list().then(setProdutos);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setItens(getItensDoEmbarque(embarque));
    setDataEntrada(dataHoje());
  }, [isOpen, embarque]);

  const copiarQuantidadesEmbarcado = () => {
    setItens((prev) =>
      prev.map((item) => {
        const qtdEmb = roundToTwoDecimals(Number(item.quantidade_embarcada) || 0);
        return {
          ...item,
          quantidade_recebida: qtdEmb,
          divergencia_tipo: item.divergencia_tipo === 'Quantidade A Menor' ? 'Nenhuma' : item.divergencia_tipo,
        };
      })
    );
    toast({ title: 'Quantidades iguais ao embarcado', className: 'bg-green-100 text-green-800' });
  };

  const handleQuantidadeChange = (index, value) => {
    const newItens = [...itens];
    newItens[index].quantidade_recebida = roundToTwoDecimals(parseFloat(value) || 0);
    
    // Auto-detectar divergência de quantidade
    const qtdEmb = newItens[index].quantidade_embarcada;
    const qtdRec = newItens[index].quantidade_recebida;
    
    if (qtdRec < qtdEmb && newItens[index].divergencia_tipo === 'Nenhuma') {
      newItens[index].divergencia_tipo = 'Quantidade A Menor';
    } else if (qtdRec === qtdEmb && newItens[index].divergencia_tipo === 'Quantidade A Menor') {
      newItens[index].divergencia_tipo = 'Nenhuma';
    }
    
    setItens(newItens);
  };

  const abrirDivergencia = (index) => {
    setSelectedItemIndex(index);
    setShowDivergenciaDialog(true);
    setSearchProduto('');
  };

  const filteredProdutos = useMemo(() => {
    if (!searchProduto.trim()) return [];
    return filterAndSortProducts(produtos, searchProduto);
  }, [produtos, searchProduto]);

  const handleAceitarTroca = async (novoId, novoNome) => {
    const newItens = [...itens];
    newItens[selectedItemIndex] = {
      ...newItens[selectedItemIndex],
      produto_id_recebido_diferente: novoId,
      produto_nome_recebido_diferente: novoNome,
      divergencia_tipo: 'Produto Diferente - Aceite'
    };
    setItens(newItens);
    setShowDivergenciaDialog(false);
    setSelectedItemIndex(null);
    toast({ title: 'Troca aceita', description: `Produto alterado para ${novoNome}` });
  };

  const handleRejeitar = () => {
    const newItens = [...itens];
    newItens[selectedItemIndex].divergencia_tipo = 'Produto Diferente - Rejeitado';
    newItens[selectedItemIndex].quantidade_recebida = 0;
    setItens(newItens);
    setShowDivergenciaDialog(false);
    setSelectedItemIndex(null);
    toast({ title: 'Divergência registrada', variant: 'destructive' });
  };

  const handleNovoProduct = async () => {
    if (!novoProduto.nome.trim() || !novoProduto.hierarquico_1.trim()) {
      toast({ title: 'Preenchimento obrigatório', variant: 'destructive' });
      return;
    }

    try {
      const novo = await base44.entities.Produto.create({
        campo_hierarquico_1: novoProduto.hierarquico_1,
        nome: novoProduto.nome,
        preco_venda_padrao: 0,
        tipo: 'Produto',
        ativo: true
      });

      handleAceitarTroca(novo.id, novo.nome);
      setShowNovoProduct(false);
      setProdutos(prev => [...prev, novo]);
    } catch (error) {
      toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
    }
  };

  const handleConfirmarRecebimento = async () => {
    setIsSaving(true);
    let avisoSincroniaEmbarqueItem = null;
    try {
      const itensNorm = itens.map((item) => ({
        ...item,
        quantidade_embarcada: roundToTwoDecimals(item.quantidade_embarcada),
        quantidade_recebida: roundToTwoDecimals(item.quantidade_recebida),
      }));
      if (!embarque?.id) {
        toast({
          title: 'Embarque sem identificador',
          description:
            'Não é possível concluir a receção sem o id do embarque na Base44. Recarregue o pedido ou abra de novo na aba Logística.',
          variant: 'destructive',
        });
        return;
      }

      const totalRecebido = itensNorm.reduce((s, i) => s + (Number(i.quantidade_recebida) || 0), 0);
      const totalEmbarcadoItens = itensNorm.reduce((s, i) => s + (Number(i.quantidade_embarcada) || 0), 0);
      if (totalEmbarcadoItens <= 0) {
        toast({
          title: 'Sem linhas embarcadas',
          description: 'Este embarque não tem quantidades embarcadas para receber. Corrija na logística antes de confirmar.',
          variant: 'destructive',
        });
        return;
      }
      if (totalRecebido <= 0 && totalEmbarcadoItens > 0) {
        toast({
          title: 'Quantidades recebidas em branco',
          description:
            'Use «Copiar quantidades iguais ao embarcado» ou preencha o que entrou antes de confirmar. Sem quantidade recebida não há entrada em estoque.',
          variant: 'destructive',
        });
        return;
      }
      const novoEmbarque = { ...embarque, itens: itensNorm, itens_embarcados: itensNorm };
      const temDivergencia = itensNorm.some(i => i.divergencia_tipo !== 'Nenhuma');
      const todosRecebidos = itensNorm.every(
        (i) => Number(i.quantidade_recebida || 0) >= Number(i.quantidade_embarcada || 0)
      );
      
      let statusRecebimento = 'Recebido OK';
      if (temDivergencia) {
        statusRecebimento = 'Com Divergência';
      } else if (!todosRecebidos) {
        statusRecebimento = 'Recebido Parcial';
      }
      
      novoEmbarque.status_recebimento = statusRecebimento;
      novoEmbarque.status = 'Concluído';

      const embarques = Array.isArray(pedido._embarques) ? pedido._embarques : (Array.isArray(pedido.embarques_registrados) ? pedido.embarques_registrados : []);
      const outrosEmbarques = embarques.filter(e => e.id !== embarque.id);

      const itensOrfaos = itensNorm.map((item) => {
        const saldo = roundToTwoDecimals(
          Math.max(0, Number(item.quantidade_embarcada || 0) - Number(item.quantidade_recebida || 0))
        );
        if (!saldo) return null;
        return {
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade_pedida: saldo,
          quantidade_embarcada: saldo,
          quantidade_recebida: 0,
          unidade_medida: item.unidade_medida,
          divergencia_tipo: 'Nenhuma'
        };
      }).filter(Boolean);

      const proximaLetra = String.fromCharCode(65 + outrosEmbarques.length + 1);
      const embarqueOrfao = itensOrfaos.length > 0 ? {
        pedido_compra_id: pedido.id,
        pedido_compra_numero: pedido.numero,
        fornecedor_id: pedido.fornecedor_id,
        fornecedor_nome: pedido.fornecedor_nome,
        numero: String(outrosEmbarques.length + 1).padStart(2, '0'),
        codigo_exibicao: `${pedido.numero}-${proximaLetra}`,
        tipo: 'Necessidade',
        status: 'Pendente',
        data_embarque: null,
        eta: null,
        transportadora_id: '',
        transportadora_nome: '',
        volumes: '',
        volumes_detalhados: [],
        peso_kg: 0,
        observacoes: 'Gerado automaticamente por saldo não recebido do embarque original.',
        status_recebimento: 'Pendente',
        status_recebimento_embarque: 'Pendente',
        itens: itensOrfaos,
        itens_embarcados: itensOrfaos
      } : null;

      const pedidoItensParaCusto = Array.isArray(pedido?.itens) ? pedido.itens : [];

      // 1) Entrada em stock na DB Base44 (antes de fechar o embarque — se falhar, receção não fica «Concluída»).
      for (const item of itensNorm) {
        if (item.quantidade_recebida > 0) {
          const produtoId = item.produto_id_recebido_diferente || item.produto_id;
          const linhaPedido = pedidoItensParaCusto.find((pi) => String(pi?.produto_id) === String(item?.produto_id));
          await base44.entities.MovimentacaoEstoque.create(
            buildMovimentacaoRecepcaoCompraPayload({
              produtoId,
              produtoNome: item.produto_nome_recebido_diferente || item.produto_nome,
              quantidade: item.quantidade_recebida,
              pedido,
              embarque,
              purchaseItem: linhaPedido || item,
              receiptItem: item,
            })
          );
          await invokeRecalcularEstoqueProduto(base44, produtoId);
        }
      }

      await base44.entities.Embarque.update(embarque.id, {
        status: novoEmbarque.status,
        status_recebimento: statusRecebimento,
        itens: itensNorm,
        itens_embarcados: itensNorm,
        observacoes: novoEmbarque.observacoes,
      });

      const pedidoItens = Array.isArray(pedido?.itens) ? pedido.itens : [];
      try {
        const itensCanonicos = itensNorm
          .map((it, idx) => {
            const linhaPedido = pedidoItens.find((pi) => pi.produto_id === it?.produto_id);
            const qPedida =
              Number(it?.quantidade_pedida) ||
              Number(linhaPedido?.quantidade) ||
              0;
            return {
              produto_id: it?.produto_id || '',
              produto_unidade_id: it?.produto_unidade_id || '',
              pedido_compra_item_id: it?.pedido_compra_item_id || '',
              unidade_sigla: it?.unidade_medida || '',
              quantidade_pedida_comercial: qPedida,
              quantidade_embarcada_comercial: Number(it?.quantidade_embarcada) || 0,
              quantidade_recebida_comercial: Number(it?.quantidade_recebida) || 0,
              divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
              produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
              produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
              acordo_financeiro_lancamento_id: it?.acordo_financeiro_lancamento_id || '',
              ordem: idx,
            };
          })
          .filter((it) => it.produto_id && it.quantidade_embarcada_comercial > 0);
        if (itensCanonicos.length > 0) {
          await saveEmbarqueItem({
            action: 'replaceAll',
            embarque_id: embarque.id,
            items: itensCanonicos,
          });
        }
      } catch (canonicalErr) {
        console.warn('Sincronia canonica de EmbarqueItem (recepcao) falhou:', canonicalErr?.message || canonicalErr);
        try {
          const fb = await syncEmbarqueItemRecepcaoFallback(base44, {
            embarqueId: embarque.id,
            itensNorm,
          });
          console.info('[RecepcionarEmbarque] fallback EmbarqueItem OK:', fb);
        } catch (fallbackErr) {
          avisoSincroniaEmbarqueItem = String(
            fallbackErr?.message || canonicalErr?.message || canonicalErr,
          );
        }
      }

      if (embarqueOrfao) {
        await base44.entities.Embarque.create(embarqueOrfao);
      }

      const divergenciasCount = itensNorm.filter(i => i.divergencia_tipo !== 'Nenhuma').length;
      const divergenciasDesc = divergenciasCount > 0 ? ` | ${divergenciasCount} divergência(s)` : '';
      const resumoItens = itensNorm.map(i => `${i.produto_nome}: ${formatQuantity(i.quantidade_recebida)}/${formatQuantity(i.quantidade_embarcada)}`).join('; ');

      await base44.entities.PedidoCompra.update(pedido.id, {
        historico: (pedido.historico || '') + `\n[RECEPÇÃO EMBARQUE ${embarque.codigo_exibicao || ''} | Status: ${statusRecebimento}${divergenciasDesc} | Data: ${dataEntrada} | Itens: ${resumoItens}${embarqueOrfao ? ' | split automático gerou novo embarque' : ''} | ${formatarLogTime()}]`
      });

      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

      const recebimentoNumero = `REC-${String(embarque?.id || '').slice(-6) || String(Date.now()).slice(-6)}`;
      if (avisoSincroniaEmbarqueItem) {
        toast({
          title: 'Recebimento concluído com ressalvas',
          description: `Entrada em stock e embarque guardados. Sincronização EmbarqueItem falhou: ${avisoSincroniaEmbarqueItem.slice(0, 200)}`,
          variant: 'destructive',
          duration: 12000,
        });
      } else {
        toast({ title: 'Recebimento concluído', className: 'bg-green-100 text-green-800' });
      }
      onRecebido?.({ recebimentoNumero });
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao confirmar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const temDivergencias = itens.some(i => i.divergencia_tipo !== 'Nenhuma');
  const isReadOnly = embarque?.status_recebimento && embarque.status_recebimento !== 'Pendente';

  const handleReverterRecebimento = async () => {
    setIsReverting(true);
    try {
      const resultado = await reverterRecepcaoEmbarque(base44, { pedido, embarque });
      toast({
        title: 'Recebimento revertido',
        description:
          resultado.movimentosRemovidos > 0
            ? `${resultado.movimentosRemovidos} entrada(s) de stock removida(s). O embarque voltou a «Pendente» — pode receber de novo.`
            : 'Embarque reposto como pendente. Não havia movimentos de stock ligados a este código.',
        className: 'bg-green-100 text-green-800',
      });
      setShowRevertDialog(false);
      onRevertido?.(resultado);
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao reverter', description: error.message, variant: 'destructive' });
    } finally {
      setIsReverting(false);
    }
  };

  const iniciarRecepção = () => {
    setShowModoDialog(true);
  };

  const gerarCodigoConferencia = () => {
    const codigo = 'CONF-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    setCodigoConferencia(codigo);
    setShowCodigoConferencia(true);
    setShowCodigoDecrypt(false);
  };

  const confirmarModo = (modo) => {
    setShowModoDialog(false);
    if (modo === 'simplificado') {
      // Continua na recepção simplificada
    } else if (modo === 'conferencia') {
      gerarCodigoConferencia();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] md:w-full h-[calc(100vh-1rem)] md:h-[90vh] bg-card border-0 rounded-3xl p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-b from-white to-muted/60 dark:from-muted/40 dark:to-muted/60 px-6 py-5 border-b border-border/40/50 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-quicksand text-lg font-semibold text-foreground">Receber Embarque</h2>
                {isReadOnly && (
                  <p className="text-xs text-muted-foreground mt-1">Somente leitura</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted dark:hover:bg-primary/90">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Info do embarque - Grid de 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50/50 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Transportadora</p>
                <p className="text-sm font-semibold text-foreground">{embarque?.transportadora_nome || '-'}</p>
              </div>
              <div className="bg-muted/50/50 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">ETA Prevista</p>
                <p className="text-sm font-semibold text-foreground">
                  {embarque?.eta ? new Date(embarque.eta).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
            </div>

            {/* Itens - PDV Style */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1 mb-3">
                <h3 className="text-sm font-semibold text-foreground">Itens do Embarque</h3>
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copiarQuantidadesEmbarcado}
                    className="h-9 rounded-xl border-0 bg-muted text-foreground hover:bg-muted dark:hover:bg-muted shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Igual ao embarcado
                  </Button>
                )}
              </div>
              {!isReadOnly &&
                (!embarque?.status_recebimento || embarque.status_recebimento === 'Pendente') && (
                  <p className="text-xs text-muted-foreground px-1 -mt-2 mb-1">
                    Por defeito, a quantidade recebida iguala ao embarcado — ajuste só em caso de falta ou divergência.
                  </p>
                )}
              {itens.map((item, idx) => {
                const hasDivergencia = item.divergencia_tipo !== 'Nenhuma';
                return (
                  <div key={idx} className="bg-muted/50/50 rounded-2xl p-5 space-y-4 shadow-sm">
                    {/* Produto */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground leading-snug">
                          {item.produto_nome}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Embarcado: <span className="font-medium text-foreground">{formatQuantity(item.quantidade_embarcada)} {item.unidade_medida}</span>
                        </p>
                      </div>
                      {hasDivergencia && (
                        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-1" />
                      )}
                    </div>

                    {/* Quantidade Recebida */}
                    <div>
                      <Label className="text-xs text-muted-foreground font-semibold block mb-2">Quantidade Recebida</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantidade_recebida || ''}
                        onChange={e => handleQuantidadeChange(idx, e.target.value)}
                        disabled={isReadOnly}
                        className="h-14 text-lg bg-card border-0 rounded-xl shadow-sm font-semibold text-foreground text-center placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>

                    {/* Botão Divergência */}
                    <Button
                      onClick={() => abrirDivergencia(idx)}
                      disabled={isReadOnly}
                      variant={hasDivergencia ? 'default' : 'outline'}
                      className={`w-full h-12 text-sm font-semibold rounded-xl transition-colors ${
                        isReadOnly ? 'opacity-60 cursor-not-allowed' :
                        hasDivergencia
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-0'
                          : 'border-0 bg-muted text-foreground/90 hover:bg-muted dark:hover:bg-muted'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      {hasDivergencia ? 'Divergência Registrada' : 'Registrar Divergência'}
                    </Button>

                    {/* Aviso de divergência */}
                    {hasDivergencia && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3">
                        <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                          {item.divergencia_tipo === 'Quantidade A Menor' && '⚠ Quantidade menor que embarcada'}
                          {item.divergencia_tipo === 'Produto Diferente - Aceite' && `✓ Aceito: ${item.produto_nome_recebido_diferente}`}
                          {item.divergencia_tipo === 'Produto Diferente - Rejeitado' && '✗ Produto rejeitado'}
                          {item.divergencia_tipo === 'Produto Novo Recebido' && '✓ Novo produto'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer com Data e Botão */}
          <div className="shrink-0 border-t border-border/40/50 bg-gradient-to-b from-white to-muted/60 dark:from-muted/40 dark:to-muted/60 px-6 py-6 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Data de Entrada */}
            <div>
              <Label className="text-xs text-foreground/90 font-semibold block mb-2">Data de Entrada</Label>
              <Input
                type="date"
                value={dataEntrada}
                onChange={e => setDataEntrada(e.target.value)}
                disabled={isReadOnly}
                className="h-12 bg-card border-0 rounded-xl shadow-sm text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              />
              </div>

              {/* Botão Concluir */}
              {!isReadOnly && (
              <Button
                onClick={handleConfirmarRecebimento}
                disabled={isSaving}
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Concluir Recebimento
                  </>
                )}
              </Button>
              )}
              {isReadOnly && (
              <div className="space-y-3">
                <div className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl text-center">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">✓ Recebimento concluído</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Visualizando dados registrados</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRevertDialog(true)}
                  disabled={isReverting}
                  className="w-full h-12 border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40 rounded-xl font-semibold"
                >
                  {isReverting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      A reverter…
                    </>
                  ) : (
                    <>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Reverter recebimento
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground px-2">
                  Remove as entradas de stock deste embarque e deixa-o pendente para receber de novo (ex.: corrigir quantidade ou fator).
                </p>
              </div>
              )}
          </div>
          </DialogContent>
          </Dialog>

      <AlertDialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <AlertDialogContent className="max-w-lg bg-card border-0 rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-foreground">Reverter recebimento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              O embarque <strong>{embarque?.codigo_exibicao || ''}</strong> voltará ao estado{' '}
              <strong>Pendente</strong>. As entradas de stock ligadas a este recebimento serão removidas e o estoque
              recalculado. Depois pode confirmar o recebimento outra vez com as quantidades corretas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel
              disabled={isReverting}
              className="border-0 bg-muted text-foreground hover:bg-muted rounded-xl font-semibold"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReverterRecebimento();
              }}
              disabled={isReverting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
            >
              {isReverting ? 'A reverter…' : 'Sim, reverter'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Divergência - PDV Style */}
      <Dialog open={showDivergenciaDialog} onOpenChange={setShowDivergenciaDialog}>
        <DialogContent className="max-w-lg bg-card border-0 rounded-3xl p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-b from-white to-muted/60 dark:from-muted/40 dark:to-muted/60 px-6 py-5 border-b border-border/40/50">
            <h2 className="font-quicksand text-lg font-semibold text-foreground">Registrar Divergência</h2>
          </div>

          <div className="px-6 py-6 space-y-4">
            {selectedItemIndex !== null && (
              <>
                <div className="bg-muted/50/50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Produto</p>
                  <p className="text-base font-semibold text-foreground">
                    {itens[selectedItemIndex]?.produto_nome}
                  </p>
                </div>

                {/* Buscar produto diferente */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground font-semibold block mb-2">Buscar Produto Correto</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Nome ou código..."
                        value={searchProduto}
                        onChange={e => setSearchProduto(e.target.value)}
                        className="pl-10 h-11 bg-card border-0 rounded-xl shadow-sm text-sm"
                      />
                    </div>
                  </div>

                  {filteredProdutos.length > 0 && (
                    <div className="border border-border/40 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      {filteredProdutos.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAceitarTroca(p.id, p.nome)}
                          className="w-full text-left px-4 py-3 hover:bg-teal-50 dark:hover:bg-teal-900/20 border-b border-border/40 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          {p.codigo_interno && <p className="text-xs text-muted-foreground mt-0.5">{p.codigo_interno}</p>}
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNovoProduct(!showNovoProduct)}
                    className="w-full h-11 text-sm font-semibold border-0 bg-muted text-foreground hover:bg-muted dark:hover:bg-primary/90 rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Novo Produto
                  </Button>

                  {showNovoProduct && (
                    <div className="space-y-3 p-4 bg-muted/50/50 rounded-xl">
                      <Input
                        placeholder="Nome do produto"
                        value={novoProduto.nome}
                        onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})}
                        className="h-11 bg-card border-0 rounded-lg text-sm shadow-sm"
                      />
                      <Input
                        placeholder="Categoria"
                        value={novoProduto.hierarquico_1}
                        onChange={e => setNovoProduto({...novoProduto, hierarquico_1: e.target.value})}
                        className="h-11 bg-card border-0 rounded-lg text-sm shadow-sm"
                      />
                      <Button
                        onClick={handleNovoProduct}
                        className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white rounded-lg"
                      >
                        Criar e Aceitar
                      </Button>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleRejeitar}
                  className="w-full h-11 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0 font-semibold text-sm rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  Rejeitar Produto
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/40/50 px-6 py-4">
            <Button
              onClick={() => setShowDivergenciaDialog(false)}
              className="w-full h-11 bg-muted text-foreground border-0 font-semibold rounded-xl hover:bg-muted dark:hover:bg-primary/90"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Seleção de Modo */}
      <AlertDialog open={showModoDialog} onOpenChange={setShowModoDialog}>
        <AlertDialogContent className="max-w-lg bg-card border-0 rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-foreground">Como deseja proceder?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <button
              onClick={() => confirmarModo('simplificado')}
              className="w-full text-left bg-muted/50/50 hover:bg-muted rounded-2xl p-4 transition-colors"
            >
              <p className="font-semibold text-foreground">✓ Recepção Simplificada</p>
              <p className="text-sm text-muted-foreground mt-1">Confirmar recebimento direto (modelo atual)</p>
            </button>
            <button
              onClick={() => confirmarModo('conferencia')}
              className="w-full text-left bg-muted/50/50 hover:bg-muted rounded-2xl p-4 transition-colors"
            >
              <p className="font-semibold text-foreground"><Search className="w-4 h-4 inline mr-1" /> Conferência Cega</p>
              <p className="text-sm text-muted-foreground mt-1">Enviar para conferência com senha de acesso</p>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-0 bg-muted text-foreground hover:bg-muted dark:hover:bg-primary/90 rounded-xl font-semibold">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Código Conferência Cega */}
      <Dialog open={showCodigoConferencia} onOpenChange={setShowCodigoConferencia}>
        <DialogContent className="max-w-lg bg-card border-0 rounded-3xl p-0 overflow-hidden">
          <div className="bg-gradient-to-b from-white to-muted/60 dark:from-muted/40 dark:to-muted/60 px-6 py-5 border-b border-border/40/50">
            <h2 className="font-quicksand text-lg font-semibold text-foreground">Código Conferência Cega</h2>
          </div>
          <div className="px-6 py-8 space-y-6">
            <p className="text-sm text-muted-foreground">
              Compartilhe este código com o conferente para acessar a conferência cega em outro dispositivo.
            </p>
            <div className="bg-muted/50/50 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-between gap-3 bg-card rounded-xl p-4 border border-border/40">
                <span className="text-2xl font-bold tracking-widest text-foreground font-mono">
                  {showCodigoDecrypt ? codigoConferencia : '••••••••••••••'}
                </span>
                <button
                  onClick={() => setShowCodigoDecrypt(!showCodigoDecrypt)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  {showCodigoDecrypt ? (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Eye className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codigoConferencia);
                toast({ title: 'Código copiado', className: 'bg-green-100 text-green-800' });
              }}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copiar Código
            </button>
            <button
              onClick={() => {
                setShowCodigoConferencia(false);
                onClose();
              }}
              className="w-full h-12 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted dark:hover:bg-primary/90 transition-colors"
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}