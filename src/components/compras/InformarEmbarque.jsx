import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Package, Calendar, AlertTriangle, CheckCircle2, ChevronDown, Plus, Check, X, Search, Route, ClipboardList, ShipWheel, Loader2, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import FluvialTripSelectorFullscreen from '@/components/compras/FluvialTripSelectorFullscreen';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import { agora, dataHoje, meioDiaSistemaISO, toLocalDateKey, formatarLogTime } from '@/components/utils/dateUtils';
import { logDespachoAudit, InformarDespachoAuditStrip } from '@/components/compras/informarEmbarqueAudit.jsx';
import { calcPercentualValorEmbarcadoPedido } from '@/lib/embarqueValorFinanceiro';
import { formatQuantity, roundToTwoDecimals } from '@/lib/financialUtils';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import { buildItensCanonicosEmbarque } from '@/lib/buildEmbarqueItensCanonicos';
import { getEmbarqueItensLinhas, hydrateEmbarquesFromSql } from '@/lib/fetchEmbarqueItens';
import { resolverItensPedidoCompra } from '@/lib/embarqueLogisticaHelpers';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';
import {
  buildTransportadoraPersistPayload,
  resolveAndMatchTransportadora,
} from '@/lib/resolveTransportadora';
import {
  buildPurchaseUnitOptions,
  calculateBaseQuantity,
  commercialQuantityFromBase,
  formatCommercialQuantity,
  getItemCompraExibicaoVitrine,
  getUnidadeBySiglaCanonical,
  hasAlternativeUnits,
} from '@/lib/productUnits';
import {
  buildItemEmbarquePersistido,
  buildUnidadeLinhaInicial,
  carregarProdutosMap,
  enrichLinhaEmbarque as enrichLinhaDespacho,
  pedidaBaseItem,
  quantidadeApresentacaoEmbarqueItem,
  quantidadeBaseEmbarqueItem,
  resolveFatorLinhaEmbarque as resolveFatorLinhaDespacho,
  resolveUnidadeLinha,
} from '@/lib/embarqueVitrineHelpers';

// ── helpers ───────────────────────────────────────────────────────────────────

function calcularJaEmbarcadoBaseSemEmbarque(pedido, embarqueExistenteId) {
  const map = {};
  const embarques = Array.isArray(pedido?._embarques) ? pedido._embarques : [];
  embarques.forEach((emb) => {
    if (embarqueExistenteId && emb.id === embarqueExistenteId) return;
    getEmbarqueItensLinhas(emb).forEach((item) => {
      const prev = map[item.produto_id] || 0;
      map[item.produto_id] = roundToTwoDecimals(prev + quantidadeBaseEmbarqueItem(item));
    });
  });
  return map;
}

function calcularStatusEmbarque(itens, jaEmbarcadoBase, qtdEmbarque, selectedItems, unidadeLinhaMap, produtosMap) {
  let totalPedidoBase = 0;
  let totalEmbarcadoBase = 0;
  itens.forEach((item) => {
    const pedidaBase = pedidaBaseItem(item);
    const anteriorBase = jaEmbarcadoBase[item.produto_id] || 0;
    const selecionado = selectedItems[item.produto_id] !== false;
    const produto = produtosMap[item.produto_id];
    const linha = resolveUnidadeLinha(item, produto, unidadeLinhaMap, item.produto_id);
    const novaBase = selecionado
      ? calculateBaseQuantity(parseFloat(qtdEmbarque[item.produto_id]) || 0, linha.fator)
      : 0;
    totalPedidoBase = roundToTwoDecimals(totalPedidoBase + pedidaBase);
    totalEmbarcadoBase = roundToTwoDecimals(totalEmbarcadoBase + Math.min(anteriorBase + novaBase, pedidaBase));
  });
  if (totalEmbarcadoBase <= 0) return 'Nenhum';
  if (totalEmbarcadoBase >= totalPedidoBase - 0.01) return 'Total';
  return 'Parcial';
}

function calcularPercentualValorEmbarcado(pedido, embarquesAtualizados) {
  return calcPercentualValorEmbarcadoPedido(pedido, embarquesAtualizados, {});
}

// ── TransportadoraSearch ──────────────────────────────────────────────────────

