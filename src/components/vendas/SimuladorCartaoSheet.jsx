import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, X, AlertTriangle, CheckCircle, ChevronDown, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];

const fmt = (valor) =>
  valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Dado as faixas de parcelamento, retorna a taxa mensal para N parcelas
function getTaxaMensalParFaixa(faixas, parcelas) {
  if (!faixas || faixas.length === 0) return 0;
  for (const f of faixas) {
    if (parcelas >= f.min_parcelas && parcelas <= f.max_parcelas) {
      return f.taxa_mensal_percentual || 0;
    }
  }
  return 0;
}

// Taxa acumulada do vendedor para N parcelas (ex: 3x a 2,55%/mês = 2 * 2,55 = 5,10%)
function getTaxaAcumuladaVendedor(faixas, parcelas) {
  const mensal = getTaxaMensalParFaixa(faixas, parcelas);
  return (parcelas - 1) * mensal;
}

// Calcula taxa total e valor líquido para o VENDEDOR (sem juros do cliente)
export function calcularTaxaCartao(maquininha, bandeira, modalidade, parcelas) {
  if (!maquininha) return { taxa_intermediacao: 0, taxa_parcelamento: 0, taxa_total: 0 };
  const confBandeira = (maquininha.bandeiras || []).find(b => b.bandeira === bandeira);
  if (!confBandeira) return { taxa_intermediacao: 0, taxa_parcelamento: 0, taxa_total: 0 };

  let taxa_intermediacao = 0;
  let taxa_parcelamento = 0;

  if (modalidade === 'Débito') {
    taxa_intermediacao = confBandeira.taxa_debito || 0;
  } else if (modalidade === 'Crédito à Vista') {
    taxa_intermediacao = confBandeira.taxa_credito_1x || 0;
  } else if (modalidade === 'Crédito Parcelado') {
    taxa_intermediacao = confBandeira.taxa_intermediacao_parcelado || 0;
    taxa_parcelamento = getTaxaAcumuladaVendedor(confBandeira.faixas_parcelamento, parcelas);
  }

  const taxa_total = taxa_intermediacao + taxa_parcelamento;
  return { taxa_intermediacao, taxa_parcelamento, taxa_total };
}

// Calcula o máximo de parcelas sem juros que cabe no desconto disponível
function calcularMaxParcelasSemJuros(maqSelecionada, bandeira, valorTotal, valorDesconto) {
  if (!maqSelecionada || valorDesconto <= 0 || valorTotal <= 0) return null;
  const confBandeira = (maqSelecionada.bandeiras || []).find(b => b.bandeira === bandeira);
  if (!confBandeira) return null;

  let maxParcelas = 1; // 1x sempre (crédito à vista)
  for (let n = 2; n <= 12; n++) {
    const taxaIntermediacao = confBandeira.taxa_intermediacao_parcelado || 0;
    const taxaParc = getTaxaAcumuladaVendedor(confBandeira.faixas_parcelamento, n);
    const taxaTotal = taxaIntermediacao + taxaParc;
    const valorTaxa = valorTotal * taxaTotal / 100;
    if (valorTaxa <= valorDesconto) {
      maxParcelas = n;
    }
  }
  return maxParcelas;
}

// Calcula parcela para o cliente com juros compostos (Price): PMT = PV * i / (1 - (1+i)^-n)
function calcularParcelaComJuros(valorTotal, taxaMensalPercent, parcelas) {
  if (parcelas <= 1) return valorTotal;
  const i = taxaMensalPercent / 100;
  if (i === 0) return valorTotal / parcelas;
  return valorTotal * i / (1 - Math.pow(1 + i, -parcelas));
}

