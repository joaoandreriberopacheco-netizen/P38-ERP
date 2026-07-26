import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { FileText, Plus, Trophy, CheckCircle, UploadCloud, AlertCircle, Camera, Trash2, Search, Minus } from 'lucide-react';
import { format } from 'date-fns';
import ImportadorCotacaoPDF from './ImportadorCotacaoPDF';
import ImportadorListaFoto from './ImportadorListaFoto';
import { dataHoje } from '@/components/utils/dateUtils';
import { pickDefaultPurchaseUnit } from '@/lib/productUnits';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
  p38StatusTone,
} from '@/components/ui/p38-mobile-line';
import { syncPedidoCompraItensReplaceAll } from '@/lib/pedidoCompraCanonicoSync';

function cotacaoAccent(status) {
  if (status === 'Finalizada') return 'success';
  if (status === 'Em Análise') return 'info';
  return 'muted';
}

export default function CotacoesManager() {
  const [cotacoes, setCotacoes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCotacao, setSelectedCotacao] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [isImportadorOpen, setIsImportadorOpen] = useState(false);
  const [isImportadorFotoOpen, setIsImportadorFotoOpen] = useState(false);
  const [targetCotacaoImportacaoLista, setTargetCotacaoImportacaoLista] = useState(null);
  const [isNovaCotacaoOpen, setIsNovaCotacaoOpen] = useState(false);
  const [novaCotacaoTitulo, setNovaCotacaoTitulo] = useState('');
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [manualSearch, setManualSearch] = useState('');
  const [manualCart, setManualCart] = useState([]);
  const { toast } = useToast();

  const [precosInput, setPrecosInput] = useState({});
  const [isAnaliseDialogOpen, setIsAnaliseDialogOpen] = useState(false);

  const mapCotacaoItemsToManualCart = (cotacao) => (
    (cotacao?.itens || []).map((item) => ({
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade || 1,
      unidade: item.unidade || 'UN'
    }))
  );

  const mergeCotacaoItemsByProduct = (currentItems = [], incomingItems = []) => {
    const merged = new Map();
    [...currentItems, ...incomingItems].forEach((item) => {
      const key = item.produto_id;
      const previous = merged.get(key);
      const qty = parseFloat(item.quantidade) || 0;
      if (!previous) {
        merged.set(key, { ...item, quantidade: qty });
        return;
      }
      merged.set(key, {
        ...previous,
        quantidade: (parseFloat(previous.quantidade) || 0) + qty
      });
    });
    return Array.from(merged.values()).filter((item) => (parseFloat(item.quantidade) || 0) > 0);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cotacoesData, fornecedoresData] = await Promise.all([
        base44.entities.Cotacao.list('-created_date'),
        base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] })
      ]);
      setCotacoes(cotacoesData);
      setFornecedores(fornecedoresData);
      const produtosData = await base44.entities.Produto.filter({ tipo: 'Produto', ativo: true });
      setProdutosCatalogo(produtosData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePedido = async (cotacao) => {
    const itensVencedores = cotacao.respostas.filter(r => r.vencedor);
    
    if (itensVencedores.length === 0) {
      toast({ title: "Nenhum vencedor", description: "Selecione os itens vencedores antes de gerar pedido.", variant: "destructive" });
      return;
    }

    const itensPorFornecedor = {};
    itensVencedores.forEach(resp => {
      if (!itensPorFornecedor[resp.fornecedor_id]) {
        itensPorFornecedor[resp.fornecedor_id] = [];
      }
      const itemOriginal = cotacao.itens.find(i => i.produto_id === resp.produto_id);
      if (itemOriginal) {
        itensPorFornecedor[resp.fornecedor_id].push({
          produto_id: resp.produto_id,
          produto_nome: itemOriginal.produto_nome,
          quantidade: resp.quantidade_ofertada || itemOriginal.quantidade,
          custo_unitario: resp.preco_unitario,
          total: (resp.quantidade_ofertada || itemOriginal.quantidade) * resp.preco_unitario
        });
      }
    });

    try {
      const allPOs = await base44.entities.PedidoCompra.list();
      let nextNumber = (allPOs.length > 0 ? Math.max(...allPOs.map(p => parseInt(p.numero?.split('-')[1] || 0))) : 0) + 1;

      for (const fornecedorId in itensPorFornecedor) {
        const itens = itensPorFornecedor[fornecedorId];
        const fornecedor = fornecedores.find(f => f.id === fornecedorId);
        const total = itens.reduce((sum, i) => sum + i.total, 0);

        const created = await base44.entities.PedidoCompra.create({
          numero: `PC-${String(nextNumber++).padStart(5, '0')}`,
          fornecedor_id: fornecedorId,
          fornecedor_nome: fornecedor?.nome || 'Desconhecido',
          status: 'Rascunho',
          itens: itens,
          valor_total: total,
          observacoes: `Gerado a partir da Cotação ${cotacao.numero}`
        });
        if (created?.id && itens.length > 0) {
          const sync = await syncPedidoCompraItensReplaceAll(created.id, itens, { valorTotal: total });
          if (!sync.ok && !sync.skipped) {
            console.warn('[CotacoesManager] sync SQL linhas:', sync.error);
          }
        }
      }

      await base44.entities.Cotacao.update(cotacao.id, { status: 'Finalizada' });
      toast({ title: "Sucesso", description: "Pedidos de compra gerados com sucesso!", className: "bg-green-100 text-green-800" });
      loadData();
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdatePreco = (fornecedorId, produtoId, valor) => {
    setPrecosInput(prev => ({
      ...prev,
      [`${fornecedorId}_${produtoId}`]: valor
    }));
  };

  const filteredManualProducts = useMemo(() => {
    if (!manualSearch.trim()) return [];
    return filterAndSortProducts(produtosCatalogo, manualSearch);
  }, [manualSearch, produtosCatalogo]);

  const handleOpenAnaliseCotacao = (cotacao) => {
    setSelectedCotacao(cotacao);
    const inputs = {};
    cotacao.respostas?.forEach(r => {
      inputs[`${r.fornecedor_id}_${r.produto_id}`] = r.preco_unitario;
    });
    setPrecosInput(inputs);
    setManualSearch('');
    setManualCart(mapCotacaoItemsToManualCart(cotacao));
  };

  const handleOpenImportadorListaGlobal = () => {
    setTargetCotacaoImportacaoLista(null);
    setIsImportadorFotoOpen(true);
  };

  const handleOpenImportadorListaEmCotacao = () => {
    if (!selectedCotacao) return;
    setTargetCotacaoImportacaoLista(selectedCotacao);
    setIsImportadorFotoOpen(true);
  };

  const handleAddManualProduct = (produto) => {
    setManualCart((prev) => {
      const index = prev.findIndex((item) => item.produto_id === produto.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          quantidade: (parseFloat(next[index].quantidade) || 0) + 1
        };
        return next;
      }
      const pu = pickDefaultPurchaseUnit(produto);
      const unidade = pu?.unidade || produto.unidade_principal || 'UN';
      const fator = pu?.fator_conversao ?? 1;
      return [
        ...prev,
        {
          produto_id: produto.id,
          produto_nome: produto.nome,
          quantidade: 1,
          unidade,
          fator_conversao: fator,
        },
      ];
    });
  };

  const handleManualQtyChange = (produtoId, nextValue) => {
    setManualCart((prev) => prev.map((item) => (
      item.produto_id === produtoId
        ? { ...item, quantidade: nextValue }
        : item
    )));
  };

  const handleRemoveManualItem = (produtoId) => {
    setManualCart((prev) => prev.filter((item) => item.produto_id !== produtoId));
  };

  const handleSaveManualItems = async () => {
    if (!selectedCotacao) return;
    const itensValidos = manualCart
      .map((item) => ({ ...item, quantidade: parseFloat(item.quantidade) || 0 }))
      .filter((item) => item.quantidade > 0);

    if (itensValidos.length === 0) {
      toast({ title: "Sem itens válidos", description: "Adicione pelo menos um item com quantidade.", variant: "destructive" });
      return;
    }

    await base44.entities.Cotacao.update(selectedCotacao.id, { itens: itensValidos });
    toast({ title: "Itens atualizados", className: "bg-green-100 text-green-800" });
    await loadData();
    const updated = await base44.entities.Cotacao.get(selectedCotacao.id);
    setSelectedCotacao(updated);
    setManualCart(mapCotacaoItemsToManualCart(updated));
  };

  const handleAbrirCompeticao = async () => {
    if (!selectedCotacao) return;
    if ((selectedCotacao.itens?.length || 0) === 0) {
      toast({ title: "Sem itens", description: "Adicione itens antes de abrir a competição.", variant: "destructive" });
      return;
    }
    if (selectedCotacao.status !== 'Rascunho') return;

    try {
      await base44.entities.Cotacao.update(selectedCotacao.id, { status: 'Em Análise' });
      toast({ title: "Competição aberta", description: "Agora você pode coletar respostas e comparar preços.", className: "bg-blue-100 text-blue-800" });
      await loadData();
      const updated = await base44.entities.Cotacao.get(selectedCotacao.id);
      handleOpenAnaliseCotacao(updated);
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCotacao = async (cotacao) => {
    const confirmDelete = window.confirm(`Excluir a cotação "${cotacao.titulo}"? Essa ação não pode ser desfeita.`);
    if (!confirmDelete) return;
    try {
      await base44.entities.Cotacao.delete(cotacao.id);
      toast({ title: "Cotação excluída", className: "bg-green-100 text-green-800" });
      if (selectedCotacao?.id === cotacao.id) {
        setSelectedCotacao(null);
      }
      loadData();
    } catch (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const handleImportComplete = async (fornecedorId, respostasImportadas, descontoGlobal) => {
    // 1. Atualizar lista de fornecedores (caso tenha sido criado um novo)
    const fornecedoresAtualizados = await base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] });
    setFornecedores(fornecedoresAtualizados);

    // 2. Mesclar respostas
    // Primeiro, pegamos as respostas existentes que NÃO são deste fornecedor
    const outrasRespostas = selectedCotacao.respostas?.filter(r => r.fornecedor_id !== fornecedorId) || [];
    
    // Agora pegamos as respostas existentes DESTE fornecedor para manter marcas/obs se não forem sobrescritas (embora a importação traga tudo)
    // Na verdade, a importação deve prevalecer. Vamos combinar:
    // Se o item não veio na importação, mantemos o antigo? Não, geralmente PDF é o estado atual.
    // Mas vamos manter itens que o PDF não mencionou por segurança?
    // O Importador retorna apenas os itens que foram "match".
    
    const respostasAntigasDesteFornecedor = selectedCotacao.respostas?.filter(r => r.fornecedor_id === fornecedorId) || [];
    
    // Mesclagem inteligente:
    const novasRespostasDesteFornecedor = [...respostasImportadas];
    
    // Se quiser manter itens que o PDF ignorou, descomente abaixo. Mas melhor confiar na importação.
    // respostasAntigasDesteFornecedor.forEach(old => {
    //    if (!novasRespostasDesteFornecedor.find(n => n.produto_id === old.produto_id)) {
    //        novasRespostasDesteFornecedor.push(old);
    //    }
    // });

    const todasRespostas = [...outrasRespostas, ...novasRespostasDesteFornecedor];

    // Atualizar a Cotação
    await base44.entities.Cotacao.update(selectedCotacao.id, { 
        respostas: todasRespostas, 
        status: 'Em Análise',
        // Se quisermos adicionar o fornecedor à lista de convidados da cotação se ele não estiver lá:
        fornecedores: [
            ...(selectedCotacao.fornecedores?.filter(f => f.fornecedor_id !== fornecedorId) || []),
            {
                fornecedor_id: fornecedorId,
                fornecedor_nome: fornecedoresAtualizados.find(f => f.id === fornecedorId)?.nome || 'Novo',
                email: '',
                status_envio: 'Respondido'
            }
        ]
    });

    // Atualizar inputs locais e recarregar
    const inputs = { ...precosInput };
    novasRespostasDesteFornecedor.forEach(r => {
        inputs[`${r.fornecedor_id}_${r.produto_id}`] = r.preco_unitario;
    });
    setPrecosInput(inputs);
    
    loadData();
    const updated = await base44.entities.Cotacao.get(selectedCotacao.id);
    setSelectedCotacao(updated);

    if (descontoGlobal > 0) {
        toast({ title: "Desconto Global Aplicado", description: `O desconto de R$ ${descontoGlobal} foi rateado nos preços unitários.`, duration: 5000 });
    }
  };

  const handleSaveRespostas = async () => {
    if (!selectedCotacao) return;

    const novasRespostas = [];
    selectedCotacao.fornecedores.forEach(f => {
      selectedCotacao.itens.forEach(item => {
        const key = `${f.fornecedor_id}_${item.produto_id}`;
        const preco = parseFloat(precosInput[key]);
        if (!isNaN(preco) && preco > 0) {
          const respExistente = selectedCotacao.respostas?.find(r => r.fornecedor_id === f.fornecedor_id && r.produto_id === item.produto_id);
          novasRespostas.push({
            fornecedor_id: f.fornecedor_id,
            produto_id: item.produto_id,
            preco_unitario: preco,
            marca: respExistente?.marca || '',
            observacao: respExistente?.observacao || '',
            vencedor: respExistente?.vencedor || false
          });
        }
      });
    });

    await base44.entities.Cotacao.update(selectedCotacao.id, { respostas: novasRespostas, status: 'Em Análise' });
    toast({ title: "Preços atualizados", className: "bg-green-100 text-green-800" });
    loadData();
  };

  const toggleVencedor = async (cotacao, resposta) => {
    const novasRespostas = cotacao.respostas.map(r => {
      if (r.produto_id === resposta.produto_id) {
        if (r.fornecedor_id === resposta.fornecedor_id) {
          return { ...r, vencedor: !r.vencedor };
        } else {
          return { ...r, vencedor: false };
        }
      }
      return r;
    });
    
    await base44.entities.Cotacao.update(cotacao.id, { respostas: novasRespostas });
    loadData();
    const updated = await base44.entities.Cotacao.get(cotacao.id);
    setSelectedCotacao(updated);
  };

  const handleImportFotoComplete = async (novosItens) => {
    try {
        if (targetCotacaoImportacaoLista?.id) {
            const itensMesclados = mergeCotacaoItemsByProduct(targetCotacaoImportacaoLista.itens || [], novosItens || []);
            await base44.entities.Cotacao.update(targetCotacaoImportacaoLista.id, { itens: itensMesclados });
            toast({
                title: "Itens importados",
                description: `${novosItens.length} itens processados e mesclados na cotação.`,
                className: "bg-green-100 text-green-800"
            });
            await loadData();
            const updated = await base44.entities.Cotacao.get(targetCotacaoImportacaoLista.id);
            handleOpenAnaliseCotacao(updated);
            return;
        }

        const allCots = await base44.entities.Cotacao.list();
        let nextNumber = (allCots.length > 0 ? Math.max(...allCots.map(c => parseInt(c.numero?.split('-')[1] || 0))) : 0) + 1;

        const novaCotacao = {
            numero: `COT-${String(nextNumber++).padStart(5, '0')}`,
            titulo: `Cotação via Foto - ${new Date().toLocaleDateString()}`,
            status: 'Rascunho',
            data_abertura: dataHoje(),
            itens: novosItens,
            fornecedores: [], // Inicialmente sem fornecedores
            respostas: []
        };

        await base44.entities.Cotacao.create(novaCotacao);
        
        toast({
            title: "Cotação Criada!",
            description: `${novosItens.length} itens importados da foto com sucesso.`,
            className: "bg-green-100 text-green-800"
        });
        
        loadData();
    } catch (error) {
        console.error(error);
        toast({ title: "Erro ao criar cotação", description: error.message, variant: "destructive" });
    } finally {
        setTargetCotacaoImportacaoLista(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-border/40">
        <div>
          <h3 className="text-lg font-light text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            Cotações
          </h3>
          <p className="text-sm text-muted-foreground font-light">
            Análise de preços e concorrência
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
            <Button 
                variant="outline"
                className="border-dashed border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100"
                onClick={handleOpenImportadorListaGlobal}
            >
                <Camera className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Importar Foto</span>
            </Button>
            <Dialog open={isNovaCotacaoOpen} onOpenChange={setIsNovaCotacaoOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm font-normal">
                        <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Nova Cotação</span>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Cotação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Título da Cotação</Label>
                            <Input 
                                value={novaCotacaoTitulo} 
                                onChange={(e) => setNovaCotacaoTitulo(e.target.value)}
                                placeholder="Ex: Compra de Cimento Mensal"
                            />
                        </div>
                        <Button onClick={async () => {
                            if (!novaCotacaoTitulo) return;
                            try {
                                const allCots = await base44.entities.Cotacao.list();
                                let nextNumber = (allCots.length > 0 ? Math.max(...allCots.map(c => parseInt(c.numero?.split('-')[1] || 0))) : 0) + 1;

                                const nova = await base44.entities.Cotacao.create({
                                    numero: `COT-${String(nextNumber).padStart(5, '0')}`,
                                    titulo: novaCotacaoTitulo,
                                    status: 'Rascunho',
                                    data_abertura: dataHoje(),
                                    itens: [],
                                    fornecedores: [],
                                    respostas: []
                                });
                                
                                toast({ title: "Cotação criada", className: "bg-green-100 text-green-800" });
                                setIsNovaCotacaoOpen(false);
                                setNovaCotacaoTitulo('');
                                loadData();
                                
                                // Abrir para edição imediatamente
                                setTimeout(() => {
                                    handleOpenAnaliseCotacao(nova);
                                }, 500);
                            } catch (e) {
                                toast({ title: "Erro", description: e.message, variant: "destructive" });
                            }
                        }} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                            Criar Cotação
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="grid gap-3">
        {cotacoes.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border/40">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground dark:text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma cotação encontrada</p>
          </div>
        ) : (
          <>
            <P38MobileLineList className="desktop-layout:hidden">
              {cotacoes.map((cotacao, index) => (
                <P38MobileLine
                  key={cotacao.id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(cotacaoAccent(cotacao.status))}
                  onClick={() => handleOpenAnaliseCotacao(cotacao)}
                  title={cotacao.titulo}
                  subtitle={cotacao.numero}
                  meta={
                    <>
                      <P38StatusLabel tone={p38StatusTone(cotacao.status)}>{cotacao.status}</P38StatusLabel>
                      <span>{cotacao.fornecedores?.length || 0} forn.</span>
                    </>
                  }
                  value={`${cotacao.itens?.length || 0} prod.`}
                  valueSub={
                    cotacao.data_abertura
                      ? format(new Date(cotacao.data_abertura), 'dd/MM/yyyy')
                      : '—'
                  }
                />
              ))}
            </P38MobileLineList>
            <div className="hidden desktop-layout:grid gap-3">
          {cotacoes.map(cotacao => (
            <div key={cotacao.id} className="bg-card rounded-xl border border-border/40 p-4 transition-all hover:border-teal-200">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground dark:text-foreground">{cotacao.titulo}</h4>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground mt-0.5">{cotacao.numero}</span>
                  </div>
                  <Badge className={`border-0 font-normal px-2 py-0.5 text-[10px] ${
                      cotacao.status === 'Finalizada' ? 'bg-emerald-50 text-emerald-700' : 
                      cotacao.status === 'Em Análise' ? 'bg-blue-50 text-blue-700' : 
                      'bg-muted text-muted-foreground'
                  }`}>{cotacao.status}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 border-t border-border/30 dark:border-border/40">
                  <div className="text-center sm:text-left">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Produtos</p>
                      <p className="text-sm text-foreground/90">{cotacao.itens?.length || 0}</p>
                  </div>
                  <div className="text-center sm:text-left">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Fornecedores</p>
                      <p className="text-sm text-foreground/90">{cotacao.fornecedores?.length || 0}</p>
                  </div>
                  <div className="text-center sm:text-left">
                      <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Data</p>
                      <p className="text-sm text-foreground/90">
                           {cotacao.data_abertura ? format(new Date(cotacao.data_abertura), 'dd/MM/yyyy') : '-'}
                      </p>
                  </div>
              </div>

              <div className="pt-2 border-t border-border/30 dark:border-border/40">
                  <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full border-border/40 text-muted-foreground hover:text-teal-600 hover:bg-teal-50 h-9 text-sm font-normal" onClick={() => handleOpenAnaliseCotacao(cotacao)}>
                                <Trophy className="w-4 h-4 mr-2" />
                                {cotacao.status === 'Rascunho' ? 'Montar Lista' : 'Analisar & Preços'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[96vw] max-w-[96vw] sm:!max-w-[95vw] sm:!w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                            <DialogHeader>
                                <DialogTitle className="text-lg sm:text-xl font-light">
                                  {selectedCotacao?.status === 'Rascunho' ? `Montagem da Cotação: ${cotacao.titulo}` : `Análise de Cotação: ${cotacao.titulo}`}
                                </DialogTitle>
                            </DialogHeader>
                            
                            {selectedCotacao?.status === 'Rascunho' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 bg-muted/40 p-3 rounded-lg border border-border/40">
                                <div className="space-y-2">
                                    <Label className="text-xs">Selecionar Produto</Label>
                                    <div className="relative">
                                      <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                                      <Input
                                        value={manualSearch}
                                        onChange={(e) => setManualSearch(e.target.value)}
                                        placeholder="Buscar por nome, código, barras ou marca..."
                                        className="h-9 text-sm bg-card pl-8"
                                      />
                                    </div>
                                    <div className="max-h-72 overflow-y-auto rounded-md border bg-card">
                                      {filteredManualProducts.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3">Digite para buscar produtos.</p>
                                      ) : (
                                        filteredManualProducts.map((produto) => (
                                          <button
                                            key={produto.id}
                                            type="button"
                                            className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/40"
                                            onClick={() => handleAddManualProduct(produto)}
                                          >
                                            <p className="text-sm text-foreground">{produto.nome}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                              {(produto.codigo_interno || produto.codigo_barras || 'Sem código')} • {produto.unidade_principal || 'UN'}
                                            </p>
                                          </button>
                                        ))
                                      )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs">Carrinho da Cotação</Label>
                                    <span className="text-xs text-muted-foreground">{manualCart.length} itens</span>
                                  </div>
                                  <div className="max-h-72 overflow-y-auto rounded-md border bg-card">
                                    {manualCart.length === 0 ? (
                                      <p className="text-xs text-muted-foreground p-3">Nenhum item adicionado.</p>
                                    ) : (
                                      manualCart.map((item) => (
                                        <div key={item.produto_id} className="px-3 py-2 border-b last:border-b-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm text-foreground">{item.produto_nome}</p>
                                            <button type="button" onClick={() => handleRemoveManualItem(item.produto_id)} className="text-red-500 hover:text-red-700">
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2 mt-2">
                                            <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleManualQtyChange(item.produto_id, Math.max(0, (parseFloat(item.quantidade) || 0) - 1))}>
                                              <Minus className="w-3 h-3" />
                                            </Button>
                                            <Input
                                              value={item.quantidade}
                                              type="number"
                                              className="h-7 text-xs w-20"
                                              onChange={(e) => handleManualQtyChange(item.produto_id, e.target.value)}
                                            />
                                            <span className="text-xs text-muted-foreground">{item.unidade || 'UN'}</span>
                                            <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => handleManualQtyChange(item.produto_id, (parseFloat(item.quantidade) || 0) + 1)}>
                                              <Plus className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  <Button size="sm" className="h-8 bg-blue-600 text-white w-full" onClick={handleSaveManualItems}>
                                    <Plus className="w-4 h-4 mr-1" /> Salvar Itens no Carrinho
                                  </Button>
                                </div>
                            </div>
                            )}

                            {selectedCotacao?.status !== 'Rascunho' ? (
                            <div className="border rounded-lg overflow-x-auto mt-4 min-w-0">
                              <Table>
                                  <TableHeader className="bg-muted/40">
                                      <TableRow>
                                          <TableHead className="w-[300px]">Produto</TableHead>
                                          {cotacao.fornecedores?.map(f => (
                                              <TableHead key={f.fornecedor_id} className="text-center min-w-[120px]">
                                                  {f.fornecedor_nome}
                                              </TableHead>
                                          ))}
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {cotacao.itens?.map(item => (
                                          <TableRow key={item.produto_id}>
                                              <TableCell>
                                                  <div className="font-medium">{item.produto_nome}</div>
                                                  <div className="text-xs text-muted-foreground">{item.quantidade} {item.unidade}</div>
                                              </TableCell>
                                              {cotacao.fornecedores?.map(f => {
                                                  const resposta = cotacao.respostas?.find(r => r.fornecedor_id === f.fornecedor_id && r.produto_id === item.produto_id);
                                                  const isVencedor = resposta?.vencedor;
                                                  const menorPreco = cotacao.respostas
                                                      ?.filter(r => r.produto_id === item.produto_id && r.preco_unitario > 0)
                                                      .sort((a,b) => a.preco_unitario - b.preco_unitario)[0]?.preco_unitario;
                                                  const isMenor = resposta?.preco_unitario > 0 && resposta?.preco_unitario === menorPreco;
                                                  const qtdDiferente = resposta?.quantidade_ofertada && resposta?.quantidade_ofertada !== item.quantidade;

                                                  return (
                                                      <TableCell key={f.fornecedor_id} className="text-center p-2">
                                                          <div className={`p-2 rounded border transition-colors ${isVencedor ? 'bg-green-50 border-green-200' : 'border-transparent hover:bg-muted/40'}`}>
                                                              <Input 
                                                                  type="number" 
                                                                  className={`h-8 text-center bg-transparent border-border/40 ${isMenor && !isVencedor ? 'text-green-600 font-bold' : ''}`}
                                                                  placeholder="R$ 0,00"
                                                                  value={precosInput[`${f.fornecedor_id}_${item.produto_id}`] || ''}
                                                                  onChange={(e) => handleUpdatePreco(f.fornecedor_id, item.produto_id, e.target.value)}
                                                              />
                                                              {qtdDiferente && (
                                                                <div className="text-[10px] text-amber-600 mt-1 font-medium flex items-center justify-center gap-1" title="Quantidade ofertada diferente da solicitada">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Qtd: {resposta.quantidade_ofertada}
                                                                </div>
                                                              )}
                                                              {precosInput[`${f.fornecedor_id}_${item.produto_id}`] > 0 && (
                                                                  <Button 
                                                                      variant="ghost" 
                                                                      size="sm" 
                                                                      className={`mt-1 h-6 w-full text-[10px] ${isVencedor ? 'bg-green-200 text-green-800' : 'text-muted-foreground hover:text-green-600'}`}
                                                                      onClick={() => toggleVencedor(cotacao, {fornecedor_id: f.fornecedor_id, produto_id: item.produto_id})}
                                                                  >
                                                                      {isVencedor ? 'Vencedor' : 'Marcar Vencedor'}
                                                                  </Button>
                                                              )}
                                                          </div>
                                                      </TableCell>
                                                  );
                                              })}
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                            </div>
                            ) : (
                              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-800">
                                A cotação está em montagem. Salve os itens e abra a competição para coletar respostas de fornecedores.
                              </div>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mt-6 pt-4 border-t border-border/40">
                                {selectedCotacao?.status === 'Rascunho' ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      className="text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                                      onClick={handleOpenImportadorListaEmCotacao}
                                    >
                                      <Camera className="w-4 h-4 mr-2" />
                                      Importar Lista (Foto/PDF)
                                    </Button>
                                    <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleAbrirCompeticao}>
                                      Abrir Competição
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button 
                                        variant="ghost" 
                                        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                        onClick={() => setIsImportadorOpen(true)}
                                    >
                                        <UploadCloud className="w-4 h-4 mr-2" />
                                        Importar Resposta (PDF)
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => handleSaveRespostas()}>Salvar Preços</Button>
                                    </div>
                                  </>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>



                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-normal text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteCotacao(cotacao)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </Button>
                      {cotacao.status !== 'Finalizada' && (
                          <Button 
                              size="sm" 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-normal"
                              onClick={() => handleCreatePedido(cotacao)}
                          >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Gerar Pedidos
                          </Button>
                      )}
                    </div>
                </div>
              </div>
            </div>
          ))}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={isAnaliseDialogOpen && !!selectedCotacao}
        onOpenChange={(open) => {
          setIsAnaliseDialogOpen(open);
          if (!open) setSelectedCotacao(null);
        }}
      >
        {selectedCotacao && (
          <DialogContent className="w-[96vw] max-w-[96vw] sm:!max-w-[95vw] sm:!w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-light">
                {selectedCotacao.status === 'Rascunho'
                  ? `Montagem da Cotação: ${selectedCotacao.titulo}`
                  : `Análise de Cotação: ${selectedCotacao.titulo}`}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedCotacao.itens?.length || 0} produtos · {selectedCotacao.fornecedores?.length || 0} fornecedores
            </p>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-2"
              onClick={() => setIsAnaliseDialogOpen(false)}
            >
              <Trophy className="w-4 h-4 mr-2 inline" />
              {selectedCotacao.status === 'Rascunho' ? 'Montar lista' : 'Analisar preços'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Use um ecrã maior para edição completa de fornecedores e preços, ou rode em modo paisagem.
            </p>
          </DialogContent>
        )}
      </Dialog>

      {selectedCotacao && (
        <ImportadorCotacaoPDF 
            isOpen={isImportadorOpen}
            onClose={() => setIsImportadorOpen(false)}
            cotacao={selectedCotacao}
            onImportComplete={handleImportComplete}
        />
      )}

      <ImportadorListaFoto 
        isOpen={isImportadorFotoOpen}
        mode={targetCotacaoImportacaoLista ? 'merge' : 'create'}
        onClose={() => {
          setIsImportadorFotoOpen(false);
          setTargetCotacaoImportacaoLista(null);
        }}
        onImportComplete={handleImportFotoComplete}
      />
    </div>
  );
}