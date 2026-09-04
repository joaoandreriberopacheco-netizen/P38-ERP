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
import { CheckCircle, AlertTriangle, Package, Search, Plus, X, Play, Copy, Eye, EyeOff, Loader2, Undo2, Boxes } from 'lucide-react';
import { dataHoje, formatarLogTime } from '@/components/utils/dateUtils';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import {
  buildPurchaseUnitOptions,
  calculateBaseQuantity,
  commercialQuantityFromBase,
  formatCommercialQuantity,
  getUnidadeBySiglaCanonical,
  hasAlternativeUnits,
} from '@/lib/productUnits';
import {
  buildItemRecepcaoAtualizado,
  buildUnidadeLinhaInicial,
  carregarProdutosMap,
  enrichLinhaEmbarque,
  quantidadeApresentacaoEmbarqueItem,
  quantidadeBaseEmbarqueItem,
  quantidadeRecebidaApresentacaoEmbarqueItem,
  resolveFatorLinhaEmbarque,
  resolveUnidadeLinha,
} from '@/lib/embarqueVitrineHelpers';
import {
  invokeRecalcularConclusaoPedidoCompra,
  invokeRecalcularEstoqueProduto,
} from '@/lib/p38StockRecalc';
import { buildMovimentacaoRecepcaoCompraPayload } from '@/lib/movimentacaoRecepcaoCompra';
import { reverterRecepcaoEmbarque } from '@/lib/reverterRecepcaoEmbarque';
import { buildItensCanonicosEmbarque } from '@/lib/buildEmbarqueItensCanonicos';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { hydrateEmbarquesFromSql, getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  resolveEmbarqueQuantidadeBase,
  resolveEmbarqueQuantidadeComercial,
} from '@/lib/embarqueQuantityResolve';

function pedidoItemParaEmbarque(pedido, embItem) {
  return (Array.isArray(pedido?.itens) ? pedido.itens : []).find(
    (pi) => String(pi?.produto_id) === String(embItem?.produto_id),
  ) || embItem;
}

