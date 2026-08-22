import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Package, FileWarning } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function AlertasCriticos({ alertas, isLoading }) {
  const { baixoEstoque, contasVencendo } = alertas;

  return (
    <Card className="shadow-sm border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Alertas Críticos
        </CardTitle>
        <p className="text-sm text-muted-foreground">Itens que requerem sua atenção imediata.</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <>
            {/* Alerta de Baixo Estoque */}
            <div className="p-4 bg-[#e8b824]/6 rounded-lg border border-[#4a5240]/8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-[#5c5640] flex items-center gap-2"><Package className="w-5 h-5"/> Baixo Estoque</h3>
                <Badge variant="destructive">{baixoEstoque.length}</Badge>
              </div>
              <div className="space-y-1 text-sm text-[#6b6550] max-h-32 overflow-y-auto">
                {baixoEstoque.length > 0 ? baixoEstoque.map(p => (
                  <p key={p.id}>- {p.nome} (Atual: {p.estoque_atual})</p>
                )) : <p className="text-muted-foreground">Nenhum produto com baixo estoque.</p>}
              </div>
            </div>

            {/* Alerta de Contas a Pagar */}
            <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-red-800 flex items-center gap-2"><FileWarning className="w-5 h-5"/> Contas Vencendo</h3>
                    <Badge variant="destructive">{contasVencendo.length}</Badge>
                </div>
                <div className="space-y-1 text-sm text-red-700 max-h-32 overflow-y-auto">
                    {contasVencendo.length > 0 ? contasVencendo.map(c => (
                        <p key={c.id}>- {c.descricao} (Vence: {new Date(c.data_vencimento).toLocaleDateString('pt-BR')})</p>
                    )) : <p className="text-muted-foreground">Nenhuma conta vencendo nos próximos 7 dias.</p>}
                </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}