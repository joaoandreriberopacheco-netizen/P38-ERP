import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, TrendingUp, History, ClipboardCheck } from 'lucide-react';
import FilaSeparacao from '@/components/estoque/FilaSeparacao';
import MovimentacaoEstoqueForm from '@/components/estoque/MovimentacaoEstoqueForm';
import HistoricoMovimentacoes from '@/components/estoque/HistoricoMovimentacoes';
import ListaConferencias from '@/components/estoque/auditoria/ListaConferencias';
import ConferenciaEditor from '@/components/estoque/auditoria/ConferenciaEditor';
import ConferenciaAuditoria from '@/components/estoque/auditoria/ConferenciaAuditoria';

export default function Armazenagem() {
  const [produtos, setProdutos] = useState([]);
  const [conferenciaAtiva, setConferenciaAtiva] = useState(null);
  const [conferenciaAuditoria, setConferenciaAuditoria] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const produtosData = await base44.entities.Produto.list();
    setProdutos(produtosData);
  };

  return (
    <div className="min-h-screen bg-background font-din-1451 w-full max-w-full overflow-x-hidden pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="p-4 md:p-6 space-y-6 w-full max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-light text-foreground">Módulo de Estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seu inventário, separação de pedidos, entradas, saídas e histórico completo
          </p>
        </div>

        <Tabs defaultValue="separacao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted/40 rounded-xl p-1 border border-border/40 dark:border-white/10 overflow-hidden gap-0.5">
            <TabsTrigger
              value="separacao"
              title="Fila de Separação"
              data-pulse-sensor="armazenagem.tab-separacao"
              className="flex items-center gap-2 data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
            >
              <Package className="w-4 h-4" />
              <span className="hidden md:inline">Fila de Separação</span>
            </TabsTrigger>
            <TabsTrigger
              value="movimentacao"
              title="Nova Movimentação"
              className="flex items-center gap-2 data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden md:inline">Nova Movimentação</span>
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              title="Histórico de Movimentações"
              className="flex items-center gap-2 data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">Histórico</span>
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              title="Auditoria de Estoque"
              onClick={() => setConferenciaAtiva(null)}
              className="flex items-center gap-2 data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden md:inline">Auditoria de Estoque</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="separacao" className="mt-6">
            <FilaSeparacao />
          </TabsContent>

          <TabsContent value="movimentacao" className="mt-6">
            <MovimentacaoEstoqueForm produtos={produtos} onSuccess={loadData} />
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <HistoricoMovimentacoes />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-6">
            <Tabs defaultValue="contagem" className="w-full">
              <TabsList className="bg-card rounded-xl p-1 shadow-sm mb-4 inline-flex w-full max-w-full overflow-hidden">
                <TabsTrigger
                  value="contagem"
                  onClick={() => { setConferenciaAtiva(null); }}
                  className="text-sm data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
                >
                  Contagem
                </TabsTrigger>
                <TabsTrigger
                  value="auditoria-sub"
                  onClick={() => { setConferenciaAuditoria(null); }}
                  className="text-sm data-[state=active]:bg-muted dark:data-[state=active]:bg-muted"
                >
                  Auditoria
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contagem">
                <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background overflow-hidden w-full max-w-full">
                  {conferenciaAtiva ? (
                    <ConferenciaEditor
                      conferencia={conferenciaAtiva}
                      onVoltar={() => setConferenciaAtiva(null)}
                    />
                  ) : (
                    <ListaConferencias
                      onAbrirConferencia={setConferenciaAtiva}
                      onAbrirAuditoria={setConferenciaAuditoria}
                      modoFiltro="contagem"
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="auditoria-sub">
                <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background p-4 w-full max-w-full overflow-x-hidden">
                  {conferenciaAuditoria ? (
                    <ConferenciaAuditoria
                      conferencia={conferenciaAuditoria}
                      onVoltar={() => setConferenciaAuditoria(null)}
                      onAtualizar={() => setConferenciaAuditoria(null)}
                    />
                  ) : (
                    <ListaConferencias
                      onAbrirConferencia={setConferenciaAtiva}
                      onAbrirAuditoria={setConferenciaAuditoria}
                      modoFiltro="auditoria"
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}