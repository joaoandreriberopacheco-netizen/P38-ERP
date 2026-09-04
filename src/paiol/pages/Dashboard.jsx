import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import P38Logo from '@/components/brand/P38Logo';
import GeralTab from '@/paiol/components/dashboard/tabs/GeralTab';
import VendasTab from '@/paiol/components/dashboard/tabs/VendasTab';
import ComprasTab from '@/paiol/components/dashboard/tabs/ComprasTab';
import EstoqueTab from '@/paiol/components/dashboard/tabs/EstoqueTab';
import FinanceiroTab from '@/paiol/components/dashboard/tabs/FinanceiroTab';
import DashboardVendedor from '@/pages/DashboardVendedor';
import DashboardCaixa from '@/pages/DashboardCaixa';
import { P38_SHELL_DESC, P38_SHELL_TITLE } from '@/lib/p38FormTypography';
import { usePermissoesUsuario } from '@/hooks/usePermissoesUsuario';

export default function DashboardPage() {
  const { tem: podePerm } = usePermissoesUsuario();
  const podeKpisVendas = podePerm('dashboard.ver_kpis_vendas', 'dashboard.acesso');
  const podeKpisEstoque = podePerm('dashboard.ver_kpis_estoque', 'dashboard.acesso');
  const podeKpisFinanceiro = podePerm('dashboard.ver_kpis_financeiro', 'dashboard.acesso');
  const podeKpisGeral = podePerm('dashboard.acesso');

  const defaultTab = useMemo(() => {
    if (podeKpisGeral) return 'geral';
    if (podeKpisVendas) return 'vendas';
    if (podeKpisEstoque) return 'estoque';
    if (podeKpisFinanceiro) return 'financeiro';
    return 'geral';
  }, [podeKpisGeral, podeKpisVendas, podeKpisEstoque, podeKpisFinanceiro]);

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['geral']));
  const [currentUser, setCurrentUser] = useState(null);

  const handleTabSelect = useCallback((tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
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
            <VendasTab enabled={visitedTabs.has('vendas')} />
          </div>
        )}
        {podeKpisGeral && visitedTabs.has('compras') && (
          <div hidden={activeTab !== 'compras'}>
            <ComprasTab />
          </div>
        )}
        {podeKpisEstoque && visitedTabs.has('estoque') && (
          <div hidden={activeTab !== 'estoque'}>
            <EstoqueTab enabled={visitedTabs.has('estoque')} />
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
