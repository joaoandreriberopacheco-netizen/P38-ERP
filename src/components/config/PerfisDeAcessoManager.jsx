import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/notify';
import { Plus, Trash2, Shield, Users, Pencil } from 'lucide-react';
import PerfilFormTela, { MODULOS, contarPermissoes } from './PerfilFormTela';
import { garantirChavesPermissoes, perfilTemEscopoTotal } from '@/lib/perfilPermissoes';

export default function PerfisDeAcessoManager() {
  const [perfis, setPerfis] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null); // null = lista, 'novo' = criar, perfil = editar
  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    const [p, u] = await Promise.all([
      base44.entities.PerfilDeAcesso.list(),
      base44.entities.User.list()
    ]);
    setPerfis(p);
    setUsuarios(u);
    setLoading(false);
  };

  const handleSalvar = async (form) => {
    const editandoExistente = editando && editando !== 'novo';
    if (!form.nome.trim()) {
      notify.warning('Nome obrigatório', 'Informe um nome para o perfil.');
      return;
    }
    try {
      const payload = {
        ...form,
        permissoes: garantirChavesPermissoes(form.permissoes, {
          novasComo: false,
          perfilAdministrador: perfilTemEscopoTotal(form),
        }),
      };
      if (editandoExistente) {
        await base44.entities.PerfilDeAcesso.update(editando.id, payload);
      } else {
        await base44.entities.PerfilDeAcesso.create(payload);
      }
      notify.success(editandoExistente ? 'Perfil atualizado' : 'Perfil criado', 'As permissões foram salvas.');
      setEditando(null);
      carregarDados();
    } catch (e) {
      notify.error('Erro ao salvar', e.message);
    }
  };

  const deletar = async (id) => {
    const emUso = usuarios.filter(u => u.perfil_acesso_id === id).length;
    if (emUso > 0) {
      notify.warning(`Perfil em uso por ${emUso} usuário(s)`, 'Desvincule os usuários antes de excluir.');
      return;
    }
    if (!window.confirm('Excluir este perfil?')) return;
    await base44.entities.PerfilDeAcesso.delete(id);
    notify.success('Perfil excluído');
    carregarDados();
  };

  // ── Modo tela de edição ─────────────────────────────────────────
  if (editando !== null) {
    return (
      <PerfilFormTela
        perfil={editando === 'novo' ? null : editando}
        onSalvar={handleSalvar}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  // ── Lista ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-border/40 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Perfis de Acesso</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Defina o que cada função pode ver e fazer</p>
        </div>
        <Button
          onClick={() => setEditando('novo')}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs">Novo Perfil</span>
        </Button>
      </div>

      {perfis.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm text-center py-14">
          <Shield className="w-8 h-8 text-muted-foreground dark:text-foreground/90 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum perfil criado ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Crie perfis para controlar o acesso de cada usuário</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {perfis.map(perfil => {
            const totalAtivas = MODULOS.reduce((acc, m) => acc + contarPermissoes(perfil.permissoes, m.key).ativas, 0);
            const totalGeral = MODULOS.reduce((acc, m) => acc + contarPermissoes(perfil.permissoes, m.key).total, 0);
            const qtdUsuarios = usuarios.filter(u => u.perfil_acesso_id === perfil.id).length;
            const pct = totalGeral > 0 ? (totalAtivas / totalGeral) * 100 : 0;

            return (
              <div key={perfil.id} className="bg-card rounded-xl shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm leading-tight">{perfil.nome}</p>
                      {perfil.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{perfil.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setEditando(perfil)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletar(perfil.id)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                    {totalAtivas}/{totalGeral}
                  </span>
                  {qtdUsuarios > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {qtdUsuarios}
                    </span>
                  )}
                  {perfil.menu_compacto && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">Compacto</span>
                  )}
                  {!perfil.ativo && (
                    <span className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">Inativo</span>
                  )}
                </div>

                <div className="w-full bg-muted rounded-full h-1">
                  <div className="h-1 rounded-full bg-muted dark:bg-muted-foreground/40 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}