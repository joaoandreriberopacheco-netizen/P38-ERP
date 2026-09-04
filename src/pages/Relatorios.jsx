import React, { useState, useMemo } from 'react';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { TrendingUp, ShoppingCart, Warehouse, DollarSign, Download, FileText, ChevronRight, BarChart3, ClipboardPenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import RelatorioPerformance from './RelatorioPerformance';
import SeletorProdutoRPP from '@/components/relatorios/SeletorProdutoRPP';
import { usePermissoesUsuario } from '@/hooks/usePermissoesUsuario';

export default function RelatoriosPage() {
  const { tem: podePerm } = usePermissoesUsuario();
  const podeVendas = podePerm('relatorios.relatorio_vendas', 'relatorios.acesso');
  const podeEstoque = podePerm('relatorios.relatorio_estoque', 'relatorios.acesso');
  const podeFinanceiro = podePerm('relatorios.relatorio_financeiro', 'relatorios.acesso');
  const podeMargem = podePerm('relatorios.relatorio_margem', 'relatorios.acesso');
  const podeGeral = podePerm('relatorios.acesso');

  const defaultTab = useMemo(() => {
    if (podeVendas) return 'vendas';
    if (podeGeral) return 'gerenciais';
    if (podeEstoque) return 'estoque';
    if (podeFinanceiro) return 'financeiro';
    return 'vendas';
  }, [podeVendas, podeGeral, podeEstoque, podeFinanceiro]);

  const [showSeletor, setShowSeletor] = useState(false);
  const [showRPP, setShowRPP] = useState(false);
  const [dadosProdutoSelecionado, setDadosProdutoSelecionado] = useState(null);

  const relatoriosGerenciais = [
    { 
      id: 'ponto-equilibrio',
      nome: "Ponto de Equilíbrio", 
      descricao: "Análise mensal do ponto de equilíbrio operacional",
      icon: BarChart3
    },
    { 
      id: 'eficiencia-operacional',
      nome: "Eficiência Operacional", 
      descricao: "Lucro bruto vs. investimento em compras",
      icon: TrendingUp
    },
    { 
      id: 'dashboard-executivo',
      nome: "Dashboard Executivo", 
      descricao: "Consolidação de todos os KPIs do negócio",
      icon: BarChart3
    },
  ];

  const relatoriosVendas = [
    { 
      id: 'vendas-periodo',
      nome: "Vendas por Período", 
      descricao: "Faturamento detalhado por período",
      icon: TrendingUp
    },
    { 
      id: 'ranking-vendedores',
      nome: "Ranking de Vendedores", 
      descricao: "Performance individual da equipe",
      icon: TrendingUp
    },
    { 
      id: 'ticket-medio',
      nome: "Ticket Médio", 
      descricao: "Evolução do ticket ao longo do tempo",
      icon: DollarSign
    },
    { 
      id: 'taxa-conversao',
      nome: "Taxa de Conversão", 
      descricao: "Orçamentos vs. Pedidos finalizados",
      icon: TrendingUp
    },
    { 
      id: 'produtos-vendidos',
      nome: "Produtos Top", 
      descricao: "Top produtos por quantidade e faturamento",
      icon: ShoppingCart
    },
    { 
      id: 'markup-margem',
      nome: "Markup & Margem", 
      descricao: "Análise de markup e margem de contribuição",
      icon: TrendingUp,
      highlight: true
    },
    { 
      id: 'preco-justo',
      nome: "Preço Justo (Simulador)", 
      descricao: "Backtest de markup global 40% com subsídio KVI × pisos × conveniência",
      icon: BarChart3,
      highlight: true
    },
  ];

  const relatoriosCompras = [
    { 
      id: 'curva-abc-fornecedores',
      nome: "Curva ABC Fornecedores", 
      descricao: "Classificação por volume de compra",
      icon: ShoppingCart
    },
    { 
      id: 'lead-time',
      nome: "Lead Time", 
      descricao: "Tempo médio de entrega por fornecedor",
      icon: TrendingUp
    },
    { 
      id: 'historico-precos',
      nome: "Histórico de Preços", 
      descricao: "Evolução dos custos de aquisição",
      icon: DollarSign
    },
    { 
      id: 'pedidos-pendentes',
      nome: "Pedidos Pendentes", 
      descricao: "Listagem de POs aguardando recebimento",
      icon: ShoppingCart
    },
  ];

  const relatoriosEstoque = [
    {
      id: 'resumo-global-estoque',
      nome: 'Resumo global',
      descricao: 'Estoque físico + trânsito em 2 páginas (reunião)',
      icon: Warehouse,
      highlight: true,
    },
    { 
      id: 'inventario-valorizado',
      nome: "Inventário Valorizado", 
      descricao: "Estoque atual com valor investido",
      icon: Warehouse
    },
    { 
      id: 'giro-estoque',
      nome: "Giro de Estoque", 
      descricao: "Estoque + vendas 30/60 dias com hierarquia do catálogo",
      icon: TrendingUp,
      highlight: true,
    },
    { 
      id: 'estoque-critico',
      nome: "Estoque Crítico", 
      descricao: "Itens abaixo do estoque mínimo",
      icon: Warehouse
    },
    { 
      id: 'produtos-sem-giro',
      nome: "Sem Giro", 
      descricao: "Itens parados há mais de X dias",
      icon: Warehouse
    },
    { 
      id: 'historico-movimentacoes',
      nome: "Movimentações", 
      descricao: "Rastreabilidade de entradas/saídas",
      icon: TrendingUp
    },
    { 
      id: 'consumo-interno',
      nome: "Consumo Interno", 
      descricao: "Saídas internas por destinação, produto e período",
      icon: ClipboardPenLine
    },
    { 
      id: 'performance-produto',
      nome: "Performance Produto", 
      descricao: "Análise IEP e pilares operacionais",
      icon: BarChart3
    },
  ];

  const relatoriosFinanceiros = [
    { 
      id: 'fluxo-caixa',
      nome: "Fluxo de Caixa", 
      descricao: "Previsão de entradas e saídas",
      icon: DollarSign
    },
    { 
      id: 'contas-pagar',
      nome: "Contas a Pagar", 
      descricao: "Obrigações financeiras pendentes",
      icon: DollarSign
    },
    { 
      id: 'contas-receber',
      nome: "Contas a Receber", 
      descricao: "Valores a receber de clientes",
      icon: DollarSign
    },
    { 
      id: 'dre',
      nome: "DRE", 
      descricao: "Receitas, custos e despesas",
      icon: FileText
    },
  ];

  const RelatorioCard = ({ relatorio, onClickAbrir }) => {
    const Icon = relatorio.icon;
    return (
      <Card 
        onClick={() => onClickAbrir?.(relatorio.id)}
        className={`cursor-pointer transition-all hover:shadow-sm ${
          relatorio.highlight ? 'ring-2 ring-green-500/30 bg-green-50/30 dark:bg-green-900/10' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              relatorio.highlight 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-muted'
            }`}>
              <Icon className={`w-5 h-5 ${
                relatorio.highlight 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-muted-foreground'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm md:text-base text-foreground">
                {relatorio.nome}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {relatorio.descricao}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full pb-6">
      {/* Header */}
      <div className="px-4 md:px-6 py-6 md:py-8 bg-card border-b border-border/40">
        <P38PageHeader
          variant="page"
          title="Relatórios"
          description="Acesse análises estratégicas e operacionais do seu negócio."
        />
      </div>

      {/* Tabs Navigation */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="sticky top-0 z-20 bg-card border-b border-border/40">
          <div className="px-4 md:px-6">
            <TabsList className="w-full h-auto justify-start gap-2 md:gap-4 bg-transparent p-0 border-b border-border/40">
              {podeVendas && (
              <TabsTrigger 
                value="vendas" 
                data-pulse-sensor="relatorios.tab-vendas"
                className="px-0 py-3 text-xs md:text-sm font-medium border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-none"
              >
                Vendas
              </TabsTrigger>
              )}
              {podeGeral && (
              <TabsTrigger 
                value="gerenciais" 
                className="px-0 py-3 text-xs md:text-sm font-medium border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-none"
              >
                Gerenciais
              </TabsTrigger>
              )}
              {podeEstoque && (
              <TabsTrigger 
                value="estoque" 
                className="px-0 py-3 text-xs md:text-sm font-medium border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-none"
              >
                Estoque
              </TabsTrigger>
              )}
              {podeGeral && (
              <TabsTrigger 
                value="compras" 
                className="px-0 py-3 text-xs md:text-sm font-medium border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-none"
              >
                Compras
              </TabsTrigger>
              )}
              {podeFinanceiro && (
              <TabsTrigger 
                value="financeiro" 
                className="px-0 py-3 text-xs md:text-sm font-medium border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 rounded-none"
              >
                Financeiro
              </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="px-4 md:px-6 py-6 md:py-8">
          {podeVendas && (
          <TabsContent value="vendas" className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {relatoriosVendas.filter((rel) => {
                if (rel.id === 'markup-margem') return podeMargem;
                if (rel.id === 'preco-justo') return podeVendas;
                return true;
              }).map((rel) => (
                <RelatorioCard 
                  key={rel.id} 
                  relatorio={rel}
                  onClickAbrir={(id) => {
                    if (id === 'markup-margem') {
                      window.location.href = '/RelatorioMargem';
                    } else if (id === 'preco-justo') {
                      window.location.href = '/PrecoJustoDashboard';
                    }
                  }}
                />
              ))}
            </div>
          </TabsContent>
          )}

          {podeGeral && (
          <TabsContent value="gerenciais" className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {relatoriosGerenciais.map((rel) => (
                <RelatorioCard key={rel.id} relatorio={rel} />
              ))}
            </div>
          </TabsContent>
          )}

          {podeEstoque && (
          <TabsContent value="estoque" className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {relatoriosEstoque.map((rel) => (
                <RelatorioCard 
                  key={rel.id} 
                  relatorio={rel}
                  onClickAbrir={(id) => {
                    if (id === 'resumo-global-estoque') {
                      window.location.href = '/Produtos?relatorioEstoqueGlobal=1';
                    } else if (id === 'inventario-valorizado') {
                      window.location.href = '/Produtos?relatorioEstoque=1';
                    } else if (id === 'giro-estoque') {
                      window.location.href = '/Produtos?relatorioVendas=1';
                    } else if (id === 'consumo-interno') {
                      window.location.href = '/RelatorioConsumoInterno';
                    } else if (id === 'performance-produto') {
                      setShowSeletor(true);
                    }
                  }}
                />
              ))}
            </div>
          </TabsContent>
          )}

          {podeGeral && (
          <TabsContent value="compras" className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {relatoriosCompras.map((rel) => (
                <RelatorioCard key={rel.id} relatorio={rel} />
              ))}
            </div>
          </TabsContent>
          )}

          {podeFinanceiro && (
          <TabsContent value="financeiro" className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {relatoriosFinanceiros.map((rel) => (
                <RelatorioCard key={rel.id} relatorio={rel} />
              ))}
            </div>
          </TabsContent>
          )}
        </div>
      </Tabs>

      {showSeletor && (
        <SeletorProdutoRPP
          onSelectProduct={(produto) => {
            setDadosProdutoSelecionado({
              nome: produto.nome,
              tipo: produto.nivelHierarquico,
              categoria: produto.categoria,
              lucro90dias: produto.lucro90d,
              classeABCD: produto.classe,
              scoreIEP: produto.iep,
              janelaGiro: produto.janelaGiro,
              pilares: {
                margem: { valorReal: `${produto.margem.toFixed(1)}%`, score: 85, mediaCat: '38.5%' },
                giro: { valorReal: `${produto.giro} dias`, score: 72, mediaCat: '32 dias' },
                anexacao: { valorReal: `${produto.anexacao}%`, score: 68, mediaCat: '55%' }
              },
              outliers: [],
              empresa: {
                departamento: 'Inteligência & Compras',
                nome: 'VarejoSync',
                email: 'inteligencia@varejosynq.com.br'
              }
            });
            setShowSeletor(false);
            setShowRPP(true);
          }}
          onClose={() => setShowSeletor(false)}
        />
      )}

      {showRPP && dadosProdutoSelecionado && (
        <RelatorioPerformance 
          dados={dadosProdutoSelecionado}
          onClose={() => {
            setShowRPP(false);
            setDadosProdutoSelecionado(null);
          }} 
        />
      )}
    </div>
  );
}