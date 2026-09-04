import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  CalendarClock,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format, subDays } from 'date-fns';
import { dataHoje, fimDiaSistemaISO, inicioDiaSistemaISO } from '@/components/utils/dateUtils';
import { fetchLancamentosFinanceirosPeriodo } from '@/lib/fetchLancamentosFinanceirosFluxo';
import { getDataChaveLancamento } from '@/lib/financialUtils';
import { codigoOrdemLancamento } from '@/lib/lancamentoOrdemMeta';
import {
  lerPreferenciasCorteHistorico,
  passaFiltroCorteHistorico,
  periodoRangeFinanceiro,
} from '@/lib/filtroDataFinanceiro';

const PAGE_SIZE = 800;

function dedupPorId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

function ordenarMaisRecentes(lista) {
  return [...lista].sort((a, b) => {
    const ca = codigoOrdemLancamento(a) || '';
    const cb = codigoOrdemLancamento(b) || '';
    if (ca && cb && ca !== cb) return cb.localeCompare(ca);
    const da = getDataChaveLancamento(a) || a.data_pagamento || a.data_vencimento || '';
    const db = getDataChaveLancamento(b) || b.data_pagamento || b.data_vencimento || '';
    return db.localeCompare(da);
  });
}

function intervaloBuscaPeriodo(periodo) {
  const hoje = dataHoje();
  if (periodo === 'hoje') return { dataInicio: hoje, dataFim: hoje };
  if (periodo === 'semana') {
    const inicio = format(subDays(new Date(`${hoje}T12:00:00`), 6), 'yyyy-MM-dd');
    return { dataInicio: inicio, dataFim: hoje };
  }
  if (periodo === 'mes') {
    const { s, e } = periodoRangeFinanceiro('mes', null, null);
    return {
      dataInicio: format(s, 'yyyy-MM-dd'),
      dataFim: format(e, 'yyyy-MM-dd'),
    };
  }
  const { dataCorte } = lerPreferenciasCorteHistorico();
  return { dataInicio: dataCorte || hoje, dataFim: hoje };
}

async function buscarLancamentosPeriodo({ dataInicio, dataFim, limit = PAGE_SIZE }) {
  const [porPeriodo, porLancamento, porCriacao] = await Promise.all([
    fetchLancamentosFinanceirosPeriodo({ dataInicio, dataFim, limit }).catch(() => []),
    base44.entities.LancamentoFinanceiro.filter(
      { data_lancamento: { $gte: inicioDiaSistemaISO(dataInicio), $lte: fimDiaSistemaISO(dataFim) } },
      '-data_lancamento',
      limit,
    ).catch(() => []),
    base44.entities.LancamentoFinanceiro.filter(
      { created_date: { $gte: inicioDiaSistemaISO(dataInicio), $lte: fimDiaSistemaISO(dataFim) } },
      '-created_date',
      limit,
    ).catch(() => []),
  ]);
  return dedupPorId([...(porPeriodo || []), ...(porLancamento || []), ...(porCriacao || [])]);
}

function queryPriorizaValor(queryRaw, valorSugerido) {
  const q = String(queryRaw || '').trim();
  if (!q || valorSugerido == null) return q;
  const alvo = Number(valorSugerido);
  if (!Number.isFinite(alvo)) return q;
  const nQ = parseValorBusca(q);
  if (nQ != null && Math.abs(nQ - alvo) < 0.009) return '';
  const formatted = alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (q.replace(/\s/g, '') === formatted.replace(/\s/g, '')) return '';
  return q;
}

function passaFiltroPeriodoLancamento(l, periodo) {
  if (periodo === 'todas') return true;
  const { dataInicio, dataFim } = intervaloBuscaPeriodo(periodo);
  const key = getDataChaveLancamento(l);
  if (!key) return false;
  return key >= dataInicio && key <= dataFim;
}

function labelPeriodoAtivo(periodo) {
  if (periodo === 'hoje') return 'de hoje';
  if (periodo === 'semana') return 'dos últimos 7 dias';
  if (periodo === 'mes') return 'do mês';
  return 'recentes';
}

