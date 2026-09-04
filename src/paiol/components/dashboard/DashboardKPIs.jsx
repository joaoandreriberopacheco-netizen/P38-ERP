import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, ShoppingBag, Package } from 'lucide-react';
import { p38Dashboard } from '@/lib/p38DashboardSurfaces';

export default function DashboardKPIs({ kpis, isLoading }) {
  if (!kpis && !isLoading) return null;
  
  const safeKpis = kpis || { faturamentoMes: 0, margemBruta: 0, ticketMedio: 0, valorEstoque: 0 };

  const cards = [
    { 
      title: "Faturamento do Mês", 
      value: `R$ ${safeKpis.faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: p38Dashboard.iconAccent,
      bgColor: 'bg-[#4a5240]/6 dark:bg-green-900/20',
    },
    { 
      title: "Margem Bruta Média", 
      value: `${safeKpis.margemBruta.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-[#5c6650] dark:text-blue-400',
      bgColor: 'bg-[#4a5240]/5 dark:bg-blue-900/20',
    },
    { 
      title: "Ticket Médio", 
      value: `R$ ${safeKpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: ShoppingBag,
      color: p38Dashboard.iconAccentJuice,
      bgColor: 'bg-[#e8b824]/6 dark:bg-purple-900/20',
    },
    { 
      title: "Valor em Estoque", 
      value: `R$ ${safeKpis.valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: Package,
      color: 'text-[#727a62] dark:text-orange-400',
      bgColor: 'bg-gradient-to-br from-[#e8b824]/5 to-[#4a5240]/4 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className={p38Dashboard.card}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <div className={`p-2 rounded-md ${card.bgColor}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