function TransportadoraSearch({ transportadoras, value, onChange, onCriarNova, displayNome }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ref = useRef(null);

  const selected = transportadoras.find(t => t.id === value);
  const labelExibicao = selected?.nome || (value && displayNome) || null;

  const filtered = useMemo(() => {
    if (!query.trim()) return transportadoras.slice(0, 10);
    const q = query.toLowerCase();
    return transportadoras.filter(t => t.nome.toLowerCase().includes(q)).slice(0, 10);
  }, [query, transportadoras]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSalvarNova = async () => {
    if (!nomeNova.trim()) return;
    setSalvando(true);
    try {
      const nova = await base44.entities.Transportadora.create({ nome: nomeNova.trim().toUpperCase(), ativo: true });
      onCriarNova(nova);
      onChange(nova.id);
      setCriando(false);
      setNomeNova('');
      setOpen(false);
      toast.success('Transportadora cadastrada!');
    } catch {
      toast.error('Erro ao cadastrar transportadora');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="w-full h-12 rounded-xl bg-muted/50 shadow-sm px-4 flex items-center gap-3 text-left"
      >
        <Truck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className={`flex-1 text-sm truncate ${labelExibicao ? 'text-foreground' : 'text-muted-foreground'}`}>
          {labelExibicao || 'Selecione ou busque...'}
        </span>
        {value && <button type="button" onClick={e => { e.stopPropagation(); onChange(''); }} className="p-1"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-card rounded-2xl shadow-2xl border-0 overflow-hidden">
          {/* busca */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input autoComplete="off"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar transportadora..."
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {/* lista */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onChange(t.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 dark:hover:bg-muted text-left"
              >
                <Truck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{t.nome}</span>
                {t.id === value && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma encontrada</p>
            )}
          </div>
          {/* criar nova */}
          {!criando ? (
            <button
              type="button"
              onClick={() => { setCriando(true); setNomeNova(query); }}
              className="w-full flex items-center gap-2 px-4 py-3 border-t border-border/40 hover:bg-muted/40 dark:hover:bg-muted text-sm text-muted-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> Cadastrar nova transportadora
            </button>
          ) : (
            <div className="px-4 py-3 border-t border-border/40 space-y-2">
              <input autoComplete="off"
                autoFocus
                value={nomeNova}
                onChange={e => setNomeNova(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSalvarNova()}
                placeholder="Nome da transportadora..."
                className="w-full text-sm bg-muted/50 rounded-xl px-3 py-2 outline-none text-foreground"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleSalvarNova} disabled={salvando || !nomeNova.trim()}
                  className="flex-1 h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 border-0">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCriando(false)}
                  className="h-9 text-xs border-0 bg-muted">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const PAUSA_ANTES_RECEPCAO_MS = 2200;

export default function InformarEmbarque({ pedido, isOpen, onClose, onSuccess, onIrParaRecepcao, embarqueExistente }) {
  const isEdicao = !!embarqueExistente;
  const [embarqueEdicaoHidratado, setEmbarqueEdicaoHidratado] = useState(null);
  const embarqueRef = embarqueEdicaoHidratado || embarqueExistente;
  const itensPedido = useMemo(
    () => resolverItensPedidoCompra(
      pedido,
      isEdicao && embarqueRef ? [embarqueRef] : (pedido?._embarques || []),
    ),
    [pedido, isEdicao, embarqueRef],
  );
  const [transportadoras, setTransportadoras] = useState([]);
  const [eventosLogisticos, setEventosLogisticos] = useState([]);
  const [eventoLogisticoId, setEventoLogisticoId] = useState('');
  const [eventoVinculado, setEventoVinculado] = useState(null);
  const [transportadoraId, setTransportadoraId] = useState('');
  const [transportadoraNome, setTransportadoraNome] = useState('');
  const [dataDespacho, setDataDespacho] = useState('');
  const [eta, setEta] = useState('');
  const [volumes, setVolumes] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transporte');
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [qtdEmbarque, setQtdEmbarque] = useState({});
  const [selectedItems, setSelectedItems] = useState({});
  const [unidadeLinha, setUnidadeLinha] = useState({});
  const [produtosMap, setProdutosMap] = useState({});
  const [unitSelector, setUnitSelector] = useState({ open: false, produtoId: null, product: null });
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorLocal, setFornecedorLocal] = useState({ id: '', nome: '' });
  const [podeEscolherFornecedor, setPodeEscolherFornecedor] = useState(false);

  const eventoSelecionado = useMemo(() => {
    if (eventoVinculado && eventoVinculado.id === eventoLogisticoId) return eventoVinculado;
    return eventosLogisticos.find((evento) => evento.id === eventoLogisticoId) || eventoVinculado || null;
  }, [eventosLogisticos, eventoLogisticoId, eventoVinculado]);

  const jaEmbarcadoBase = useMemo(() =>
    calcularJaEmbarcadoBaseSemEmbarque(pedido, embarqueExistente?.id),
    [pedido, embarqueExistente]
  );

  useEffect(() => {
    if (!isOpen || !embarqueExistente?.id) {
      setEmbarqueEdicaoHidratado(null);
      return undefined;
    }
    let cancelled = false;
    hydrateEmbarquesFromSql(base44, [embarqueExistente]).then(([hydrated]) => {
      if (!cancelled && hydrated) setEmbarqueEdicaoHidratado(hydrated);
    });
    return () => { cancelled = true; };
  }, [isOpen, embarqueExistente?.id]);

  useEffect(() => {
    if (!isOpen) {
      setShowTripSelector(false);
      setEventoVinculado(null);
      return;
    }
    if (!pedido) return;
    logDespachoAudit({ action: 'despacho_aberto', pedidoId: pedido.id, edicao: !!embarqueExistente });
    setShowTripSelector(false);
    loadTransportadoras();
    loadEventosLogisticos(embarqueRef);
    loadFornecedores();
    setFornecedorLocal({ id: pedido.fornecedor_id || '', nome: pedido.fornecedor_nome || '' });
    setPodeEscolherFornecedor(false);
    setActiveTab('transporte');
    setUnidadeLinha({});

    const jaBase = calcularJaEmbarcadoBaseSemEmbarque(pedido, embarqueExistente?.id);
    const initUnidade = {};
    const initQtd = {};
    const initSel = {};

    if (isEdicao && embarqueRef) {
      setDataDespacho(embarqueRef.data_embarque ? toLocalDateKey(new Date(embarqueRef.data_embarque)) : dataHoje());
      setTransportadoraId(embarqueRef.transportadora_id || '');
      setTransportadoraNome(embarqueRef.transportadora_nome || '');
      setEventoLogisticoId(embarqueRef.evento_logistico_id || '');
      const etaVal = embarqueRef.eta
        ? toLocalDateKey(new Date(embarqueRef.eta))
        : '';
      setEta(etaVal);
      const volsCarregados = (embarqueRef.volumes_detalhados && Array.isArray(embarqueRef.volumes_detalhados) && embarqueRef.volumes_detalhados.length > 0)
        ? embarqueRef.volumes_detalhados
        : [];
      setVolumes(volsCarregados);
      setObservacoes(embarqueRef.observacoes || '');
      const itensDoEmbarque = getEmbarqueItensLinhas(embarqueRef);
      itensPedido.forEach((item) => {
        const produto = null;
        const embItem = itensDoEmbarque.find((i) => i.produto_id === item.produto_id);
        const linha = buildUnidadeLinhaInicial(item, produto, embItem);
        initUnidade[item.produto_id] = linha;
        if (embItem) {
          initQtd[item.produto_id] = String(quantidadeApresentacaoEmbarqueItem(embItem, linha));
          initSel[item.produto_id] = quantidadeBaseEmbarqueItem(embItem) > 0;
        } else {
          initQtd[item.produto_id] = '0';
          initSel[item.produto_id] = false;
        }
      });
    } else {
      setDataDespacho(dataHoje());
      setTransportadoraId('');
      setTransportadoraNome('');
      setEventoLogisticoId('');
      setEventoVinculado(null);
      setEta('');
      setVolumes([]);
      setObservacoes('');
      (itensPedido || []).forEach((item) => {
        const linha = buildUnidadeLinhaInicial(item, null);
        initUnidade[item.produto_id] = linha;
        const pedidaBase = pedidaBaseItem(item);
        const anteriorBase = jaBase[item.produto_id] || 0;
        const pendenteBase = Math.max(0, pedidaBase - anteriorBase);
        initQtd[item.produto_id] = pendenteBase > 0
          ? String(commercialQuantityFromBase(pendenteBase, linha.fator, linha.unidade))
          : '0';
        initSel[item.produto_id] = pendenteBase > 0;
      });
    }

    setQtdEmbarque(initQtd);
    setSelectedItems(initSel);
    setUnidadeLinha(initUnidade);

    carregarProdutosMap(itensPedido || []).then((map) => {
      setProdutosMap(map);
      const unidadeAtualizada = { ...initUnidade };
      const qtdAtualizada = { ...initQtd };
      (itensPedido || []).forEach((item) => {
        const produto = map[item.produto_id];
        if (!produto) return;
        if (isEdicao && embarqueRef) {
          const itensDoEmbarque = getEmbarqueItensLinhas(embarqueRef);
          const embItem = itensDoEmbarque.find((i) => i.produto_id === item.produto_id);
          const linha = enrichLinhaDespacho(produto, buildUnidadeLinhaInicial(item, produto, embItem));
          unidadeAtualizada[item.produto_id] = linha;
          if (embItem) {
            qtdAtualizada[item.produto_id] = String(quantidadeApresentacaoEmbarqueItem(embItem, linha));
          }
        } else {
          const linha = enrichLinhaDespacho(produto, buildUnidadeLinhaInicial(item, produto));
          unidadeAtualizada[item.produto_id] = linha;
          const pedidaBase = pedidaBaseItem(item);
          const anteriorBase = jaBase[item.produto_id] || 0;
          const pendenteBase = Math.max(0, pedidaBase - anteriorBase);
          qtdAtualizada[item.produto_id] = pendenteBase > 0
            ? String(commercialQuantityFromBase(pendenteBase, linha.fator, linha.unidade))
            : '0';
        }
      });
      setUnidadeLinha(unidadeAtualizada);
      setQtdEmbarque(qtdAtualizada);
    });
  }, [isOpen, pedido, embarqueExistente, embarqueRef, itensPedido, isEdicao]);

  const loadTransportadoras = async () => {
    try {
      const data = await base44.entities.Transportadora.list();
      setTransportadoras((data || []).filter(t => t.ativo !== false));
    } catch {
      toast.error('Erro ao carregar transportadoras');
    }
  };

  const loadEventosLogisticos = async (embarqueRef) => {
    try {
      const data = await base44.entities.EventoLogisticoSandbox.list('-data_referencia', 100);
      let merged = data || [];
      const needId = embarqueRef?.evento_logistico_id;
      if (needId && !merged.find((e) => e.id === needId)) {
        try {
          const extra = await base44.entities.EventoLogisticoSandbox.filter({ id: needId });
          if (extra?.[0]) merged = [...merged, extra[0]];
        } catch {
          /* ignora evento removido do sandbox */
        }
      }
      setEventosLogisticos(merged);
    } catch {
      toast.error('Erro ao carregar eventos logísticos');
    }
  };

  const loadFornecedores = async () => {
    try {
      const data = await base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] }, 'nome', 500);
      setFornecedores(data || []);
    } catch {
      toast.error('Erro ao carregar fornecedores');
    }
  };

  const handleSelectTrip = (evento) => {
    logDespachoAudit({ action: 'viagem_selecionada', eventoId: evento?.id, codigo: evento?.codigo });
    setEventoVinculado(evento || null);
    setEventoLogisticoId(evento?.id || '');
    const matched = resolveAndMatchTransportadora(evento, transportadoras);
    setTransportadoraId(matched.transportadora_id || '');
    setTransportadoraNome(matched.transportadora_nome || '');
    const dataSaida = evento?.data_saida_origem || evento?.data_referencia;
    const dataEta = evento?.previsao_chegada || evento?.data_chegada_destino;
    if (dataSaida) setDataDespacho(String(dataSaida).slice(0, 10));
    if (dataEta) setEta(String(dataEta).slice(0, 10));
    setShowTripSelector(false);
    logDespachoAudit({ action: 'viagem_selector_fechado_apos_escolha' });
  };

  const toggleItem = (produtoId) => {
    setSelectedItems(prev => ({ ...prev, [produtoId]: !prev[produtoId] }));
  };

  const statusPreview = useMemo(() =>
    calcularStatusEmbarque(
      pedido?.itens || [],
      jaEmbarcadoBase,
      qtdEmbarque,
      selectedItems,
      unidadeLinha,
      produtosMap,
    ),
    [pedido, jaEmbarcadoBase, qtdEmbarque, selectedItems, unidadeLinha, produtosMap]
  );

  const handleConfirmUnitDespacho = (unitOption) => {
    const produtoId = unitSelector.produtoId;
    if (!produtoId || !unitOption) return;
    const item = (itensPedido || []).find((i) => i.produto_id === produtoId);
    if (!item) return;
    const linhaAtual = unidadeLinha[produtoId] || buildUnidadeLinhaInicial(item, produtosMap[produtoId]);
    const qtyAtual = parseFloat(qtdEmbarque[produtoId]) || 0;
    const baseAtual = calculateBaseQuantity(qtyAtual, linhaAtual.fator);
    const fatorNovo = resolveFatorLinhaDespacho(produtosMap[produtoId], {
      unidade: unitOption.unidade,
      fator: Number(unitOption.fator_conversao) || 1,
    });
    const qtyNova = commercialQuantityFromBase(baseAtual, fatorNovo, unitOption.unidade);
    setUnidadeLinha((prev) => ({
      ...prev,
      [produtoId]: enrichLinhaDespacho(produtosMap[produtoId], {
        unidade: unitOption.unidade,
        fator: fatorNovo,
        produto_unidade_id: getUnidadeBySiglaCanonical(produtosMap[produtoId], unitOption.unidade)?.id || '',
      }),
    }));
    setQtdEmbarque((prev) => ({ ...prev, [produtoId]: String(qtyNova) }));
    setUnitSelector({ open: false, produtoId: null, product: null });
  };

  const totalPesoKg = roundToTwoDecimals(volumes.reduce((s, v) => s + (v.peso_total_kg || 0), 0));

  const bloquearFecharPorPortalAberto = showTripSelector || unitSelector.open;

  useEffect(() => {
    if (!isOpen || !pedido) return;
    logDespachoAudit({
      action: 'state_snapshot',
      showTripSelector,
      podeEscolherFornecedor,
      activeTab,
      eventoLogisticoId: eventoLogisticoId || null,
      radixModalDespacho: !bloquearFecharPorPortalAberto,
    });
  }, [
    isOpen,
    pedido?.id,
    showTripSelector,
    podeEscolherFornecedor,
    activeTab,
    eventoLogisticoId,
    bloquearFecharPorPortalAberto,
  ]);

  const handleSalvar = async () => {
    if (!eta) return toast.error('Informe a data de chegada prevista (ETA)');

    const fornecedorIdFinal = fornecedorLocal.id || pedido.fornecedor_id;
    const fornecedorNomeFinal = fornecedorLocal.nome || pedido.fornecedor_nome;
    if (podeEscolherFornecedor) {
      return toast.error('Confirme ou cancele a alteração de fornecedor antes de salvar o despacho.');
    }

    setLoading(true);
    try {
      if (fornecedorIdFinal && fornecedorIdFinal !== pedido.fornecedor_id) {
        const rows = await base44.entities.PedidoCompra.filter({ id: pedido.id });
        const atual = rows?.[0] || pedido;
        await base44.entities.PedidoCompra.update(pedido.id, {
          ...atual,
          fornecedor_id: fornecedorIdFinal,
          fornecedor_nome: fornecedorNomeFinal,
          historico: `${atual.historico || ''}\n[Fornecedor alterado no despacho — ${fornecedorNomeFinal} — ${formatarLogTime()}]`,
        });
      }

      const transportadora = transportadoras.find(t => t.id === transportadoraId);
      const transportadoraPayload = buildTransportadoraPersistPayload(
        {
          transportadora_id: transportadoraId,
          transportadora_nome: transportadora?.nome || transportadoraNome,
          embarcacao_nome: transportadoraNome,
        },
        transportadoras,
      );
      const embarquesExistentes = Array.isArray(pedido._embarques) ? pedido._embarques : [];
      const letraExibicao = String.fromCharCode(65 + embarquesExistentes.length);
      const itensEmbarcados = (itensPedido || [])
        .filter(item => selectedItems[item.produto_id])
        .map(item => {
          const produto = produtosMap[item.produto_id];
          const linha = resolveUnidadeLinha(item, produto, unidadeLinha, item.produto_id);
          const qEmb = roundToTwoDecimals(parseFloat(qtdEmbarque[item.produto_id]) || 0);
          return buildItemEmbarquePersistido(item, produto, linha, qEmb);
        })
        .filter(i => i.quantidade_embarcada > 0);
      const itensJaLancados = getEmbarqueItensLinhas(embarqueRef).filter(
        (item) => (Number(item?.quantidade_embarcada) || 0) > 0
      );
      const podeSalvarSoTransporte = isEdicao && itensEmbarcados.length === 0 && itensJaLancados.length > 0;

      if (!podeSalvarSoTransporte && itensEmbarcados.length === 0) {
        toast.error('Informe quantidades maiores que zero');
        return;
      }

      const volumesTexto = volumes.length > 0
        ? volumes.map(v => `${v.quantidade}x ${v.descricao || 'sem descrição'}`).join(', ')
        : '';
      const volumesDetalhados = volumes.length > 0 ? volumes : [];

      const payloadMetadados = {
        data_embarque: dataDespacho ? meioDiaSistemaISO(dataDespacho) : (embarqueExistente?.data_embarque || agora()),
        eta: meioDiaSistemaISO(eta),
        transportadora_id: transportadoraPayload.transportadora_id,
        transportadora_nome: transportadoraPayload.transportadora_nome,
        fornecedor_id: fornecedorIdFinal,
        fornecedor_nome: fornecedorNomeFinal,
        evento_logistico_id: eventoLogisticoId || '',
        volumes: volumesTexto,
        volumes_detalhados: volumesDetalhados,
        peso_kg: totalPesoKg,
        observacoes,
        status: 'Pendente',
      };

      let embarqueIdSalvo = embarqueExistente?.id || null;
      if (!isEdicao) {
        const embCriado = await base44.entities.Embarque.create({
          pedido_compra_id: pedido.id,
          pedido_compra_numero: pedido.numero,
          fornecedor_id: fornecedorIdFinal,
          fornecedor_nome: fornecedorNomeFinal,
          numero: String(embarquesExistentes.length + 1).padStart(2, '0'),
          codigo_exibicao: `${pedido.numero}-${letraExibicao}`,
          tipo: 'Embarque',
          status_recebimento: 'Pendente',
          ...payloadMetadados,
        });
        embarqueIdSalvo = embCriado?.id || null;
      }

      if (!embarqueIdSalvo) {
        toast.error('Não foi possível identificar o embarque para gravar as linhas.');
        return;
      }

      if (!podeSalvarSoTransporte) {
        const itensCanonicos = buildItensCanonicosEmbarque(itensEmbarcados, itensPedido || []);
        if (itensCanonicos.length === 0) {
          toast.error('Não foi possível gravar as linhas do despacho. Verifique produto e quantidades.');
          return;
        }
        await saveEmbarqueItem({
          action: 'replaceAll',
          embarque_id: embarqueIdSalvo,
          items: itensCanonicos,
        });
      }

      if (isEdicao) {
        await base44.entities.Embarque.update(embarqueExistente.id, payloadMetadados);
      }

      const linhasComQuantidade = podeSalvarSoTransporte
        ? itensJaLancados
        : itensEmbarcados.filter((it) => it?.produto_id && (Number(it?.quantidade_embarcada) || 0) > 0);
      const nProdutosVinculados = linhasComQuantidade.length;
      const totalUnidadesEmbarcadas = linhasComQuantidade.reduce(
        (s, i) => s + (Number(i.quantidade_embarcada) || 0),
        0
      );

      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

      const msgOk = isEdicao ? 'Despacho atualizado com sucesso.' : 'Despacho registrado com sucesso.';
      const resumoItens =
        nProdutosVinculados > 0
          ? `${nProdutosVinculados} produto(s) com quantidades embarcadas (${formatQuantity(totalUnidadesEmbarcadas)} un.). `
          : 'Sem linhas novas por produto neste envio (apenas transporte/dados logísticos). ';
      const seguirRecepcao = isEdicao
        ? 'Quantidades e dados logísticos gravados — pode receber quando quiser.'
        : 'A seguir abrimos a Recepção.';

      toast.success(msgOk, {
        description: `${resumoItens}${seguirRecepcao}`,
        duration: isEdicao ? 4500 : 6500,
      });
      if (!isEdicao) {
        await new Promise((r) => setTimeout(r, PAUSA_ANTES_RECEPCAO_MS));
      }
      onSuccess?.();
      if (!isEdicao) {
        onIrParaRecepcao?.();
      }
      onClose();
    } catch (err) {
      const det = err?.message || err?.response?.data?.error || 'Erro desconhecido';
      toast.error('Não foi possível salvar o despacho', {
        description: det,
        duration: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !pedido) return null;

  return (
    <>
      {/* modal=false enquanto há portal por cima: Radix bloqueia pointer-events no resto da página em modal=true */}
      <Dialog open={isOpen} onOpenChange={onClose} modal={!bloquearFecharPorPortalAberto}>
        <DialogContent
          className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl bg-card border border-border/40 text-foreground shadow-2xl"
          onInteractOutside={(e) => {
            if (bloquearFecharPorPortalAberto) {
              e.preventDefault();
              logDespachoAudit({ action: 'radix_interact_outside_prevented', motivo: 'portal_viagem_ou_auth' });
            }
          }}
          onPointerDownOutside={(e) => {
            if (bloquearFecharPorPortalAberto) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (bloquearFecharPorPortalAberto) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!bloquearFecharPorPortalAberto) return;
            e.preventDefault();
            if (showTripSelector) setShowTripSelector(false);
            if (unitSelector.open) setUnitSelector({ open: false, produtoId: null, product: null });
            logDespachoAudit({ action: 'escape_fechou_portal' });
          }}
        >

        <div className="flex flex-shrink-0 items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40 bg-gradient-to-b from-card to-muted/60 dark:from-muted/40 dark:to-muted/60">
          <div className="w-10 h-10 rounded-3xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shadow-sm">
            <Truck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
          </div>
          <h2 className="text-base font-semibold text-foreground font-quicksand flex-1">
            {isEdicao ? 'Editar Despacho' : 'Informar Despacho'}
            <span className="text-muted-foreground font-normal"> — {pedido.numero}</span>
          </h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 pb-10 scroll-smooth bg-card">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 pb-2">
            <TabsList className="grid grid-cols-2 gap-1 h-auto rounded-2xl bg-muted p-1 w-full border border-border/40">
              <TabsTrigger value="transporte" className="rounded-2xl py-2.5 text-sm flex items-center gap-2"><Route className="w-4 h-4" />Transporte</TabsTrigger>
              <TabsTrigger value="itens" className="rounded-2xl py-2.5 text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4" />Itens relacionados</TabsTrigger>
            </TabsList>

              <TabsContent value="transporte" className="space-y-5 mt-0">
                <div className="space-y-2 rounded-2xl border border-border/40 bg-muted/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Fornecedor do pedido</p>
                      <p className="text-sm font-medium text-foreground truncate">{fornecedorLocal.nome || '—'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPodeEscolherFornecedor(true)}
                      className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                    >
                      Alterar fornecedor
                    </button>
                  </div>
                  {podeEscolherFornecedor && (
                    <div className="space-y-2 pt-1 border-t border-border/40">
                      <label className="text-xs text-muted-foreground">Selecionar fornecedor</label>
                      <select
                        value={fornecedorLocal.id}
                        onChange={(e) => {
                          const fn = fornecedores.find((f) => f.id === e.target.value);
                          setFornecedorLocal({ id: fn?.id || '', nome: fn?.nome || '' });
                        }}
                        className="w-full h-11 rounded-xl border-0 bg-muted px-3 text-sm text-foreground"
                      >
                        <option value="">Selecione...</option>
                        {fornecedores.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
                          onClick={() => {
                            if (!fornecedorLocal.id) {
                              toast.error('Selecione um fornecedor');
                              return;
                            }
                            setPodeEscolherFornecedor(false);
                            toast.success('Fornecedor definido para este despacho. Salve o formulário para gravar.');
                          }}
                        >
                          Confirmar alteração
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-muted px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/80"
                          onClick={() => {
                            setPodeEscolherFornecedor(false);
                            setFornecedorLocal({ id: pedido.fornecedor_id || '', nome: pedido.fornecedor_nome || '' });
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-border/40 bg-muted/50 p-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Data Despacho
                    </label>
                    <Input
                      type="date"
                      value={dataDespacho}
                      onChange={e => setDataDespacho(e.target.value)}
                      className="h-12 rounded-xl border-0 bg-muted shadow-sm text-sm text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      ETA — Chegada <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <Input
                      type="date"
                      value={eta}
                      onChange={e => setEta(e.target.value)}
                      className="h-12 rounded-xl border-0 bg-muted shadow-sm text-sm text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 rounded-2xl border border-border/40 bg-muted/50 p-4">
                  <label className="text-sm text-muted-foreground">
                    Transportadora <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <TransportadoraSearch
                    transportadoras={transportadoras}
                    value={transportadoraId}
                    displayNome={transportadoraNome}
                    onChange={(id) => {
                      setTransportadoraId(id);
                      const encontrada = transportadoras.find((t) => t.id === id);
                      setTransportadoraNome(encontrada?.nome || '');
                    }}
                    onCriarNova={nova => setTransportadoras(prev => [...prev, nova])}
                  />
                </div>

                <div className="space-y-1.5 rounded-2xl border border-border/40 bg-muted/50 p-4">
                  <label className="text-sm text-muted-foreground">
                    Viagem vinculada <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      logDespachoAudit({ action: 'click_informar_viagem' });
                      setShowTripSelector(true);
                    }}
                    className="w-full h-12 rounded-xl border-0 bg-muted shadow-sm text-sm text-foreground px-4 flex items-center gap-3 text-left"
                  >
                    <ShipWheel className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className={`flex-1 truncate ${eventoSelecionado ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {eventoSelecionado ? `${eventoSelecionado.codigo || 'Sem código'} · ${eventoSelecionado.nome || eventoSelecionado.embarcacao_nome || 'Viagem'}` : 'Informar viagem no itinerário'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {eventoSelecionado ? (
                    <div className="flex items-center justify-between gap-3 px-1">
                      <p className="text-xs text-muted-foreground">
                        Ao escolher a viagem, datas e transportadora foram preenchidas; você pode ajustar manualmente.
                      </p>
                      <button type="button" onClick={() => { setEventoLogisticoId(''); setEventoVinculado(null); setTransportadoraNome(''); }} className="shrink-0 text-xs text-teal-400 hover:text-teal-300">
                        Limpar vínculo
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5 rounded-2xl border border-border/40 bg-muted/50 p-4">
                  <label className="text-sm text-muted-foreground">Observações</label>
                  <Input
                    placeholder="Observações sobre este embarque..."
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    className="h-12 rounded-xl border-0 bg-muted shadow-sm text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 mt-0">
                {isEdicao && (
                  <p className="text-xs text-muted-foreground rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 leading-relaxed">
                    Ajuste as quantidades embarcadas (ex.: caixas avariadas) e salve. Só é possível enquanto a recepção ainda não começou.
                  </p>
                )}
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                  statusPreview === 'Total' ? 'bg-muted/50 text-muted-foreground' :
                  statusPreview === 'Parcial' ? 'bg-muted/50 text-muted-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {statusPreview === 'Total' && <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  {statusPreview === 'Parcial' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                  {statusPreview === 'Nenhum' && <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span>
                    {statusPreview === 'Total' && 'Embarque total — todos os itens cobertos'}
                    {statusPreview === 'Parcial' && 'Embarque parcial — haverá itens órfãos aguardando despacho'}
                    {statusPreview === 'Nenhum' && 'Selecione e informe as quantidades a embarcar'}
                  </span>
                </div>

                <div className="space-y-2">
                  {(itensPedido || []).map(item => {
                    const produto = produtosMap[item.produto_id];
                    const linha = resolveUnidadeLinha(item, produto, unidadeLinha, item.produto_id);
                    const pedidaBase = pedidaBaseItem(item);
                    const anteriorBase = jaEmbarcadoBase[item.produto_id] || 0;
                    const pendenteBase = Math.max(0, pedidaBase - anteriorBase);
                    const pedidaExib = commercialQuantityFromBase(pedidaBase, linha.fator, linha.unidade);
                    const pendenteExib = commercialQuantityFromBase(pendenteBase, linha.fator, linha.unidade);
                    const anteriorExib = commercialQuantityFromBase(anteriorBase, linha.fator, linha.unidade);
                    const selecionado = selectedItems[item.produto_id] !== false;
                    const emb = parseFloat(qtdEmbarque[item.produto_id]) || 0;
                    const excede = emb > pendenteExib + 0.02;
                    const podeTrocarUnidade = produto && hasAlternativeUnits(produto) && buildPurchaseUnitOptions(produto).length > 1;
                    const exibVitrine = getItemCompraExibicaoVitrine(item, produto);

                    return (
                      <div
                        key={item.produto_id}
                        className={`flex flex-col gap-2.5 rounded-xl px-4 py-3 transition-colors border ${selecionado ? 'bg-muted/50 border-border/40' : 'bg-muted/40/40 dark:bg-background/40 border-border/40 opacity-60'}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.produto_id)}
                            className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors mt-0.5 ${selecionado ? 'bg-primary' : 'bg-muted'}`}
                          >
                            {selecionado && <Check className="w-3 h-3 text-primary-foreground" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-tight">{item.produto_nome}</p>
                            {exibVitrine.unidade_medida !== (item.unidade_medida || '') && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Pedido em {item.unidade_medida || 'UN'} · vitrine {exibVitrine.unidade_medida}
                              </p>
                            )}
                          </div>
                          {podeTrocarUnidade ? (
                            <button
                              type="button"
                              onClick={() => setUnitSelector({ open: true, produtoId: item.produto_id, product: produto })}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-muted/80"
                            >
                              <Boxes className="w-3 h-3" aria-hidden />
                              {linha.unidade}
                            </button>
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground px-1">
                              {linha.unidade}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 pl-8">
                          <p className="text-xs text-muted-foreground flex-1">
                            Ped: <span className="font-medium">{formatCommercialQuantity(pedidaExib, linha.unidade)}</span> {linha.unidade}
                            {pendenteExib < pedidaExib && (
                              <span className="ml-1.5">· pend: {formatCommercialQuantity(pendenteExib, linha.unidade)}</span>
                            )}
                            {anteriorExib > 0 && (
                              <span className="ml-1.5">· já emb: {formatCommercialQuantity(anteriorExib, linha.unidade)}</span>
                            )}
                            {excede && selecionado && <span className="ml-1.5 text-red-400">· excede!</span>}
                          </p>
                          <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                            <Input
                              type="text"
                              inputMode="decimal"
                              disabled={!selecionado}
                              value={qtdEmbarque[item.produto_id] ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={e => setQtdEmbarque(prev => ({ ...prev, [item.produto_id]: e.target.value.replace(',', '.') }))}
                              className={`w-14 h-8 text-xs text-right rounded-lg bg-card dark:bg-muted text-foreground dark:text-foreground disabled:opacity-40 placeholder:text-muted-foreground px-2 border-0 shadow-sm ${excede && selecionado ? 'ring-1 ring-red-400' : ''}`}
                              placeholder="0"
                            />
                            <span className="text-[9px] text-muted-foreground uppercase">{linha.unidade}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer — fixo na base do modal; corpo acima rola com respiro (evita “fim seco”) */}
          <div className="flex flex-shrink-0 justify-end gap-3 px-6 pt-4 pb-6 border-t border-border/40 bg-gradient-to-b from-card to-muted/60 dark:from-muted/40 dark:to-muted/60">
            <Button variant="outline" onClick={onClose} disabled={loading}
              className="h-12 px-6 rounded-xl border-0 shadow-sm bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50">
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={loading}
              className="h-12 px-8 rounded-xl border-0 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground min-w-[180px] disabled:opacity-70 disabled:pointer-events-none inline-flex items-center justify-center gap-0">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Processando…
                </>
              ) : isEdicao ? (
                'Salvar Despacho'
              ) : (
                'Registrar Despacho'
              )}
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      {showTripSelector ? (
        <FluvialTripSelectorFullscreen
          open
          onClose={() => {
            logDespachoAudit({ action: 'viagem_selector_fechado_usuario' });
            setShowTripSelector(false);
          }}
          onSelect={handleSelectTrip}
        />
      ) : null}

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="purchase"
        onClose={() => setUnitSelector({ open: false, produtoId: null, product: null })}
        onConfirm={handleConfirmUnitDespacho}
      />

      <InformarDespachoAuditStrip isOpen={isOpen} />
    </>
  );
}