/** Extrai número monetário de texto livre (ex.: "150,90", "R$ 100"). */
function parseValorBusca(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/r\$\s*/gi, '')
    .replace(/\s/g, '');
  if (!s || !/\d/.test(s)) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatVencimentoBR(dataVenc) {
  if (!dataVenc) return '';
  try {
    return format(new Date(`${String(dataVenc).slice(0, 10)}T12:00:00`), 'dd/MM/yyyy');
  } catch {
    return String(dataVenc);
  }
}

function getDataExibicaoLancamento(l) {
  const key = getDataChaveLancamento(l);
  if (key) return formatVencimentoBR(key);
  if (l?.data_pagamento) return formatVencimentoBR(l.data_pagamento);
  return formatVencimentoBR(l?.data_vencimento);
}

function lancamentoMatchesSearch(l, qRaw) {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;

  const textHit =
    (l.descricao || '').toLowerCase().includes(q) ||
    (l.terceiro_nome || '').toLowerCase().includes(q) ||
    (l.categoria || '').toLowerCase().includes(q) ||
    (l.conta_financeira_nome || '').toLowerCase().includes(q) ||
    (l.referencia_numero || '').toLowerCase().includes(q) ||
    (l.id || '').toLowerCase().includes(q) ||
    (Array.isArray(l.tags) ? l.tags : []).some((t) => String(t).toLowerCase().includes(q));

  if (textHit) return true;

  const br = formatVencimentoBR(l.data_vencimento).toLowerCase();
  const iso = (l.data_vencimento || '').slice(0, 10).toLowerCase();
  if (br.includes(q) || iso.includes(q) || q.split(/[./-]/).some((part) => part && (br.includes(part) || iso.includes(part)))) {
    return true;
  }

  const nQ = parseValorBusca(qRaw);
  if (nQ != null) {
    const v = Number(l.valor) || 0;
    if (Math.abs(v - nQ) < 0.009) return true;
    const formatted = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (formatted.replace(/\s/g, '').includes(qRaw.replace(/\s/g, ''))) return true;
  }

  return false;
}

function isVencido(l) {
  const todayKey = dataHoje();
  const paid = l.status === 'Pago' || l.data_pagamento;
  if (paid) return false;
  return Boolean(l.data_vencimento && l.data_vencimento.slice(0, 10) < todayKey);
}

function filtrosAuxiliares(l, { filterTipo, filterStatus, filterPrazo }) {
  if (filterTipo !== 'todos' && l.tipo !== filterTipo) return false;

  if (filterStatus !== 'todos') {
    if (filterStatus === 'Vencido') {
      if (!(l.status === 'Vencido' || isVencido(l))) return false;
    } else if (l.status !== filterStatus) {
      return false;
    }
  }

  if (filterPrazo === 'vencidas') {
    if (!isVencido(l)) return false;
  } else if (filterPrazo === 'em_dia') {
    const paid = l.status === 'Pago' || l.data_pagamento;
    if (!paid && isVencido(l)) return false;
  }

  return true;
}

