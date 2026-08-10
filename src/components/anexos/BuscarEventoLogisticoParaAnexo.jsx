import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Anchor,
  Link2,
  Ship,
  Banknote,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildFluvialEvents } from '@/components/logistica-sandbox/fluvialDataUtils';

/** Junta produção + sandbox (o itinerário na app usa EventoLogisticoSandbox; anexos podiam só ler EventosLogisticos e ficar vazio). */
function unificarEventosLogisticos(fromProd = [], fromSandbox = []) {
  const mapa = new Map();
  for (const ev of fromProd) {
    if (ev?.id) mapa.set(ev.id, ev);
  }
  for (const ev of fromSandbox) {
    if (ev?.id && !mapa.has(ev.id)) mapa.set(ev.id, ev);
  }
  return Array.from(mapa.values());
}

function montarTextoBusca(ev) {
  const emb = ev.embarques_relacionados || [];
  const extras = emb.flatMap((e) =>
    [e.codigo, e.fornecedor_nome, e.pedido_compra_id, e.numero_pedido, e.observacao].filter(Boolean)
  );
  return [
    ev.codigo,
    ev.embarcacao_nome,
    ev.status,
    ev.transportadora_nome,
    ev.rota_nome,
    ev.data_chegada_destino_formatada,
    ev.data_saida_manaus_formatada,
    ev.data_chegada_manaus_formatada,
    ev.data_retorno_origem_formatada,
    extras.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Linha do tempo compacta: perspectiva chegada em Tabatinga + datas Manaus */
function TimelineViagemFluvial({ ev }) {
  const emb = ev.embarques_relacionados || [];
  const steps = [
    {
      key: 'manaus',
      label: 'Manaus',
      sub: 'Chegada',
      data: ev.data_chegada_manaus_formatada || '—',
    },
    {
      key: 'saida',
      label: 'Manaus',
      sub: 'Saída',
      data: ev.data_saida_manaus_formatada || '—',
    },
    {
      key: 'tab',
      label: 'Tabatinga',
      sub: 'Chegada (ETA)',
      data: ev.data_chegada_destino_formatada || '—',
      highlight: true,
    },
  ];

  const temEmb = (ev.total_embarques_relacionados || 0) > 0;
  const temFrete = Boolean(ev.tem_conta_frete);

  return (
    <div className="mt-3 space-y-2">
      <div className="relative flex gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 ? (
              <div
                className={`mx-0.5 mt-5 h-px min-w-[12px] flex-1 ${s.highlight ? 'bg-emerald-400/80 dark:bg-emerald-500/70' : 'bg-muted dark:bg-muted'}`}
              />
            ) : null}
            <div
              className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-center ${
                s.highlight
                  ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:ring-emerald-800'
                  : 'bg-muted/50/80'
              }`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${s.highlight ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                {s.sub}
              </p>
              <p className={`truncate text-[11px] font-medium ${s.highlight ? 'text-emerald-900 dark:text-emerald-100' : 'text-foreground/90'}`}>
                {s.label}
              </p>
              <p className={`mt-0.5 text-xs tabular-nums ${s.highlight ? 'font-semibold text-emerald-800 dark:text-emerald-200' : 'text-muted-foreground'}`}>
                {s.data}
              </p>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-2 text-[11px] dark:border-border/40">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Ship className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>
            {ev.total_embarques_relacionados || 0} embarque(s)
            {temEmb ? (
              <span className="text-muted-foreground dark:text-muted-foreground">
                {' '}
                · {ev.total_embarques_ativos || 0} ativos · {ev.total_embarques_concluidos || 0} concl.
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400"> · nenhum vínculo</span>
            )}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Banknote className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {temFrete ? (
            <span>
              Frete {ev.lancamento_financeiro_status === 'Pago' ? 'pago' : 'conta vinculada'}
              {ev.lancamento_financeiro_valor != null ? (
                <span className="tabular-nums">
                  {' '}
                  ·{' '}
                  {Number(ev.lancamento_financeiro_valor).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">Frete sem conta</span>
          )}
        </span>
      </div>

      {(ev.resumo_fornecedores?.length > 0 || emb.length > 0) && temEmb ? (
        <div className="rounded-lg bg-muted/40/90 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
            <Link2 className="h-3 w-3" /> Vínculos
          </span>
          <span className="mt-0.5 block">
            {(ev.resumo_fornecedores || [])
              .slice(0, 4)
              .map((r) => r.fornecedor_nome)
              .filter(Boolean)
              .join(' · ') || `${emb.length} processo(s) de embarque`}
            {(ev.resumo_fornecedores || []).length > 4 ? '…' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function BuscarEventoLogisticoParaAnexo({ onSelecionar, onVoltar, uploadando }) {
  const [query, setQuery] = useState('');
  const [eventosEnriquecidos, setEventosEnriquecidos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const inputBuscaRef = useRef(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [fromProd, fromSandbox, embs, lancs] = await Promise.all([
        base44.entities.EventosLogisticos.list('-created_date', 300).catch((err) => {
          console.warn('[BuscarEventoLogistico] EventosLogisticos:', err);
          return [];
        }),
        base44.entities.EventoLogisticoSandbox.list('-data_saida_origem', 500).catch((err) => {
          console.warn('[BuscarEventoLogistico] EventoLogisticoSandbox:', err);
          return [];
        }),
        base44.entities.Embarque.list('-created_date', 1000).catch(() => []),
        base44.entities.LancamentoFinanceiro.filter(
          { referencia_tipo: 'EventosLogisticos' },
          '-created_date',
          800
        ).catch(() => []),
      ]);
      const todos = unificarEventosLogisticos(fromProd || [], fromSandbox || []);
      const built = buildFluvialEvents({
        eventosLogisticos: todos,
        embarques: embs || [],
        lancamentosFinanceiros: lancs || [],
      });
      setEventosEnriquecidos(built);
    } catch (e) {
      console.error(e);
      setErro(e?.message || 'Não foi possível carregar as viagens.');
      setEventosEnriquecidos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  /** Foco na barra ao abrir o painel — “busca ativada”. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      inputBuscaRef.current?.focus({ preventScroll: false });
    }, 100);
    return () => window.clearTimeout(id);
  }, []);

  const eventosFiltrados = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return eventosEnriquecidos;
    return eventosEnriquecidos.filter((ev) => montarTextoBusca(ev).includes(q));
  }, [eventosEnriquecidos, query]);

  const handleSearchChange = (e) => {
    setQuery(e.target.value);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 px-5 pb-6 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground/90">Viagem / frete fluvial</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            Linha do tempo com ETA em Tabatinga e vínculos (embarques / frete)
          </p>
        </div>
        <button
          type="button"
          title="Recarregar lista de viagens"
          onClick={() => carregarDados()}
          disabled={carregando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 dark:bg-muted dark:text-foreground/90 dark:hover:bg-primary/90"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputBuscaRef}
          autoComplete="off"
          autoFocus
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={handleSearchChange}
          placeholder="Código, barco, datas, fornecedor, pedido…"
          className="w-full rounded-2xl border border-transparent bg-card py-3 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none ring-2 ring-border/80 placeholder:text-muted-foreground focus:border-primary/30 focus:ring-primary/35 dark:bg-background dark:text-foreground dark:ring-border/40 dark:focus:ring-primary/40"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        {erro && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}
        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventosFiltrados.length === 0 ? (
          <div className="space-y-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {query.trim()
                ? 'Nenhuma viagem corresponde à busca.'
                : 'Nenhuma viagem encontrada neste momento.'}
            </p>
            {!query.trim() ? (
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
                A lista junta viagens da base principal e da área de itinerário. Se usa o mapa em Logística e não via
                nada aqui, toque em atualizar ou verifique em Compras / Gestão de eventos logísticos.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => carregarDados()}
              disabled={carregando}
              className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 dark:bg-muted dark:text-foreground dark:hover:bg-primary/90"
            >
              <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar lista
            </button>
          </div>
        ) : (
          eventosFiltrados.map((ev) => (
            <button
              type="button"
              key={ev.id}
              onClick={() => setSelecionado(ev)}
              className={`flex w-full flex-col rounded-2xl px-4 py-3 text-left text-sm shadow-sm transition-colors ${
                selecionado?.id === ev.id
                  ? 'bg-primary text-primary-foreground ring-2 ring-border/40 dark:bg-card dark:text-foreground dark:ring-white'
                  : 'bg-card text-foreground dark:bg-background dark:text-foreground'
              }`}
            >
              <div className="flex items-start gap-3">
                <Anchor className="mt-0.5 h-4 w-4 flex-none opacity-70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{ev.codigo || ev.id}</p>
                  <p className="mt-0.5 truncate text-xs opacity-80">{ev.embarcacao_nome || '—'}</p>
                </div>
              </div>
              <TimelineViagemFluvial ev={ev} />
            </button>
          ))
        )}
      </div>

      {selecionado && (
        <button
          type="button"
          onClick={() => onSelecionar(selecionado)}
          disabled={uploadando}
          className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-background text-sm font-semibold text-white dark:bg-card dark:text-foreground"
        >
          {uploadando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Anexar à viagem
            </>
          )}
        </button>
      )}
    </div>
  );
}