function getItensDoEmbarque(embarque) {
  const baseItens = getEmbarqueItensLinhas(embarque);

  return baseItens.map((item) => {
    const qEmbApres = resolveEmbarqueQuantidadeComercial(item, 'embarcada');
    const qEmbBase = resolveEmbarqueQuantidadeBase(item, 'embarcada');
    const hasExplicitRecebida =
      (item.quantidade_recebida != null && item.quantidade_recebida !== '')
      || item.quantidade_recebida_apresentacao != null;

    let quantidade_recebida_apresentacao;
    let quantidade_recebida;
    if (hasExplicitRecebida) {
      quantidade_recebida_apresentacao = resolveEmbarqueQuantidadeComercial(item, 'recebida');
      quantidade_recebida = resolveEmbarqueQuantidadeBase(item, 'recebida');
    } else {
      quantidade_recebida_apresentacao = qEmbApres;
      quantidade_recebida = qEmbBase;
    }

    return {
      ...item,
      quantidade_recebida,
      quantidade_recebida_apresentacao,
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
  const [produtosMap, setProdutosMap] = useState({});
  const [unidadeLinha, setUnidadeLinha] = useState({});
  const [qtdRecebidaApres, setQtdRecebidaApres] = useState({});
  const [unitSelector, setUnitSelector] = useState({ open: false, produtoId: null, product: null });
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

  const inicializarVitrineRecepcao = (baseItens) => {
    const initUnidade = {};
    const initQtd = {};
    baseItens.forEach((item) => {
      const pedidoItem = pedidoItemParaEmbarque(pedido, item);
      const linha = buildUnidadeLinhaInicial(pedidoItem, null, item);
      initUnidade[item.produto_id] = linha;
      initQtd[item.produto_id] = String(quantidadeRecebidaApresentacaoEmbarqueItem(item, linha));
    });
    setUnidadeLinha(initUnidade);
    setQtdRecebidaApres(initQtd);
    setProdutosMap({});

    carregarProdutosMap(baseItens).then((map) => {
      setProdutosMap(map);
      const unidadeAtualizada = { ...initUnidade };
      const qtdAtualizada = { ...initQtd };
      baseItens.forEach((item) => {
        const produto = map[item.produto_id];
        if (!produto) return;
        const pedidoItem = pedidoItemParaEmbarque(pedido, item);
        const linha = enrichLinhaEmbarque(produto, buildUnidadeLinhaInicial(pedidoItem, produto, item));
        unidadeAtualizada[item.produto_id] = linha;
        qtdAtualizada[item.produto_id] = String(quantidadeRecebidaApresentacaoEmbarqueItem(item, linha));
      });
      setUnidadeLinha(unidadeAtualizada);
      setQtdRecebidaApres(qtdAtualizada);
    });
  };

  useEffect(() => {
    if (!isOpen || !embarque?.id) return;
    let cancelled = false;
    setDataEntrada(dataHoje());

    (async () => {
      const [hydrated] = await hydrateEmbarquesFromSql(base44, [embarque]);
      if (cancelled) return;
      const baseItens = getItensDoEmbarque(hydrated || embarque);
      setItens(baseItens);
      inicializarVitrineRecepcao(baseItens);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, embarque?.id, pedido?.id]);

  const copiarQuantidadesEmbarcado = () => {
    const qtdAtualizada = { ...qtdRecebidaApres };
    setItens((prev) =>
      prev.map((item) => {
        const produto = produtosMap[item.produto_id];
        const pedidoItem = pedidoItemParaEmbarque(pedido, item);
        const linha = resolveUnidadeLinha(pedidoItem, produto, unidadeLinha, item.produto_id);
        const qEmbApres = quantidadeApresentacaoEmbarqueItem(item, linha);
        const qEmbBase = quantidadeBaseEmbarqueItem(item);
        qtdAtualizada[item.produto_id] = String(qEmbApres);
        return {
          ...item,
          quantidade_recebida: qEmbBase,
          quantidade_recebida_apresentacao: qEmbApres,
          divergencia_tipo: item.divergencia_tipo === 'Quantidade A Menor' ? 'Nenhuma' : item.divergencia_tipo,
        };
      })
    );
    setQtdRecebidaApres(qtdAtualizada);
    toast({ title: 'Quantidades iguais ao embarcado', className: 'bg-green-100 text-green-800' });
  };

  const handleQuantidadeChange = (index, value) => {
    const item = itens[index];
    const produto = produtosMap[item.produto_id];
    const pedidoItem = pedidoItemParaEmbarque(pedido, item);
    const linha = resolveUnidadeLinha(pedidoItem, produto, unidadeLinha, item.produto_id);
    const qApres = roundToTwoDecimals(parseFloat(String(value).replace(',', '.')) || 0);
    const qBase = roundToTwoDecimals(calculateBaseQuantity(qApres, linha.fator));
    const qEmbBase = quantidadeBaseEmbarqueItem(item);

    const newItens = [...itens];
    newItens[index] = {
      ...newItens[index],
      quantidade_recebida: qBase,
      quantidade_recebida_apresentacao: qApres,
    };

    if (qBase < qEmbBase - 0.01 && newItens[index].divergencia_tipo === 'Nenhuma') {
      newItens[index].divergencia_tipo = 'Quantidade A Menor';
    } else if (qBase >= qEmbBase - 0.01 && newItens[index].divergencia_tipo === 'Quantidade A Menor') {
      newItens[index].divergencia_tipo = 'Nenhuma';
    }

    setItens(newItens);
    setQtdRecebidaApres((prev) => ({ ...prev, [item.produto_id]: String(value).replace(',', '.') }));
  };

  const handleConfirmUnitRecepcao = (unitOption) => {
    const produtoId = unitSelector.produtoId;
    if (!produtoId || !unitOption) return;
    const index = itens.findIndex((i) => i.produto_id === produtoId);
    if (index < 0) return;
    const item = itens[index];
    const produto = produtosMap[produtoId];
    const pedidoItem = pedidoItemParaEmbarque(pedido, item);
    const linhaAtual = unidadeLinha[produtoId] || buildUnidadeLinhaInicial(pedidoItem, produto, item);
    const qtyAtual = parseFloat(qtdRecebidaApres[produtoId]) || 0;
    const baseAtual = calculateBaseQuantity(qtyAtual, linhaAtual.fator);
    const fatorNovo = resolveFatorLinhaEmbarque(produto, {
      unidade: unitOption.unidade,
      fator: Number(unitOption.fator_conversao) || 1,
    });
    const qtyNova = commercialQuantityFromBase(baseAtual, fatorNovo, unitOption.unidade);

    setUnidadeLinha((prev) => ({
      ...prev,
      [produtoId]: enrichLinhaEmbarque(produto, {
        unidade: unitOption.unidade,
        fator: fatorNovo,
        produto_unidade_id: getUnidadeBySiglaCanonical(produto, unitOption.unidade)?.id || '',
      }),
    }));
    handleQuantidadeChange(index, String(qtyNova));
    setUnitSelector({ open: false, produtoId: null, product: null });
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
    try {
      const itensNorm = itens.map((item) => {
        const produto = produtosMap[item.produto_id];
        const pedidoItem = pedidoItemParaEmbarque(pedido, item);
        const linha = resolveUnidadeLinha(pedidoItem, produto, unidadeLinha, item.produto_id);
        const qApres = roundToTwoDecimals(parseFloat(qtdRecebidaApres[item.produto_id]) || 0);
        return buildItemRecepcaoAtualizado(item, pedidoItem, produto, linha, qApres);
      });
      if (!embarque?.id) {
        toast({
          title: 'Embarque sem identificador',
          description:
            'Não é possível concluir a receção sem o id do embarque. Recarregue o pedido ou abra de novo na aba Logística.',
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

      const temDivergencia = itensNorm.some((i) => i.divergencia_tipo !== 'Nenhuma');
      const todosRecebidos = itensNorm.every(
        (i) => Number(i.quantidade_recebida || 0) >= Number(i.quantidade_embarcada || 0),
      );

      let statusRecebimento = 'Recebido OK';
      if (temDivergencia) {
        statusRecebimento = 'Com Divergência';
      } else if (!todosRecebidos) {
        statusRecebimento = 'Recebido Parcial';
      }

      const embarques = Array.isArray(pedido._embarques) ? pedido._embarques : [];
      const outrosEmbarques = embarques.filter((e) => e.id !== embarque.id);
      const pedidoItens = Array.isArray(pedido?.itens) ? pedido.itens : [];

      const itensOrfaosNorm = itensNorm
        .map((item) => {
          const pedidoItem = pedidoItemParaEmbarque(pedido, item);
          const produto = produtosMap[item.produto_id];
          const linha = resolveUnidadeLinha(pedidoItem, produto, unidadeLinha, item.produto_id);
          const qEmbApres = Number(item.quantidade_embarcada_apresentacao) ?? quantidadeApresentacaoEmbarqueItem(item, linha);
          const qRecApres = Number(item.quantidade_recebida_apresentacao) ?? 0;
          const saldoApres = roundToTwoDecimals(Math.max(0, qEmbApres - qRecApres));
          if (saldoApres <= 0) return null;
          const saldoBase = roundToTwoDecimals(calculateBaseQuantity(saldoApres, linha.fator));
          return {
            ...item,
            quantidade_pedida: saldoBase,
            quantidade_embarcada: saldoBase,
            quantidade_recebida: 0,
            quantidade_pedida_apresentacao: saldoApres,
            quantidade_embarcada_apresentacao: saldoApres,
            quantidade_recebida_apresentacao: 0,
            unidade_apresentacao: linha.unidade,
            fator_apresentacao: linha.fator,
            divergencia_tipo: 'Nenhuma',
          };
        })
        .filter(Boolean);

      const proximaLetra = String.fromCharCode(65 + outrosEmbarques.length + 1);
      const embarqueOrfaoMeta = itensOrfaosNorm.length > 0 ? {
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
      } : null;

      const itensCanonicos = buildItensCanonicosEmbarque(itensNorm, pedidoItens);
      if (itensCanonicos.length <= 0) {
        toast({
          title: 'Linhas inválidas',
          description: 'Não foi possível gravar as linhas do embarque. Verifique produto e quantidades.',
          variant: 'destructive',
        });
        return;
      }

      // 1) SQL canónico (EmbarqueItem) — obrigatório; recomporEmbarque actualiza espelho JSON
      await saveEmbarqueItem({
        action: 'replaceAll',
        embarque_id: embarque.id,
        items: itensCanonicos,
      });

      // 2) Entrada em stock
      const pedidoItensParaCusto = pedidoItens;
      for (const item of itensNorm) {
        if (item.quantidade_recebida > 0) {
          const produtoId = item.produto_id_recebido_diferente || item.produto_id;
          const linhaPedido = pedidoItensParaCusto.find((pi) => String(pi?.produto_id) === String(item?.produto_id));
          await base44.entities.MovimentacaoEstoque.create(
            buildMovimentacaoRecepcaoCompraPayload({
              produtoId,
              produtoNome: item.produto_nome_recebido_diferente || item.produto_nome,
              quantidade:
                item.quantidade_recebida_apresentacao
                ?? resolveEmbarqueQuantidadeComercial(item, 'recebida'),
              pedido,
              embarque,
              purchaseItem: linhaPedido || item,
              receiptItem: item,
            }),
          );
          await invokeRecalcularEstoqueProduto(base44, produtoId);
        }
      }

      // 3) Metadados do embarque (sem duplicar itens — espelho vem do SQL)
      const divergenciasCount = itensNorm.filter((i) => i.divergencia_tipo !== 'Nenhuma').length;
      const resumoDivergencias = itensNorm
        .filter((i) => i.divergencia_tipo !== 'Nenhuma')
        .map((i) => {
          const un = i.unidade_apresentacao || i.unidade_medida || '';
          const rec = i.quantidade_recebida_apresentacao ?? resolveEmbarqueQuantidadeComercial(i, 'recebida');
          const emb = i.quantidade_embarcada_apresentacao ?? resolveEmbarqueQuantidadeComercial(i, 'embarcada');
          return `${i.produto_nome}: recebido ${rec}/${emb} ${un} (${i.divergencia_tipo})`;
        })
        .join('; ');

      const obsAnteriores = String(embarque?.observacoes || '').trim();
      const obsRecepcao = [
        temDivergencia ? `Recepção com divergência (${dataEntrada}).` : null,
        resumoDivergencias || null,
        itensOrfaosNorm.length > 0
          ? `Saldo aguardando novo embarque: ${itensOrfaosNorm.map((i) => `${i.produto_nome} ${i.quantidade_embarcada_apresentacao} ${i.unidade_apresentacao || ''}`.trim()).join('; ')}`
          : null,
      ].filter(Boolean).join('\n');
      const observacoesFinais = [obsAnteriores, obsRecepcao].filter(Boolean).join('\n\n');

      await base44.entities.Embarque.update(embarque.id, {
        status: 'Concluído',
        status_recebimento: statusRecebimento,
        observacoes: observacoesFinais || embarque?.observacoes,
      });

      if (embarqueOrfaoMeta) {
        const orphanCreated = await base44.entities.Embarque.create(embarqueOrfaoMeta);
        const orphanCanonicos = buildItensCanonicosEmbarque(itensOrfaosNorm, pedidoItens);
        if (orphanCreated?.id && orphanCanonicos.length > 0) {
          await saveEmbarqueItem({
            action: 'replaceAll',
            embarque_id: orphanCreated.id,
            items: orphanCanonicos,
          });
        }
      }

      const divergenciasDesc = divergenciasCount > 0 ? ` | ${divergenciasCount} divergência(s)` : '';
      const resumoItens = itensNorm.map((i) => {
        const un = i.unidade_apresentacao || i.unidade_medida || '';
        const rec = i.quantidade_recebida_apresentacao ?? i.quantidade_recebida;
        const emb = i.quantidade_embarcada_apresentacao ?? i.quantidade_embarcada;
        return `${i.produto_nome}: ${formatCommercialQuantity(rec, un)}/${formatCommercialQuantity(emb, un)} ${un}`;
      }).join('; ');

      await base44.entities.PedidoCompra.update(pedido.id, {
        historico: (pedido.historico || '') + `\n[RECEPÇÃO EMBARQUE ${embarque.codigo_exibicao || ''} | Status: ${statusRecebimento}${divergenciasDesc} | Data: ${dataEntrada} | Itens: ${resumoItens}${embarqueOrfaoMeta ? ' | split automático gerou novo embarque' : ''} | ${formatarLogTime()}]`,
      });

      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

      const recebimentoNumero = `REC-${String(embarque?.id || '').slice(-6) || String(Date.now()).slice(-6)}`;
      toast({ title: 'Recebimento concluído', className: 'bg-green-100 text-green-800' });
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
                const produto = produtosMap[item.produto_id];
                const pedidoItem = pedidoItemParaEmbarque(pedido, item);
                const linha = resolveUnidadeLinha(pedidoItem, produto, unidadeLinha, item.produto_id);
                const qEmbApres = quantidadeApresentacaoEmbarqueItem(item, linha);
                const podeTrocarUnidade = produto && hasAlternativeUnits(produto) && buildPurchaseUnitOptions(produto).length > 1;
                return (
                  <div key={idx} className="bg-muted/50/50 rounded-2xl p-5 space-y-4 shadow-sm">
                    {/* Produto */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground leading-snug">
                          {item.produto_nome}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Embarcado:{' '}
                          <span className="font-medium text-foreground">
                            {formatCommercialQuantity(qEmbApres, linha.unidade)} {linha.unidade}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {podeTrocarUnidade && !isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => setUnitSelector({ open: true, produtoId: item.produto_id, product: produto })}
                            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-muted/80"
                          >
                            <Boxes className="w-3 h-3" aria-hidden />
                            {linha.unidade}
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground px-1">
                            {linha.unidade}
                          </span>
                        )}
                        {hasDivergencia && (
                          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Quantidade Recebida */}
                    <div>
                      <Label className="text-xs text-muted-foreground font-semibold block mb-2">
                        Quantidade Recebida ({linha.unidade})
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={qtdRecebidaApres[item.produto_id] ?? ''}
                        onFocus={(e) => e.target.select()}
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

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="purchase"
        onClose={() => setUnitSelector({ open: false, produtoId: null, product: null })}
        onConfirm={handleConfirmUnitRecepcao}
      />

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