import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { MODULOS } from './PerfilFormTela';
import {
  agruparPermissoesPorModulo,
  getValorPermissao,
  listarPermissoesFolha,
} from '@/lib/moduloPermissoesUtils';
import {
  Monitor, LayoutDashboard, TrendingUp, Package,
  DollarSign, BookOpen, Settings, ClipboardPenLine, Home, Shield,
} from 'lucide-react';

const MODULO_ICONS = {
  homepage: Home,
  pdv: Monitor,
  dashboard: LayoutDashboard,
  vendas: TrendingUp,
  estoque: Package,
  financeiro: DollarSign,
  relatorios: BookOpen,
  consumo_interno: ClipboardPenLine,
  configuracoes: Settings,
};

function OverrideRow({ folha, valorBase, overrides, onChange }) {
  const overrideVal = overrides?.[folha.chave];
  const grantActive = overrideVal === true;
  const denyActive = overrideVal === false;

  const setGrant = () => {
    const next = { ...(overrides || {}) };
    if (grantActive) delete next[folha.chave];
    else next[folha.chave] = true;
    onChange(next);
  };

  const setDeny = () => {
    const next = { ...(overrides || {}) };
    if (denyActive) delete next[folha.chave];
    else next[folha.chave] = false;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-[1fr_44px_44px_44px] items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-muted/30">
      <span className="text-xs text-foreground/90 truncate pr-2" title={folha.label}>
        {folha.label}
      </span>
      <div className="flex justify-center">
        <div className={`h-4 w-4 rounded-md flex items-center justify-center ${valorBase ? 'bg-muted' : 'border border-border/50'}`}>
          {valorBase ? <Check className="h-2.5 w-2.5 text-muted-foreground" /> : null}
        </div>
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={setGrant}
          title="Adicionar ao kit"
          className={`h-5 w-5 rounded-md flex items-center justify-center transition-colors ${
            grantActive
              ? 'bg-emerald-500 text-white'
              : 'border border-border/50 text-muted-foreground hover:border-emerald-400 hover:text-emerald-500'
          }`}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={setDeny}
          title="Remover do kit"
          className={`h-5 w-5 rounded-md flex items-center justify-center transition-colors ${
            denyActive
              ? 'bg-red-500 text-white'
              : 'border border-border/50 text-muted-foreground hover:border-red-400 hover:text-red-500'
          }`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ModuloOverrideCard({ modulo, folhas, permissoesBase, overrides, onChange }) {
  const [expandido, setExpandido] = useState(false);
  const Icon = MODULO_ICONS[modulo.key] || Shield;
  const qtdOverrides = folhas.filter((f) => f.chave in (overrides || {})).length;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm border border-border/30">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground truncate">{modulo.label}</span>
          {qtdOverrides > 0 ? (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded-md flex-shrink-0">
              {qtdOverrides} ajuste{qtdOverrides > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
        {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expandido ? (
        <div className="border-t border-border/40 px-2 pb-3 pt-2">
          <div className="grid grid-cols-[1fr_44px_44px_44px] items-center gap-1 px-2 pb-1.5 text-[10px] text-muted-foreground font-medium">
            <span>Permissão</span>
            <span className="text-center">Perfil</span>
            <span className="text-center text-emerald-600">+Kit</span>
            <span className="text-center text-red-500">−Kit</span>
          </div>
          {folhas.map((folha) => (
            <OverrideRow
              key={folha.chave}
              folha={folha}
              valorBase={getValorPermissao(permissoesBase, folha.chave)}
              overrides={overrides}
              onChange={onChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Ajustes individuais da mochila (override_permissoes).
 * Perfil = kit base; + adiciona; − remove mesmo que o perfil tenha.
 */
export default function UsuarioOverridesPanel({ permissoesBase = {}, overrides, onChange, disabled = false }) {
  const grupos = useMemo(() => agruparPermissoesPorModulo(listarPermissoesFolha()), []);

  if (disabled) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">Utilizadores com papel técnico admin ignoram o kit — acesso total.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
        O <strong>perfil</strong> é o kit padrão. Use <span className="text-emerald-600">+Kit</span> para dar algo extra só a esta pessoa, ou <span className="text-red-500">−Kit</span> para tirar algo que o perfil traz.
      </p>
      {MODULOS.map((modulo) => {
        const folhas = grupos.get(modulo.key);
        if (!folhas?.length) return null;
        return (
          <ModuloOverrideCard
            key={modulo.key}
            modulo={modulo}
            folhas={folhas}
            permissoesBase={permissoesBase}
            overrides={overrides}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}