export default function SimuladorCartaoSheet({ open, onClose, valorTotal, valorDesconto }) {
  const [maquininhas, setMaquininhas] = useState([]);
  const [maqSelecionada, setMaqSelecionada] = useState(null);
  const [bandeira, setBandeira] = useState('Visa');
  const [modalidade, setModalidade] = useState('Crédito à Vista');
  const [parcelas, setParcelas] = useState(1);
  const [modoJurosCliente, setModoJurosCliente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      base44.entities.Maquininha.filter({ ativo: true }).then(list => {
        setMaquininhas(list);
        if (list.length > 0) setMaqSelecionada(list[0]);
        setLoading(false);
      });
    }
  }, [open]);

  // Cálculo para modo vendedor (empresa paga a taxa)
  const { taxa_intermediacao, taxa_parcelamento, taxa_total } = useMemo(() => {
    if (!maqSelecionada || modoJurosCliente) return { taxa_intermediacao: 0, taxa_parcelamento: 0, taxa_total: 0 };
    return calcularTaxaCartao(maqSelecionada, bandeira, modalidade, parcelas);
  }, [maqSelecionada, bandeira, modalidade, parcelas, modoJurosCliente]);

  const valor_taxa = valorTotal * (taxa_total / 100);
  const valor_liquido = valorTotal - valor_taxa;
  const taxaMaiorQueDesconto = !modoJurosCliente && valorDesconto > 0 && valor_taxa > valorDesconto;

  // Máximo de parcelas sem juros
  const maxParcelasSemJuros = useMemo(() =>
    calcularMaxParcelasSemJuros(maqSelecionada, bandeira, valorTotal, valorDesconto),
    [maqSelecionada, bandeira, valorTotal, valorDesconto]
  );

  // Taxa juros cliente
  const taxaJurosClienteMensal = maqSelecionada?.taxa_juros_cliente_mensal ?? 1.81;

  // Parcelas disponíveis com suas taxas
  const parcelasDisponiveis = useMemo(() => {
    if (modalidade !== 'Crédito Parcelado') return [];
    const confBandeira = (maqSelecionada?.bandeiras || []).find(b => b.bandeira === bandeira);
    if (!confBandeira) return [];

    return Array.from({ length: 11 }, (_, i) => i + 2).map(n => {
      if (modoJurosCliente) {
        const parcela = calcularParcelaComJuros(valorTotal, taxaJurosClienteMensal, n);
        return { parcelas: n, valorParcela: parcela, taxaMensal: taxaJurosClienteMensal };
      } else {
        const taxaIntermediacao = confBandeira.taxa_intermediacao_parcelado || 0;
        const taxaAcum = getTaxaAcumuladaVendedor(confBandeira.faixas_parcelamento, n);
        return { parcelas: n, taxaTotal: taxaIntermediacao + taxaAcum };
      }
    });
  }, [maqSelecionada, bandeira, modalidade, modoJurosCliente, taxaJurosClienteMensal, valorTotal]);

  // Cálculo para modo juros do cliente
  const parcelaModoCliente = useMemo(() => {
    if (!modoJurosCliente || modalidade !== 'Crédito Parcelado') return null;
    return calcularParcelaComJuros(valorTotal, taxaJurosClienteMensal, parcelas);
  }, [modoJurosCliente, modalidade, parcelas, valorTotal, taxaJurosClienteMensal]);

  // Taxa intermediação do vendedor no modo cliente (empresa paga apenas intermediação)
  const { taxa_intermediacao: taxa_interm_vendor_modo_cliente } = useMemo(() => {
    if (!modoJurosCliente || !maqSelecionada) return { taxa_intermediacao: 0 };
    return calcularTaxaCartao(maqSelecionada, bandeira, 'Crédito Parcelado', parcelas);
  }, [modoJurosCliente, maqSelecionada, bandeira, parcelas]);

  const prazoStr = () => (maqSelecionada ? 'D+1 (próximo dia útil)' : '');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl shadow-2xl z-10 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground font-glacial">Simulador de Cartão</h2>
              <p className="text-xs text-muted-foreground">Venda de R$ {fmt(valorTotal)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 pb-8 text-center text-sm text-muted-foreground py-8">Carregando maquininhas...</div>
        ) : maquininhas.length === 0 ? (
          <div className="px-5 pb-8 text-center text-sm text-muted-foreground py-8">
            Nenhuma maquininha cadastrada.<br />Configure em Configurações → Maquininhas.
          </div>
        ) : (
          <div className="px-5 pb-6 space-y-4 overflow-y-auto flex-1">

            {/* Modo: Vendedor paga taxas vs Cliente paga juros */}
            <div className="flex rounded-xl overflow-hidden bg-muted p-0.5 gap-0.5">
              <button
                onClick={() => setModoJurosCliente(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-all ${
                  !modoJurosCliente ? 'bg-card dark:bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Vendedor paga
              </button>
              <button
                onClick={() => { setModoJurosCliente(true); setModalidade('Crédito Parcelado'); setParcelas(2); }}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-all ${
                  modoJurosCliente ? 'bg-card dark:bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Cliente paga juros
              </button>
            </div>

            {/* Maquininha */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Maquininha</label>
              <div className="relative">
                <select
                  value={maqSelecionada?.id || ''}
                  onChange={e => setMaqSelecionada(maquininhas.find(m => m.id === e.target.value))}
                  className="w-full h-11 pl-4 pr-10 rounded-xl bg-muted/50 text-sm text-foreground dark:text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring"
                >
                  {maquininhas.map(m => <option key={m.id} value={m.id}>{m.nome} — {m.adquirente}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Bandeira */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Bandeira</label>
              <div className="flex gap-2 flex-wrap">
                {BANDEIRAS.map(b => (
                  <button key={b} onClick={() => setBandeira(b)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      bandeira === b
                        ? 'bg-card text-card-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >{b}</button>
                ))}
              </div>
            </div>

            {/* Modalidade — só mostra se não for modo cliente (que é sempre parcelado) */}
            {!modoJurosCliente && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Modalidade</label>
                <div className="flex gap-2">
                  {['Débito', 'Crédito à Vista', 'Crédito Parcelado'].map(mod => (
                    <button key={mod} onClick={() => {
                      setModalidade(mod);
                      if (mod !== 'Crédito Parcelado') setParcelas(1);
                      else setParcelas(2);
                    }}
                      className={`flex-1 h-10 rounded-xl text-xs font-medium transition-all ${
                        modalidade === mod
                          ? 'bg-card text-card-foreground'
                          : 'bg-muted/50 text-muted-foreground'
                      }`}
                    >{mod === 'Crédito à Vista' ? 'Créd. 1x' : mod === 'Crédito Parcelado' ? 'Crédito Parc.' : mod}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Parcelas */}
            {(modalidade === 'Crédito Parcelado' || modoJurosCliente) && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  {modoJurosCliente ? `Parcelas (${taxaJurosClienteMensal}%/mês do cliente)` : 'Parcelas'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {parcelasDisponiveis.map(({ parcelas: n, taxaTotal, valorParcela }) => (
                    <button
                      key={n}
                      onClick={() => setParcelas(n)}
                      className={`h-14 rounded-xl text-xs font-medium flex flex-col items-center justify-center transition-all ${
                        parcelas === n
                          ? 'bg-card text-card-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-sm font-bold">{n}x</span>
                      {modoJurosCliente && valorParcela && (
                        <span className="text-[9px] opacity-70 mt-0.5">R$ {fmt(valorParcela)}</span>
                      )}
                      {!modoJurosCliente && taxaTotal > 0 && (
                        <span className="text-[9px] opacity-60 mt-0.5">+{taxaTotal.toFixed(2)}%</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Aviso máximo parcelas sem juros */}
                {!modoJurosCliente && maxParcelasSemJuros !== null && valorDesconto > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Máx. sem juros para o cliente: <strong>{maxParcelasSemJuros}x</strong> (cobre com o desconto de R$ {fmt(valorDesconto)})</span>
                  </div>
                )}
              </div>
            )}

            {/* Resultado */}
            <div className="bg-muted/50/60 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Valor cobrado ao cliente</span>
                <span className="text-sm font-semibold text-foreground">R$ {fmt(valorTotal)}</span>
              </div>

              {modoJurosCliente ? (
                // Modo: cliente paga os juros
                <>
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Empresa paga (intermediação)</span>
                      <span className="text-xs text-red-500">- R$ {fmt(valorTotal * (taxa_interm_vendor_modo_cliente / 100))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Juros cobrado do cliente ({taxaJurosClienteMensal}%/mês)</span>
                      <span className="text-xs text-muted-foreground">suportado pelo cliente</span>
                    </div>
                    {parcelaModoCliente && modalidade === 'Crédito Parcelado' && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Parcela do cliente ({parcelas}x)</span>
                        <span className="text-xs font-medium text-foreground/90">R$ {fmt(parcelaModoCliente)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-2">
                    <span className="text-sm font-medium text-foreground/90">Você receberá</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-foreground">
                        R$ {fmt(valorTotal - valorTotal * taxa_interm_vendor_modo_cliente / 100)}
                      </div>
                      <div className="text-xs text-muted-foreground">{prazoStr()}</div>
                    </div>
                  </div>
                </>
              ) : (
                // Modo: vendedor paga as taxas
                <>
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Intermediação ({taxa_intermediacao.toFixed(2)}%)</span>
                      <span className="text-xs text-muted-foreground">- R$ {fmt(valorTotal * taxa_intermediacao / 100)}</span>
                    </div>
                    {taxa_parcelamento > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Parcelamento ({taxa_parcelamento.toFixed(2)}%)</span>
                        <span className="text-xs text-muted-foreground">- R$ {fmt(valorTotal * taxa_parcelamento / 100)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-border/40 pt-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Total taxas ({taxa_total.toFixed(2)}%)</span>
                      <span className="text-xs font-medium text-red-500">- R$ {fmt(valor_taxa)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-2">
                    <span className="text-sm font-medium text-foreground/90">Você receberá</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-foreground">R$ {fmt(valor_liquido)}</div>
                      <div className="text-xs text-muted-foreground">{prazoStr()}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Alerta desconto vs taxa */}
            {!modoJurosCliente && valorDesconto > 0 && (
              <div className={`flex items-start gap-3 p-3.5 rounded-2xl ${
                taxaMaiorQueDesconto ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
              }`}>
                {taxaMaiorQueDesconto ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">Taxa supera o desconto</p>
                      <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                        Desconto concedido: R$ {fmt(valorDesconto)} · Taxa maquininha: R$ {fmt(valor_taxa)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Taxa dentro do desconto</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Desconto: R$ {fmt(valorDesconto)} · Taxa: R$ {fmt(valor_taxa)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <Button variant="outline" onClick={onClose} className="w-full">Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}