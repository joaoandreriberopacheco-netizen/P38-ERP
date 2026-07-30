import React, { useState, useEffect, lazy, Suspense } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Target, 
  Percent,
  Tag,
  Calendar as CalendarIcon,
  AlertCircle,
  Clock
} from 'lucide-react';

import { format, startOfDay, startOfMonth, subDays } from 'date-fns';

const DashboardVendedorVendasChart = lazy(() => import('@/components/dashboard/DashboardVendedorVendasChart'));

const dateKey = (value) => format(value instanceof Date ? value : new Date(value), 'yyyy-MM-dd');

export default function DashboardVendedor() {
  const [userData, setUserData] = useState(null);
  const [vendasHoje, setVendasHoje] = useState([]);
  const [vendasMes, setVendasMes] = useState([]);
  const [tabelaPreco, setTabelaPreco] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [metaMensal, setMetaMensal] = useState(50000); // Mock - deve vir de configuração
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setUserData(user);

      // Vendas de hoje
      const hoje = dateKey(startOfDay(new Date()));
      const vendasHj = await base44.entities.PedidoVenda.filter({
        vendedor_id: user.id,
        created_date: { $gte: hoje }
      });
      setVendasHoje(vendasHj);

      // Vendas do mês
      const inicioMes = dateKey(startOfMonth(new Date()));
      const vendasM = await base44.entities.PedidoVenda.filter({
        vendedor_id: user.id,
        created_date: { $gte: inicioMes }
      });
      setVendasMes(vendasM);

      // Tabela de preço (buscar a configurada para este vendedor)
      const tabelas = await base44.entities.TabelaPreco.filter({ ativo: true });
      if (tabelas.length > 0) {
        setTabelaPreco(tabelas[0]); // Simplificado
      }

      // Agendamentos logísticos
      const agenda = await base44.entities.AgendaLogistica.filter({
        data_agendada: { $gte: dateKey(new Date()) }
      });
      setAgendamentos(agenda.slice(0, 5));

      // Avisos automáticos
      const avisosAuto = await base44.entities.AvisosAuto.list();
      setAvisos(avisosAuto.slice(0, 3));

    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalVendasHoje = vendasHoje.reduce((acc, v) => acc + (v.valor_total || 0), 0);
  const totalVendasMes = vendasMes.reduce((acc, v) => acc + (v.valor_total || 0), 0);
  const percentualMeta = (totalVendasMes / metaMensal) * 100;

  // Dados para gráfico mensal
  const vendasPorDia = React.useMemo(() => {
    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const dia = subDays(new Date(), i);
      const diaKey = dateKey(dia);
      const vendasDia = vendasMes.filter((v) => dateKey(v.created_date) === diaKey);
      const total = vendasDia.reduce((acc, v) => acc + (v.valor_total || 0), 0);
      dias.push({
        dia: format(dia, 'dd/MM'),
        valor: total,
      });
    }
    return dias;
  }, [vendasMes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border/40 dark:border-border/40"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 font-glacial">
      {/* Header */}
      <div className="pb-3 md:pb-4 border-b border-border/40">
        <h1 className="text-xl md:text-3xl font-semibold text-foreground">
          Olá, {userData?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground font-light">
          Seu desempenho de vendas
        </p>
      </div>

      {/* KPIs do Dia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Vendas Hoje</p>
                <p className="text-2xl font-semibold text-foreground">
                  R$ {totalVendasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {vendasHoje.length} venda{vendasHoje.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total do Mês</p>
                <p className="text-2xl font-semibold text-foreground">
                  R$ {totalVendasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {vendasMes.length} vendas
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Meta Mensal</p>
                <p className="text-2xl font-semibold text-foreground">
                  {percentualMeta.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Faltam R$ {(metaMensal - totalVendasMes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de Vendas */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-medium text-foreground/90 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Vendas nos Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <Suspense fallback={<div className="h-[200px] animate-pulse rounded-lg bg-muted" />}>
              <DashboardVendedorVendasChart
                data={vendasPorDia}
                metaMensal={metaMensal}
                percentualMeta={percentualMeta}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Tabela de Preços e Descontos */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-medium text-foreground/90 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Sua Tabela de Preços
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {tabelaPreco ? (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tabelaPreco.nome_tabela}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fator de ajuste: {((tabelaPreco.fator_ajuste - 1) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Badge className="bg-blue-600 text-white border-0">Ativa</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground/90">Desconto Comercial</span>
                    </div>
                    <span className="font-semibold text-foreground">
                      {tabelaPreco.permite_desconto_comercial ? 'Permitido' : 'Não Permitido'}
                    </span>
                  </div>

                  {tabelaPreco.permite_desconto_comercial && (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="text-sm text-foreground/90">Desconto Máximo</span>
                      <span className="text-lg font-semibold text-green-700 dark:text-green-400">
                        {tabelaPreco.percentual_desconto_maximo}%
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma tabela de preços ativa</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Avisos */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-medium text-foreground/90 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Avisos e Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {avisos.length > 0 ? (
              <div className="space-y-3">
                {avisos.map((aviso, idx) => (
                  <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      {aviso.titulo || 'Aviso'}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {aviso.mensagem || 'Sem detalhes'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum aviso no momento</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agenda de Entregas */}
        <Card className="border-0 shadow-sm bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-medium text-foreground/90 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Próximas Entregas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {agendamentos.length > 0 ? (
              <div className="space-y-2">
                {agendamentos.map((agenda, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {agenda.cliente_nome || 'Cliente'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(agenda.data_entrega), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {agenda.periodo || 'Manhã'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma entrega agendada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}