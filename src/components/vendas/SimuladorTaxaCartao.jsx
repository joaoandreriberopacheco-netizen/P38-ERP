import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CreditCard, TrendingDown, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];

/**
 * Calcula o custo total da taxa para uma modalidade/parcelas
 * Lógica confirmada pelas simulações:
 * - Débito: taxa_debito simples
 * - Crédito 1x: taxa_credito_1x (apenas intermediação)
 * - Crédito parcelado: taxa_intermediacao_parcelado + taxa_parcelamento_vendedor[parcelas]
 */
export function calcularTaxaCartao(bandeiraCfg, modalidade, parcelas) {
  if (!bandeiraCfg) return { taxa_intermediacao: 0, taxa_parcelamento: 0, taxa_total: 0 };

  if (modalidade === 'Débito') {
    return {
      taxa_intermediacao: bandeiraCfg.taxa_debito || 0,
      taxa_parcelamento: 0,
      taxa_total: bandeiraCfg.taxa_debito || 0
    };
  }

  if (modalidade === 'Crédito à Vista' || parcelas === 1) {
    return {
      taxa_intermediacao: bandeiraCfg.taxa_credito_1x || 0,
      taxa_parcelamento: 0,
      taxa_total: bandeiraCfg.taxa_credito_1x || 0
    };
  }

  // Crédito parcelado
  const taxaInter = bandeiraCfg.taxa_intermediacao_parcelado || 0;
  const entrada = (bandeiraCfg.taxas_parcelamento_vendedor || []).find(t => t.parcelas === parcelas);
  const taxaParcela = entrada?.taxa_parcelamento_percentual || 0;
  const total = taxaInter + taxaParcela;

  return {
    taxa_intermediacao: taxaInter,
    taxa_parcelamento: taxaParcela,
    taxa_total: total
  };
}

