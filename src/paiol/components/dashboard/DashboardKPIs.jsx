import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, ShoppingBag, Package } from 'lucide-react';

export default function DashboardKPIs({ kpis, isLoading }) {
  if (!kpis && !isLoading) return null;
  
  const safeKpis = kpis || { faturamentoMes: 0, margemBruta: 0, ticketMedio: 0, valorEstoque: 0 };

  const cards = [
    { 
      title: "Faturamento do Mês", 
      value: `R$ ${safeKpis.faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-p38-olive dark:text-green-400",
      bgColor: "bg-p38-olive/10 dark:bg-green-900/20"
    },
    { 
      title: "Margem Bruta Média", 
      value: `${safeKpis.margemBruta.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-p38-mediterranean dark:text-blue-400",
      bgColor: "bg-p38-olive/8 dark:bg-blue-900/20"
    },
    { 
      title: "Ticket Médio", 
      value: `R$ ${safeKpis.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: ShoppingBag,
      color: "text-p38-citrus-orange dark:text-purple-400",
      bgColor: "bg-p38-citrus-yellow/15 dark:bg-purple-900/20"
    },
    { 
      title: "Valor em Estoque", 
      value: `R$ ${safeKpis.valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: Package,
      color: "text-amber-700 dark:text-orange-400",
      bgColor: "bg-amber-100/80 dark:bg-orange-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="shadow-sm border border-border bg-card">
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