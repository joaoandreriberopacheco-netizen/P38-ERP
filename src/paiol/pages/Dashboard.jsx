import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import P38Logo from '@/components/brand/P38Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import GeralTab from '@/paiol/components/dashboard/tabs/GeralTab';
import VendasTab from '@/paiol/components/dashboard/tabs/VendasTab';
import ComprasTab from '@/paiol/components/dashboard/tabs/ComprasTab';
import EstoqueTab from '@/paiol/components/dashboard/tabs/EstoqueTab';
import FinanceiroTab from '@/paiol/components/dashboard/tabs/FinanceiroTab';
import { P38DashboardLightProvider } from '@/paiol/components/dashboard/P38DashboardLightContext';
import DashboardVendedor from '@/pages/DashboardVendedor';
import DashboardCaixa from '@/pages/DashboardCaixa';

const LIGHT_SHELL_TABS = new Set(['vendas', 'estoque']);

const TAB_META = {
  vendas: { title: 'Dashboard de Vendas', subtitle: 'Indicadores e metas do mês' },
  estoque: { title: 'Dashboard de Estoque', subtitle: 'Nível, qualidade e abastecimento' },
};

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

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
  const isMobile = useIsMobile();
  const isDark = useIsDarkMode();
  const useLightShell = isMobile && !isDark && LIGHT_SHELL_TABS.has(activeTab);
  const tabMeta = TAB_META[activeTab];

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

  const tabsList = (
    <GlacialTabsList scrollable className={useLightShell ? 'p38-dashboard-light__tabs' : undefined}>
      <GlacialTabsTrigger value="geral" activeValue={activeTab} onSelect={setActiveTab} icon={BarChart3} label="Geral" />
      <GlacialTabsTrigger value="vendas" activeValue={activeTab} onSelect={setActiveTab} icon={TrendingUp} label="Vendas" />
      <GlacialTabsTrigger value="compras" activeValue={activeTab} onSelect={setActiveTab} icon={ShoppingCart} label="Compras" />
      <GlacialTabsTrigger value="estoque" activeValue={activeTab} onSelect={setActiveTab} icon={Package} label="Estoque" />
      <GlacialTabsTrigger value="financeiro" activeValue={activeTab} onSelect={setActiveTab} icon={DollarSign} label="Financeiro" />
    </GlacialTabsList>
  );

  return (
    <P38DashboardLightProvider enabled={useLightShell}>
      {useLightShell ? (
        <div className="p38-dashboard-light -mx-4 -mt-4 min-w-0 overflow-x-hidden">
          <div className="bg-[#121212] px-3 pt-1 pb-5 sm:px-4">
            <div className="pb-3 pt-1">
              <h1 className="p38-dashboard-light__title">{tabMeta?.title || 'Dashboard'}</h1>
              {tabMeta?.subtitle ? (
                <p className="p38-dashboard-light__subtitle">{tabMeta.subtitle}</p>
              ) : null}
            </div>

            {tabsList}

            <div className="p38-dashboard-light__sheet mt-4 p-4 sm:p-6">
              <DashboardTabContent activeTab={activeTab} />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground font-glacial">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Visão geral do negócio</p>
            </div>
            <div className="hidden md:block">
              <P38Logo surface="dashboard.header" />
            </div>
          </div>

          {tabsList}

          <div>
            <DashboardTabContent activeTab={activeTab} />
          </div>
        </div>
      )}
    </P38DashboardLightProvider>
  );
}