export default function SimuladorTaxaCartao({ open, onClose, valorTotal, valorDesconto }) {
  const [maquininhas, setMaquininhas] = useState([]);
  const [maquininhaSel, setMaquininhaSel] = useState(null);
  const [bandeira, setBandeira] = useState('Visa');
  const [modalidade, setModalidade] = useState('Crédito à Vista');
  const [parcelas, setParcelas] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      base44.entities.Maquininha.filter({ ativo: true }).then(list => {
        setMaquininhas(list);
        if (list.length > 0) setMaquininhaSel(list[0]);
        setLoading(false);
      });
    }
  }, [open]);

  const bandeiraCfg = useMemo(() => {
    if (!maquininhaSel) return null;
    return (maquininhaSel.bandeiras || []).find(b => b.bandeira === bandeira) || null;
  }, [maquininhaSel, bandeira]);

  const calculo = useMemo(() => {
    if (!bandeiraCfg) return null;
    const { taxa_intermediacao, taxa_parcelamento, taxa_total } = calcularTaxaCartao(bandeiraCfg, modalidade, parcelas);
    const valor_taxa = valorTotal * taxa_total / 100;
    const valor_liquido = valorTotal - valor_taxa;
    return {
      taxa_intermediacao,
      taxa_parcelamento,
      taxa_total,
      valor_taxa,
      valor_liquido,
      taxa_consome_desconto: valor_taxa > (valorDesconto || 0) && valorDesconto > 0
    };
  }, [bandeiraCfg, modalidade, parcelas, valorTotal, valorDesconto]);

  const maxParcelas = modalidade === 'Crédito Parcelado' ? 12 : 1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-t-3xl md:rounded-3xl w-full md:max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground font-glacial">Simulador de Taxa</h3>
              <p className="text-xs text-muted-foreground">Venda de R$ {valorTotal.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando maquininhas...</div>
          ) : maquininhas.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma maquininha cadastrada.</div>
          ) : (
            <>
              {/* Seleção de Maquininha */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">Maquininha</label>
                <div className="grid gap-2">
                  {maquininhas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMaquininhaSel(m)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                        maquininhaSel?.id === m.id
                          ? 'bg-card text-card-foreground'
                          : 'bg-muted/50 text-foreground/90 hover:bg-muted'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{m.nome}</div>
                        <div className={`text-[10px] ${maquininhaSel?.id === m.id ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{m.adquirente || '—'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bandeira */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">Bandeira</label>
                <div className="flex flex-wrap gap-2">
                  {BANDEIRAS.filter(b => (maquininhaSel?.bandeiras || []).some(cfg => cfg.bandeira === b)).map(b => (
                    <button
                      key={b}
                      onClick={() => setBandeira(b)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        bandeira === b
                          ? 'bg-card text-card-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modalidade */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">Modalidade</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Débito', 'Crédito à Vista', 'Crédito Parcelado'].map(mod => (
                    <button
                      key={mod}
                      onClick={() => {
                        setModalidade(mod);
                        setParcelas(mod === 'Crédito Parcelado' ? 2 : 1);
                      }}
                      className={`px-2 py-2.5 rounded-xl text-xs font-medium transition-all text-center ${
                        modalidade === mod
                          ? 'bg-card text-card-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcelas */}
              {modalidade === 'Crédito Parcelado' && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">Parcelas</label>
                  <div className="flex flex-wrap gap-2">
                    {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <button
                        key={n}
                        onClick={() => setParcelas(n)}
                        className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${
                          parcelas === n
                            ? 'bg-card text-card-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultado */}
              {calculo && (
                <div className={`rounded-2xl p-4 space-y-3 ${
                  calculo.taxa_consome_desconto
                    ? 'bg-red-50 dark:bg-red-900/15'
                    : 'bg-muted/50/60'
                }`}>
                  {/* Alerta taxa > desconto */}
                  {calculo.taxa_consome_desconto && (
                    <div className="flex items-start gap-2 pb-2 border-b border-red-100 dark:border-red-900/30">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 dark:text-red-400">
                        A taxa (R$ {calculo.valor_taxa.toFixed(2).replace('.', ',')}) é maior que o desconto concedido (R$ {valorDesconto.toFixed(2).replace('.', ',')}).
                      </p>
                    </div>
                  )}
                  {!calculo.taxa_consome_desconto && valorDesconto > 0 && (
                    <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Taxa dentro do desconto concedido.
                      </p>
                    </div>
                  )}

                  {/* Breakdown de taxas */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Intermediação</span>
                      <span>{calculo.taxa_intermediacao.toFixed(2)}% = R$ {(valorTotal * calculo.taxa_intermediacao / 100).toFixed(2).replace('.', ',')}</span>
                    </div>
                    {calculo.taxa_parcelamento > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Parcelamento vendedor</span>
                        <span>{calculo.taxa_parcelamento.toFixed(2)}% = R$ {(valorTotal * calculo.taxa_parcelamento / 100).toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-foreground/90 pt-1 border-t border-border/40">
                      <span>Taxa total</span>
                      <span className={calculo.taxa_consome_desconto ? 'text-red-500' : ''}>
                        {calculo.taxa_total.toFixed(2)}% = R$ {calculo.valor_taxa.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>

                  {/* Valor líquido em destaque */}
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Você receberá</div>
                      <div className="text-2xl font-bold text-foreground">
                        R$ {calculo.valor_liquido.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Prazo</div>
                      <div className="text-sm font-semibold text-muted-foreground">D+1</div>
                    </div>
                  </div>

                  {/* Parcela do cliente */}
                  {modalidade === 'Crédito Parcelado' && (
                    <div className="text-xs text-center text-muted-foreground pt-1">
                      {parcelas}x R$ {(valorTotal / parcelas).toFixed(2).replace('.', ',')} para o cliente
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <Button onClick={onClose} className="w-full h-12 bg-card text-card-foreground rounded-2xl font-medium shadow-none border-0">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}