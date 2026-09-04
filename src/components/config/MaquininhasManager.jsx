import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronUp, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];

const faixaPadrao = () => ({ min_parcelas: 2, max_parcelas: 6, taxa_mensal_percentual: 0 });

const bandeiraPadrao = (b) => ({
  bandeira: b,
  taxa_debito: 0,
  taxa_credito_1x: 0,
  taxa_intermediacao_parcelado: 0,
  faixas_parcelamento: [
    { min_parcelas: 2, max_parcelas: 6, taxa_mensal_percentual: 0 },
    { min_parcelas: 7, max_parcelas: 12, taxa_mensal_percentual: 0 },
  ],
});

const maqVazia = () => ({
  nome: '',
  adquirente: '',
  conta_destino_id: '',
  conta_destino_nome: '',
  prazo_debito_dias: 1,
  prazo_credito_vista_dias: 1,
  prazo_credito_parcelado_dias: 1,
  taxa_juros_cliente_mensal: 1.81,
  bandeiras: BANDEIRAS.map(bandeiraPadrao),
  ativo: true,
});

// Normaliza bandeira vinda do banco para o novo formato
const normalizarBandeira = (b) => {
  const base = { ...bandeiraPadrao(b.bandeira), ...b };
  // Se não tem faixas mas tem o legado, converte
  if (!base.faixas_parcelamento || base.faixas_parcelamento.length === 0) {
    base.faixas_parcelamento = [
      { min_parcelas: 2, max_parcelas: 6, taxa_mensal_percentual: 0 },
      { min_parcelas: 7, max_parcelas: 12, taxa_mensal_percentual: 0 },
    ];
  }
  return base;
};

// Preview: calcula taxa acumulada para cada parcela com base nas faixas
function calcularAcumuladoPorFaixa(faixas, parcelas) {
  if (!faixas || faixas.length === 0) return 0;
  for (const f of faixas) {
    if (parcelas >= f.min_parcelas && parcelas <= f.max_parcelas) {
      return (parcelas - 1) * (f.taxa_mensal_percentual || 0);
    }
  }
  return 0;
}

