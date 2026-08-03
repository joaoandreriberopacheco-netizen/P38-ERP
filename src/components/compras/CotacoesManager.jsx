import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/components/utils';
import { dataHoje } from '@/components/utils/dateUtils';
import { pickDefaultPurchaseUnit } from '@/lib/productUnits';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import ImportadorCotacaoPDF from './ImportadorCotacaoPDF';
import ImportadorListaFoto from './ImportadorListaFoto';
import CotacaoExpressHub from './cotacao-express/CotacaoExpressHub';
import CotacaoExpressMontagem from './cotacao-express/CotacaoExpressMontagem';
import CotacaoExpressDisputa from './cotacao-express/CotacaoExpressDisputa';
import CotacaoExpressAprovar from './cotacao-express/CotacaoExpressAprovar';
import {
  buildResumoAprovacao,
  cotacaoItemToSelectorItem,
  COTACAO_STATUS_ANALISE,
  COTACAO_STATUS_FINALIZADA,
  COTACAO_STATUS_RASCUNHO,
  gerarProximoNumeroCotacao,
  gerarProximoNumeroPedido,
  mergeCotacaoItemsByProduct,
  selectorItemToCotacaoItem,
  sincronizarRegistrosDisputa,
} from '@/lib/cotacaoExpressUtils';

