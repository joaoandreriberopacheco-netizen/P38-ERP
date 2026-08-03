import { useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, CheckCircle, FileOutput, MessageSquarePlus, Plus, Trophy, UploadCloud, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/financialUtils';
import {
  calcDiferencaPct,
  formatDiferencaPct,
  getMenorPrecoPorProduto,
  getPrecoCompraAtual,
  getResposta,
} from '@/lib/cotacaoExpressUtils';

function DisputaTipoBadge({ tipo }) {
  const map = {
    preco_acima_custo: 'bg-amber-100 text-amber-800',
    preco_abaixo_custo: 'bg-emerald-100 text-emerald-800',
    qtd_divergente: 'bg-orange-100 text-orange-800',
    observacao: 'bg-blue-100 text-blue-800',
  };
  const labels = {
    preco_acima_custo: 'Acima do custo',
    preco_abaixo_custo: 'Abaixo do custo',
    qtd_divergente: 'Qtd divergente',
    observacao: 'Observação',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[tipo] || 'bg-muted text-muted-foreground'}`}>
      {labels[tipo] || tipo}
    </span>
  );
}

export default function CotacaoExpressDisputa({
  cotacao,
  produtosMap = {},
  fornecedoresDisponiveis = [],
  precosInput = {},
  registrosDisputa = [],
  salvando = false,
  onVoltar,
  onUpdatePreco,
  onToggleVencedor,
  onSalvarPrecos,
  onImportarResposta,
  onAdicionarFornecedor,
  onAdicionarRegistro,
  onIrAprovar,
  onExportarSolicitacao,
}) {
  const [fornecedorDialogOpen, setFornecedorDialogOpen] = useState(false);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [registroDialogOpen, setRegistroDialogOpen] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState({ mensagem: '', produto_id: '' });

  const fornecedoresNaCotacao = cotacao?.fornecedores || [];
  const fornecedoresFiltrados = useMemo(() => {
    const idsNaCotacao = new Set(fornecedoresNaCotacao.map((f) => f.fornecedor_id));
    const lista = fornecedoresDisponiveis.filter((f) => !idsNaCotacao.has(f.id));
    if (!buscaFornecedor.trim()) return lista;
    const q = buscaFornecedor.toLowerCase();
    return lista.filter((f) => f.nome?.toLowerCase().includes(q));
  }, [fornecedoresDisponiveis, fornecedoresNaCotacao, buscaFornecedor]);

  const vencedoresCount = (cotacao?.respostas || []).filter((r) => r.vencedor).length;
  const totalItens = cotacao?.itens?.length || 0;

  const handleSalvarRegistro = () => {
    if (!novoRegistro.mensagem.trim()) return;
    const item = cotacao.itens?.find((i) => i.produto_id === novoRegistro.produto_id);
    onAdicionarRegistro({
      tipo: 'observacao',
      produto_id: novoRegistro.produto_id || null,
      produto_nome: item?.produto_nome || 'Geral',
      mensagem: novoRegistro.mensagem.trim(),
      created_at: new Date().toISOString(),
      automatico: false,
    });
    setNovoRegistro({ mensagem: '', produto_id: '' });
    setRegistroDialogOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVoltar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold font-glacial text-foreground">
              Disputa
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {cotacao?.titulo} · {vencedoresCount}/{totalItens} vencedores
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportarSolicitacao}
            className="h-9 shrink-0 rounded-xl"
            title="Gerar solicitação HTML/PDF"
          >
            <FileOutput className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFornecedorDialogOpen(true)}
            className="h-9 shrink-0 rounded-xl"
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Forn.
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {fornecedoresNaCotacao.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Adicione fornecedores manualmente ou importe uma proposta (OCR).
            </p>
            <Button type="button" onClick={() => setFornecedorDialogOpen(true)} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar fornecedor
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {fornecedoresNaCotacao.map((f) => (
                <Button
                  key={f.fornecedor_id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => onImportarResposta(f.fornecedor_id)}
                >
                  <UploadCloud className="mr-1 h-3.5 w-3.5" />
                  OCR · {f.fornecedor_nome}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              {(cotacao?.itens || []).map((item) => {
                const produto = produtosMap[item.produto_id];
                const precoCompra = getPrecoCompraAtual(produto);
                const menorPreco = getMenorPrecoPorProduto(cotacao.respostas, item.produto_id);

                return (
                  <div
                    key={item.produto_id}
                    className="rounded-2xl border border-border/40 bg-card p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.produto_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade} {item.unidade || 'UN'}
                          {precoCompra > 0 && (
                            <span className="ml-2">
                              · Custo atual: {formatCurrency(precoCompra)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {fornecedoresNaCotacao.map((f) => {
                        const resposta = getResposta(cotacao, f.fornecedor_id, item.produto_id);
                        const key = `${f.fornecedor_id}_${item.produto_id}`;
                        const precoInput = precosInput[key];
                        const precoNum = parseFloat(precoInput) || 0;
                        const isVencedor = resposta?.vencedor;
                        const isMenor = precoNum > 0 && precoNum === menorPreco;
                        const diffCusto = precoNum > 0 ? calcDiferencaPct(precoNum, precoCompra) : null;
                        const qtdDiferente = resposta?.quantidade_ofertada
                          && resposta.quantidade_ofertada !== item.quantidade;

                        return (
                          <div
                            key={f.fornecedor_id}
                            className={`rounded-xl border p-2 transition-colors ${
                              isVencedor
                                ? 'border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30'
                                : 'border-border/40 bg-muted/20'
                            }`}
                          >
                            <p className="mb-1 truncate text-[11px] font-medium text-muted-foreground">
                              {f.fornecedor_nome}
                            </p>
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="R$ 0,00"
                              value={precoInput ?? ''}
                              onChange={(e) => onUpdatePreco(f.fornecedor_id, item.produto_id, e.target.value)}
                              className={`h-10 rounded-xl text-center text-sm ${
                                isMenor && !isVencedor ? 'font-bold text-emerald-600' : ''
                              }`}
                            />
                            {diffCusto != null && precoCompra > 0 && (
                              <p className={`mt-1 text-center text-[10px] ${
                                diffCusto > 0 ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                              >
                                vs custo: {formatDiferencaPct(diffCusto)}
                              </p>
                            )}
                            {qtdDiferente && (
                              <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-600">
                                <AlertCircle className="h-3 w-3" />
                                Qtd: {resposta.quantidade_ofertada}
                              </p>
                            )}
                            {precoNum > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`mt-1 h-7 w-full rounded-lg text-[10px] ${
                                  isVencedor ? 'bg-emerald-200 text-emerald-900' : ''
                                }`}
                                onClick={() => onToggleVencedor({
                                  fornecedor_id: f.fornecedor_id,
                                  produto_id: item.produto_id,
                                })}
                              >
                                <Trophy className="mr-1 h-3 w-3" />
                                {isVencedor ? 'Vencedor' : 'Marcar'}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Registro de disputa</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => setRegistroDialogOpen(true)}
            >
              <MessageSquarePlus className="mr-1 h-4 w-4" />
              Nota
            </Button>
          </div>
          {registrosDisputa.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Alertas automáticos aparecem ao comparar propostas com o custo de compra atual.
            </p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {registrosDisputa.map((reg) => (
                <li key={reg.id || `${reg.created_at}-${reg.mensagem}`} className="rounded-xl bg-card p-2 text-xs">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <DisputaTipoBadge tipo={reg.tipo} />
                    {reg.fornecedor_nome && (
                      <span className="text-muted-foreground">{reg.fornecedor_nome}</span>
                    )}
                    {reg.automatico && (
                      <span className="text-[10px] text-muted-foreground">(auto)</span>
                    )}
                  </div>
                  <p className="text-foreground">{reg.mensagem}</p>
                  {reg.produto_nome && (
                    <p className="mt-0.5 text-muted-foreground">{reg.produto_nome}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40 bg-card/80 p-3 backdrop-blur-sm space-y-2">
        {onExportarSolicitacao && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full rounded-xl text-muted-foreground"
            onClick={onExportarSolicitacao}
          >
            <FileOutput className="mr-2 h-4 w-4" />
            Solicitação para fornecedor (HTML / PDF)
          </Button>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-2xl"
            onClick={onSalvarPrecos}
            disabled={salvando}
          >
            Salvar preços
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-2xl p38-btn-primary"
            onClick={onIrAprovar}
            disabled={vencedoresCount === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Revisar aprovação ({vencedoresCount})
          </Button>
        </div>
      </div>

      <Dialog open={fornecedorDialogOpen} onOpenChange={setFornecedorDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Buscar fornecedor..."
              value={buscaFornecedor}
              onChange={(e) => setBuscaFornecedor(e.target.value)}
              className="h-12 rounded-xl"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {fornecedoresFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum fornecedor disponível.</p>
              ) : (
                fornecedoresFiltrados.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="w-full rounded-xl px-3 py-3 text-left hover:bg-muted/50"
                    onClick={() => {
                      onAdicionarFornecedor(f);
                      setFornecedorDialogOpen(false);
                      setBuscaFornecedor('');
                    }}
                  >
                    <p className="text-sm font-medium">{f.nome}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={registroDialogOpen} onOpenChange={setRegistroDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar observação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Produto (opcional)</Label>
              <select
                className="mt-1 w-full h-10 rounded-xl border bg-background px-3 text-sm"
                value={novoRegistro.produto_id}
                onChange={(e) => setNovoRegistro((p) => ({ ...p, produto_id: e.target.value }))}
              >
                <option value="">Geral</option>
                {(cotacao?.itens || []).map((item) => (
                  <option key={item.produto_id} value={item.produto_id}>{item.produto_nome}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={novoRegistro.mensagem}
                onChange={(e) => setNovoRegistro((p) => ({ ...p, mensagem: e.target.value }))}
                placeholder="Ex.: Fornecedor confirmou prazo de 7 dias..."
                className="mt-1 rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSalvarRegistro} className="rounded-xl">
              Salvar registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
