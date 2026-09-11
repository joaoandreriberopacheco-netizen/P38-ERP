import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, AlertTriangle, Check, X, Package, Hash, MessageSquare, PackagePlus } from 'lucide-react';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import ProdutoThumbImage from '@/components/produtos/ProdutoThumbImage';

export default function LostSalesForm({ open, onClose, currentUser }) {
  const [produtos, setProdutos] = useState([]);
  const [produtosNaoMix, setProdutosNaoMix] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtosSugeridos, setProdutosSugeridos] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    is_produto_do_mix: true,
    produto_consultado_nome: '',
    produto_consultado_id: '',
    nome_produto_nao_mix: '',
    quantidade_desejada: 1,
    motivo_perda: 'Sem Estoque',
    observacao: '',
    vendedor_id: currentUser?.id || '',
    vendedor_nome: currentUser?.full_name || ''
  });

  useEffect(() => {
    if (open) {
      loadProdutos();
      loadProdutosNaoMix();
    }
  }, [open]);

  // Busca de produtos do mix
  useEffect(() => {
    // Não mostrar sugestões se já tem produto selecionado
    if (formData.is_produto_do_mix && formData.produto_consultado_id) {
      setProdutosSugeridos([]);
      setShowSuggestions(false);
      return;
    }
    if (!formData.is_produto_do_mix && formData.nome_produto_nao_mix && buscaProduto === formData.nome_produto_nao_mix) {
      setProdutosSugeridos([]);
      setShowSuggestions(false);
      return;
    }

    if (formData.is_produto_do_mix && buscaProduto.trim().length >= 2) {
      const resultados = filterAndSortProducts(produtos, buscaProduto);
      setProdutosSugeridos(resultados);
      setShowSuggestions(resultados.length > 0);
    } else if (!formData.is_produto_do_mix && buscaProduto.trim().length >= 2) {
      // Busca nos produtos não-mix já registrados
      const termo = buscaProduto.toLowerCase();
      const resultados = produtosNaoMix
        .filter(p => p.toLowerCase().includes(termo))
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      setProdutosSugeridos(resultados.map(nome => ({ nome, id: null })));
      setShowSuggestions(resultados.length > 0);
    } else {
      setProdutosSugeridos([]);
      setShowSuggestions(false);
    }
  }, [buscaProduto, produtos, produtosNaoMix, formData.is_produto_do_mix, formData.produto_consultado_id, formData.nome_produto_nao_mix]);

  const loadProdutos = async () => {
    try {
      const produtosData = await base44.entities.Produto.list();
      setProdutos(produtosData);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadProdutosNaoMix = async () => {
    try {
      const vendasPerdidas = await base44.entities.VendaPerdida.list();
      // Extrai nomes únicos de produtos não-mix já registrados
      const nomesUnicos = [...new Set(
        vendasPerdidas
          .filter(vp => vp.is_produto_do_mix === false && vp.nome_produto_nao_mix)
          .map(vp => vp.nome_produto_nao_mix)
      )];
      setProdutosNaoMix(nomesUnicos);
    } catch (error) {
      console.error('Erro ao carregar produtos não-mix:', error);
    }
  };

  const handleSelecionarProduto = (produto) => {
    setProdutosSugeridos([]);
    setShowSuggestions(false);
    setBuscaProduto(produto.nome);
    
    if (formData.is_produto_do_mix) {
      setFormData(prev => ({
        ...prev,
        produto_consultado_nome: produto.nome,
        produto_consultado_id: produto.id
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        nome_produto_nao_mix: produto.nome
      }));
    }
  };

  const handleToggleTipoProduto = (isProdutoDoMix) => {
    setFormData({
      ...formData,
      is_produto_do_mix: isProdutoDoMix,
      produto_consultado_nome: '',
      produto_consultado_id: '',
      nome_produto_nao_mix: '',
      motivo_perda: isProdutoDoMix ? 'Sem Estoque' : 'Não faz parte do mix'
    });
    setBuscaProduto('');
    setProdutosSugeridos([]);
    setShowSuggestions(false);
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => {
        setFeedback({ type: '', message: '' });
        handleClose();
      }, 1500);
    } else {
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.quantidade_desejada <= 0) {
      showFeedback('error', 'Informe a quantidade desejada');
      return;
    }

    if (formData.is_produto_do_mix && !formData.produto_consultado_nome) {
      showFeedback('error', 'Selecione um produto do mix');
      return;
    }

    if (!formData.is_produto_do_mix) {
      const nomeProduto = buscaProduto.trim();
      if (!nomeProduto) {
        showFeedback('error', 'Informe o nome do produto');
        return;
      }
      formData.nome_produto_nao_mix = nomeProduto;
      formData.motivo_perda = 'Não faz parte do mix';
    }

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        produto_nome: formData.produto_consultado_nome,
        motivo: formData.motivo_perda
      };
      await base44.entities.VendaPerdida.create(dataToSave);
      showFeedback('success', 'Venda perdida registrada');
    } catch (error) {
      showFeedback('error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      is_produto_do_mix: true,
      produto_consultado_nome: '',
      produto_consultado_id: '',
      nome_produto_nao_mix: '',
      quantidade_desejada: 1,
      motivo_perda: 'Sem Estoque',
      observacao: '',
      vendedor_id: currentUser?.id || '',
      vendedor_nome: currentUser?.full_name || ''
    });
    setBuscaProduto('');
    setProdutosSugeridos([]);
    setShowSuggestions(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border-0 shadow-xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-foreground">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Venda Perdida</h2>
              <p className="text-xs font-normal text-muted-foreground">Registre para análise de estoque e mix</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Feedback Inline */}
        {feedback.message && (
          <div className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Switch Produto do Mix / Não Mix */}
          <div className="flex items-center justify-between py-3 px-4 bg-muted/40 dark:bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className={`text-sm ${formData.is_produto_do_mix ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                Produto Cadastrado
              </span>
            </div>
            <Switch
              checked={!formData.is_produto_do_mix}
              onCheckedChange={(checked) => handleToggleTipoProduto(!checked)}
            />
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!formData.is_produto_do_mix ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                Produto Novo
              </span>
              <PackagePlus className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Busca de Produto */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
              {formData.is_produto_do_mix ? <Package className="w-3 h-3" /> : <PackagePlus className="w-3 h-3" />}
              {formData.is_produto_do_mix ? 'Produto do Mix *' : 'Nome do Produto *'}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={formData.is_produto_do_mix ? "Buscar produto cadastrado..." : "Digite o nome do produto..."}
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                className="pl-10 bg-card dark:bg-muted/50 border-0 border-b border-border/40 rounded-none focus:ring-0 focus:border-border/40 text-foreground dark:text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {showSuggestions && produtosSugeridos.length > 0 && (
              <div className="absolute z-50 w-full mt-1.5 bg-card rounded-2xl shadow-xl max-h-72 overflow-y-auto border border-border/40">
                {produtosSugeridos.map((produto, idx) => (
                  <div
                    key={produto.id || idx}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 dark:hover:bg-muted/60 cursor-pointer border-b border-border/30 dark:border-border/40 last:border-b-0 transition-colors"
                    onClick={() => handleSelecionarProduto(produto)}
                  >
                    {formData.is_produto_do_mix && (
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        <ProdutoThumbImage produto={produto} size="xs" iconClassName="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{produto.nome}</p>
                      {formData.is_produto_do_mix && produto.estoque_atual !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Estoque: {produto.estoque_atual} · #{produto.codigo_interno}
                        </p>
                      )}
                      {!formData.is_produto_do_mix && (
                        <p className="text-xs text-amber-500">Já registrado</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantidade e Motivo em linha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                <Hash className="w-3 h-3" />
                Quantidade *
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.quantidade_desejada}
                onChange={(e) => setFormData({ ...formData, quantidade_desejada: parseInt(e.target.value) || 1 })}
                onFocus={(e) => e.target.select()}
                className="bg-card dark:bg-muted/50 border-0 border-b border-border/40 rounded-none focus:ring-0 focus:border-border/40 text-foreground dark:text-foreground"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertTriangle className="w-3 h-3" />
                Motivo *
              </Label>
              {formData.is_produto_do_mix ? (
                <Select
                  value={formData.motivo_perda}
                  onValueChange={(v) => setFormData({ ...formData, motivo_perda: v })}
                >
                  <SelectTrigger className="bg-card dark:bg-muted/50 border-0 border-b border-border/40 rounded-none focus:ring-0 text-foreground dark:text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/40">
                    <SelectItem value="Sem Estoque">Sem Estoque</SelectItem>
                    <SelectItem value="Preço Alto">Preço Alto</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 flex items-center text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Fora do Mix
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
              <MessageSquare className="w-3 h-3" />
              Observações
            </Label>
            <Textarea
              placeholder="Detalhes adicionais..."
              value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={2}
              className="bg-card dark:bg-muted/50 border-0 border-b border-border/40 rounded-none focus:ring-0 focus:border-border/40 text-foreground dark:text-foreground resize-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <DialogFooter className="pt-4 flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-12 md:h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-white text-base font-medium"
          >
            {isSubmitting ? 'Registrando...' : 'Registrar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="w-full h-11 md:h-10 text-muted-foreground hover:text-foreground/90 hover:bg-muted"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}