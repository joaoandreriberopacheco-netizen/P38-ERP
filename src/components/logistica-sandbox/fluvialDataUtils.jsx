import { format, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeEventoTransportadoraFields, resolveTransportadoraFromRecord } from '@/lib/resolveTransportadora';

export const FLUVIAL_DEFAULT_PERIOD = '30d';
export const FLUVIAL_FETCH_WINDOW_ALL_DAYS = 365;

export const FLUVIAL_PERIOD_OPTIONS = [
  { id: '30d', label: '±30 dias', dias: 30 },
  { id: '60d', label: '±60 dias', dias: 60 },
  { id: '90d', label: '±90 dias', dias: 90 },
  { id: 'todas', label: 'Todas', dias: null },
];

export function normalizeFluvialDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : format(value, 'yyyy-MM-dd');
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd');
  }
  return null;
}

export function normalizeEventoLogisticoRecord(item) {
  if (!item) return item;

  const dataSaida = normalizeFluvialDateKey(
    item.data_saida_origem || item.data_referencia || item.data_saida,
  );
  const chegadaDestino = normalizeFluvialDateKey(
    item.data_chegada_destino || item.previsao_chegada || item.data_previsao_chegada,
  );
  const chegadaManaus = normalizeFluvialDateKey(
    item.data_chegada_manaus || item.data_retorno_origem || item.previsao_retorno,
  );

  const withTransportadora = normalizeEventoTransportadoraFields(item);

  return {
    ...withTransportadora,
    codigo: item.codigo || item.lancamento_financeiro_numero || (item.id ? String(item.id).slice(0, 8) : null),
    embarcacao_nome: withTransportadora.embarcacao_nome || item.nome || item.transportadora,
    data_saida_origem: dataSaida || item.data_saida_origem,
    data_referencia: normalizeFluvialDateKey(item.data_referencia) || dataSaida,
    data_chegada_destino: chegadaDestino || item.data_chegada_destino,
    previsao_chegada: chegadaDestino || item.previsao_chegada,
    data_chegada_manaus: chegadaManaus || item.data_chegada_manaus,
    data_retorno_origem: normalizeFluvialDateKey(item.data_retorno_origem || item.previsao_retorno),
    previsao_retorno: normalizeFluvialDateKey(item.previsao_retorno),
  };
}

export function unifyLogisticaEventos(fromSandbox = [], fromProd = []) {
  const mapa = new Map();

  (fromSandbox || []).forEach((evento) => {
    if (evento?.id) mapa.set(evento.id, normalizeEventoLogisticoRecord(evento));
  });

  (fromProd || []).forEach((evento) => {
    if (evento?.id && !mapa.has(evento.id)) {
      mapa.set(evento.id, normalizeEventoLogisticoRecord(evento));
    }
  });

  return Array.from(mapa.values());
}

export function getFluvialFetchWindowDays(periodoId) {
  const option = FLUVIAL_PERIOD_OPTIONS.find((item) => item.id === periodoId);
  if (!option?.dias) return FLUVIAL_FETCH_WINDOW_ALL_DAYS;
  return option.dias;
}

export function getFluvialViewDate(evento, viewMode) {
  if (viewMode === 'chegada_tabatinga') {
    return normalizeFluvialDateKey(evento.data_chegada_destino || evento.previsao_chegada || evento.data_previsao_chegada);
  }
  if (viewMode === 'saida_manaus') {
    return normalizeFluvialDateKey(evento.data_saida_origem || evento.data_referencia || evento.data_saida);
  }
  return normalizeFluvialDateKey(
    evento.data_chegada_manaus || evento.data_retorno_origem || evento.previsao_retorno,
  );
}

export function getFluvialPeriodBounds(periodoId, referenceDate = new Date()) {
  const option = FLUVIAL_PERIOD_OPTIONS.find((item) => item.id === periodoId);
  if (!option?.dias) {
    return { inicio: null, fim: null };
  }

  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0,
  );

  return {
    inicio: format(subDays(ref, option.dias), 'yyyy-MM-dd'),
    fim: format(addDays(ref, option.dias), 'yyyy-MM-dd'),
  };
}

