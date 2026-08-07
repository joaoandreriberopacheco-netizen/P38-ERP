import { useMemo, useState } from 'react';
import { Search, Check, ChevronRight, Wallet } from 'lucide-react';

import { searchTextIncludes } from '@/lib/normalizeSearchText';

function ListaBuscaContas({ busca, onBuscaChange, opcoes, value, onSelect, listClassName }) {
  return (
    <>
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoComplete="off"
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar conta..."
          inputMode="search"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border-0 bg-muted pl-11 pr-4 text-base text-foreground outline-none focus:ring-2 focus:ring-border/40"
        />
      </div>

      <div
        className={
          listClassName
          || 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain'
        }
      >
        {opcoes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta encontrada</p>
        ) : (
          opcoes.map((c) => {
            const ativa = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left transition-colors ${
                  ativa ? 'bg-primary text-primary-foreground' : 'bg-card shadow-sm active:bg-muted'
                }`}
              >
                <span className={`truncate text-base font-semibold ${ativa ? '' : 'text-foreground'}`}>
                  {c.nome}
                </span>
                {ativa && <Check className="h-5 w-5 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

/**
 * Seletor de conta financeira otimizado para mobile — texto grande e lista tocável.
 * pickerMode: dentro de bottom sheet — busca fixa no topo, lista scrollável.
 */
export default function SeletorContaMobile({
  contas,
  value,
  onChange,
  label = 'Conta',
  placeholder = 'Selecionar conta',
  excludeIds = [],
  pickerMode = false,
}) {
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState(pickerMode || !value);

  const opcoes = useMemo(() => {
    const base = contas.filter((c) => !excludeIds.includes(c.id));
    const q = busca.trim();
    if (!q) return base;
    return base.filter((c) => searchTextIncludes(c.nome || '', q));
  }, [contas, busca, excludeIds]);

  const selecionada = contas.find((c) => c.id === value);

  const selecionar = (id) => {
    onChange(id);
    setBusca('');
    if (!pickerMode) setExpandido(false);
  };

  if (pickerMode) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <ListaBuscaContas
          busca={busca}
          onBuscaChange={setBusca}
          opcoes={opcoes}
          value={value}
          onSelect={selecionar}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">{label}</p>

      {selecionada && !expandido ? (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-lg font-semibold text-foreground">{selecionada.nome}</p>
            <p className="text-sm text-muted-foreground">Toque para alterar</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <>
          <ListaBuscaContas
            busca={busca}
            onBuscaChange={setBusca}
            opcoes={opcoes}
            value={value}
            onSelect={selecionar}
            listClassName="flex max-h-[min(42vh,320px)] flex-col gap-2 overflow-y-auto overscroll-contain"
          />

          {selecionada && (
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="py-1 text-center text-sm text-muted-foreground"
            >
              Fechar lista
            </button>
          )}
        </>
      )}

      {!selecionada && !expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="h-14 w-full rounded-2xl border border-dashed border-border/50 text-base text-muted-foreground"
        >
          {placeholder}
        </button>
      )}
    </div>
  );
}