export default function CotacoesManager() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState('hub');
  const [hubView, setHubView] = useState('abertas');
  const [cotacoes, setCotacoes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCotacao, setSelectedCotacao] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [selectorItems, setSelectorItems] = useState([]);
  const [precosInput, setPrecosInput] = useState({});
  const [registrosDisputa, setRegistrosDisputa] = useState([]);
  const [pedidosGerados, setPedidosGerados] = useState([]);

  const [isImportadorOpen, setIsImportadorOpen] = useState(false);
  const [isImportadorFotoOpen, setIsImportadorFotoOpen] = useState(false);
  const [targetCotacaoImportacaoLista, setTargetCotacaoImportacaoLista] = useState(null);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [abrindoDisputa, setAbrindoDisputa] = useState(false);
  const [gerandoPedidos, setGerandoPedidos] = useState(false);

  const produtosMap = useMemo(
    () => Object.fromEntries(produtosCatalogo.map((p) => [p.id, p])),
    [produtosCatalogo],
  );
  const fornecedoresMap = useMemo(
    () => Object.fromEntries(fornecedores.map((f) => [f.id, f])),
    [fornecedores],
  );

  const resumoAprovacao = useMemo(() => {
    if (!selectedCotacao) return null;
    return buildResumoAprovacao(selectedCotacao, fornecedoresMap, produtosMap);
  }, [selectedCotacao, fornecedoresMap, produtosMap]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cotacoesData, fornecedoresData, produtosData] = await Promise.all([
        base44.entities.Cotacao.list('-created_date'),
        base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] }),
        base44.entities.Produto.filter({ tipo: 'Produto', ativo: true }),
      ]);
      setCotacoes(cotacoesData);
      setFornecedores(fornecedoresData);
      setProdutosCatalogo(produtosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshCotacao = async (cotacaoId) => {
    const updated = await base44.entities.Cotacao.get(cotacaoId);
    setSelectedCotacao(updated);
    setRegistrosDisputa(sincronizarRegistrosDisputa(updated, produtosMap));
    const inputs = {};
    updated.respostas?.forEach((r) => {
      inputs[`${r.fornecedor_id}_${r.produto_id}`] = r.preco_unitario;
    });
    setPrecosInput(inputs);
    setSelectorItems(
      (updated.itens || []).map((item) => cotacaoItemToSelectorItem(item, produtosMap[item.produto_id])),
    );
    return updated;
  };

  const syncSelectorFromCotacao = (cotacao) => {
    setSelectorItems(
      (cotacao?.itens || []).map((item) => cotacaoItemToSelectorItem(item, produtosMap[item.produto_id])),
    );
  };

  const handleAbrirCotacao = (cotacao) => {
    setSelectedCotacao(cotacao);
    setPedidosGerados([]);
    const inputs = {};
    cotacao.respostas?.forEach((r) => {
      inputs[`${r.fornecedor_id}_${r.produto_id}`] = r.preco_unitario;
    });
    setPrecosInput(inputs);
    setRegistrosDisputa(sincronizarRegistrosDisputa(cotacao, produtosMap));
    syncSelectorFromCotacao(cotacao);

    if (cotacao.status === COTACAO_STATUS_RASCUNHO) {
      setView('montagem');
    } else if (cotacao.status === COTACAO_STATUS_ANALISE) {
      setView('disputa');
    } else {
      setHubView('concluidas');
      setView('hub');
    }
  };

  const handleNovaCotacao = async () => {
    const titulo = window.prompt('Título da cotação:', `Cotação ${new Date().toLocaleDateString('pt-BR')}`);
    if (!titulo?.trim()) return;

    setCriando(true);
    try {
      const numero = await gerarProximoNumeroCotacao(base44);
      const nova = await base44.entities.Cotacao.create({
        numero,
        titulo: titulo.trim(),
        status: COTACAO_STATUS_RASCUNHO,
        data_abertura: dataHoje(),
        itens: [],
        fornecedores: [],
        respostas: [],
        registros_disputa: [],
      });
      await loadData();
      handleAbrirCotacao(nova);
      toast({ title: 'Cotação criada', className: 'bg-green-100 text-green-800' });
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setCriando(false);
    }
  };

  const handleDeleteCotacao = async (cotacao) => {
    const ok = window.confirm(`Excluir a cotação "${cotacao.titulo}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      await base44.entities.Cotacao.delete(cotacao.id);
      if (selectedCotacao?.id === cotacao.id) {
        setSelectedCotacao(null);
        setView('hub');
      }
      toast({ title: 'Cotação excluída', className: 'bg-green-100 text-green-800' });
      loadData();
    } catch (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    }
  };

  const handleSalvarItens = async () => {
    if (!selectedCotacao) return;
    setSalvando(true);
    try {
      const itensValidos = selectorItems
        .map(selectorItemToCotacaoItem)
        .filter((item) => (parseFloat(item.quantidade) || 0) > 0);

      if (itensValidos.length === 0) {
        toast({ title: 'Sem itens válidos', description: 'Adicione pelo menos um item.', variant: 'destructive' });
        return;
      }

      await base44.entities.Cotacao.update(selectedCotacao.id, { itens: itensValidos });
      toast({ title: 'Itens salvos', className: 'bg-green-100 text-green-800' });
      await loadData();
      await refreshCotacao(selectedCotacao.id);
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirDisputa = async () => {
    if (!selectedCotacao) return;
    if (selectorItems.length === 0) {
      toast({ title: 'Sem itens', description: 'Adicione itens antes de abrir a disputa.', variant: 'destructive' });
      return;
    }

    setAbrindoDisputa(true);
    try {
      const itensValidos = selectorItems
        .map(selectorItemToCotacaoItem)
        .filter((item) => (parseFloat(item.quantidade) || 0) > 0);

      await base44.entities.Cotacao.update(selectedCotacao.id, {
        itens: itensValidos,
        status: COTACAO_STATUS_ANALISE,
      });
      toast({
        title: 'Disputa aberta',
        description: 'Importe propostas (OCR) ou adicione fornecedores manualmente.',
        className: 'bg-blue-100 text-blue-800',
      });
      await loadData();
      await refreshCotacao(selectedCotacao.id);
      setView('disputa');
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setAbrindoDisputa(false);
    }
  };

  const handleAddItem = (product = null) => {
    if (!product) return;
    const pu = pickDefaultPurchaseUnit(product);
    const fator = pu?.fator_conversao ?? 1;
    const unidade = pu?.unidade || product.unidade_principal || 'UN';
    setSelectorItems((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantidade: (parseFloat(next[idx].quantidade) || 0) + 1,
          quantidade_base: ((parseFloat(next[idx].quantidade) || 0) + 1) * fator,
        };
        return next;
      }
      return [
        ...prev,
        {
          produto_id: product.id,
          produto_nome: product.nome,
          quantidade: 1,
          unidade_medida: unidade,
          fator_conversao: fator,
          quantidade_base: fator,
          custo_unitario: parseFloat(product.valor_compra) || 0,
          valor_desconto_item: 0,
          desconto_pct_item: 0,
          total: 0,
        },
      ];
    });
  };

  const handleUpdateItem = (index, field, value) => {
    setSelectorItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (typeof field === 'object' && field !== null) {
        Object.assign(item, field);
      } else {
        item[field] = value;
      }
      const fator = parseFloat(item.fator_conversao) || 1;
      const qty = parseFloat(item.quantidade) || 0;
      item.quantidade_base = roundToTwoDecimals(qty * fator);
      next[index] = item;
      return next;
    });
  };

  const handleRemoveItem = (index) => {
    setSelectorItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePreco = (fornecedorId, produtoId, valor) => {
    setPrecosInput((prev) => ({
      ...prev,
      [`${fornecedorId}_${produtoId}`]: valor,
    }));
  };

  const handleSalvarPrecos = async () => {
    if (!selectedCotacao) return;
    setSalvando(true);
    try {
      const novasRespostas = [];
      const fornecedoresCotacao = selectedCotacao.fornecedores || [];

      fornecedoresCotacao.forEach((f) => {
        (selectedCotacao.itens || []).forEach((item) => {
          const key = `${f.fornecedor_id}_${item.produto_id}`;
          const preco = parseFloat(precosInput[key]);
          if (!isNaN(preco) && preco > 0) {
            const respExistente = selectedCotacao.respostas?.find(
              (r) => r.fornecedor_id === f.fornecedor_id && r.produto_id === item.produto_id,
            );
            novasRespostas.push({
              fornecedor_id: f.fornecedor_id,
              produto_id: item.produto_id,
              preco_unitario: preco,
              marca: respExistente?.marca || '',
              observacao: respExistente?.observacao || '',
              quantidade_ofertada: respExistente?.quantidade_ofertada,
              vencedor: respExistente?.vencedor || false,
            });
          }
        });
      });

      const outrasRespostas = (selectedCotacao.respostas || []).filter((r) => {
        const key = `${r.fornecedor_id}_${r.produto_id}`;
        const preco = parseFloat(precosInput[key]);
        return isNaN(preco) || preco <= 0;
      });

      const todasRespostas = [...outrasRespostas, ...novasRespostas];
      const registros = sincronizarRegistrosDisputa(
        { ...selectedCotacao, respostas: todasRespostas },
        produtosMap,
      );

      await base44.entities.Cotacao.update(selectedCotacao.id, {
        respostas: todasRespostas,
        registros_disputa: registros,
        status: COTACAO_STATUS_ANALISE,
      });

      setRegistrosDisputa(registros);
      toast({ title: 'Preços atualizados', className: 'bg-green-100 text-green-800' });
      await loadData();
      await refreshCotacao(selectedCotacao.id);
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleVencedor = async (respostaRef) => {
    if (!selectedCotacao) return;
    const novasRespostas = (selectedCotacao.respostas || []).map((r) => {
      if (r.produto_id === respostaRef.produto_id) {
        if (r.fornecedor_id === respostaRef.fornecedor_id) {
          return { ...r, vencedor: !r.vencedor };
        }
        return { ...r, vencedor: false };
      }
      return r;
    });

    if (!novasRespostas.find((r) => r.fornecedor_id === respostaRef.fornecedor_id && r.produto_id === respostaRef.produto_id)) {
      const preco = parseFloat(precosInput[`${respostaRef.fornecedor_id}_${respostaRef.produto_id}`]) || 0;
      novasRespostas.push({
        fornecedor_id: respostaRef.fornecedor_id,
        produto_id: respostaRef.produto_id,
        preco_unitario: preco,
        vencedor: true,
        marca: '',
        observacao: '',
      });
      novasRespostas.forEach((r) => {
        if (r.produto_id === respostaRef.produto_id && r.fornecedor_id !== respostaRef.fornecedor_id) {
          r.vencedor = false;
        }
      });
    }

    await base44.entities.Cotacao.update(selectedCotacao.id, { respostas: novasRespostas });
    await loadData();
    await refreshCotacao(selectedCotacao.id);
  };

  const handleAdicionarFornecedor = async (fornecedor) => {
    if (!selectedCotacao) return;
    const jaExiste = selectedCotacao.fornecedores?.some((f) => f.fornecedor_id === fornecedor.id);
    if (jaExiste) return;

    const novosFornecedores = [
      ...(selectedCotacao.fornecedores || []),
      {
        fornecedor_id: fornecedor.id,
        fornecedor_nome: fornecedor.nome,
        email: fornecedor.email || '',
        status_envio: 'Pendente',
      },
    ];

    await base44.entities.Cotacao.update(selectedCotacao.id, { fornecedores: novosFornecedores });
    toast({ title: 'Fornecedor adicionado', className: 'bg-green-100 text-green-800' });
    await loadData();
    await refreshCotacao(selectedCotacao.id);
  };

  const handleAdicionarRegistro = async (registro) => {
    if (!selectedCotacao) return;
    const manuais = [
      { ...registro, id: registro.id || `manual-${Date.now()}` },
      ...(selectedCotacao.registros_disputa || []).filter((r) => !r.automatico),
    ];
    const auto = sincronizarRegistrosDisputa(selectedCotacao, produtosMap).filter((r) => r.automatico);
    const merged = [...manuais, ...auto];
    await base44.entities.Cotacao.update(selectedCotacao.id, { registros_disputa: merged });
    setRegistrosDisputa(merged);
    toast({ title: 'Registro salvo' });
    await refreshCotacao(selectedCotacao.id);
  };

  const handleConfirmarGeracao = async () => {
    if (!selectedCotacao) return;
    const itensVencedores = (selectedCotacao.respostas || []).filter((r) => r.vencedor);

    if (itensVencedores.length === 0) {
      toast({ title: 'Nenhum vencedor', description: 'Selecione os itens vencedores.', variant: 'destructive' });
      return;
    }

    setGerandoPedidos(true);
    try {
      const itensPorFornecedor = {};
      itensVencedores.forEach((resp) => {
        if (!itensPorFornecedor[resp.fornecedor_id]) {
          itensPorFornecedor[resp.fornecedor_id] = [];
        }
        const itemOriginal = selectedCotacao.itens.find((i) => i.produto_id === resp.produto_id);
        if (itemOriginal) {
          const qty = parseFloat(resp.quantidade_ofertada) || parseFloat(itemOriginal.quantidade) || 0;
          const preco = parseFloat(resp.preco_unitario) || 0;
          itensPorFornecedor[resp.fornecedor_id].push({
            produto_id: resp.produto_id,
            produto_nome: itemOriginal.produto_nome,
            quantidade: qty,
            custo_unitario: preco,
            total: qty * preco,
          });
        }
      });

      let nextNumber = await gerarProximoNumeroPedido(base44);
      const criados = [];

      for (const fornecedorId of Object.keys(itensPorFornecedor)) {
        const itens = itensPorFornecedor[fornecedorId];
        const fornecedor = fornecedoresMap[fornecedorId];
        const total = itens.reduce((sum, i) => sum + i.total, 0);

        const po = await base44.entities.PedidoCompra.create({
          numero: `PC-${String(nextNumber++).padStart(5, '0')}`,
          fornecedor_id: fornecedorId,
          fornecedor_nome: fornecedor?.nome || 'Desconhecido',
          status: 'Rascunho',
          itens,
          valor_total: total,
          observacoes: `Gerado a partir da Cotação ${selectedCotacao.numero}`,
        });
        criados.push(po);
      }

      await base44.entities.Cotacao.update(selectedCotacao.id, { status: COTACAO_STATUS_FINALIZADA });
      setPedidosGerados(criados);
      toast({
        title: 'Pedidos gerados',
        description: `${criados.length} pedido(s) criado(s) em rascunho.`,
        className: 'bg-green-100 text-green-800',
      });
      await loadData();
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setGerandoPedidos(false);
    }
  };

  const handleImportComplete = async (fornecedorId, respostasImportadas, descontoGlobal) => {
    const fornecedoresAtualizados = await base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] });
    setFornecedores(fornecedoresAtualizados);

    const outrasRespostas = selectedCotacao.respostas?.filter((r) => r.fornecedor_id !== fornecedorId) || [];
    const novasRespostasDesteFornecedor = [...respostasImportadas];
    const todasRespostas = [...outrasRespostas, ...novasRespostasDesteFornecedor];

    const fornecedorNome = fornecedoresAtualizados.find((f) => f.id === fornecedorId)?.nome || 'Novo';
    const cotacaoAtualizada = {
      ...selectedCotacao,
      respostas: todasRespostas,
      fornecedores: [
        ...(selectedCotacao.fornecedores?.filter((f) => f.fornecedor_id !== fornecedorId) || []),
        {
          fornecedor_id: fornecedorId,
          fornecedor_nome: fornecedorNome,
          email: '',
          status_envio: 'Respondido',
        },
      ],
    };

    const registros = sincronizarRegistrosDisputa(cotacaoAtualizada, produtosMap);

    await base44.entities.Cotacao.update(selectedCotacao.id, {
      respostas: todasRespostas,
      status: COTACAO_STATUS_ANALISE,
      fornecedores: cotacaoAtualizada.fornecedores,
      registros_disputa: registros,
    });

    const inputs = { ...precosInput };
    novasRespostasDesteFornecedor.forEach((r) => {
      inputs[`${r.fornecedor_id}_${r.produto_id}`] = r.preco_unitario;
    });
    setPrecosInput(inputs);
    setRegistrosDisputa(registros);

    await loadData();
    await refreshCotacao(selectedCotacao.id);

    if (descontoGlobal > 0) {
      toast({
        title: 'Desconto global aplicado',
        description: `R$ ${descontoGlobal} rateado nos preços unitários.`,
        duration: 5000,
      });
    }
  };

  const handleImportFotoComplete = async (novosItens) => {
    try {
      if (targetCotacaoImportacaoLista?.id) {
        const itensMesclados = mergeCotacaoItemsByProduct(
          targetCotacaoImportacaoLista.itens || [],
          novosItens || [],
        );
        await base44.entities.Cotacao.update(targetCotacaoImportacaoLista.id, { itens: itensMesclados });
        toast({
          title: 'Itens importados',
          description: `${novosItens.length} itens mesclados na cotação.`,
          className: 'bg-green-100 text-green-800',
        });
        await loadData();
        const updated = await refreshCotacao(targetCotacaoImportacaoLista.id);
        setView(updated.status === COTACAO_STATUS_RASCUNHO ? 'montagem' : 'disputa');
        return;
      }

      const numero = await gerarProximoNumeroCotacao(base44);
      const novaCotacao = {
        numero,
        titulo: `Cotação via OCR - ${new Date().toLocaleDateString('pt-BR')}`,
        status: COTACAO_STATUS_RASCUNHO,
        data_abertura: dataHoje(),
        itens: novosItens,
        fornecedores: [],
        respostas: [],
        registros_disputa: [],
      };

      const criada = await base44.entities.Cotacao.create(novaCotacao);
      toast({
        title: 'Cotação criada',
        description: `${novosItens.length} itens importados.`,
        className: 'bg-green-100 text-green-800',
      });
      await loadData();
      handleAbrirCotacao(criada);
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setTargetCotacaoImportacaoLista(null);
    }
  };

  const handleVoltarHub = () => {
    setSelectedCotacao(null);
    setPedidosGerados([]);
    setView('hub');
    loadData();
  };

  const handleOpenImportadorLista = () => {
    setTargetCotacaoImportacaoLista(selectedCotacao);
    setIsImportadorFotoOpen(true);
  };

  const handleOpenImportadorListaGlobal = () => {
    setTargetCotacaoImportacaoLista(null);
    setIsImportadorFotoOpen(true);
  };

  return (
    <div className="flex h-[calc(100dvh-var(--p38-scroll-pad-below-nav,0px)-8rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm md:h-[calc(100dvh-10rem)]">
      {view === 'hub' && (
        <CotacaoExpressHub
          cotacoes={cotacoes}
          loading={isLoading}
          hubView={hubView}
          onHubViewChange={setHubView}
          onNovaCotacao={handleNovaCotacao}
          onImportarFoto={handleOpenImportadorListaGlobal}
          onAbrirCotacao={handleAbrirCotacao}
          onExcluirCotacao={handleDeleteCotacao}
          criando={criando}
        />
      )}

      {view === 'montagem' && selectedCotacao && (
        <CotacaoExpressMontagem
          cotacao={selectedCotacao}
          selectorItems={selectorItems}
          produtos={produtosCatalogo}
          salvando={salvando}
          abrindoDisputa={abrindoDisputa}
          onVoltar={handleVoltarHub}
          onAddItem={handleAddItem}
          onUpdateItem={handleUpdateItem}
          onRemoveItem={handleRemoveItem}
          onProductCreated={(p) => setProdutosCatalogo((prev) => [...prev, p])}
          onSalvarItens={handleSalvarItens}
          onImportarLista={handleOpenImportadorLista}
          onAbrirDisputa={handleAbrirDisputa}
        />
      )}

      {view === 'disputa' && selectedCotacao && (
        <CotacaoExpressDisputa
          cotacao={selectedCotacao}
          produtosMap={produtosMap}
          fornecedoresDisponiveis={fornecedores}
          precosInput={precosInput}
          registrosDisputa={registrosDisputa}
          salvando={salvando}
          onVoltar={() => {
            if (selectedCotacao.status === COTACAO_STATUS_RASCUNHO) {
              setView('montagem');
            } else {
              handleVoltarHub();
            }
          }}
          onUpdatePreco={handleUpdatePreco}
          onToggleVencedor={handleToggleVencedor}
          onSalvarPrecos={handleSalvarPrecos}
          onImportarResposta={() => setIsImportadorOpen(true)}
          onAdicionarFornecedor={handleAdicionarFornecedor}
          onAdicionarRegistro={handleAdicionarRegistro}
          onIrAprovar={() => setView('aprovar')}
        />
      )}

      {view === 'aprovar' && selectedCotacao && (
        <CotacaoExpressAprovar
          cotacao={selectedCotacao}
          resumo={resumoAprovacao}
          gerando={gerandoPedidos}
          pedidosGerados={pedidosGerados}
          onVoltar={() => (pedidosGerados.length > 0 ? handleVoltarHub() : setView('disputa'))}
          onConfirmarGeracao={handleConfirmarGeracao}
          onVerPedido={() => navigate(createPageUrl('PedidosCompra'))}
        />
      )}

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