export function isWithinFluvialPeriod(dateStr, periodoId, referenceDate = new Date()) {
  const normalized = normalizeFluvialDateKey(dateStr);
  if (!normalized) return false;
  const { inicio, fim } = getFluvialPeriodBounds(periodoId, referenceDate);
  if (!inicio || !fim) return true;
  return normalized >= inicio && normalized <= fim;
}

export function getFluvialTimelineDate(evento, viewMode) {
  return (
    getFluvialViewDate(evento, viewMode)
    || normalizeFluvialDateKey(evento.data_saida_origem)
    || normalizeFluvialDateKey(evento.data_chegada_manaus)
    || normalizeFluvialDateKey(evento.data_chegada_destino)
    || normalizeFluvialDateKey(evento.data_referencia)
  );
}

export function getFluvialEventDateCandidates(evento) {
  return [
    evento.data_saida_origem,
    evento.data_referencia,
    evento.data_saida,
    evento.data_chegada_manaus,
    evento.data_retorno_origem,
    evento.previsao_retorno,
    evento.data_chegada_destino,
    evento.previsao_chegada,
    evento.data_previsao_chegada,
  ]
    .map(normalizeFluvialDateKey)
    .filter(Boolean);
}

export function eventoTemDataNoPeriodo(evento, periodoId) {
  const datas = getFluvialEventDateCandidates(evento);
  if (!datas.length) return false;
  if (periodoId === 'todas') return true;
  return datas.some((data) => isWithinFluvialPeriod(data, periodoId));
}

export function getFluvialPeriodLabel(periodoId) {
  return FLUVIAL_PERIOD_OPTIONS.find((item) => item.id === periodoId)?.label || '±30 dias';
}

function parseStableDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  if (!value) return '-';
  const parsed = parseStableDate(value);
  return parsed ? format(parsed, 'dd/MM/yyyy', { locale: ptBR }) : value;
}

export function getEmbarqueLifecycleStatus(embarque = {}) {
  const statusOperacional = String(embarque.status || '').toLowerCase();
  const statusRecebimento = String(embarque.status_recebimento || '').toLowerCase();
  const isFinalizado = statusOperacional === 'concluído' || statusOperacional === 'concluido';
  const isRecebido = statusRecebimento === 'recebido ok' || statusRecebimento === 'recebido parcial' || statusRecebimento === 'com divergência' || statusRecebimento === 'com divergencia';

  return isFinalizado || isRecebido ? 'finalizado' : 'ativo';
}

export function getLinkedIndicatorStyle(status = 'ativo') {
  if (status === 'finalizado') {
    return {
      badge: 'bg-muted/90 text-foreground dark:bg-muted/400/70 dark:text-foreground',
      dot: 'bg-muted dark:bg-muted/400'
    };
  }

  return {
    badge: 'bg-lime-300 text-foreground dark:bg-lime-300 dark:text-foreground',
    dot: 'bg-lime-300 dark:bg-lime-300'
  };
}

