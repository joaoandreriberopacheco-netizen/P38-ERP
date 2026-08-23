import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldAlert } from 'lucide-react';
import { TrendingUp, Package, DollarSign, BarChart3, Settings, Building2, Users, Sliders, Tags, Wallet, CreditCard, Smartphone, Bookmark, Wrench, Shield, MapPin, Printer, Trash2, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { GlacialTabsList, GlacialTabsTrigger, GlacialSubTabsList, GlacialSubTabsTrigger } from '@/components/ui/GlacialTabs';
import TabelasPrecoManager from '../components/config/TabelasPrecoManager';
import ConfiguracoesVendaManager from '../components/config/ConfiguracoesVendaManager';
import MetasDashboardKpiManager from '../components/config/MetasDashboardKpiManager';
import AreasManager from '../components/config/AreasManager';
import ContasFinanceirasManager from '../components/config/ContasFinanceirasManager';
import CategoriasFinanceirasManager from '../components/config/CategoriasFinanceirasManager';
import ConfigEstoqueManager from '../components/config/ConfigEstoqueManager';
import MaquininhasManager from '../components/config/MaquininhasManager';
import FormasPagamentoManager from '../components/config/FormasPagamentoManager';
import ListaUsuariosApp from '../components/config/ListaUsuariosApp';
import DadosEmpresaManager from '@/components/config/DadosEmpresaManager';
import PerfisDeAcessoManager from '@/components/config/PerfisDeAcessoManager';
import RecomecarDoZero from '@/components/config/RecomecarDoZero';
import MetasEstoqueConfigTool from '@/components/config/MetasEstoqueConfigTool';
import CodigoProdutoBackfillTool from '@/components/config/CodigoProdutoBackfillTool';
import { useNavigate } from 'react-router-dom';
export default function ConfiguracoesPage() {
  const [userLoaded, setUserLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('vendas');
  const [vendaTab, setVendaTab] = useState('fluxo');
  const [opTab, setOpTab] = useState('estoque');
  const [finTab, setFinTab] = useState('contas');
  const [geralTab, setGeralTab] = useState('empresa');

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setUserLoaded(true); }).catch(() => setUserLoaded(true));
  }, []);

  if (!userLoaded) return null;

  const isAdmin = user?.role === 'admin';
  const hasConfigAccess = isAdmin || user?.override_permissoes?.['configuracoes.acesso'] === true;

  if (!hasConfigAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Você não tem permissão para acessar as configurações do sistema. Solicite acesso ao administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 overflow-x-hidden">
      <div>
        <h1 className="text-lg font-semibold text-foreground font-glacial">Configurações</h1>
        <p className="text-xs text-muted-foreground">Regras de negócio e parâmetros do sistema</p>
      </div>

      {/* Tabs principais */}
      <GlacialTabsList scrollable>
        <GlacialTabsTrigger value="vendas"     activeValue={tab} onSelect={setTab} icon={TrendingUp}  label="Vendas" pulseSensor="configuracoes.tab-vendas" />
        <GlacialTabsTrigger value="operacoes"  activeValue={tab} onSelect={setTab} icon={Package}     label="Operações" />
        <GlacialTabsTrigger value="financeiro" activeValue={tab} onSelect={setTab} icon={DollarSign}  label="Financeiro" />
        <GlacialTabsTrigger value="geral"      activeValue={tab} onSelect={setTab} icon={Settings}    label="Parâmetros" />
        <GlacialTabsTrigger value="sistema"    activeValue={tab} onSelect={setTab} icon={Wrench}      label="Ferramentas" />
      </GlacialTabsList>

      <div className="pt-1">
        {/* VENDAS */}
        {tab === 'vendas' && (
          <div className="space-y-4">
            <GlacialSubTabsList>
              <GlacialSubTabsTrigger value="fluxo"       activeValue={vendaTab} onSelect={setVendaTab} icon={Sliders}  label="Fluxo & Parâmetros" />
              <GlacialSubTabsTrigger value="metas"       activeValue={vendaTab} onSelect={setVendaTab} icon={BarChart3} label="Metas Dashboard" />
              <GlacialSubTabsTrigger value="tabelas"     activeValue={vendaTab} onSelect={setVendaTab} icon={Tags}     label="Tabelas & Políticas" />
            </GlacialSubTabsList>
            <div>
              {vendaTab === 'fluxo'       && <ConfiguracoesVendaManager />}
              {vendaTab === 'metas'       && <MetasDashboardKpiManager />}
              {vendaTab === 'tabelas'     && <TabelasPrecoManager />}
            </div>
          </div>
        )}

        {/* OPERAÇÕES */}
        {tab === 'operacoes' && (
          <div className="space-y-4">
            <GlacialSubTabsList>
              <GlacialSubTabsTrigger value="estoque" activeValue={opTab} onSelect={setOpTab} icon={Package} label="Estoque" />
              <GlacialSubTabsTrigger value="areas"   activeValue={opTab} onSelect={setOpTab} icon={MapPin}  label="Áreas/Setores" />
            </GlacialSubTabsList>
            <div>
              {opTab === 'estoque' && <ConfigEstoqueManager />}
              {opTab === 'areas'   && <AreasManager />}
            </div>
          </div>
        )}

        {/* FINANCEIRO */}
        {tab === 'financeiro' && (
          <div className="space-y-4">
            <GlacialSubTabsList>
              <GlacialSubTabsTrigger value="contas"      activeValue={finTab} onSelect={setFinTab} icon={Wallet}     label="Contas" />
              <GlacialSubTabsTrigger value="formas"      activeValue={finTab} onSelect={setFinTab} icon={CreditCard} label="Pagamentos" />
              <GlacialSubTabsTrigger value="maquininhas" activeValue={finTab} onSelect={setFinTab} icon={Smartphone} label="Maquininhas" />
              <GlacialSubTabsTrigger value="categorias"  activeValue={finTab} onSelect={setFinTab} icon={Bookmark}   label="Categorias" />
            </GlacialSubTabsList>
            <div>
              {finTab === 'contas'      && <ContasFinanceirasManager />}
              {finTab === 'formas'      && <FormasPagamentoManager />}
              {finTab === 'maquininhas' && <MaquininhasManager />}
              {finTab === 'categorias'  && <CategoriasFinanceirasManager />}
            </div>
          </div>
        )}

        {/* PARÂMETROS GERAIS */}
        {tab === 'geral' && (
          <div className="space-y-4">
            <GlacialSubTabsList>
              <GlacialSubTabsTrigger value="empresa"       activeValue={geralTab} onSelect={setGeralTab} icon={Building2} label="Dados da Empresa" />
              <GlacialSubTabsTrigger value="usuarios-app"  activeValue={geralTab} onSelect={setGeralTab} icon={Users}     label="Usuários" />
              <GlacialSubTabsTrigger value="perfis-acesso" activeValue={geralTab} onSelect={setGeralTab} icon={Shield}    label="Perfis de Acesso" />
            </GlacialSubTabsList>
            <div>
              {geralTab === 'empresa'       && <DadosEmpresaManager />}
              {geralTab === 'usuarios-app'  && <ListaUsuariosApp />}
              {geralTab === 'perfis-acesso' && <PerfisDeAcessoManager />}
            </div>
          </div>
        )}

        {/* FERRAMENTAS */}
        {tab === 'sistema' && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground/90">Ferramentas de Sistema</h2>
            </div>

            {/* Documentos */}
            <div className="rounded-2xl bg-muted/50/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Documentos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to={createPageUrl('ReimpressaoDocumentos')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 shadow-sm hover:shadow transition-shadow"
                >
                  <Printer className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground/90">Reimpressão</p>
                    <p className="text-xs text-muted-foreground">Reimprimir cupons e pedidos</p>
                  </div>
                </Link>
                <Link
                  to={createPageUrl('ExclusaoDocumentos')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 shadow-sm hover:shadow transition-shadow"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground/90">Excluir Documentos</p>
                    <p className="text-xs text-muted-foreground">Remoção permanente de registros</p>
                  </div>
                </Link>
              </div>
            </div>

            <MetasEstoqueConfigTool />
            <CodigoProdutoBackfillTool />

            <div className="rounded-2xl bg-muted/50/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inteligência artificial</p>
              <Link
                to={createPageUrl('LlmTelemetria')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 shadow-sm hover:shadow transition-shadow"
              >
                <Activity className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground/90">Telemetria de IA (OCR)</p>
                  <p className="text-xs text-muted-foreground">Tokens, custo estimado e alertas de uso</p>
                </div>
              </Link>
            </div>

            <RecomecarDoZero />
          </div>
        )}
      </div>
    </div>
  );
}