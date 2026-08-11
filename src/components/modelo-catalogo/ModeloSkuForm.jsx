import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Loader2, Save } from 'lucide-react';
import {
  ensureEixoValor,
  fetchModeloEixoValores,
  fetchModeloProdutosCompra,
  saveModeloSku,
} from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { montarNomeModeloSku, mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';
import { resolveParametrosProdutoCompra } from '@/lib/modeloCatalogo/resolveParametrosModelo';
import { applyModeloSkuSimilar } from '@/lib/modeloCatalogo/espelharProduto';
import { toast } from 'sonner';

const EMPTY = {
  id: null,
  linha_id: '',
  produto_compra_id: '',
  eixo_a_texto: '',
  eixo_b_texto: '',
  marca: '',
  nome: '',
  codigo_interno: '',
  estoque_simulado: 0,
  estoque_minimo_simulado: 0,
  espelho_produto_id: null,
  espelho_codigo_interno: '',
};

export default function ModeloSkuForm({
  open,
  onClose,
  onSaved,
  linhas = [],
  skuInicial,
  similarBase,
  presetLinhaId,
  presetProdutoCompraId,
  presetEixoA,
  presetEixoB,
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [eixoSugestoes, setEixoSugestoes] = useState({ A: [], B: [] });

  const linha = useMemo(() => linhas.find((l) => l.id === form.linha_id), [linhas, form.linha_id]);
  const produtoCompra = useMemo(
    () => produtosCompra.find((p) => p.id === form.produto_compra_id),
    [produtosCompra, form.produto_compra_id],
  );
  const solo = linha && mapTipoLinhaUi(linha.tipo) === 'solo';
  const paramsPc = useMemo(
    () => (produtoCompra && linha ? resolveParametrosProdutoCompra(produtoCompra, linha) : null),
    [produtoCompra, linha],
  );
  const isPortfolio = linha && mapTipoLinhaUi(linha.tipo) === 'portfolio';

  useEffect(() => {
    if (!open) return;
    if (skuInicial) {
      setForm({
        ...EMPTY,
        ...skuInicial,
        estoque_simulado: Number(skuInicial.estoque_simulado) || 0,
        estoque_minimo_simulado: Number(skuInicial.estoque_minimo_simulado) || 0,
      });
    } else if (similarBase) {
      setForm({ ...EMPTY, ...applyModeloSkuSimilar(similarBase) });
    } else {
      setForm({
        ...EMPTY,
        linha_id: presetLinhaId || '',
        produto_compra_id: presetProdutoCompraId || '',
        eixo_a_texto: presetEixoA || '',
        eixo_b_texto: presetEixoB || '',
      });
    }
  }, [open, skuInicial, similarBase, presetLinhaId, presetProdutoCompraId, presetEixoA, presetEixoB]);

  useEffect(() => {
    if (!form.linha_id) {
      setProdutosCompra([]);
      return;
    }
    fetchModeloProdutosCompra(form.linha_id).then(setProdutosCompra).catch(() => setProdutosCompra([]));
  }, [form.linha_id]);

  useEffect(() => {
    if (!form.linha_id) return;
    const load = async () => {
      const scope = form.produto_compra_id
        ? { produtoCompraId: form.produto_compra_id }
        : { linhaId: form.linha_id };
      const [a, b] = await Promise.all([
        fetchModeloEixoValores({ ...scope, eixo: 'A' }).catch(() => []),
        fetchModeloEixoValores({ ...scope, eixo: 'B' }).catch(() => []),
      ]);
      const allA = await fetchModeloEixoValores({ ...scope });
      setEixoSugestoes({
        A: allA.filter((e) => e.eixo === 'A'),
        B: allA.filter((e) => e.eixo === 'B'),
      });
    };
    load();
  }, [form.linha_id, form.produto_compra_id]);

  const nomePreview = useMemo(
    () =>
      montarNomeModeloSku({
        produtoCompraNome: solo ? '' : (produtoCompra?.nome || ''),
        eixoA: form.eixo_a_texto,
        eixoB: form.eixo_b_texto,
        marca: form.marca,
        linhaNome: linha?.nome,
        solo,
      }),
    [form, linha, produtoCompra, solo],
  );

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleCloneSimilar = () => {
    if (!similarBase) return;
    setForm((f) => ({
      ...f,
      ...applyModeloSkuSimilar(similarBase),
      eixo_a_texto: '',
      eixo_b_texto: '',
      codigo_interno: '',
      espelho_produto_id: null,
      espelho_codigo_interno: '',
    }));
    toast.message('Irmão clonado — edite os eixos');
  };

  const handleSave = async () => {
    if (!form.linha_id) {
      toast.error('Seleccione a LINHA');
      return;
    }
    if (!solo && !form.produto_compra_id) {
      toast.error('Seleccione o produto compra');
      return;
    }
    const nome = nomePreview || form.nome;
    if (!nome) {
      toast.error('Preencha os eixos para gerar o nome');
      return;
    }
    setLoading(true);
    try {
      let eixoAId = null;
      let eixoBId = null;
      if (form.eixo_a_texto.trim()) {
        const ev = await ensureEixoValor({
          linhaId: form.linha_id,
          produtoCompraId: solo ? null : form.produto_compra_id,
          eixo: 'A',
          texto: form.eixo_a_texto.trim(),
        });
        eixoAId = ev?.id || null;
      }
      if (form.eixo_b_texto.trim()) {
        const ev = await ensureEixoValor({
          linhaId: form.linha_id,
          produtoCompraId: solo ? null : form.produto_compra_id,
          eixo: 'B',
          texto: form.eixo_b_texto.trim(),
        });
        eixoBId = ev?.id || null;
      }
      const saved = await saveModeloSku({
        ...form,
        produto_compra_id: solo ? null : form.produto_compra_id,
        nome,
        eixo_a_valor_id: eixoAId,
        eixo_b_valor_id: eixoBId,
        estoque_simulado: Number(form.estoque_simulado) || 0,
        estoque_minimo_simulado: Number(form.estoque_minimo_simulado) || 0,
      });
      toast.success(form.id ? 'SKU modelo actualizado' : 'SKU modelo criado');
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Erro ao gravar SKU modelo');
    } finally {
      setLoading(false);
    }
  };

  const eixoARotulo = paramsPc?.eixo_a_rotulo || linha?.eixo_a_rotulo || 'Eixo A';
  const eixoBRotulo = paramsPc?.eixo_b_rotulo || linha?.eixo_b_rotulo || 'Eixo B';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar SKU (laboratório)' : 'Novo SKU (laboratório)'}</DialogTitle>
        </DialogHeader>

        {form.espelho_codigo_interno && (
          <Badge variant="outline" className="text-[10px] w-fit">
            Espelho produção: {form.espelho_codigo_interno}
          </Badge>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <Label>LINHA *</Label>
            <Select value={form.linha_id || '__none__'} onValueChange={(v) => handleChange('linha_id', v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar LINHA" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {linhas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome} ({l.tipo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!solo && (
            <div>
              <Label>Produto compra (≈ h1) *</Label>
              <Select
                value={form.produto_compra_id || '__none__'}
                onValueChange={(v) => handleChange('produto_compra_id', v === '__none__' ? '' : v)}
                disabled={!form.linha_id}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar produto compra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {produtosCompra.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isPortfolio && produtoCompra && paramsPc && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {paramsPc.overrides?.meta_vagas || paramsPc.overrides?.massa_critica ? 'Override PC · ' : 'Herdado LINHA · '}
                  {paramsPc.meta_vagas} vagas · massa {paramsPc.massa_critica} cx · saldável ≥ {paramsPc.min_linhas_saldavel} linhas
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{eixoARotulo}</Label>
              <Input
                list="eixo-a-list"
                value={form.eixo_a_texto}
                onChange={(e) => handleChange('eixo_a_texto', e.target.value)}
                placeholder="45x45"
              />
              <datalist id="eixo-a-list">
                {eixoSugestoes.A.map((e) => <option key={e.id} value={e.nome} />)}
              </datalist>
            </div>
            <div>
              <Label>{eixoBRotulo}</Label>
              <Input
                list="eixo-b-list"
                value={form.eixo_b_texto}
                onChange={(e) => handleChange('eixo_b_texto', e.target.value)}
                placeholder="GRAMADO"
              />
              <datalist id="eixo-b-list">
                {eixoSugestoes.B.map((e) => <option key={e.id} value={e.nome} />)}
              </datalist>
            </div>
          </div>

          {nomePreview && (
            <div className="rounded-lg border px-3 py-2 bg-muted/40">
              <p className="text-[10px] text-muted-foreground uppercase">Preview nome SKU</p>
              <p className="font-medium text-sm">{nomePreview}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Marca</Label>
              <Input value={form.marca} onChange={(e) => handleChange('marca', e.target.value)} />
            </div>
            <div>
              <Label>Cód. interno (opcional)</Label>
              <Input value={form.codigo_interno} onChange={(e) => handleChange('codigo_interno', e.target.value)} placeholder="só laboratório" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Estoque simulado</Label>
              <Input type="number" step="0.01" value={form.estoque_simulado} onChange={(e) => handleChange('estoque_simulado', e.target.value)} />
            </div>
            <div>
              <Label>Ponto (simulado)</Label>
              <Input type="number" step="0.01" value={form.estoque_minimo_simulado} onChange={(e) => handleChange('estoque_minimo_simulado', e.target.value)} />
            </div>
          </div>

          {similarBase && !form.id && (
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={handleCloneSimilar}>
              <Copy className="h-3.5 w-3.5" />
              Clonar irmão (só mudar eixos)
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Gravar no laboratório
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
