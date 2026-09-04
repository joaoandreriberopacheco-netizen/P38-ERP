import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { Package, PackagePlus, AlertTriangle, TrendingDown, RefreshCw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';

function motivoTone(motivo) {
  if (motivo === 'Sem Estoque') return 'danger';
  if (motivo === 'Preço Alto') return 'warning';
  return 'muted';
}

export default function VendasPerdidasPage() {
  const [vendasPerdidas, setVendasPerdidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mix');

  useEffect(() => {
    loadVendasPerdidas();
  }, []);

  const loadVendasPerdidas = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.VendaPerdida.list('-created_date');
      setVendasPerdidas(data);
    } catch (error) {
      console.error('Erro ao carregar vendas perdidas:', error);
    } finally {
      setLoading(false);
    }
  };

  const vendasMix = vendasPerdidas.filter(vp => vp.is_produto_do_mix !== false);
  const vendasNaoMix = vendasPerdidas.filter(vp => vp.is_produto_do_mix === false);

  const produtosNaoMixAgrupados = vendasNaoMix.reduce((acc, vp) => {
    const nome = vp.nome_produto_nao_mix || 'Sem nome';
    if (!acc[nome]) {
      acc[nome] = { nome, quantidade_total: 0, registros: [] };
    }
    acc[nome].quantidade_total += vp.quantidade_desejada || 0;
    acc[nome].registros.push(vp);
    return acc;
  }, {});

  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-din-1451 bg-background pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="flex items-center justify-between">
        <P38PageHeader
          variant="page"
          title="Vendas Perdidas"
          description="Análise de oportunidades e sugestões de mix"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={loadVendasPerdidas}
          className="text-muted-foreground hover:text-foreground/90"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: TrendingDown, label: 'Total Registros', value: vendasPerdidas.length, tone: 'danger' },
          { icon: Package, label: 'Produtos do Mix', value: vendasMix.length, tone: 'muted' },
          { icon: PackagePlus, label: 'Sugestões Novos', value: Object.keys(produtosNaoMixAgrupados).length, tone: 'warning' },
          { icon: AlertTriangle, label: 'Sem Estoque', value: vendasPerdidas.filter(vp => vp.motivo_perda === 'Sem Estoque').length, tone: 'danger' },
        ].map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="p38-panel border border-border/40 dark:border-white/10">
            <div className="p38-panel__body py-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${tone === 'danger' ? 'text-red-500' : tone === 'warning' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className="p38-micro-label">{label}</span>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent border-b border-border/40 rounded-none h-auto p-0 w-full justify-start">
          <TabsTrigger
            value="mix"
            data-pulse-sensor="vendas-perdidas.tab-mix"
            className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3 px-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Package className="w-4 h-4 mr-2" />
            Produtos do Mix ({vendasMix.length})
          </TabsTrigger>
          <TabsTrigger
            value="nao-mix"
            className="border-b-2 border-transparent data-[state=active]:border-primary rounded-none py-3 px-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <PackagePlus className="w-4 h-4 mr-2" />
            Sugestões ({Object.keys(produtosNaoMixAgrupados).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mix" className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : vendasMix.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border/40 rounded-lg">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p>Nenhum registro de venda perdida de produtos do mix</p>
            </div>
          ) : (
            <P38MobileLineList>
              {vendasMix.map((vp, index) => (
                <P38MobileLine
                  key={vp.id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(motivoTone(vp.motivo_perda))}
                  title={vp.produto_consultado_nome || 'Produto não identificado'}
                  subtitle={
                    vp.created_date
                      ? format(new Date(vp.created_date), 'dd/MM/yyyy HH:mm')
                      : '—'
                  }
                  meta={
                    <>
                      <P38StatusLabel tone={motivoTone(vp.motivo_perda)}>{vp.motivo_perda || '—'}</P38StatusLabel>
                      <span>Qtd: {formatValor(vp.quantidade_desejada)}</span>
                      {vp.vendedor_nome ? <span>{vp.vendedor_nome}</span> : null}
                    </>
                  }
                  valueSub={vp.observacao ? String(vp.observacao).slice(0, 48) : undefined}
                />
              ))}
            </P38MobileLineList>
          )}
        </TabsContent>

        <TabsContent value="nao-mix" className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : Object.keys(produtosNaoMixAgrupados).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border/40 rounded-lg">
              <PackagePlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p>Nenhuma sugestão de novo produto registrada</p>
            </div>
          ) : (
            <P38MobileLineList>
              {Object.values(produtosNaoMixAgrupados)
                .sort((a, b) => b.quantidade_total - a.quantidade_total)
                .map((item, index) => (
                  <P38MobileLine
                    key={item.nome}
                    striped={index % 2 === 1}
                    accent="warning"
                    title={item.nome}
                    subtitle={`${item.registros.length} solicitação(ões)`}
                    meta={
                      <>
                        <P38StatusLabel tone="warning">Sugestão</P38StatusLabel>
                        {item.registros.slice(0, 2).map((reg, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {reg.created_date ? format(new Date(reg.created_date), 'dd/MM/yyyy') : '—'}
                          </span>
                        ))}
                      </>
                    }
                    value={`${formatValor(item.quantidade_total)} un.`}
                  />
                ))}
            </P38MobileLineList>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