function FilterChipRow({ label, icon: Icon, options, value, onChange }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`rounded-full px-3 py-2 text-xs font-medium transition-all md:text-sm ${
                active
                  ? 'bg-primary/15 text-foreground ring-1 ring-primary/40 dark:bg-muted dark:ring-primary/45'
                  : 'bg-muted text-muted-foreground shadow-sm dark:bg-card dark:text-muted-foreground dark:ring-1 dark:ring-border'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function priorizarPorValorSugerido(lista, valorSugerido) {
  const alvo = Number(valorSugerido);
  if (!Number.isFinite(alvo) || alvo <= 0) return lista;
  return [...lista].sort((a, b) => {
    const diffA = Math.abs((Number(a.valor) || 0) - alvo);
    const diffB = Math.abs((Number(b.valor) || 0) - alvo);
    const exatoA = diffA < 0.009 ? 0 : 1;
    const exatoB = diffB < 0.009 ? 0 : 1;
    if (exatoA !== exatoB) return exatoA - exatoB;
    if (diffA !== diffB) return diffA - diffB;
    return 0;
  });
}

export default function BuscarLancamentoSheet({
  onSelecionar,
  onVoltar,
  uploadando,
  queryInicial = '',
  valorSugerido = null,
}) {
  const [query, setQuery] = useState(() => String(queryInicial || '').trim());
  const [cache, setCache] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPeriodo, setFilterPeriodo] = useState('hoje');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterPrazo, setFilterPrazo] = useState('todos');
  const preferenciasCorte = useMemo(() => lerPreferenciasCorteHistorico(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const { dataInicio, dataFim } = intervaloBuscaPeriodo(filterPeriodo);
        const todos = await buscarLancamentosPeriodo({ dataInicio, dataFim, limit: PAGE_SIZE });
        if (cancelled) return;
        const lista = Array.isArray(todos) ? todos : [];
        const aposCorte = lista.filter((l) =>
          passaFiltroCorteHistorico(getDataChaveLancamento(l), preferenciasCorte),
        );
        setCache(ordenarMaisRecentes(aposCorte));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setErro(e?.message || 'Não foi possível carregar os lançamentos.');
          setCache([]);
        }
      } finally {
        if (!cancelled) setCarregando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterPeriodo, preferenciasCorte]);

  const hasActiveFilters =
    filterPeriodo !== 'hoje' ||
    filterTipo !== 'todos' ||
    filterStatus !== 'todos' ||
    filterPrazo !== 'todos';

  useEffect(() => {
    const q = String(queryInicial || '').trim();
    if (q) setQuery(q);
  }, [queryInicial]);

  const lancamentos = useMemo(() => {
    const queryEfetiva = queryPriorizaValor(query, valorSugerido);
    const filtrados = cache
      .filter((l) => passaFiltroPeriodoLancamento(l, filterPeriodo))
      .filter((l) => filtrosAuxiliares(l, { filterTipo, filterStatus, filterPrazo }))
      .filter((l) => lancamentoMatchesSearch(l, queryEfetiva));
    if (!queryEfetiva.trim() && valorSugerido != null) {
      return priorizarPorValorSugerido(filtrados, valorSugerido);
    }
    return ordenarMaisRecentes(filtrados);
  }, [cache, query, filterPeriodo, filterTipo, filterStatus, filterPrazo, valorSugerido]);

  const limparFiltros = () => {
    setFilterPeriodo('hoje');
    setFilterTipo('todos');
    setFilterStatus('todos');
    setFilterPrazo('todos');
    setQuery('');
  };

  const handleConfirmar = () => {
    if (selecionado) onSelecionar(selecionado);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 px-5 pb-6 pt-4">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted dark:bg-muted dark:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-foreground/90 dark:text-foreground">Selecionar lançamento</p>
      </div>

      <div className="shrink-0 rounded-[20px] bg-[#EEF1F4] p-2.5 dark:bg-muted/40">
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-card px-3 dark:bg-card dark:ring-1 dark:ring-border">
            <Search className="h-4 w-4 flex-none text-muted-foreground dark:text-muted-foreground" />
            <input autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, valor, vencimento (dd/mm)…"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground dark:text-foreground dark:placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} className="shrink-0">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card dark:bg-card dark:ring-1 dark:ring-border"
          >
            <SlidersHorizontal className="h-4 w-4 text-foreground" />
            {hasActiveFilters ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                ·
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex items-center justify-between px-1 pt-2">
          <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            {lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''} {labelPeriodoAtivo(filterPeriodo)}
          </p>
          {(hasActiveFilters || query) && (
            <button type="button" onClick={limparFiltros} className="flex items-center gap-1 text-[11px] text-muted-foreground dark:text-muted-foreground">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {erro && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}
        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lancamentos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground dark:text-muted-foreground">
            {cache.length === 0
              ? filterPeriodo === 'hoje'
                ? 'Nenhum lançamento de hoje. Amplie o período nos filtros ou crie um lançamento no Financeiro.'
                : 'Nenhum lançamento neste período. Tente ampliar o filtro ou crie um lançamento no Financeiro.'
              : query
                ? `Nenhum lançamento ${labelPeriodoAtivo(filterPeriodo)} corresponde à busca. Limpe a busca ou amplie o período.`
                : 'Nenhum lançamento corresponde aos filtros.'}
          </p>
        ) : (
          lancamentos.map((l) => (
            <LancamentoItem
              key={l.id}
              lancamento={l}
              selecionado={selecionado?.id === l.id}
              onClick={() => setSelecionado(l)}
            />
          ))
        )}
      </div>

      {selecionado && (
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={uploadando}
          className="mt-auto flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {uploadando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Vincular ao lançamento
            </>
          )}
        </button>
      )}

      {filterOpen && (
        <div
          className="fixed inset-0 z-[60000] flex flex-col justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros de lançamentos"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="max-h-[78vh] space-y-5 overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-4 pb-6 pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <p className="font-glacial text-lg font-semibold text-foreground">Filtros</p>
            <FilterChipRow
              label="Período"
              icon={CalendarClock}
              value={filterPeriodo}
              onChange={setFilterPeriodo}
              options={[
                { id: 'hoje', label: 'Hoje' },
                { id: 'semana', label: '7 dias' },
                { id: 'mes', label: 'Mês' },
                { id: 'todas', label: 'Todas' },
              ]}
            />
            <FilterChipRow
              label="Tipo"
              icon={BarChart3}
              value={filterTipo}
              onChange={setFilterTipo}
              options={[
                { id: 'todos', label: 'Todas' },
                { id: 'Despesa', label: 'Despesa' },
                { id: 'Receita', label: 'Receita' },
                { id: 'Transferência', label: 'Transferência' },
              ]}
            />
            <FilterChipRow
              label="Situação"
              icon={RefreshCw}
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { id: 'todos', label: 'Todas' },
                { id: 'Em Aberto', label: 'Em aberto' },
                { id: 'Pago', label: 'Pago' },
                { id: 'Vencido', label: 'Vencido / atrasado' },
                { id: 'Cancelado', label: 'Cancelado' },
              ]}
            />
            <FilterChipRow
              label="Prazo"
              icon={CalendarClock}
              value={filterPrazo}
              onChange={setFilterPrazo}
              options={[
                { id: 'todos', label: 'Todas' },
                { id: 'vencidas', label: 'Vencidas' },
                { id: 'em_dia', label: 'Em dia' },
              ]}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFilterPeriodo('hoje');
                  setFilterTipo('todos');
                  setFilterStatus('todos');
                  setFilterPrazo('todos');
                }}
                className="h-11 flex-1 rounded-2xl bg-muted text-sm text-muted-foreground"
              >
                Redefinir filtros
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="h-11 flex-1 rounded-2xl bg-primary text-sm font-medium text-primary-foreground"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LancamentoItem({ lancamento, selecionado, onClick }) {
  const isReceita = lancamento.tipo === 'Receita';
  const valor = (lancamento.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const Icon = isReceita ? ArrowDownLeft : ArrowUpRight;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${
        selecionado
          ? 'bg-primary/15 ring-2 ring-primary/40 dark:bg-muted dark:ring-primary/45'
          : 'bg-card shadow-sm dark:border dark:border-border dark:bg-card'
      }`}
    >
      <div
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
          selecionado ? 'bg-primary/20 dark:bg-background/50' : 'bg-muted dark:bg-muted'
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            selecionado ? 'text-primary dark:text-primary' : isReceita ? 'text-green-500' : 'text-red-400'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${selecionado ? 'text-foreground' : 'text-foreground'}`}>
          {lancamento.descricao || '—'}
        </p>
        <p className={`mt-0.5 text-xs ${selecionado ? 'text-muted-foreground' : 'text-muted-foreground dark:text-muted-foreground'}`}>
          {getDataExibicaoLancamento(lancamento) || '—'}
          {lancamento.status && ` · ${lancamento.status}`}
        </p>
      </div>
      <span
        className={`flex-none text-sm font-semibold ${
          selecionado ? 'text-foreground' : isReceita ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
        }`}
      >
        R$ {valor}
      </span>
    </button>
  );
}
