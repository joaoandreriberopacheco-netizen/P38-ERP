import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createP38UserAsAdmin } from '@/functions/p38Auth';
import { isValidP38Login, normalizeP38Login } from '@/lib/p38InternalAuth';
import { isSupabaseAuthEnabled } from '@/integrations/p38/providers';
import { resolverPermissoes } from '@/lib/perfilPermissoes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Users, Shield, UserPlus, AlertTriangle, CheckCircle2, ArrowRight,
  Search, Pencil, Lock, Backpack,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MODULOS, contarPermissoes } from './PerfilFormTela';
import UsuarioKitEditor from './UsuarioKitEditor';

function Avatar({ name }) {
  const initials = (name || '?').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground flex-shrink-0">
      {initials}
    </div>
  );
}

function KitProgress({ permissoes, isAdmin }) {
  if (isAdmin) {
    return <span className="text-[10px] text-muted-foreground">Acesso total</span>;
  }
  const totalAtivas = MODULOS.reduce((acc, m) => acc + contarPermissoes(permissoes, m.key).ativas, 0);
  const totalGeral = MODULOS.reduce((acc, m) => acc + contarPermissoes(permissoes, m.key).total, 0);
  const pct = totalGeral > 0 ? Math.round((totalAtivas / totalGeral) * 100) : 0;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/70 dark:bg-foreground/40 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{totalAtivas}/{totalGeral}</span>
    </div>
  );
}