export function buildFluvialEvents({ eventosLogisticos = [], embarques = [], lancamentosFinanceiros = [] }) {
  // Mapa de lancamentos financeiros por referencia_id (evento logistico)
  const mapaLancamentosFrete = {};
  (lancamentosFinanceiros || []).forEach((lancamento) => {
    if (lancamento.referencia_id && lancamento.referencia_tipo === 'EventosLogisticos') {
      mapaLancamentosFrete[lancamento.referencia_id] = lancamento;
    }
  });

  // Criar mapa de itens dos pedidos de compra para enriquecer os embarques
  const mapaPedidosItens = {};
  embarques.forEach((embarque) => {
    const pedido = embarque?._pedido_compra;
    if (pedido?.id && pedido?.itens) {
      if (!mapaPedidosItens[pedido.id]) {
        mapaPedidosItens[pedido.id] = {};
      }
      pedido.itens.forEach((item) => {
        if (item?.produto_id) {
          mapaPedidosItens[pedido.id][item.produto_id] = item;
        }
      });
    }
  });

  const embarquesPorEvento = new Map();
  (embarques || []).forEach((embarque) => {
    const eventoId = embarque.evento_logistico_id;
    if (!eventoId) return;
    if (!embarquesPorEvento.has(eventoId)) {
      embarquesPorEvento.set(eventoId, []);
    }
    embarquesPorEvento.get(eventoId).push(embarque);
  });

  return (eventosLogisticos || [])
    .map((item) => {
      const saidaManaus = item.data_saida_origem || item.data_referencia;
      const chegadaTabatinga = item.data_chegada_destino || item.previsao_chegada;
      const chegadaManaus = item.data_chegada_manaus || item.data_retorno_origem || item.previsao_retorno;
      const proximaChegadaManaus = item.proxima_chegada_manaus || item.proximo_ciclo_chegada_manaus;
      const embarquesRelacionados = embarquesPorEvento.get(item.id) || [];

      const fornecedoresMap = new Map();
      embarquesRelacionados.forEach((embarque) => {
        const key = embarque.fornecedor_nome || 'Fornecedor';
        if (!fornecedoresMap.has(key)) {
          fornecedoresMap.set(key, { fornecedor_nome: key, itens: [] });
        }
        const group = fornecedoresMap.get(key);
        (embarque.itens || []).forEach((itemEmbarque) => {
          group.itens.push(itemEmbarque);
        });
      });

      const resumoFornecedores = Array.from(fornecedoresMap.values());
      const valorTotalCarga = embarquesRelacionados.reduce((total, embarque) => {
        const pedidoItens = mapaPedidosItens[embarque.pedido_compra_id] || {};
        return total + (embarque.itens || []).reduce((sum, itemEmbarque) => {
          const quantidade = itemEmbarque.quantidade_embarcada ?? itemEmbarque.quantidade_pedida ?? itemEmbarque.quantidade ?? 0;
          const itemPedido = pedidoItens[itemEmbarque.produto_id] || {};
          const custo = Number(itemEmbarque.custo_unitario ?? itemPedido.custo_unitario ?? 0) || 0;
          return sum + (quantidade * custo);
        }, 0);
      }, 0);
      const totalEmbarquesAtivos = embarquesRelacionados.filter((emb) => getEmbarqueLifecycleStatus(emb) === 'ativo').length;
      const totalEmbarquesConcluidos = embarquesRelacionados.filter((emb) => getEmbarqueLifecycleStatus(emb) === 'finalizado').length;

      const lancamento = mapaLancamentosFrete[item.id] || null;

      return {
        ...item,
        data_chegada_manaus: chegadaManaus,
        data_saida_origem: saidaManaus,
        data_chegada_destino: chegadaTabatinga,
        proxima_chegada_manaus: proximaChegadaManaus,
        data_chegada_manaus_formatada: formatDate(chegadaManaus),
        data_saida_manaus_formatada: formatDate(saidaManaus),
        data_chegada_destino_formatada: formatDate(chegadaTabatinga),
        proxima_chegada_manaus_formatada: formatDate(proximaChegadaManaus),
        data_retorno_origem_formatada: formatDate(proximaChegadaManaus),
        embarques_relacionados: embarquesRelacionados,
        embarques_status_resumo: embarquesRelacionados.map((emb) => getEmbarqueLifecycleStatus(emb)),
        tem_embarques_relacionados: embarquesRelacionados.length > 0,
        total_embarques_relacionados: embarquesRelacionados.length,
        total_fornecedores_relacionados: resumoFornecedores.length,
        resumo_fornecedores: resumoFornecedores,
        valor_total_carga: valorTotalCarga,
        total_embarques_ativos: totalEmbarquesAtivos,
        total_embarques_concluidos: totalEmbarquesConcluidos,
        // Dados financeiros do LancamentoFinanceiro
        conta_frete: lancamento,
        lancamento_financeiro_id: lancamento?.id || null,
        lancamento_financeiro_valor: lancamento?.valor || 0,
        lancamento_financeiro_status: lancamento?.status || null,
        lancamento_financeiro_data_vencimento: lancamento?.data_vencimento || null,
        tem_conta_frete: Boolean(lancamento)
      };
    })
    .sort((a, b) => new Date(b.data_saida_origem || 0) - new Date(a.data_saida_origem || 0));
}

