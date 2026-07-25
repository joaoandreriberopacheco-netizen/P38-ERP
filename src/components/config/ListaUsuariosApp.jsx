import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createP38UserAsAdmin } from '@/functions/p38Auth';
import { isValidP38Login, normalizeP38Login } from '@/lib/p38InternalAuth';
import { isSupabaseAuthEnabled } from '@/integrations/p38/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Edit, Shield, UserPlus, AlertTriangle, CheckCircle2, ArrowRight, Monitor, Tag, AtSign } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const MAPA_LEGADO = {
  'Admin': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Gerente': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Vendedor': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Operador de Caixa': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Estoquista': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Financeiro': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export default function ListaUsuariosApp() {
  const [usuarios, setUsuarios] = useState([]);
  const [perfisAcesso, setPerfisAcesso] = useState([]);
  const [contasCaixa, setContasCaixa] = useState([]);
  const [tabelasPreco, setTabelasPreco] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPerfilId, setSelectedPerfilId] = useState('');
  const [selectedCaixas, setSelectedCaixas] = useState([]);
  const [selectedTabelaId, setSelectedTabelaId] = useState('');
  const [selectedNickname, setSelectedNickname] = useState('');
  const [orfaos, setOrfaos] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLogin, setCreateLogin] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPerfilId, setCreatePerfilId] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const supabaseAuthAtivo = isSupabaseAuthEnabled();

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setIsLoading(true);
    const [users, perfis, contas, tabelas] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.PerfilDeAcesso.list(),
      base44.entities.ContasFinanceiras.filter({ tipo: 'Caixa Físico', ativo: true }),
      base44.entities.TabelaPreco.filter({ ativo: true })
    ]);
    setUsuarios(users || []);
    setPerfisAcesso(perfis || []);
    setContasCaixa(contas || []);
    setTabelasPreco(tabelas || []);
    setOrfaos((users || []).filter(u => !u.perfil_acesso_id));
    setIsLoading(false);
  };

  const handleEditar = (user) => {
    setEditingUser(user);
    setSelectedPerfilId(user.perfil_acesso_id || '');
    setSelectedCaixas(user.caixas_pdv_autorizados_ids || []);
    setSelectedTabelaId(user.tabela_preco_id || '');
    setSelectedNickname(user.nickname || '');
    setIsDialogOpen(true);
  };

  const handleSalvar = async () => {
    if (!editingUser) return;
    const perfilSelecionado = perfisAcesso.find(p => p.id === selectedPerfilId);
    const tabelaSelecionada = tabelasPreco.find(t => t.id === selectedTabelaId);
    await base44.entities.User.update(editingUser.id, {
      nickname: selectedNickname.trim() || null,
      perfil_acesso_id: selectedPerfilId || null,
      perfil_acesso_nome: perfilSelecionado?.nome || null,
      perfil: perfilSelecionado?.nome || editingUser.perfil,
      caixas_pdv_autorizados_ids: selectedCaixas,
      tabela_preco_id: selectedTabelaId || null,
      tabela_preco_nome: tabelaSelecionada?.nome_tabela || null
    });
    toast({ title: 'Usuário atualizado', className: 'bg-green-50 text-green-800' });
    setIsDialogOpen(false);
    carregarDados();
  };

  const handleMigrarOrfaos = async () => {
    if (!window.confirm(`Vincular automaticamente ${orfaos.length} usuário(s) por nome?`)) return;
    let migrados = 0;
    for (const user of orfaos) {
      const perfilCorrespondente = perfisAcesso.find(
        p => p.nome?.toLowerCase() === user.perfil?.toLowerCase()
      );
      if (perfilCorrespondente) {
        await base44.entities.User.update(user.id, {
          perfil_acesso_id: perfilCorrespondente.id,
          perfil_acesso_nome: perfilCorrespondente.nome
        });
        migrados++;
      }
    }
    toast({ title: `Migração concluída`, description: `${migrados}/${orfaos.length} vinculados automaticamente.`, className: 'bg-green-50 text-green-800' });
    carregarDados();
  };

  const toggleCaixa = (id) => {
    setSelectedCaixas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const abrirCriar = () => {
    setCreateLogin('');
    setCreateFullName('');
    setCreatePerfilId(perfisAcesso.find(p => p.ativo !== false)?.id || '');
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
    const perfil = perfisAcesso.find(p => p.id === createPerfilId);
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
        description: `${result.login}: peça para activar em /ativar-acesso`,
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
    toast({ title: 'Para convidar usuários', description: 'Use a função convidarUsuarios no dashboard > functions', duration: 6000 });
  };

  const perfisAtivos = perfisAcesso.filter((p) => p.ativo !== false);

  const getBadgePerfil = (user) => {
    if (user.perfil_acesso_nome) {
      return <Badge className="bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90 border-0 font-normal text-xs">{user.perfil_acesso_nome}</Badge>;
    }
    if (user.perfil) {
      return (
        <div className="flex items-center gap-1">
          <Badge className={`border-0 font-normal text-xs ${MAPA_LEGADO[user.perfil] || 'bg-muted text-muted-foreground'}`}>{user.perfil}</Badge>
          <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-0 text-[10px]">legado</Badge>
        </div>
      );
    }
    return <Badge className="bg-red-50 text-red-500 border-0 text-xs">sem perfil</Badge>;
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-border/40 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Banner de órfãos */}
      {orfaos.length > 0 && (
        <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {orfaos.length} usuário{orfaos.length > 1 ? 's' : ''} sem Perfil de Acesso vinculado
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Perfil legado ou sem perfil. Use a migração automática ou edite manualmente.</p>
              </div>
              {perfisAcesso.length > 0 && (
                <Button
                  size="sm" variant="outline" onClick={handleMigrarOrfaos}
                  className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-700 h-8 text-xs gap-1.5 shrink-0"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Migrar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Usuários do Sistema</h2>
          <p className="text-xs text-muted-foreground font-light mt-0.5">Vincule perfil de acesso e caixas autorizados</p>
        </div>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs"
          onClick={handleConvidarOuCriar}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{supabaseAuthAtivo ? 'Novo utilizador' : 'Convidar'}</span>
        </Button>
      </div>

      {/* Tabela */}
      <Card className="border-0 shadow-sm bg-card overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-muted/50/50 pb-3 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground/90 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Lista de Usuários
            </CardTitle>
            <div className="flex items-center gap-2">
              {orfaos.length === 0 && usuarios.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Todos vinculados
                </span>
              )}
              <span className="text-xs text-muted-foreground">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="text-xs text-muted-foreground font-medium">Nome</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden sm:table-cell">Utilizador</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">Perfil</TableHead>
                {supabaseAuthAtivo ? (
                  <TableHead className="text-xs text-muted-foreground font-medium hidden sm:table-cell">Acesso</TableHead>
                ) : null}
                <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">Caixas</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium hidden desktop-layout:table-cell">Tabela Preço</TableHead>
                <TableHead className="text-right text-xs text-muted-foreground font-medium">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map(user => {
                  const caixasVinculadas = (user.caixas_pdv_autorizados_ids || []).length;
                  return (
                    <TableRow key={user.id} className="border-border/40 hover:bg-muted/40 dark:hover:bg-muted/50">
                      <TableCell>
                       <div className="font-medium text-foreground/90 text-sm">{user.full_name || '-'}</div>
                       {user.nickname && (
                         <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                           <AtSign className="w-2.5 h-2.5" />
                           {user.nickname}
                         </div>
                       )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-xs text-muted-foreground font-mono">
                          {user.login || user.nickname || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{getBadgePerfil(user)}</TableCell>
                      {supabaseAuthAtivo ? (
                        <TableCell className="hidden sm:table-cell">
                          {user.auth_ativado ? (
                            <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-0 text-[10px]">
                              activo
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-0 text-[10px]">
                              pendente
                            </Badge>
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="hidden md:table-cell">
                         {caixasVinculadas > 0 ? (
                           <span className="flex items-center gap-1 text-xs text-muted-foreground">
                             <Monitor className="w-3 h-3" />
                             {caixasVinculadas} caixa{caixasVinculadas !== 1 ? 's' : ''}
                           </span>
                         ) : (
                           <span className="text-xs text-muted-foreground dark:text-muted-foreground">—</span>
                         )}
                       </TableCell>
                       <TableCell className="hidden desktop-layout:table-cell">
                         {user.tabela_preco_nome ? (
                           <span className="flex items-center gap-1 text-xs text-muted-foreground">
                             <Tag className="w-3 h-3" />
                             {user.tabela_preco_nome}
                           </span>
                         ) : (
                           <span className="text-[10px] text-muted-foreground dark:text-muted-foreground italic">usa padrão</span>
                         )}
                       </TableCell>
                       <TableCell className="text-right">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground"
                          onClick={() => handleEditar(user)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Configurar Acesso
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingUser?.full_name} — {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nickname */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5" />
                Nickname (apelido nas operações)
              </label>
              <Input
                placeholder="Ex: João, Mari, Caixa 1..."
                value={selectedNickname}
                onChange={(e) => setSelectedNickname(e.target.value)}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground pl-1">
                Usado para identificar o usuário em vendas, caixa e relatórios.
              </p>
            </div>

            {/* Perfil de acesso */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Perfil de Acesso</label>
              {perfisAtivos.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg">
                  Crie Perfis de Acesso primeiro na aba "Perfis de Acesso".
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                  {perfisAtivos.map((p) => {
                    const ativo = selectedPerfilId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPerfilId(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                            : 'bg-muted/50 text-foreground/90 hover:bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                          ativo ? 'bg-card/20 dark:bg-black/10' : 'border border-border/40 dark:border-border/40'
                        }`}>
                          {ativo && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground dark:text-foreground" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-medium">{p.nome}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabela de Preço */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tabela de Preço
              </label>
              {tabelasPreco.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg">
                  Crie Tabelas de Preço primeiro na aba "Tabelas de Preço".
                </p>
              ) : (
                <Select
                  value={selectedTabelaId || '__default__'}
                  onValueChange={(value) => setSelectedTabelaId(value === '__default__' ? '' : value)}
                >
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                    <SelectValue placeholder="Usar tabela padrão do sistema" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] dark:bg-card dark:border-border/40">
                    <SelectItem value="__default__">
                      <span className="text-muted-foreground italic text-xs">Usar tabela padrão do sistema</span>
                    </SelectItem>
                    {tabelasPreco.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{t.nome_tabela}</span>
                          {t.is_default && <span className="text-[10px] text-yellow-500">★ padrão</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground pl-1">
                Se não selecionada, usa a tabela marcada como padrão.
              </p>
            </div>

            {/* Caixas PDV autorizados */}
            {contasCaixa.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" />
                  Caixas PDV Autorizados
                </label>
                <div className="space-y-1">
                  {contasCaixa.map(conta => {
                    const ativo = selectedCaixas.includes(conta.id);
                    return (
                      <button
                        key={conta.id}
                        type="button"
                        onClick={() => toggleCaixa(conta.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                            : 'bg-muted/50 text-foreground/90 hover:bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                          ativo ? 'bg-card/20 dark:bg-black/10' : 'border border-border/40 dark:border-border/40'
                        }`}>
                          {ativo && (
                            <svg className="w-2.5 h-2.5 text-foreground" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-medium">{conta.nome}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground pl-1">
                  Se nenhum selecionado, o usuário verá todos os caixas disponíveis.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground h-8 text-xs"
              onClick={handleSalvar}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog criar utilizador (login interno) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              Novo utilizador
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cria login e perfil. A pessoa define a senha em <strong>/ativar-acesso</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Utilizador (login)</label>
              <Input
                placeholder="Ex: maria, caixa2…"
                value={createLogin}
                onChange={(e) => setCreateLogin(e.target.value)}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Nome completo</label>
              <Input
                placeholder="Nome para exibir no sistema"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Perfil de Acesso</label>
              {perfisAtivos.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg">
                  Crie Perfis de Acesso primeiro na aba "Perfis de Acesso".
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                  {perfisAtivos.map((p) => {
                    const ativo = createPerfilId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCreatePerfilId(p.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                          ativo
                            ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'
                            : 'bg-muted/50 text-foreground/90 hover:bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                          ativo ? 'bg-card/20 dark:bg-black/10' : 'border border-border/40 dark:border-border/40'
                        }`}>
                          {ativo && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground dark:text-foreground" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-medium">{p.nome}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} className="h-8 text-xs" disabled={creating}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground h-8 text-xs"
              onClick={handleCriarUtilizador}
              disabled={creating}
            >
              {creating ? 'A criar…' : 'Criar utilizador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}