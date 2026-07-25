/**
 * Quarter Master UI — Gestão Modular de Acessos
 * Vincula e-mail de login → PerfilDeAcesso (template) + overrides individuais
 */
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/components/ui/notify';
import {
  Users, Shield, ChevronRight, ChevronDown, Search,
  UserPlus, Pencil, X, Check, ArrowLeft, AlertCircle,
  Monitor, LayoutDashboard, TrendingUp, Package, DollarSign,
  BookOpen, Settings, Eye, Lock
} from 'lucide-react';
import { MODULOS, contarPermissoes, getPermissao, setPermissao } from './PerfilFormTela';
import { resolverPermissoes } from './usePermissoesResolvidas';

// ─── Mapa de ícones ──────────────────────────────────────────────────────────
const MODULO_ICONS = {
  pdv: Monitor, dashboard: LayoutDashboard, vendas: TrendingUp,
  estoque: Package, financeiro: DollarSign, relatorios: BookOpen,
  configuracoes: Settings,
};

// ─── Avatar Inicial ──────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sizeClass} rounded-xl bg-muted flex items-center justify-center font-semibold text-muted-foreground flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Painel de Override Individual ───────────────────────────────────────────
function OverridePanel({ modulo, perfilBase, overrides, onChange }) {
  const [expandido, setExpandido] = useState(false);
  const Icon = MODULO_ICONS[modulo.key] || Shield;

  // Contar quantos overrides estão ativos neste módulo
  const qtdOverrides = Object.entries(overrides || {}).filter(([k]) => k.startsWith(`${modulo.key}.`)).length;

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">{modulo.label}</span>
          {qtdOverrides > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono">
              {qtdOverrides} override{qtdOverrides > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expandido ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expandido && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-0.5">
          {/* Header das colunas */}
          <div className="grid grid-cols-[1fr_56px_56px_56px] items-center gap-1 px-2 pb-1.5">
            <div />
            <span className="text-[10px] text-center text-muted-foreground font-medium">PERFIL</span>
            <span className="text-[10px] text-center text-amber-500 font-medium">+ADD</span>
            <span className="text-[10px] text-center text-red-400 font-medium">-REM</span>
          </div>

          {modulo.permissoes.map(perm => {
            const chaveBase = `${modulo.key}.${perm.key}`;
            const overrideAdd = overrides?.[`${chaveBase}`] === true;
            const overrideRem = overrides?.[`${chaveBase}`] === false;
            const hasOverride = `${chaveBase}` in (overrides || {});

            // Valor do perfil base
            let valorBase = false;
            if (perm.tipo === 'ver_editar') {
              valorBase = perfilBase?.[modulo.key]?.[perm.key]?.ver || perfilBase?.[modulo.key]?.[perm.key]?.editar;
            } else {
              valorBase = perfilBase?.[modulo.key]?.[perm.key] === true;
            }

            const handleAdd = () => {
              const novos = { ...(overrides || {}) };
              if (overrideAdd) {
                delete novos[chaveBase]; // remove override
              } else {
                novos[chaveBase] = true;
              }
              onChange(novos);
            };

            const handleRemove = () => {
              const novos = { ...(overrides || {}) };
              if (overrideRem) {
                delete novos[chaveBase];
              } else {
                novos[chaveBase] = false;
              }
              onChange(novos);
            };

            return (
              <div key={perm.key} className="grid grid-cols-[1fr_56px_56px_56px] items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-muted/20 transition-colors">
                <span className="text-xs text-muted-foreground">{perm.label}</span>

                {/* Valor do perfil base (read-only) */}
                <div className="flex justify-center">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${valorBase ? 'bg-muted dark:bg-muted' : ''}`}>
                    {valorBase && <Check className="w-2.5 h-2.5 text-muted-foreground" />}
                  </div>
                </div>

                {/* Override: adicionar */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      overrideAdd
                        ? 'bg-green-500 text-white'
                        : 'border border-border/40 text-muted-foreground hover:border-green-400 hover:text-green-400'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>

                {/* Override: remover */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleRemove}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      overrideRem
                        ? 'bg-red-400 text-white'
                        : 'border border-border/40 text-muted-foreground hover:border-red-400 hover:text-red-400'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tela de edição de acesso de um usuário ───────────────────────────────────
function EditarAcessoUsuario({ usuario, perfis, onSalvar, onCancelar }) {
  const [perfilId, setPerfilId] = useState(usuario.perfil_acesso_id || '');
  const [overrides, setOverrides] = useState(usuario.override_permissoes || {});
  const [saving, setSaving] = useState(false);

  const perfilSelecionado = perfis.find(p => p.id === perfilId);
  const permissoesBase = perfilSelecionado?.permissoes || {};
  const permissoesFinais = resolverPermissoes(perfilSelecionado, overrides);
  const qtdOverrides = Object.keys(overrides).length;

  const handleSalvar = async () => {
    setSaving(true);
    await onSalvar(usuario.id, {
      perfil_acesso_id: perfilId,
      perfil_acesso_nome: perfilSelecionado?.nome || '',
      override_permissoes: overrides
    });
    setSaving(false);
  };

  const limparOverrides = () => setOverrides({});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <button onClick={onCancelar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <Avatar name={usuario.full_name} size="sm" />
            <div>
              <p className="text-sm font-semibold text-foreground">{usuario.full_name}</p>
              <p className="text-xs text-muted-foreground">{usuario.email}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {qtdOverrides > 0 && (
            <button onClick={limparOverrides} className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400">
              Limpar {qtdOverrides} override{qtdOverrides > 1 ? 's' : ''}
            </button>
          )}
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={saving}
            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground"
          >
            {saving ? 'Salvando...' : 'Salvar Acesso'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Coluna esquerda: selecionar template */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">TEMPLATE DE ACESSO</p>
            <div className="space-y-1.5">
              {perfis.filter(p => p.ativo).map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPerfilId(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    perfilId === p.id
                      ? 'bg-muted text-foreground dark:bg-muted dark:text-foreground'
                      : 'bg-card shadow-sm hover:shadow text-foreground/90'
                  }`}
                >
                  <Shield className={`w-4 h-4 flex-shrink-0 ${perfilId === p.id ? 'text-primary-foreground dark:text-foreground/90' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    {p.descricao && <p className={`text-xs truncate mt-0.5 ${perfilId === p.id ? 'text-muted-foreground dark:text-muted-foreground' : 'text-muted-foreground'}`}>{p.descricao}</p>}
                  </div>
                  {perfilId === p.id && <Check className="w-3.5 h-3.5 flex-shrink-0 text-foreground/90" />}
                </button>
              ))}
              {perfis.length === 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">Nenhum perfil ativo. Crie perfis em "Perfis de Acesso".</p>
                </div>
              )}
            </div>
          </div>

          {/* Resumo das permissões finais */}
          {perfilSelecionado && (
            <div className="bg-muted/50 rounded-xl p-3 shadow-sm space-y-2">
              <p className="text-xs text-muted-foreground font-medium">ACESSO RESULTANTE</p>
              {MODULOS.map(m => {
                const { ativas, total } = contarPermissoes(permissoesFinais, m.key);
                if (total === 0) return null;
                const Icon = MODULO_ICONS[m.key] || Shield;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1">{m.label}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${ativas > 0 ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {ativas}/{total}
                    </span>
                  </div>
                );
              })}
              {qtdOverrides > 0 && (
                <div className="pt-1.5 border-t border-border/40">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ↑ {qtdOverrides} override{qtdOverrides > 1 ? 's' : ''} individual{qtdOverrides > 1 ? 'is' : ''} aplicado{qtdOverrides > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita: overrides individuais */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs text-muted-foreground font-medium tracking-wide">OVERRIDES INDIVIDUAIS</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted dark:bg-muted flex items-center justify-center">
                  <Check className="w-2 h-2 text-muted-foreground" />
                </div>
                <span>Perfil base</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500 flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
                <span>Adicionar</span>
              </div>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-400 flex items-center justify-center">
                  <X className="w-2 h-2 text-white" />
                </div>
                <span>Remover</span>
              </div>
            </div>
          </div>

          {!perfilSelecionado ? (
            <div className="bg-card rounded-xl shadow-sm p-8 text-center">
              <Shield className="w-8 h-8 text-muted-foreground dark:text-foreground/90 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Selecione um template para configurar overrides</p>
            </div>
          ) : (
            MODULOS.map(modulo => (
              <OverridePanel
                key={modulo.key}
                modulo={modulo}
                perfilBase={permissoesBase}
                overrides={overrides}
                onChange={setOverrides}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function UsuariosManager() {
  const [usuarios, setUsuarios] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null); // null = lista, objeto = usuário
  const [busca, setBusca] = useState('');

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    const [u, p] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.PerfilDeAcesso.list()
    ]);
    setUsuarios(u);
    setPerfis(p);
    setLoading(false);
  };

  const handleSalvarAcesso = async (userId, dados) => {
    await base44.auth.updateMe
      ? null // não podemos usar updateMe para outros usuários
      : null;
    await base44.entities.User.update(userId, dados);
    notify.success('Acesso atualizado', 'Permissões salvas com sucesso.');
    setEditando(null);
    carregarDados();
  };

  const usuariosFiltrados = useMemo(() => {
    if (!busca.trim()) return usuarios;
    const q = busca.toLowerCase();
    return usuarios.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.perfil_acesso_nome?.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  // ── Modo edição ─────────────────────────────────────────────────────────
  if (editando) {
    return (
      <EditarAcessoUsuario
        usuario={editando}
        perfis={perfis}
        onSalvar={handleSalvarAcesso}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  // ── Lista de usuários ────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 border-2 border-border/40 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Quarter Master — Gestão de Acessos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Vincule e-mails de login a perfis de acesso e configure overrides individuais</p>
        </div>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-lg font-mono">
          {usuarios.length} usuários
        </span>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou perfil..."
          className="pl-8 h-9 bg-card border-0 shadow-sm text-sm"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {usuariosFiltrados.map(usuario => {
          const perfil = perfis.find(p => p.id === usuario.perfil_acesso_id);
          const overrides = usuario.override_permissoes || {};
          const qtdOverrides = Object.keys(overrides).length;
          const isAdmin = usuario.role === 'admin';

          // Calcular % de permissões ativas
          const permissoesFinais = resolverPermissoes(perfil, overrides);
          const totalAtivas = MODULOS.reduce((acc, m) => acc + contarPermissoes(permissoesFinais, m.key).ativas, 0);
          const totalGeral = MODULOS.reduce((acc, m) => acc + contarPermissoes(permissoesFinais, m.key).total, 0);
          const pct = isAdmin ? 100 : (totalGeral > 0 ? (totalAtivas / totalGeral) * 100 : 0);

          return (
            <div key={usuario.id} className="bg-card rounded-xl shadow-sm p-4 flex items-center gap-4">
              <Avatar name={usuario.full_name} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{usuario.full_name || usuario.email}</p>
                  {isAdmin && (
                    <span className="text-[10px] bg-background dark:bg-muted text-foreground px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{usuario.email}</p>
                
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {isAdmin ? (
                    <span className="text-xs text-muted-foreground">Acesso total ao sistema</span>
                  ) : perfil ? (
                    <>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {perfil.nome}
                      </span>
                      {qtdOverrides > 0 && (
                        <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md">
                          {qtdOverrides} override{qtdOverrides > 1 ? 's' : ''}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-muted/400 dark:bg-muted-foreground/40 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{totalAtivas}/{totalGeral}</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Sem perfil atribuído
                    </span>
                  )}
                </div>
              </div>

              {!isAdmin && (
                <button
                  onClick={() => setEditando(usuario)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground transition-colors flex-shrink-0"
                  title="Configurar acesso"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {usuariosFiltrados.length === 0 && (
          <div className="bg-card rounded-xl shadow-sm py-12 text-center">
            <Users className="w-8 h-8 text-muted-foreground dark:text-foreground/90 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {busca ? `Nenhum resultado para "${busca}"` : 'Nenhum usuário encontrado'}
            </p>
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div className="bg-muted/50/50 rounded-xl p-3 flex gap-2.5 items-start">
        <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Novos usuários são adicionados automaticamente após realizarem login/cadastro. 
          Atribua um perfil de acesso para definir o que cada usuário poderá ver e operar no sistema.
        </p>
      </div>
    </div>
  );
}