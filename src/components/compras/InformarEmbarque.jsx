import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Package, Calendar, AlertTriangle, CheckCircle2, ChevronDown, Plus, Check, X, Search, Anchor, Route, ClipboardList, ShipWheel, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FluvialTripSelectorFullscreen from '@/components/compras/FluvialTripSelectorFullscreen';
import { agora, dataHoje, meioDiaSistemaISO, toLocalDateKey, formatarLogTime } from '@/components/utils/dateUtils';
import { logDespachoAudit, InformarDespachoAuditStrip } from '@/components/compras/informarEmbarqueAudit.jsx';
import { roundToTwoDecimals, formatQuantity } from '@/lib/financialUtils';
import { saveEmbarqueItem } from '@/functions/saveEmbarqueItem';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';
import {
  buildTransportadoraPersistPayload,
  resolveAndMatchTransportadora,
} from '@/lib/resolveTransportadora';

// ── helpers ───────────────────────────────────────────────────────────────────

function calcularJaEmbarcadoSemEmbarque(pedido, embarqueExistenteId) {
  const map = {};
  const embarques = Array.isArray(pedido?._embarques) ? pedido._embarques : (pedido?.embarques_registrados || []);
  embarques.forEach((emb) => {
    if (embarqueExistenteId && emb.id === embarqueExistenteId) return;
    (emb.itens || emb.itens_embarcados || []).forEach((item) => {
      const prev = map[item.produto_id] || 0;
      map[item.produto_id] = roundToTwoDecimals(prev + (Number(item.quantidade_embarcada) || 0));
    });
  });
  return map;
}

function calcularStatusEmbarque(itens, jaEmbarcado, qtdEmbarque, selectedItems) {
  let totalPedido = 0;
  let totalEmbarcado = 0;
  itens.forEach((item) => {
    const pedida = item.quantidade || 0;
    const anterior = jaEmbarcado[item.produto_id] || 0;
    const selecionado = selectedItems[item.produto_id] !== false;
    const nova = selecionado ? roundToTwoDecimals(parseFloat(qtdEmbarque[item.produto_id]) || 0) : 0;
    totalPedido = roundToTwoDecimals(totalPedido + pedida);
    totalEmbarcado = roundToTwoDecimals(totalEmbarcado + Math.min(anterior + nova, pedida));
  });
  if (totalEmbarcado <= 0) return 'Nenhum';
  if (totalEmbarcado >= totalPedido) return 'Total';
  return 'Parcial';
}

function calcularPercentualValorEmbarcado(pedido, embarquesAtualizados) {
  const custoPorProduto = Object.fromEntries((pedido.itens || []).map((item) => [item.produto_id, Number(item.custo_unitario) || 0]));
  const valorTotalPedido = Number(pedido.valor_total) || (pedido.itens || []).reduce((acc, item) => acc + ((Number(item.quantidade) || 0) * (Number(item.custo_unitario) || 0)), 0);
  if (!valorTotalPedido) return 0;

  const qtdPorProduto = {};
  (embarquesAtualizados || []).forEach((emb) => {
    if (emb.status === 'Pendente') return;
    (emb.itens_embarcados || []).forEach((item) => {
      const prevQ = qtdPorProduto[item.produto_id] || 0;
      qtdPorProduto[item.produto_id] = roundToTwoDecimals(prevQ + (Number(item.quantidade_embarcada) || 0));
    });
  });

  const valorEmbarcado = (pedido.itens || []).reduce((acc, item) => {
    const qtd = Math.min(Number(item.quantidade) || 0, qtdPorProduto[item.produto_id] || 0);
    return acc + (qtd * (custoPorProduto[item.produto_id] || 0));
  }, 0);

  return Math.min(100, Number(((valorEmbarcado / valorTotalPedido) * 100).toFixed(2)));
}

