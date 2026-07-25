import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, ShoppingCart, FileText, ChevronRight, Package, Clock } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OrcamentosRecentesSheet({ isOpen, onClose, currentUser, tabelaPreco, onCarregarOrcamento }) {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (isOpen) loadOrcamentos();
  }, [isOpen]);

  const loadOrcamentos = async () => {
    setLoading(true);
    try {
      const todos = await base44.entities.PedidoVenda.filter({ tipo: 'Orçamento' }, '-created_date', 50);
      const limite = subDays(new Date(), 2);
      const recentes = todos.filter(o => new Date(o.created_date) >= limite);
      setOrcamentos(recentes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCarregar = (orcamento) => {
    const itensCarrinho = (orcamento.itens || []).map(item => ({
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      codigo_interno: item.codigo_interno || '',
      quantidade: item.quantidade,
      unidade_medida: item.unidade_medida || 'UN',
      fator_conversao: item.fator_conversao || 1,
      quantidade_base: item.quantidade_base || ((Number(item.quantidade) || 0) * (Number(item.fator_conversao) || 1)),
      preco_unitario: item.preco_unitario_praticado,
      preco_unitario_praticado: item.preco_unitario_praticado,
      custo_unitario_momento: item.custo_unitario_momento || 0,
      total: item.total,
      estoque_disponivel: 999
    }));
    onCarregarOrcamento(itensCarrinho, orcamento);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/40 dark:bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-card border-b border-border/40 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground font-glacial">Orçamentos Recentes</h2>
          <p className="text-xs text-muted-foreground">Últimos 2 dias</p>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-2xl bg-muted">
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-border/40 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum orçamento nos últimos 2 dias</p>
          </div>
        ) : (
          orcamentos.map(orc => {
            const isExpanded = expandedId === orc.id;
            const dataCriacao = new Date(orc.created_date);
            return (
              <div key={orc.id} className="bg-card rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : orc.id)}
                  className="w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-muted/40 dark:active:bg-primary/60 transition-colors"
                >
                  {/* Ícone */}
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {orc.cliente_nome || 'Sem cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(orc.itens || []).length} item(s) · {format(dataCriacao, "dd/MM · HH'h'mm", { locale: ptBR })}
                    </p>
                  </div>
                  {/* Total + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-base font-bold text-foreground tabular-nums">
                      R$ {fmtR(orc.valor_total)}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                    {/* Itens */}
                    <div className="space-y-1.5">
                      {(orc.itens || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-border/30 dark:border-border/40 last:border-b-0">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-xs text-foreground/90 truncate">{item.produto_nome}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground font-medium">{item.quantidade}×</span>
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              R$ {fmtR(item.total)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Botão carregar */}
                    <button
                      onClick={() => handleCarregar(orc)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-background dark:bg-muted text-foreground rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Carregar no PDV
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}