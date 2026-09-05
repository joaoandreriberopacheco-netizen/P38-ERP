import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import P38Logo from '@/components/brand/P38Logo';
import GeralTab from '@/paiol/components/dashboard/tabs/GeralTab';
import ComprasTab from '@/paiol/components/dashboard/tabs/ComprasTab';
import FinanceiroTab from '@/paiol/components/dashboard/tabs/FinanceiroTab';
import DashboardVendedor from '@/pages/DashboardVendedor';
import DashboardCaixa from '@/pages/DashboardCaixa';
import { P38_SHELL_DESC, P38_SHELL_TITLE } from '@/lib/p38FormTypography';
import { usePermissoesUsuario } from '@/hooks/usePermissoesUsuario';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentMonthKey } from '@/lib/dashboardVendasPeriod';
import { getDashboardVendasStaleTime } from '@/lib/dashboardIncrementalCache';
import { fetchDashboardVendasBundle } from '@/hooks/useDashboardQueries';
import { p38Keys } from '@/lib/p38QueryConfig';

const VendasTab = lazy(() => import('@/paiol/components/dashboard/tabs/VendasTab'));
const EstoqueTab = lazy(() => import('@/paiol/components/dashboard/tabs/EstoqueTab'));

function DashboardTabSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-busy="true">
      {[1, 2].map((card) => (
        <div key={card} className="rounded-xl border border-border/40 bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { tem: podePerm, user: currentUser } = usePermissoesUsuario();
  const podeKpisVendas = podePerm('dashboard.ver_kpis_vendas', 'dashboard.acesso');
  const podeKpisEstoque = podePerm('dashboard.ver_kpis_estoque', 'dashboard.acesso');
  const podeKpisFinanceiro = podePerm('dashboard.ver_kpis_financeiro', 'dashboard.acesso');
  const podeKpisGeral = podePerm('dashboard.acesso');

  const defaultTab = useMemo(() => {
    if (podeKpisVendas) return 'vendas';
    if (podeKpisEstoque) return 'estoque';
    if (podeKpisFinanceiro) return 'financeiro';
    if (podeKpisGeral) return 'geral';
    return 'geral';
  }, [podeKpisGeral, podeKpisVendas, podeKpisEstoque, podeKpisFinanceiro]);

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([defaultTab]));

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(defaultTab)) return prev;
      const next = new Set(prev);
      next.add(defaultTab);
      return next;
    });
    setActiveTab((prev) => (prev === 'geral' && defaultTab !== 'geral' ? defaultTab : prev));
  }, [defaultTab]);

  useEffect(() => {
    if (!podeKpisVendas) return undefined;
    const monthKey = getCurrentMonthKey();
    queryClient.prefetchQuery({
      queryKey: p38Keys.dashboardVendas(monthKey),
      queryFn: () => fetchDashboardVendasBundle(monthKey, queryClient),
      staleTime: getDashboardVendasStaleTime(monthKey),
    });
    return undefined;
  }, [podeKpisVendas, queryClient]);

  const handleTabSelect = useCallback((tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const perfilLower = currentUser?.perfil?.toLowerCase() || '';

  if (perfilLower === 'vendedor') return <DashboardVendedor />;
  if (perfilLower === 'caixa' || perfilLower === 'operador de caixa') return <DashboardCaixa />;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className={P38_SHELL_TITLE}>Dashboard</h1>
          <p className={P38_SHELL_DESC}>Visão geral do negócio</p>
        </div>
        <div className="hidden md:block">
          <P38Logo surface="dashboard.header" />
        </div>
      </div>

      <GlacialTabsList scrollable>
        {podeKpisGeral && (
        <GlacialTabsTrigger value="geral"      activeValue={activeTab} onSelect={handleTabSelect} icon={BarChart3}      label="Geral" pulseSensor="dashboard.tab-geral" />
        )}
        {podeKpisVendas && (
        <GlacialTabsTrigger value="vendas"     activeValue={activeTab} onSelect={handleTabSelect} icon={TrendingUp}      label="Vendas" />
        )}
        {podeKpisGeral && (
        <GlacialTabsTrigger value="compras"    activeValue={activeTab} onSelect={handleTabSelect} icon={ShoppingCart}    label="Compras" />
        )}
        {podeKpisEstoque && (
        <GlacialTabsTrigger value="estoque"    activeValue={activeTab} onSelect={handleTabSelect} icon={Package}         label="Estoque" />
        )}
        {podeKpisFinanceiro && (
        <GlacialTabsTrigger value="financeiro" activeValue={activeTab} onSelect={handleTabSelect} icon={DollarSign}      label="Financeiro" />
        )}
      </GlacialTabsList>

      <div>
        {podeKpisGeral && visitedTabs.has('geral') && (
          <div hidden={activeTab !== 'geral'}>
            <GeralTab />
          </div>
        )}
        {podeKpisVendas && visitedTabs.has('vendas') && (
          <div hidden={activeTab !== 'vendas'}>
            <Suspense fallback={<DashboardTabSkeleton />}>
              <VendasTab enabled={visitedTabs.has('vendas')} />
            </Suspense>
          </div>
        )}
        {podeKpisGeral && visitedTabs.has('compras') && (
          <div hidden={activeTab !== 'compras'}>
            <ComprasTab />
          </div>
        )}
        {podeKpisEstoque && visitedTabs.has('estoque') && (
          <div hidden={activeTab !== 'estoque'}>
            <Suspense fallback={<DashboardTabSkeleton />}>
              <EstoqueTab enabled={visitedTabs.has('estoque')} />
            </Suspense>
          </div>
        )}
        {podeKpisFinanceiro && visitedTabs.has('financeiro') && (
          <div hidden={activeTab !== 'financeiro'}>
            <FinanceiroTab />
          </div>
        )}
      </div>
    </div>
  );
}
