import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Search, ChevronDown, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { normalizeDataText } from '@/lib/normalizeDataText';
import { createUppercaseInputChangeHandler } from '@/lib/uppercaseInputHandlers';

// Mini modal para criar categoria rapidamente inline
export function NovaCategoriaInline({ tipo, onCriada, onCancelar }) {
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const cat = await base44.entities.CategoriaFinanceira.create({ nome: normalizeDataText(nome.trim()), tipo, ativa: true });
    toast({ title: `Categoria "${nome}" criada!` });
    onCriada(cat);
    setSaving(false);
  };

  return (
    <div className="mt-2 bg-muted/40 dark:bg-muted rounded-xl p-3 flex gap-2">
      <input autoComplete="off"
        autoFocus
        value={nome}
        onChange={createUppercaseInputChangeHandler((e) => setNome(e.target.value))}
        onKeyDown={e => { if (e.key === 'Enter') handleSalvar(); if (e.key === 'Escape') onCancelar(); }}
        placeholder="Nome da categoria"
        className="flex-1 min-w-0 bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground outline-none p38-data-uppercase"
      />
      <button onClick={handleSalvar} disabled={saving || !nome.trim()}
        className="px-3 py-1.5 rounded-lg bg-card text-card-foreground text-xs font-medium disabled:opacity-40">
        OK
      </button>
      <button onClick={onCancelar} className="p-1.5 rounded-lg hover:bg-muted dark:hover:bg-muted">
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

// Hook para carregar categorias
export function useCategorias() {
  const [categorias, setCategorias] = useState([]);

  const load = async () => {
    const cats = await base44.entities.CategoriaFinanceira.filter({ ativa: true });
    setCategorias(cats);
  };

  React.useEffect(() => { load(); }, []);

  return { categorias, reload: load };
}

// Seletor de categoria com busca incremental
export function SeletorCategoria({ tipo, value, onChange, categorias, onCriada, disabled = false, mobileLarge = false, pickerMode = false }) {
  const [showNova, setShowNova] = useState(false);
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState(pickerMode || mobileLarge || !!value);

  const filtradas = useMemo(() => {
    const doTipo = categorias.filter(c => c.tipo === tipo);
    const q = busca.trim().toLowerCase();
    if (!q) return doTipo;
    return doTipo.filter(c => c.nome.toLowerCase().includes(q));
  }, [categorias, tipo, busca]);

  const selecionar = (nome, id) => {
    onChange(nome, id);
    setBusca('');
    if (!pickerMode) setExpandido(false);
  };

  const listaCategorias = (
    <>
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoComplete="off"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar categoria..."
          className={`w-full rounded-xl border-0 bg-muted pl-9 pr-3 text-foreground outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring ${
            mobileLarge || pickerMode ? 'h-12 text-base' : 'h-10 text-sm'
          }`}
        />
      </div>

      <div
        className={
          pickerMode
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-muted/50 divide-y divide-border/30'
            : 'max-h-44 overflow-y-auto rounded-xl bg-muted/50 divide-y divide-border/30'
        }
      >
        {filtradas.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            {busca.trim() ? 'Nenhuma categoria encontrada' : 'Sem categorias deste tipo'}
          </p>
        ) : (
          filtradas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selecionar(c.nome, c.id)}
              className={`flex w-full items-center justify-between text-left transition-colors hover:bg-muted ${
                mobileLarge || pickerMode ? 'min-h-[56px] rounded-xl px-4 py-4 text-base' : 'px-3 py-2.5 text-sm'
              } ${value === c.nome ? 'bg-muted font-medium' : ''}`}
            >
              <span className="truncate">{c.nome}</span>
              {value === c.nome && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowNova(true)}
        className="flex w-full shrink-0 items-center justify-center gap-1 rounded-xl border border-dashed border-border/40 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground dark:bg-muted"
      >
        <Plus className="h-3 w-3" /> Nova categoria
      </button>
    </>
  );

  if (pickerMode) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        {listaCategorias}
        {showNova && (
          <NovaCategoriaInline
            tipo={tipo}
            onCriada={(cat) => { onCriada(cat); onChange(cat.nome, cat.id); setShowNova(false); }}
            onCancelar={() => setShowNova(false)}
          />
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="bg-card rounded-2xl shadow-sm p-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Categoria</p>
        <p className="text-sm text-foreground">{value || 'Sem categoria'}</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 space-y-2">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
      >
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoria</p>
        <div className="flex items-center gap-2 min-w-0">
          {value && (
            <span className="text-xs font-medium text-foreground truncate max-w-[10rem]">{value}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {value && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary dark:bg-muted text-foreground">
            {value}
            <button type="button" onClick={() => onChange('', '')} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {expandido && (
        <>
          {listaCategorias}
        </>
      )}

      {showNova && !pickerMode && (
        <NovaCategoriaInline
          tipo={tipo}
          onCriada={(cat) => { onCriada(cat); onChange(cat.nome, cat.id); setShowNova(false); setExpandido(false); }}
          onCancelar={() => setShowNova(false)}
        />
      )}
    </div>
  );
}
