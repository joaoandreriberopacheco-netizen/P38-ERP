import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Receipt, Edit, Eye, X, Package } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ProcessarVendasView({ rascunhosAguardando = [], onBack, onRefresh, onAbrirPedido, formatarValorExibicao }) {
  const [rascunhoDetalhes, setRascunhoDetalhes] = useState(null);

  return (
    <div className="relative flex-1 min-h-0 h-0 flex flex-col bg-background">
      <div className="bg-card border-b border-border/40 px-4 py-3 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors" style={{ minWidth: '44px', minHeight: '44px' }}>
          <ArrowLeft className="w-6 h-6 text-foreground/90" />
        </button>
        <h2 className="flex-1 text-center text-lg font-semibold text-foreground font-glacial">Processar Vendas</h2>
        <button onClick={onRefresh} className="p-2 hover:bg-muted rounded-lg transition-colors" style={{ minWidth: '44px', minHeight: '44px' }} title="Atualizar (F7)">
          <RefreshCw className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 min-h-0 h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-1">Aguardando</div>
            <div className="text-2xl font-bold text-foreground font-glacial">
              {rascunhosAguardando.length} {rascunhosAguardando.length === 1 ? 'Venda' : 'Vendas'}
            </div>
          </div>

          {rascunhosAguardando.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Receipt className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-muted-foreground">Nenhuma venda aguardando</p>
              <p className="text-sm text-muted-foreground mt-1">As vendas aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rascunhosAguardando.map((rascunho) => (
                <div key={rascunho.id} className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onAbrirPedido(rascunho)}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    {rascunho.senha_atendimento && (
                      <div className="px-4 py-2 bg-muted/40 dark:bg-muted rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1">Senha</div>
                        <div className="text-3xl font-bold text-foreground font-mono">{rascunho.senha_atendimento.slice(-4)}</div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-foreground truncate">{rascunho.cliente_nome}</div>
                      <div className="text-sm text-muted-foreground mt-1">{rascunho.vendedor_nome}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground font-glacial">R$ {formatarValorExibicao(rascunho.valor_total)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{rascunho.itens?.length || 0} {rascunho.itens?.length === 1 ? 'item' : 'itens'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRascunhoDetalhes(rascunho); }}
                      className="h-12 px-4 bg-muted/40 dark:bg-muted text-foreground/90 rounded-xl font-medium hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center gap-2"
                      style={{ minHeight: '48px' }}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(createPageUrl('PDV') + `?mode=vendedor&rascunho_id=${rascunho.id}`, '_blank'); }}
                      className="flex-1 h-12 bg-muted/40 dark:bg-muted text-foreground/90 rounded-xl font-medium hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center gap-2"
                      style={{ minHeight: '48px' }}>
                      <Edit className="w-4 h-4" /><span>Editar</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onAbrirPedido(rascunho); }}
                      className="flex-1 h-12 bg-card text-card-foreground rounded-xl font-medium hover:shadow-md transition-shadow"
                      style={{ minHeight: '48px' }}>
                      Confirmar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {rascunhoDetalhes && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setRascunhoDetalhes(null)}
          role="presentation"
        >
          <div
            className="bg-card rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Senha</div>
                <div className="text-3xl font-bold font-mono text-foreground">{rascunhoDetalhes.senha_atendimento?.slice(-4)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">{rascunhoDetalhes.cliente_nome || 'Avulso'}</div>
                <div className="text-xs text-muted-foreground">{rascunhoDetalhes.vendedor_nome}</div>
              </div>
              <button onClick={() => setRascunhoDetalhes(null)} className="p-2 hover:bg-muted rounded-xl">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Itens</div>
              {(rascunhoDetalhes.itens || []).map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 dark:border-border/40 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-snug">{item.produto_nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">R$ {(item.preco_unitario_praticado || 0).toFixed(2)} × {item.quantidade} {item.unidade_medida || 'UN'}</div>
                  </div>
                  <div className="text-sm font-semibold text-foreground flex-shrink-0">R$ {formatarValorExibicao(item.total || 0)}</div>
                </div>
              ))}
              {rascunhoDetalhes.valor_desconto > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Desconto</span><span>-R$ {formatarValorExibicao(rascunhoDetalhes.valor_desconto)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border/40">
                <span>Total</span><span>R$ {formatarValorExibicao(rascunhoDetalhes.valor_total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}