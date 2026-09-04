import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Receipt, Printer, X, ShoppingCart, Package, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComprovantePreVenda from '@/components/vendas/ComprovantePreVenda';
import ComprovanteCompra from '@/components/vendas/ComprovanteCompra';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import { P38MobileLineList, P38MobileLine, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { toast } from 'sonner';

/** Mesmos status que o caixa deixa após aprovar (Financeiro OK) até concluído. */
const STATUS_VENDA_REIMPRESSAO = [
  'Financeiro OK',
  'Em Separação',
  'Em Rota de Entrega',
  'Pedido Concluído',
];

const TIPOS_DOCUMENTO = [
  { value: 'prevenda', label: 'Pré-Vendas', icon: FileText, entity: 'PedidoVenda', filter: (d) => d.tipo === 'Pedido' },
  {
    value: 'venda',
    label: 'Vendas Finalizadas',
    icon: Receipt,
    entity: 'PedidoVenda',
    filter: (d) => d.tipo !== 'Pedido' && STATUS_VENDA_REIMPRESSAO.includes(d.status),
  },
  { value: 'pedido_compra', label: 'Pedidos de Compra', icon: ShoppingCart, entity: 'PedidoCompra' },
  { value: 'movimentacao', label: 'Movimentações Estoque', icon: Package, entity: 'MovimentacaoEstoque' },
  { value: 'agenda_entrega', label: 'Agendas de Entrega', icon: Truck, entity: 'AgendaLogistica' },
];

export default function ReimpressaoDocumentos() {
  const [tipoDoc, setTipoDoc] = useState('prevenda');
  const [busca, setBusca] = useState('');
  const [documentoSelecionado, setDocumentoSelecionado] = useState(null);
  const [showComprovante, setShowComprovante] = useState(false);
  const [carregandoComprovante, setCarregandoComprovante] = useState(false);
  const [ultimoDocumento, setUltimoDocumento] = useState(null);

  // Buscar último documento ao trocar tipo
  useEffect(() => {
    const buscarUltimo = async () => {
      const tipo = TIPOS_DOCUMENTO.find(t => t.value === tipoDoc);
      if (!tipo) return;

      try {
        const docs = await base44.entities[tipo.entity].list('-created_date', 1);
        if (docs && docs.length > 0) {
          const doc = docs[0];
          if (tipo.filter) {
            const todosDoc = await base44.entities[tipo.entity].list('-created_date', 50);
            const filtrado = todosDoc.find(tipo.filter);
            if (filtrado) {
              setUltimoDocumento(filtrado);
              setBusca(filtrado.numero || '');
            }
          } else {
            setUltimoDocumento(doc);
            setBusca(doc.numero || '');
          }
        }
      } catch (error) {
        console.error('Erro ao buscar último documento:', error);
      }
    };

    buscarUltimo();
  }, [tipoDoc]);

  // Buscar documentos
  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['documentos-reimpressao', tipoDoc, busca],
    queryFn: async () => {
      if (!busca || busca.length < 3) return [];
      
      const tipo = TIPOS_DOCUMENTO.find(t => t.value === tipoDoc);
      if (!tipo) return [];

      const docs = await base44.entities[tipo.entity].list('-created_date', 100);
      
      return docs.filter(d => {
        const matchFilter = tipo.filter ? tipo.filter(d) : true;
        const matchBusca = 
          d.numero?.toLowerCase().includes(busca.toLowerCase()) ||
          d.senha_atendimento?.includes(busca) ||
          d.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
          d.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase()) ||
          d.produto_nome?.toLowerCase().includes(busca.toLowerCase());
        
        return matchFilter && matchBusca;
      }).slice(0, 20);
    },
    enabled: busca.length >= 3,
  });

  const handlePrint = async (doc) => {
    const tipo = TIPOS_DOCUMENTO.find((t) => t.value === tipoDoc);
    if (!tipo || tipo.entity !== 'PedidoVenda') {
      toast.info('Reimpressão deste tipo de documento ainda não está disponível.');
      return;
    }

    setCarregandoComprovante(true);
    try {
      let enriched = doc;
      if (!Array.isArray(doc?.itens) || doc.itens.length === 0) {
        const [hydrated] = await hydratePedidosVendaItensFromSql(base44, [doc]);
        enriched = hydrated || doc;
      }
      setDocumentoSelecionado(enriched);
      setShowComprovante(true);
    } catch (error) {
      console.error('Erro ao preparar comprovante:', error);
      toast.error('Não foi possível carregar os itens do pedido para reimpressão.');
    } finally {
      setCarregandoComprovante(false);
    }
  };

  const fecharComprovante = () => {
    setShowComprovante(false);
    setDocumentoSelecionado(null);
  };

  return (
    <div className="min-h-screen bg-muted/40 dark:bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Printer className="w-6 h-6 text-foreground/90" />
            <h1 className="text-2xl font-semibold text-foreground font-glacial">
              Reimpressão de Documentos
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Busque e reimprima pré-vendas ou vendas finalizadas
          </p>
        </div>

        {/* Seletor de tipo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground/90 mb-2">
            Tipo de Documento
          </label>
          <Select value={tipoDoc} onValueChange={(val) => { setTipoDoc(val); setBusca(''); }}>
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((tipo) => {
                const Icon = tipo.icon;
                return (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{tipo.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Busca */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente, fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10 bg-card"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-muted-foreground" />
            </button>
          )}
          {ultimoDocumento && busca === ultimoDocumento.numero && (
            <p className="text-xs text-muted-foreground mt-1">
              Último documento: {ultimoDocumento.numero}
            </p>
          )}
        </div>

        {/* Resultados */}
        {busca.length > 0 && busca.length < 3 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Digite pelo menos 3 caracteres para buscar
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-border/40 border-t-primary dark:border-border/40 dark:border-t-foreground rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!isLoading && busca.length >= 3 && documentos.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum documento encontrado
          </div>
        )}

        {!isLoading && documentos.length > 0 && (
          <P38MobileLineList>
            {documentos.map((doc, index) => {
              const tipoLabel = TIPOS_DOCUMENTO.find((t) => t.value === tipoDoc)?.label || tipoDoc;
              const tone = p38StatusTone(doc.status || tipoLabel);
              const nome =
                doc.cliente_nome || doc.fornecedor_nome || doc.produto_nome || 'Sem identificação';
              return (
                <P38MobileLine
                  key={doc.id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(tone)}
                  title={doc.numero}
                  subtitle={nome}
                  meta={
                    <>
                      <P38StatusLabel tone={tone}>{doc.status || tipoLabel}</P38StatusLabel>
                      {tipoDoc === 'prevenda' && doc.senha_atendimento ? (
                        <span>Senha {doc.senha_atendimento}</span>
                      ) : null}
                      <span className="tabular-nums">
                        {new Date(doc.created_date).toLocaleDateString('pt-BR')}
                      </span>
                    </>
                  }
                  value={`R$ ${(doc.valor_total || 0).toFixed(2)}`}
                  trailing={
                    <Button
                      onClick={() => handlePrint(doc)}
                      size="sm"
                      className="h-8 shrink-0"
                      disabled={carregandoComprovante}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  }
                />
              );
            })}
          </P38MobileLineList>
        )}
      </div>

      {/* Mesmo overlay do caixa (PDVCaixa) — sem Dialog por cima */}
      {showComprovante && documentoSelecionado && tipoDoc === 'prevenda' ? (
        <ComprovantePreVenda
          preVenda={documentoSelecionado}
          open={showComprovante}
          onClose={fecharComprovante}
        />
      ) : null}

      {showComprovante && documentoSelecionado && tipoDoc === 'venda' ? (
        <ComprovanteCompra
          pedido={documentoSelecionado}
          open={showComprovante}
          onClose={fecharComprovante}
        />
      ) : null}
    </div>
  );
}