function getItensEmbarque(embarque) {
  if (Array.isArray(embarque?.itens_embarcados) && embarque.itens_embarcados.length > 0) {
    return embarque.itens_embarcados;
  }
  return Array.isArray(embarque?.itens) ? embarque.itens : [];
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
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorLocal, setFornecedorLocal] = useState({ id: '', nome: '' });
  const [podeEscolherFornecedor, setPodeEscolherFornecedor] = useState(false);

  const eventoSelecionado = useMemo(() => {
    if (eventoVinculado && eventoVinculado.id === eventoLogisticoId) return eventoVinculado;
    return eventosLogisticos.find((evento) => evento.id === eventoLogisticoId) || eventoVinculado || null;
  }, [eventosLogisticos, eventoLogisticoId, eventoVinculado]);

  const jaEmbarcado = useMemo(() =>
    calcularJaEmbarcadoSemEmbarque(pedido, embarqueExistente?.id),
    [pedido, embarqueExistente]
  );

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
    loadEventosLogisticos(embarqueExistente);
    loadFornecedores();
    setFornecedorLocal({ id: pedido.fornecedor_id || '', nome: pedido.fornecedor_nome || '' });
    setPodeEscolherFornecedor(false);
    setActiveTab('transporte');
    if (isEdicao) {
      setDataDespacho(embarqueExistente.data_embarque ? toLocalDateKey(new Date(embarqueExistente.data_embarque)) : dataHoje());
      setTransportadoraId(embarqueExistente.transportadora_id || '');
      setTransportadoraNome(embarqueExistente.transportadora_nome || '');
      setEventoLogisticoId(embarqueExistente.evento_logistico_id || '');
      const etaVal = embarqueExistente.eta
        ? toLocalDateKey(new Date(embarqueExistente.eta))
        : '';
      setEta(etaVal);
      // Carrega volumes — verifica ambos campos (retrocompatibilidade)
      const volsCarregados = (embarqueExistente.volumes_detalhados && Array.isArray(embarqueExistente.volumes_detalhados) && embarqueExistente.volumes_detalhados.length > 0)
        ? embarqueExistente.volumes_detalhados
        : [];
      setVolumes(volsCarregados);
      setObservacoes(embarqueExistente.observacoes || '');
      const initQtd = {};
      const initSel = {};
      const itensDoEmbarque = getItensEmbarque(embarqueExistente);
      (pedido.itens || []).forEach((item) => {
        const embItem = itensDoEmbarque.find(i => i.produto_id === item.produto_id);
        initQtd[item.produto_id] = embItem ? String(embItem.quantidade_embarcada) : '0';
        initSel[item.produto_id] = !!embItem;
      });
      setQtdEmbarque(initQtd);
      setSelectedItems(initSel);
    } else {
      setDataDespacho(dataHoje());
      setTransportadoraId('');
      setTransportadoraNome('');
      setEventoLogisticoId('');
      setEventoVinculado(null);
      setEta('');
      setVolumes([]);
      setObservacoes('');
      const initQtd = {};
      const initSel = {};
      (pedido.itens || []).forEach((item) => {
        const pendente = Math.max(0, (item.quantidade || 0) - (jaEmbarcado[item.produto_id] || 0));
        initQtd[item.produto_id] = pendente > 0 ? String(pendente) : '0';
        initSel[item.produto_id] = pendente > 0;
      });
      setQtdEmbarque(initQtd);
      setSelectedItems(initSel);
    }
  }, [isOpen, pedido, embarqueExistente]);

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
    calcularStatusEmbarque(pedido?.itens || [], jaEmbarcado, qtdEmbarque, selectedItems),
    [pedido, jaEmbarcado, qtdEmbarque, selectedItems]
  );

  const totalPesoKg = roundToTwoDecimals(volumes.reduce((s, v) => s + (v.peso_total_kg || 0), 0));

  const bloquearFecharPorPortalAberto = showTripSelector;

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
      const embarquesExistentes = Array.isArray(pedido._embarques) ? pedido._embarques : (pedido.embarques_registrados || []);
      const letraExibicao = String.fromCharCode(65 + embarquesExistentes.length);
      const itensEmbarcados = (pedido.itens || [])
        .filter(item => selectedItems[item.produto_id])
        .map(item => ({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade_pedida: item.quantidade,
          quantidade_embarcada: roundToTwoDecimals(parseFloat(qtdEmbarque[item.produto_id]) || 0),
          unidade_medida: item.unidade_medida
        }))
        .filter(i => i.quantidade_embarcada > 0);
      const itensJaLancados = (embarqueExistente?.itens_embarcados || embarqueExistente?.itens || []).filter(
        (item) => (Number(item?.quantidade_embarcada) || 0) > 0
      );
      const podeSalvarSoTransporte = isEdicao && itensEmbarcados.length === 0 && itensJaLancados.length > 0;

      if (!podeSalvarSoTransporte && itensEmbarcados.length === 0) {
        toast.error('Informe quantidades maiores que zero');
        return;
      }

      // Volumes: texto descritivo resumido para campo legado
      // Volumes: salvar no campo volumes_detalhados (estruturado) + volumes (legado texto)
      const volumesTexto = volumes.length > 0
        ? volumes.map(v => `${v.quantidade}x ${v.descricao || 'sem descrição'}`).join(', ')
        : '';
      const volumesDetalhados = volumes.length > 0 ? volumes : [];

      const payloadEmbarque = {
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
        itens: podeSalvarSoTransporte ? (embarqueExistente?.itens || embarqueExistente?.itens_embarcados || []) : itensEmbarcados,
        itens_embarcados: podeSalvarSoTransporte ? (embarqueExistente?.itens_embarcados || embarqueExistente?.itens || []) : itensEmbarcados,
        status: 'Pendente'
      };

      let embarqueIdSalvo = embarqueExistente?.id || null;
      if (isEdicao) {
        await base44.entities.Embarque.update(embarqueExistente.id, payloadEmbarque);
      } else {
        const embCriado = await base44.entities.Embarque.create({
          pedido_compra_id: pedido.id,
          pedido_compra_numero: pedido.numero,
          fornecedor_id: fornecedorIdFinal,
          fornecedor_nome: fornecedorNomeFinal,
          numero: String(embarquesExistentes.length + 1).padStart(2, '0'),
          codigo_exibicao: `${pedido.numero}-${letraExibicao}`,
          tipo: 'Embarque',
          status_recebimento: 'Pendente',
          ...payloadEmbarque
        });
        embarqueIdSalvo = embCriado?.id || null;
      }

      const linhasComQuantidade = (payloadEmbarque.itens_embarcados || payloadEmbarque.itens || []).filter(
        (it) => it?.produto_id && (Number(it?.quantidade_embarcada) || 0) > 0
      );
      const nProdutosVinculados = linhasComQuantidade.length;
      const totalUnidadesEmbarcadas = linhasComQuantidade.reduce(
        (s, i) => s + (Number(i.quantidade_embarcada) || 0),
        0
      );

      // Sincronia canonica de EmbarqueItem (espelho recomposto pelo backend).
      let sincroniaCanonical = 'nao_aplicavel';
      if (embarqueIdSalvo && Array.isArray(payloadEmbarque?.itens) && nProdutosVinculados > 0) {
        sincroniaCanonical = 'pendente';
        try {
          const itensCanonicos = payloadEmbarque.itens
            .map((it, idx) => ({
              id: it?.embarque_item_id || it?.id || undefined,
              produto_id: it?.produto_id || '',
              produto_unidade_id: it?.produto_unidade_id || '',
              pedido_compra_item_id: it?.pedido_compra_item_id || '',
              unidade_sigla: it?.unidade_medida || '',
              quantidade_pedida_comercial: Number(it?.quantidade_pedida) || 0,
              quantidade_embarcada_comercial: Number(it?.quantidade_embarcada) || 0,
              quantidade_recebida_comercial: Number(it?.quantidade_recebida) || 0,
              divergencia_tipo: it?.divergencia_tipo || 'Nenhuma',
              produto_id_recebido_diferente: it?.produto_id_recebido_diferente || '',
              produto_nome_recebido_diferente: it?.produto_nome_recebido_diferente || '',
              acordo_financeiro_lancamento_id: it?.acordo_financeiro_lancamento_id || '',
              ordem: idx,
            }))
            .filter((it) => it.produto_id && it.quantidade_embarcada_comercial > 0);

          if (itensCanonicos.length > 0) {
            await saveEmbarqueItem({
              action: 'replaceAll',
              embarque_id: embarqueIdSalvo,
              items: itensCanonicos,
            });
            sincroniaCanonical = 'ok';
          } else {
            sincroniaCanonical = 'linhas_invalidas';
          }
        } catch (canonicalErr) {
          sincroniaCanonical = 'erro';
          console.warn('Sincronia canonica de EmbarqueItem falhou:', canonicalErr?.message || canonicalErr);
        }
      }

      // Cloud opcional: falha não deve invalidar despacho já gravado (mesmo padrão que RecepcionarEmbarque)
      await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

      const msgOk = isEdicao ? 'Despacho atualizado com sucesso.' : 'Despacho registrado com sucesso.';
      const resumoItens =
        nProdutosVinculados > 0
          ? `${nProdutosVinculados} produto(s) com quantidades embarcadas (${formatQuantity(totalUnidadesEmbarcadas)} un.). `
          : 'Sem linhas novas por produto neste envio (apenas transporte/dados logísticos). ';
      const seguirRecepcao = 'A seguir abrimos a Recepção.';
      const avisoSync =
        sincroniaCanonical === 'erro' || sincroniaCanonical === 'linhas_invalidas'
          ? ' Atenção: a sincronização extra das linhas (EmbarqueItem) falhou ou ficou incompleta — confira na Recepção.'
          : '';

      if (sincroniaCanonical === 'erro' || sincroniaCanonical === 'linhas_invalidas') {
        toast.warning(isEdicao ? 'Despacho guardado com ressalvas' : 'Despacho registado com ressalvas', {
          description: `${resumoItens}${seguirRecepcao}${avisoSync}`,
          duration: 9000,
        });
      } else {
        toast.success(msgOk, {
          description: `${resumoItens}${seguirRecepcao}`,
          duration: 6500,
        });
      }
      await new Promise((r) => setTimeout(r, PAUSA_ANTES_RECEPCAO_MS));
      onSuccess?.();
      onIrParaRecepcao?.();
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
                  {(pedido.itens || []).map(item => {
                    const pedida = item.quantidade || 0;
                    const anterior = jaEmbarcado[item.produto_id] || 0;
                    const pendente = Math.max(0, pedida - anterior);
                    const selecionado = selectedItems[item.produto_id] !== false;
                    const emb = parseFloat(qtdEmbarque[item.produto_id]) || 0;
                    const excede = emb > pendente;

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
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pl-8">
                          <p className="text-xs text-muted-foreground flex-1">
                            Ped: <span className="font-medium">{pedida}</span> {item.unidade_medida}
                            {anterior > 0 && <span className="ml-1.5">· já emb: {anterior}</span>}
                            {excede && selecionado && <span className="ml-1.5 text-red-400">· excede!</span>}
                          </p>
                          <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                            <Input
                              type="text"
                              inputMode="decimal"
                              disabled={!selecionado}
                              value={qtdEmbarque[item.produto_id] ?? ''}
                              onChange={e => setQtdEmbarque(prev => ({ ...prev, [item.produto_id]: e.target.value.replace(',', '.') }))}
                              className={`w-14 h-8 text-xs text-right rounded-lg bg-card dark:bg-muted text-foreground dark:text-foreground disabled:opacity-40 placeholder:text-muted-foreground px-2 border-0 shadow-sm ${excede && selecionado ? 'ring-1 ring-red-400' : ''}`}
                              placeholder="0"
                            />
                            <span className="text-[9px] text-muted-foreground uppercase">{item.unidade_medida}</span>
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

      <InformarDespachoAuditStrip isOpen={isOpen} />
    </>
  );
}