function PreviewParcelamento({ faixas, taxaIntermediacao }) {
  if (!faixas || faixas.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Preview — Taxa total vendedor por parcelas</p>
      <div className="grid grid-cols-6 gap-1">
        {[2,3,4,5,6,7,8,9,10,11,12].map(n => {
          const acum = calcularAcumuladoPorFaixa(faixas, n);
          const total = (taxaIntermediacao || 0) + acum;
          return (
            <div key={n} className="bg-card dark:bg-muted/60 rounded-lg p-1 text-center">
              <div className="text-[9px] text-muted-foreground">{n}x</div>
              <div className="text-[10px] font-semibold text-foreground/90">{total.toFixed(2)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MaquininhasManager() {
  const [maquininhas, setMaquininhas] = useState([]);
  const [contas, setContas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bandeirExpandida, setBandeirExpandida] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [mlist, clist] = await Promise.all([
      base44.entities.Maquininha.list(),
      base44.entities.ContasFinanceiras.list(),
    ]);
    setMaquininhas(mlist);
    setContas(clist);
    setLoading(false);
  };

  const handleSalvar = async () => {
    if (!editando.nome.trim()) { toast.error('Informe o nome da maquininha'); return; }
    const contaSel = contas.find(c => c.id === editando.conta_destino_id);
    const dados = {
      ...editando,
      conta_destino_nome: contaSel?.nome || '',
      prazo_debito_dias: 1,
      prazo_credito_vista_dias: 1,
      prazo_credito_parcelado_dias: 1,
    };
    if (editando.id) {
      await base44.entities.Maquininha.update(editando.id, dados);
      toast.success('Maquininha atualizada');
    } else {
      await base44.entities.Maquininha.create(dados);
      toast.success('Maquininha criada');
    }
    setEditando(null);
    load();
  };

  const handleExcluir = async (id) => {
    await base44.entities.Maquininha.delete(id);
    toast.success('Maquininha removida');
    load();
  };

  const updateBandeira = (bandeira, campo, valor) => {
    setEditando(prev => ({
      ...prev,
      bandeiras: prev.bandeiras.map(b =>
        b.bandeira === bandeira ? { ...b, [campo]: parseFloat(valor) || 0 } : b
      ),
    }));
  };

  const updateFaixa = (bandeira, idx, campo, valor) => {
    setEditando(prev => ({
      ...prev,
      bandeiras: prev.bandeiras.map(b => {
        if (b.bandeira !== bandeira) return b;
        const novas = [...(b.faixas_parcelamento || [])];
        novas[idx] = { ...novas[idx], [campo]: parseFloat(valor) || 0 };
        return { ...b, faixas_parcelamento: novas };
      }),
    }));
  };

  const addFaixa = (bandeira) => {
    setEditando(prev => ({
      ...prev,
      bandeiras: prev.bandeiras.map(b =>
        b.bandeira === bandeira
          ? { ...b, faixas_parcelamento: [...(b.faixas_parcelamento || []), faixaPadrao()] }
          : b
      ),
    }));
  };

  const removeFaixa = (bandeira, idx) => {
    setEditando(prev => ({
      ...prev,
      bandeiras: prev.bandeiras.map(b => {
        if (b.bandeira !== bandeira) return b;
        const novas = (b.faixas_parcelamento || []).filter((_, i) => i !== idx);
        return { ...b, faixas_parcelamento: novas };
      }),
    }));
  };

  const abrirEditar = (maq) => {
    setEditando({
      ...maqVazia(),
      ...maq,
      bandeiras: (maq.bandeiras?.length ? maq.bandeiras : BANDEIRAS.map(bandeiraPadrao))
        .map(normalizarBandeira),
    });
    setBandeirExpandida(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground font-glacial">Maquininhas</h2>
          <p className="text-xs text-muted-foreground">
            Taxas por bandeira e prazos de recebimento. O financeiro credita só o líquido; o nominal fica no pedido/comprovante.
          </p>
        </div>
        <Button onClick={() => { setEditando(maqVazia()); setBandeirExpandida(null); }} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando...</div>}

      <div className="space-y-2">
        {maquininhas.map(maq => (
          <div key={maq.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted/40 dark:bg-muted rounded-full flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{maq.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {maq.adquirente || '—'} · Recebimento: próximo dia útil (D+1)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpandido(expandido === maq.id ? null : maq.id)} className="p-2 hover:bg-muted rounded-lg">
                  {expandido === maq.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => abrirEditar(maq)} className="p-2 hover:bg-muted rounded-lg">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleExcluir(maq.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
            {expandido === maq.id && (
              <div className="border-t border-border/30 dark:border-border/40 px-4 py-3 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1 font-medium">Bandeira</th>
                        <th className="text-right py-1 font-medium">Débito</th>
                        <th className="text-right py-1 font-medium">Créd 1x</th>
                        <th className="text-right py-1 font-medium">Interm. Parc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(maq.bandeiras || []).map(b => (
                        <tr key={b.bandeira} className="border-t border-border/30 dark:border-border/40/50">
                          <td className="py-1.5 font-medium text-foreground/90">{b.bandeira}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{b.taxa_debito ?? 0}%</td>
                          <td className="py-1.5 text-right text-muted-foreground">{b.taxa_credito_1x ?? 0}%</td>
                          <td className="py-1.5 text-right text-muted-foreground">{b.taxa_intermediacao_parcelado ?? 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Faixas resumidas */}
                {(maq.bandeiras?.[0]?.faixas_parcelamento || []).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-muted-foreground">Faixas de parcelamento (vendedor):</p>
                    {(maq.bandeiras[0].faixas_parcelamento || []).map((f, i) => (
                      <p key={i}>{f.min_parcelas}x–{f.max_parcelas}x: {f.taxa_mensal_percentual}%/mês</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dialog de edição */}
      <Dialog open={!!editando} onOpenChange={() => setEditando(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto dark:bg-background">
          <DialogHeader>
            <DialogTitle className="font-glacial">{editando?.id ? 'Editar Maquininha' : 'Nova Maquininha'}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-4">
              {/* Dados básicos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                  <Input value={editando.nome} onChange={e => setEditando(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: PagSeguro Loja 1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Adquirente</label>
                  <Input value={editando.adquirente || ''} onChange={e => setEditando(p => ({ ...p, adquirente: e.target.value }))} placeholder="PagSeguro, Stone..." />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Conta Destino</label>
                  <select
                    value={editando.conta_destino_id || ''}
                    onChange={e => setEditando(p => ({ ...p, conta_destino_id: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-border/40 bg-card text-sm text-foreground/90"
                  >
                    <option value="">Selecionar conta...</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Prazo fixo: todas as modalidades creditam no próximo dia útil */}
              <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                Débito, crédito à vista e parcelado: crédito no próximo dia útil (D+1).
                Vendas de sexta a domingo entram na segunda-feira.
              </p>

              {/* Taxa juros cliente */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Juros cobrado do cliente (%/mês)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" step="0.01"
                    value={editando.taxa_juros_cliente_mensal ?? 1.81}
                    onChange={e => setEditando(p => ({ ...p, taxa_juros_cliente_mensal: parseFloat(e.target.value) || 0 }))}
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">Usado na simulação "com juros do cliente"</span>
                </div>
              </div>

              {/* Taxas por bandeira */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Taxas por Bandeira (%)</p>
                <div className="space-y-3">
                  {(editando.bandeiras || []).map(b => (
                    <div key={b.bandeira} className="bg-muted/50/60 rounded-xl overflow-hidden">
                      {/* Linha principal: débito, crédito 1x, intermediação parcelado */}
                      <div className="px-3 py-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground/90 w-20">{b.bandeira}</span>
                        <div className="flex-1 grid grid-cols-3 gap-1.5">
                          <div>
                            <div className="text-[9px] text-muted-foreground mb-0.5 text-center">Débito</div>
                            <input autoComplete="off" type="number" step="0.01" value={b.taxa_debito ?? 0}
                              onChange={e => updateBandeira(b.bandeira, 'taxa_debito', e.target.value)}
                              className="w-full h-7 text-center text-xs bg-card dark:bg-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-border/40 dark:text-foreground" />
                          </div>
                          <div>
                            <div className="text-[9px] text-muted-foreground mb-0.5 text-center">Créd 1x</div>
                            <input autoComplete="off" type="number" step="0.01" value={b.taxa_credito_1x ?? 0}
                              onChange={e => updateBandeira(b.bandeira, 'taxa_credito_1x', e.target.value)}
                              className="w-full h-7 text-center text-xs bg-card dark:bg-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-border/40 dark:text-foreground" />
                          </div>
                          <div>
                            <div className="text-[9px] text-muted-foreground mb-0.5 text-center">Interm. Parc.</div>
                            <input autoComplete="off" type="number" step="0.01" value={b.taxa_intermediacao_parcelado ?? 0}
                              onChange={e => updateBandeira(b.bandeira, 'taxa_intermediacao_parcelado', e.target.value)}
                              className="w-full h-7 text-center text-xs bg-card dark:bg-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-border/40 dark:text-foreground" />
                          </div>
                        </div>
                        <button onClick={() => setBandeirExpandida(bandeirExpandida === b.bandeira ? null : b.bandeira)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-card dark:hover:bg-primary/90">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bandeirExpandida === b.bandeira ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Faixas de parcelamento */}
                      {bandeirExpandida === b.bandeira && (
                        <div className="px-3 pb-3 border-t border-border/40 pt-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Faixas de Parcelamento (Taxa/mês do vendedor)</p>
                            <button onClick={() => addFaixa(b.bandeira)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
                              <PlusCircle className="w-3 h-3" /> Faixa
                            </button>
                          </div>

                          {(b.faixas_parcelamento || []).map((f, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-card dark:bg-muted/50 rounded-lg px-2 py-1.5">
                              <span className="text-[10px] text-muted-foreground w-4">De</span>
                              <input autoComplete="off" type="number" min="2" max="12" value={f.min_parcelas}
                                onChange={e => updateFaixa(b.bandeira, idx, 'min_parcelas', e.target.value)}
                                className="w-10 h-6 text-center text-xs bg-muted/40 dark:bg-muted rounded focus:outline-none dark:text-foreground" />
                              <span className="text-[10px] text-muted-foreground">x até</span>
                              <input autoComplete="off" type="number" min="2" max="12" value={f.max_parcelas}
                                onChange={e => updateFaixa(b.bandeira, idx, 'max_parcelas', e.target.value)}
                                className="w-10 h-6 text-center text-xs bg-muted/40 dark:bg-muted rounded focus:outline-none dark:text-foreground" />
                              <span className="text-[10px] text-muted-foreground">x =</span>
                              <input autoComplete="off" type="number" step="0.01" value={f.taxa_mensal_percentual}
                                onChange={e => updateFaixa(b.bandeira, idx, 'taxa_mensal_percentual', e.target.value)}
                                className="flex-1 h-6 text-center text-xs bg-muted/40 dark:bg-muted rounded focus:outline-none dark:text-foreground" />
                              <span className="text-[10px] text-muted-foreground">%/mês</span>
                              <button onClick={() => removeFaixa(b.bandeira, idx)} className="text-red-400 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}

                          <PreviewParcelamento faixas={b.faixas_parcelamento} taxaIntermediacao={b.taxa_intermediacao_parcelado} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditando(null)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSalvar} className="flex-1">Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}