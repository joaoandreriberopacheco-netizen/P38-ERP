import React, { useState, useEffect } from 'react';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, CheckCircle, AlertCircle, Loader2, Search, Camera, Plus, Trash2, Calendar, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ConferenciaItens() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const codigo = searchParams.get('codigo');

  const [manifestoEntrada, setManifestoEntrada] = useState(null);
  const [conferente, setConferente] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [itensConferidos, setItensConferidos] = useState([]);
  const [finalizando, setFinalizando] = useState(false);
  const [modalLote, setModalLote] = useState({ open: false, itemIndex: null });

  useEffect(() => {
    if (!codigo) {
      navigate('/ConferenciaEntrada');
      return;
    }
    carregarDados();
  }, [codigo]);

  const carregarDados = async () => {
    try {
      const [responseValidacao, produtosData] = await Promise.all([
        base44.functions.invoke('validateConferenceCode', { codigo }),
        base44.entities.Produto.list()
      ]);
      
      if (!responseValidacao.data.success) {
        toast.error(responseValidacao.data.error || 'Código inválido');
        navigate('/ConferenciaEntrada');
        return;
      }

      if (responseValidacao.data.tipo !== 'itens') {
        toast.error('Este código é para conferência de volumes');
        navigate('/ConferenciaEntrada');
        return;
      }

      const me = responseValidacao.data.manifesto_entrada;
      setManifestoEntrada(me);
      setConferente(responseValidacao.data.conferente);
      setProdutos(produtosData);

      // Inicializar itens esperados do manifesto
      if (me.itens_esperados && me.itens_esperados.length > 0) {
        const itensIniciais = me.itens_esperados.map(item => {
          const produto = produtosData.find(p => p.id === item.produto_id);
          return {
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            produto: produto,
            quantidade_esperada: item.quantidade_esperada,
            quantidade_conferida: '',
            lotes: [],
            fotos: [],
            divergencia: false,
            tipo_divergencia: null,
            observacao: ''
          };
        });
        setItensConferidos(itensIniciais);
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      navigate('/ConferenciaEntrada');
    } finally {
      setCarregando(false);
    }
  };



  const handleQuantidadeChange = (index, valor) => {
    const novosItens = [...itensConferidos];
    novosItens[index].quantidade_conferida = valor;
    setItensConferidos(novosItens);
  };

  const handleRemoverItem = (index) => {
    setItensConferidos(itensConferidos.filter((_, i) => i !== index));
  };

  const abrirModalLotes = (index) => {
    setModalLote({ open: true, itemIndex: index });
  };

  const adicionarLote = () => {
    const { itemIndex } = modalLote;
    const novosItens = [...itensConferidos];
    novosItens[itemIndex].lotes.push({
      numero_lote: '',
      data_validade: '',
      quantidade: '',
      numeros_serie: ''
    });
    setItensConferidos(novosItens);
  };

  const atualizarLote = (loteIndex, campo, valor) => {
    const { itemIndex } = modalLote;
    const novosItens = [...itensConferidos];
    novosItens[itemIndex].lotes[loteIndex][campo] = valor;
    setItensConferidos(novosItens);
  };

  const removerLote = (loteIndex) => {
    const { itemIndex } = modalLote;
    const novosItens = [...itensConferidos];
    novosItens[itemIndex].lotes = novosItens[itemIndex].lotes.filter((_, i) => i !== loteIndex);
    setItensConferidos(novosItens);
  };

  const handleUploadFoto = async (index, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const novosItens = [...itensConferidos];
      novosItens[index].fotos.push(file_url);
      setItensConferidos(novosItens);
      toast.success('Foto anexada');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto');
    }
  };

  const validarLotes = () => {
    for (const item of itensConferidos) {
      const produto = item.produto;
      const qtdTotal = parseFloat(item.quantidade_conferida) || 0;

      if (qtdTotal <= 0) continue;

      if (produto?.controla_lote || produto?.controla_validade) {
        if (item.lotes.length === 0) {
          toast.error(`${item.produto_nome} requer informação de lote/validade`);
          return false;
        }

        const somaLotes = item.lotes.reduce((sum, l) => sum + (parseFloat(l.quantidade) || 0), 0);
        if (somaLotes !== qtdTotal) {
          toast.error(`${item.produto_nome}: soma dos lotes (${somaLotes}) diferente da quantidade total (${qtdTotal})`);
          return false;
        }

        for (const lote of item.lotes) {
          if (produto.controla_lote && !lote.numero_lote) {
            toast.error(`Lote obrigatório para ${item.produto_nome}`);
            return false;
          }
          if (produto.controla_validade && !lote.data_validade) {
            toast.error(`Validade obrigatória para ${item.produto_nome}`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleFinalizar = async () => {
    const itensValidos = itensConferidos.filter(i => parseFloat(i.quantidade_conferida) > 0);
    if (itensValidos.length === 0) {
      toast.error('Adicione pelo menos um item com quantidade');
      return;
    }

    if (!validarLotes()) return;

    try {
      setFinalizando(true);

      // Atualizar manifesto de entrada
      await base44.entities.ManifestoEntrada.update(manifestoEntrada.id, {
        itens_conferidos: itensValidos.map(i => ({
          produto_id: i.produto_id,
          produto_nome: i.produto_nome,
          quantidade_conferida: parseFloat(i.quantidade_conferida),
          lotes: i.lotes,
          fotos: i.fotos,
          observacao: i.observacao
        })),
        data_conferencia: new Date().toISOString(),
        conferente_id: conferente.id,
        conferente_nome: conferente.full_name,
        status: 'Conferido',
        status_codigo_conferencia_itens: 'Concluído'
      });

      // Criar lotes de estoque e movimentações
      for (const item of itensValidos) {
        if (item.lotes.length > 0) {
          // Produto com controle de lote
          for (const lote of item.lotes) {
            const qtdLote = parseFloat(lote.quantidade);
            
            // Criar/atualizar LoteEstoque
            const loteEstoque = await base44.entities.LoteEstoque.create({
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              numero_lote: lote.numero_lote,
              data_validade: lote.data_validade || null,
              quantidade_atual: qtdLote,
              status: 'Disponível',
              data_entrada_no_lote: new Date().toISOString(),
              numeros_serie: lote.numeros_serie ? lote.numeros_serie.split(',').map(s => s.trim()).filter(Boolean) : []
            });

            // Criar movimentação
            await base44.entities.MovimentacaoEstoque.create({
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              tipo: 'Entrada',
              motivo: 'Compra',
              quantidade: qtdLote,
              referencia_tipo: 'ManifestoEntrada',
              referencia_id: manifestoEntrada.id,
              referencia_numero: manifestoEntrada.numero,
              usuario_responsavel: conferente.full_name,
              numero_lote: lote.numero_lote,
              data_validade: lote.data_validade || null,
              observacoes: `Conferência cega - Código: ${codigo} - Lote: ${loteEstoque.id}`
            });
          }
        } else {
          // Produto sem controle de lote
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: 'Entrada',
            motivo: 'Compra',
            quantidade: parseFloat(item.quantidade_conferida),
            referencia_tipo: 'ManifestoEntrada',
            referencia_id: manifestoEntrada.id,
            referencia_numero: manifestoEntrada.numero,
            usuario_responsavel: conferente.full_name,
            observacoes: `Conferência cega - Código: ${codigo}`
          });
        }
      }

      toast.success('Conferência concluída e estoque atualizado!');
      navigate('/ConferenciaEntrada');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao finalizar conferência');
    } finally {
      setFinalizando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const itemAtual = modalLote.itemIndex !== null ? itensConferidos[modalLote.itemIndex] : null;

  return (
    <div className="min-h-screen bg-background font-din-1451 p-4 pb-[var(--p38-scroll-pad-below-nav)]">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Package className="w-6 h-6 text-foreground/90" />
            </div>
            <P38PageHeader
              variant="compact"
              title="Conferência de itens"
              description="Registre o que está recebendo"
            />
          </div>

          <div className="bg-muted/40 border border-border/40 dark:border-white/10 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Confira as quantidades dos itens recebidos. Os itens esperados já estão listados abaixo.
              </p>
            </div>
          </div>
        </div>

        {/* Itens a Conferir */}
        <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background overflow-hidden">
        {itensConferidos.map((item, index) => (
          <div key={index} className="border-b border-border/50 dark:border-white/10 p-4 space-y-3 last:border-b-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm text-foreground">{item.produto_nome}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Esperado: {item.quantidade_esperada}
                </div>
                {item.lotes.length > 0 && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {item.lotes.length} lote(s) informado(s)
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">QUANTIDADE</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={item.quantidade_conferida}
                  onChange={(e) => handleQuantidadeChange(index, e.target.value)}
                  className="h-12 text-base bg-background border-0 shadow-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="cursor-pointer flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadFoto(index, e.target.files[0])}
                  />
                  <Button type="button" className="w-full h-12 bg-muted hover:bg-muted dark:hover:bg-muted text-foreground/90">
                    <Camera className="w-5 h-5" />
                    {item.fotos.length > 0 && (
                      <span className="ml-2 text-xs">({item.fotos.length})</span>
                    )}
                  </Button>
                </label>
              </div>
            </div>

            {(item.produto?.controla_lote || item.produto?.controla_validade) && (
              <Button
                onClick={() => abrirModalLotes(index)}
                variant="outline"
                className="w-full h-12 border-2 border-dashed border-border/40 dark:border-border/40 hover:border-border/40 dark:hover:border-border/40"
              >
                <Hash className="w-4 h-4 mr-2" />
                GERENCIAR LOTES/VALIDADE
              </Button>
            )}
          </div>
        ))}
        </div>

        {/* Ações */}
        <div className="sticky bottom-4 rounded-lg border border-border/40 dark:border-white/10 bg-background p-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/ConferenciaEntrada')}
              className="flex-1 h-14 text-base border-0 shadow-sm"
            >
              CANCELAR
            </Button>
            <Button
              onClick={handleFinalizar}
              disabled={finalizando || itensConferidos.length === 0}
              className="flex-1 h-14 text-base bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground shadow-lg"
            >
              {finalizando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  FINALIZANDO...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  FINALIZAR
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Lotes */}
      <Dialog open={modalLote.open} onOpenChange={(open) => setModalLote({ ...modalLote, open })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5" />
              LOTES - {itemAtual?.produto_nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {itemAtual?.lotes.map((lote, loteIndex) => (
              <div key={loteIndex} className="p-4 bg-background rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">LOTE {loteIndex + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removerLote(loteIndex)}
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {itemAtual.produto?.controla_lote && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">NÚMERO DO LOTE *</label>
                    <Input
                      placeholder="Ex: L20260203"
                      value={lote.numero_lote}
                      onChange={(e) => atualizarLote(loteIndex, 'numero_lote', e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                )}

                {itemAtual.produto?.controla_validade && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">DATA DE VALIDADE *</label>
                    <Input
                      type="date"
                      value={lote.data_validade}
                      onChange={(e) => atualizarLote(loteIndex, 'data_validade', e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">QUANTIDADE NESTE LOTE *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={lote.quantidade}
                    onChange={(e) => atualizarLote(loteIndex, 'quantidade', e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                {itemAtual.produto?.controla_serial && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">NÚMEROS DE SÉRIE (separados por vírgula)</label>
                    <Input
                      placeholder="S001, S002, S003"
                      value={lote.numeros_serie}
                      onChange={(e) => atualizarLote(loteIndex, 'numeros_serie', e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                )}
              </div>
            ))}

            <Button
              onClick={adicionarLote}
              variant="outline"
              className="w-full h-12 border-2 border-dashed"
            >
              <Plus className="w-5 h-5 mr-2" />
              ADICIONAR OUTRO LOTE
            </Button>

            <Button
              onClick={() => setModalLote({ ...modalLote, open: false })}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              CONFIRMAR LOTES
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}