export default function ListaUsuariosApp() {
  const [usuarios, setUsuarios] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [contasCaixa, setContasCaixa] = useState([]);
  const [tabelasPreco, setTabelasPreco] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [orfaos, setOrfaos] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLogin, setCreateLogin] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPerfilId, setCreatePerfilId] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const supabaseAuthAtivo = isSupabaseAuthEnabled();
  const perfisAtivos = perfisAcesso.filter((p) => p.ativo !== false);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setIsLoading(true);
    const [users, perfis, contas, tabelas] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.PerfilDeAcesso.list(),
      base44.entities.ContasFinanceiras.filter({ tipo: 'Caixa Físico', ativo: true }),
      base44.entities.TabelaPreco.filter({ ativo: true }),
    ]);
    setUsuarios(users || []);
    setPerfisAcesso(perfis || []);
    setContasCaixa(contas || []);
    setTabelasPreco(tabelas || []);
    setOrfaos((users || []).filter((u) => !u.perfil_acesso_id && u.role !== 'admin'));
    setIsLoading(false);
  };

  const usuariosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      u.full_name?.toLowerCase().includes(q) ||
      u.login?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.perfil_acesso_nome?.toLowerCase().includes(q) ||
      u.nickname?.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  const handleSalvarKit = async (dados) => {
    if (!editando) return;
    setSaving(true);
    try {
      await base44.entities.User.update(editando.id, dados);
      toast({ title: 'Kit atualizado', description: 'Permissões e operação guardadas.', className: 'bg-green-50 text-green-800' });
      setEditando(null);
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro ao guardar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMigrarOrfaos = async () => {
    if (!window.confirm(`Vincular automaticamente ${orfaos.length} utilizador(es) por nome de perfil legado?`)) return;
    let migrados = 0;
    for (const user of orfaos) {
      const perfilCorrespondente = perfisAcesso.find(
        (p) => p.nome?.toLowerCase() === user.perfil?.toLowerCase()
      );
      if (perfilCorrespondente) {
        await base44.entities.User.update(user.id, {
          perfil_acesso_id: perfilCorrespondente.id,
          perfil_acesso_nome: perfilCorrespondente.nome,
        });
        migrados++;
      }
    }
    toast({
      title: 'Migração concluída',
      description: `${migrados}/${orfaos.length} vinculados.`,
      className: 'bg-green-50 text-green-800',
    });
    carregarDados();
  };

  const abrirCriar = () => {
    setCreateLogin('');
    setCreateFullName('');
    setCreatePerfilId(perfisAtivos[0]?.id || '');
    setIsCreateOpen(true);
  };

  const handleCriarUtilizador = async () => {
    const login = normalizeP38Login(createLogin);
    if (!isValidP38Login(login)) {
      toast({ title: 'Utilizador inválido', description: 'Mín. 2 caracteres, sem espaços.', variant: 'destructive' });
      return;
    }
    if (!createPerfilId) {
      toast({ title: 'Selecione um perfil de acesso', variant: 'destructive' });
      return;
    }
    const perfil = perfisAtivos.find((p) => p.id === createPerfilId);
    setCreating(true);
    try {
      const result = await createP38UserAsAdmin({
        login,
        full_name: createFullName.trim() || login,
        perfil_acesso_id: createPerfilId,
        perfil_acesso_nome: perfil?.nome || null,
      });
      toast({
        title: 'Utilizador criado',
        description: `${result.login}: activar em /ativar-acesso`,
        className: 'bg-green-50 text-green-800',
        duration: 8000,
      });
      setIsCreateOpen(false);
      carregarDados();
    } catch (err) {
      toast({ title: 'Erro ao criar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleConvidarOuCriar = () => {
    if (supabaseAuthAtivo) {
      abrirCriar();
      return;
    }
    toast({ title: 'Convites', description: 'Use convidarUsuarios no dashboard Base44.', duration: 6000 });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-border/40 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (editando) {
    return (
      <UsuarioKitEditor
        usuario={editando}
        perfisAcesso={perfisAcesso}
        contasCaixa={contasCaixa}
        tabelasPreco={tabelasPreco}
        onSalvar={handleSalvarKit}
        onCancelar={() => setEditando(null)}
        saving={saving}
      />
    );
  }

  return (
    <div className="space-y-4">
      {orfaos.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {orfaos.length} utilizador{orfaos.length > 1 ? 'es' : ''} sem kit (perfil) atribuído
              </p>
              <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                Atribua um perfil para cada pessoa — é o template da mochila de acesso.
              </p>
            </div>
          </div>
          {perfisAcesso.length > 0 ? (
            <Button size="sm" variant="outline" onClick={handleMigrarOrfaos} className="h-8 text-xs gap-1.5 shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
              Migrar por nome
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Backpack className="w-4 h-4 text-muted-foreground" />
            Quarter Master — Utilizadores
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Cada utilizador leva um kit: perfil base + ajustes individuais. O que não está no kit não aparece no menu nem abre por URL.
          </p>
        </div>
        <Button size="sm" onClick={handleConvidarOuCriar} className="h-8 text-xs gap-1.5 shrink-0">
          <UserPlus className="w-3.5 h-3.5" />
          {supabaseAuthAtivo ? 'Novo utilizador' : 'Convidar'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, login ou perfil…"
          className="pl-9 h-9 text-sm bg-card border-border/40"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {usuariosFiltrados.length} utilizador{usuariosFiltrados.length !== 1 ? 'es' : ''}
        </span>
        {orfaos.length === 0 && usuarios.length > 0 ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Todos com kit
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {usuariosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/50 bg-card py-14 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {busca ? `Nenhum resultado para "${busca}"` : 'Nenhum utilizador encontrado'}
            </p>
          </div>
        ) : (
          usuariosFiltrados.map((user) => {
            const isAdmin = user.role === 'admin';
            const perfil = perfisAcesso.find((p) => p.id === user.perfil_acesso_id);
            const overrides = user.override_permissoes || {};
            const qtdOverrides = Object.keys(overrides).length;
            const permissoesFinais = isAdmin
              ? null
              : resolverPermissoes(perfil, overrides);

            return (
              <div
                key={user.id}
                className="rounded-2xl bg-card border border-border/30 p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={user.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{user.full_name || user.login || '—'}</p>
                      {isAdmin ? (
                        <Badge variant="outline" className="text-[10px] gap-0.5 border-amber-500/40">
                          <Lock className="w-2.5 h-2.5" /> Admin
                        </Badge>
                      ) : null}
                      {user.nickname ? (
                        <span className="text-[10px] text-muted-foreground">@{user.nickname}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                      {user.login || user.email || '—'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {isAdmin ? (
                        <span className="text-xs text-muted-foreground">Bypass técnico — todas as rotas</span>
                      ) : perfil ? (
                        <>
                          <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                            <Shield className="w-3 h-3" />
                            {perfil.nome}
                          </Badge>
                          {qtdOverrides > 0 ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                              +{qtdOverrides} ajuste{qtdOverrides > 1 ? 's' : ''}
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] font-normal">Sem kit</Badge>
                      )}
                      {supabaseAuthAtivo && !user.auth_ativado ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">Pendente activação</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:flex-shrink-0">
                  <KitProgress permissoes={permissoesFinais || {}} isAdmin={isAdmin} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setEditando(user)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Montar kit
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Novo utilizador
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cria login e perfil base. A pessoa define a senha em <strong>/ativar-acesso</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Login</label>
              <Input
                placeholder="maria, caixa2…"
                value={createLogin}
                onChange={(e) => setCreateLogin(e.target.value)}
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome completo</label>
              <Input
                placeholder="Nome no sistema"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Perfil base (kit)</label>
              {perfisAtivos.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg">
                  Crie perfis em &quot;Perfis de Acesso&quot; primeiro.
                </p>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {perfisAtivos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCreatePerfilId(p.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                        createPerfilId === p.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCriarUtilizador} disabled={creating}>
              {creating ? 'A criar…' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
