import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, AtSign, Check, Lock, Monitor, Shield, Tag,
} from 'lucide-react';
import { MODULOS, contarPermissoes } from './PerfilFormTela';
import UsuarioOverridesPanel from './UsuarioOverridesPanel';
import { resolverPermissoes } from '@/lib/perfilPermissoes';
import {
  Monitor as MonitorIcon, LayoutDashboard, TrendingUp, Package,
  DollarSign, BookOpen, Settings, ClipboardPenLine, Home,
} from 'lucide-react';

const MODULO_ICONS = {
  homepage: Home,
  pdv: MonitorIcon,
  dashboard: LayoutDashboard,
  vendas: TrendingUp,
  estoque: Package,
  financeiro: DollarSign,
  relatorios: BookOpen,
  consumo_interno: ClipboardPenLine,
  configuracoes: Settings,
};

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';
  return (
    <div className={`${sizeClass} rounded-2xl bg-muted flex items-center justify-center font-semibold text-muted-foreground flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function UsuarioKitEditor({
  usuario,
  perfisAcesso,
  contasCaixa,
  tabelasPreco,
  onSalvar,
  onCancelar,
  saving = false,
}) {
  const isAdmin = usuario?.role === 'admin';
  const perfisAtivos = perfisAcesso.filter((p) => p.ativo !== false);

  const [aba, setAba] = useState('kit');
  const [perfilId, setPerfilId] = useState(usuario.perfil_acesso_id || '');
  const [overrides, setOverrides] = useState(usuario.override_permissoes || {});
  const [nickname, setNickname] = useState(usuario.nickname || '');
  const [caixas, setCaixas] = useState(usuario.caixas_pdv_autorizados_ids || []);
  const [tabelaId, setTabelaId] = useState(usuario.tabela_preco_id || '');

  const perfilSelecionado = perfisAtivos.find((p) => p.id === perfilId);
  const permissoesBase = perfilSelecionado?.permissoes || {};
  const permissoesFinais = useMemo(
    () => resolverPermissoes(perfilSelecionado, overrides),
    [perfilSelecionado, overrides]
  );
  const qtdOverrides = Object.keys(overrides || {}).length;

  const toggleCaixa = (id) => {
    setCaixas((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSalvar = () => {
    onSalvar({
      nickname: nickname.trim() || null,
      perfil_acesso_id: perfilId || null,
      perfil_acesso_nome: perfilSelecionado?.nome || null,
      perfil: perfilSelecionado?.nome || usuario.perfil,
      override_permissoes: isAdmin ? {} : overrides,
      caixas_pdv_autorizados_ids: caixas,
      tabela_preco_id: tabelaId || null,
      tabela_preco_nome: tabelasPreco.find((t) => t.id === tabelaId)?.nome_tabela || null,
    });
  };

  const limparOverrides = () => setOverrides({});

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCancelar}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Avatar name={usuario.full_name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{usuario.full_name || '—'}</p>
              {isAdmin ? (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                  <Lock className="w-2.5 h-2.5" /> Admin técnico
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {usuario.login || usuario.email || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isAdmin && qtdOverrides > 0 ? (
            <button
              type="button"
              onClick={limparOverrides}
              className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 px-2"
            >
              Limpar {qtdOverrides} ajuste{qtdOverrides > 1 ? 's' : ''}
            </button>
          ) : null}
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={saving || (!isAdmin && !perfilId)}
            className="h-8 text-xs"
          >
            {saving ? 'A guardar…' : 'Guardar kit'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 w-fit">
        {[
          { id: 'kit', label: 'Kit de acesso' },
          { id: 'operacao', label: 'Operação PDV' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAba(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              aba === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'kit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground tracking-wide mb-2">PERFIL BASE (TEMPLATE)</p>
              {isAdmin ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 p-4 text-xs text-amber-800 dark:text-amber-200">
                  Este utilizador tem papel técnico <strong>admin</strong> — passa em todas as rotas, independente do perfil.
                </div>
              ) : perfisAtivos.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-xl">
                  Crie perfis na aba &quot;Perfis de Acesso&quot; primeiro.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {perfisAtivos.map((p) => {
                    const ativo = perfilId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPerfilId(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                            : 'bg-card border border-border/30 hover:bg-muted/40'
                        }`}
                      >
                        <Shield className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className="text-xs font-medium truncate flex-1">{p.nome}</span>
                        {ativo ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {perfilSelecionado && !isAdmin ? (
              <div className="rounded-2xl bg-muted/30 border border-border/30 p-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground tracking-wide">MOCHILA RESULTANTE</p>
                {MODULOS.map((m) => {
                  const { ativas, total } = contarPermissoes(permissoesFinais, m.key);
                  if (total === 0) return null;
                  const Icon = MODULO_ICONS[m.key] || Shield;
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{m.label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        ativas > 0 ? 'bg-primary/10 text-primary dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {ativas}/{total}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="space-y-2 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground tracking-wide px-1">AJUSTES INDIVIDUAIS</p>
            <UsuarioOverridesPanel
              permissoesBase={permissoesBase}
              overrides={overrides}
              onChange={setOverrides}
              disabled={isAdmin}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5" />
              Apelido nas operações
            </label>
            <Input
              placeholder="Ex: João, Caixa 1…"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Tabela de preço
            </label>
            <Select
              value={tabelaId || '__default__'}
              onValueChange={(v) => setTabelaId(v === '__default__' ? '' : v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tabela padrão do sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">
                  <span className="text-muted-foreground italic text-xs">Tabela padrão</span>
                </SelectItem>
                {tabelasPreco.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome_tabela}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {contasCaixa.length > 0 ? (
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" />
                Caixas PDV autorizados
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {contasCaixa.map((conta) => {
                  const ativo = caixas.includes(conta.id);
                  return (
                    <button
                      key={conta.id}
                      type="button"
                      onClick={() => toggleCaixa(conta.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        ativo ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted/40 hover:bg-muted'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex-shrink-0 border ${ativo ? 'bg-white/20 border-transparent' : 'border-border'}`}>
                        {ativo ? <Check className="w-2.5 h-2.5 m-auto" /> : null}
                      </div>
                      {conta.nome}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Vazio = todos os caixas disponíveis.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
