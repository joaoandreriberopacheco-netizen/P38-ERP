import React, { useState } from 'react';
import ExecucaoOrcamentaria from '../components/financeiro/ExecucaoOrcamentaria';
import SuperAgefin from './SuperAgefin';
import AgefinImportador from '../components/agefin/AgefinImportador';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Plus } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState('caixa');
  const [showImportDialog, setShowImportDialog] = useState(false);

  return (
    <div className="p-4 lg:p-8 min-h-screen bg-background font-din-1451 pb-28">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Financeiro</h1>
        <p className="text-sm md:text-base text-muted-foreground mb-6">Controle suas contas, fluxo de caixa e conciliações bancárias.</p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 rounded-full bg-muted p-1 h-auto gap-0.5">
            <TabsTrigger value="caixa" className="rounded-full text-xs md:text-sm">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="contas" className="rounded-full text-xs md:text-sm">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="agefin" className="rounded-full text-xs md:text-sm">AGEFIN</TabsTrigger>
            <TabsTrigger value="movimentos" className="rounded-full text-xs md:text-sm">Movimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="caixa">
            <ExecucaoOrcamentaria />
          </TabsContent>

          <TabsContent value="contas">
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader><CardTitle>Contas a Pagar</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Em desenvolvimento...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agefin" className="mt-0">
            <SuperAgefin />
          </TabsContent>

          <TabsContent value="movimentos">
            <Card className="border-0 shadow-sm rounded-3xl">
              <CardHeader><CardTitle>Movimentos Financeiros</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Em desenvolvimento...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button
          onClick={() => setShowImportDialog(true)}
          className="fixed right-4 z-[55] h-14 w-14 rounded-full bg-background p38-bottom-fab1 text-white shadow-lg hover:bg-primary lg:bottom-8 lg:right-8"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>

        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="flex min-h-0 max-h-[92vh] w-full max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-xl">
            <div className="shrink-0 border-b border-border/40 p-5 dark:border-border/40">
              <h2 className="text-lg font-semibold text-foreground">Importar conta</h2>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <AgefinImportador
                onSuccess={(_, options) => {
                  if (options?.close) {
                    setShowImportDialog(false);
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}