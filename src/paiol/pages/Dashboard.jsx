import React, { useState, useEffect } from 'react';
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

const TAB_META = {
  geral: { title: 'Dashboard', subtitle: 'Visão geral do negócio' },
  vendas: { title: 'Dashboard de Vendas', subtitle: 'Indicadores e metas do mês' },
  compras: { title: 'Dashboard de Compras', subtitle: 'Pedidos e abastecimento' },
  estoque: { title: 'Dashboard de Estoque', subtitle: 'Nível, qualidade e cobertura' },
  financeiro: { title: 'Dashboard Financeiro', subtitle: 'Fluxo e resultados' },
};

function DashboardTabContent({ activeTab }) {
  if (activeTab === 'geral') return <GeralTab />;
  if (activeTab === 'vendas') return <VendasTab />;
  if (activeTab === 'compras') return <ComprasTab />;
  if (activeTab === 'estoque') return <EstoqueTab />;
  if (activeTab === 'financeiro') return <FinanceiroTab />;
  return null;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('geral');
  const [currentUser, setCurrentUser] = useState(null);
  const tabMeta = TAB_META[activeTab] || TAB_META.geral;

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    loadUser();
  }, []);

  const perfilLower = currentUser?.perfil?.toLowerCase() || '';

  if (perfilLower === 'vendedor') return <DashboardVendedor />;
  if (perfilLower === 'caixa' || perfilLower === 'operador de caixa') return <DashboardCaixa />;

  return (
    <div className="p38-dashboard mx-auto space-y-3 sm:space-y-4 pb-2">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="p38-dashboard-title">{tabMeta.title}</h1>
          <p className="p38-dashboard-subtitle">{tabMeta.subtitle}</p>
        </div>
        <div className="hidden md:block shrink-0">
          <P38Logo surface="dashboard.header" />
        </div>
      </div>

      <GlacialTabsList scrollable className="p38-dashboard-tabs w-full min-w-0">
        <GlacialTabsTrigger value="geral" activeValue={activeTab} onSelect={setActiveTab} icon={BarChart3} label="Geral" />
        <GlacialTabsTrigger value="vendas" activeValue={activeTab} onSelect={setActiveTab} icon={TrendingUp} label="Vendas" />
        <GlacialTabsTrigger value="compras" activeValue={activeTab} onSelect={setActiveTab} icon={ShoppingCart} label="Compras" />
        <GlacialTabsTrigger value="estoque" activeValue={activeTab} onSelect={setActiveTab} icon={Package} label="Estoque" />
        <GlacialTabsTrigger value="financeiro" activeValue={activeTab} onSelect={setActiveTab} icon={DollarSign} label="Financeiro" />
      </GlacialTabsList>

      <div className="min-w-0 space-y-3 sm:space-y-4">
        <DashboardTabContent activeTab={activeTab} />
      </div>
    </div>
  );
}