export function buildBoatViewModels({ transportadoras = [], eventos = [] }) {
  const eventosPorTransportadora = new Map();
  (eventos || []).forEach((evento) => {
    const transportadoraId = resolveTransportadoraFromRecord(evento).transportadora_id;
    if (!transportadoraId) return;
    if (!eventosPorTransportadora.has(transportadoraId)) {
      eventosPorTransportadora.set(transportadoraId, []);
    }
    eventosPorTransportadora.get(transportadoraId).push(evento);
  });

  return (transportadoras || []).map((item) => {
    const eventosRelacionados = (eventosPorTransportadora.get(item.id) || [])
      .sort((a, b) => new Date(a.data_saida_origem || 0) - new Date(b.data_saida_origem || 0));

    const proximoEvento = eventosRelacionados.find((evento) => {
      if (!evento.data_chegada_destino) return false;
      return parseStableDate(evento.data_chegada_destino) >= new Date();
    }) || eventosRelacionados[0];

    return {
      ...item,
      status: item.ativo === false ? 'inativa' : 'ativa',
      proximo_eta: proximoEvento?.data_chegada_destino ? format(parseStableDate(proximoEvento.data_chegada_destino), 'dd/MM/yyyy', { locale: ptBR }) : '-',
      recorrencia: item.saida_referencia || '-',
      eventos: eventosRelacionados
        .filter((evento) => (evento.total_embarques_relacionados || 0) > 0)
        .map((evento) => ({
          id: evento.id,
          titulo: evento.nome || `${item.nome} · ${evento.codigo}`,
          codigo: evento.codigo || '-',
          data: formatDate(evento.data_saida_origem),
          cargas: evento.total_embarques_relacionados || 0,
          freteValor: evento.tem_conta_frete
            ? (evento.lancamento_financeiro_valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : 'Frete pendente',
          financeiroStatus: evento.lancamento_financeiro_status === 'Pago' ? 'pago' : evento.tem_conta_frete ? 'vinculado' : 'sem_conta',
          pagamentoLabel: evento.tem_conta_frete ? (evento.lancamento_financeiro_status || 'Conta vinculada') : 'Sem conta',
          embarques: evento.embarques_relacionados || [],
          anexos: [],
        })),
      timeline: eventosRelacionados.flatMap((evento) => ([
        {
          label: 'Chegada em Manaus',
          data: formatDate(evento.data_chegada_manaus),
          status: evento.data_chegada_manaus ? 'Planejado' : 'Sem data',
          dayLabel: evento.data_chegada_manaus ? format(parseStableDate(evento.data_chegada_manaus), 'dd', { locale: ptBR }) : '--',
          hasLinked: Boolean(evento.total_embarques_relacionados),
          linkedCount: evento.total_embarques_relacionados || 0,
        },
        {
          label: 'Saída de Manaus',
          data: formatDate(evento.data_saida_origem),
          status: evento.data_saida_origem ? 'Planejado' : 'Sem data',
          dayLabel: evento.data_saida_origem ? format(parseStableDate(evento.data_saida_origem), 'dd', { locale: ptBR }) : '--',
          hasLinked: Boolean(evento.total_embarques_relacionados),
          linkedCount: evento.total_embarques_relacionados || 0,
        },
        {
          label: 'ETA Tabatinga',
          data: formatDate(evento.data_chegada_destino),
          status: evento.data_chegada_destino ? 'Planejado' : 'Sem data',
          dayLabel: evento.data_chegada_destino ? format(parseStableDate(evento.data_chegada_destino), 'dd', { locale: ptBR }) : '--',
          hasLinked: Boolean(evento.total_embarques_relacionados),
          linkedCount: evento.total_embarques_relacionados || 0,
        }
      ])),
      itinerario_real: eventosRelacionados.flatMap((evento) => ([
        {
          id: `${evento.id}-manaus`,
          etapa: 'Chegada em Manaus',
          data: formatDate(evento.data_chegada_manaus),
          tipo: 'passada',
        },
        {
          id: `${evento.id}-saida`,
          etapa: 'Saída de Manaus',
          data: formatDate(evento.data_saida_origem),
          tipo: 'atual',
        },
        {
          id: `${evento.id}-tabatinga`,
          etapa: 'ETA Tabatinga',
          data: formatDate(evento.data_chegada_destino),
          tipo: 'futura',
        }
      ])),
    };
  });
}