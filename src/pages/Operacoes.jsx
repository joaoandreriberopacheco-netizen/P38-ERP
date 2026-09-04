import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ship, TrendingUp, ShoppingCart } from 'lucide-react';
import { createPageUrl } from '@/components/utils';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { Link } from 'react-router-dom';

export default function OperacoesPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header - SEM CORES */}
      <div className="pb-4 border-b border-border/40">
        <P38PageHeader
          variant="page"
          title="Operações"
          description="Logística, vendas e compras"
        />
      </div>

      {/* Links Rápidos - SEM CORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Link to={createPageUrl('ItinerarioFluvial')}>
          <div className="p-6 border border-border/40 rounded hover:bg-muted/40 dark:hover:bg-muted transition-colors cursor-pointer">
            <Ship className="w-8 h-8 text-foreground/90 dark:text-muted-foreground mb-3" />
            <h3 className="text-base font-normal text-foreground mb-1">Boats</h3>
            <p className="text-sm text-muted-foreground">Itinerário fluvial e logística</p>
          </div>
        </Link>

        <Link to={createPageUrl('VendasGestao')}>
          <div className="p-6 border border-border/40 rounded hover:bg-muted/40 dark:hover:bg-muted transition-colors cursor-pointer">
            <TrendingUp className="w-8 h-8 text-foreground/90 dark:text-muted-foreground mb-3" />
            <h3 className="text-base font-normal text-foreground mb-1">Vendas</h3>
            <p className="text-sm text-muted-foreground">Pedidos e orçamentos</p>
          </div>
        </Link>

        <Link to={createPageUrl('Compras')}>
          <div className="p-6 border border-border/40 rounded hover:bg-muted/40 dark:hover:bg-muted transition-colors cursor-pointer">
            <ShoppingCart className="w-8 h-8 text-foreground/90 dark:text-muted-foreground mb-3" />
            <h3 className="text-base font-normal text-foreground mb-1">Compras</h3>
            <p className="text-sm text-muted-foreground">Pedidos e recepção</p>
          </div>
        </Link>
      </div>
    </div>
  );
}