import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { mapTipoLinhaUi, TIPO_LINHA_LABEL } from '@/lib/modeloCatalogo/montarNomeSku';
import {
  fetchAllModeloProdutosCompra,
  fetchModeloLinhas,
} from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { filtrarDadosPilotoModelo, isLinhaPilotoAtiva } from '@/lib/modeloCatalogo/filtrarPilotoModelo';
import { resolveEixosCadastro } from '@/lib/cadastroProdutoV2/resolveEixosCadastro';
import { emptyGradeRow } from '@/lib/cadastroProdutoV2/montarNovoSku';
import { cadastroV2ToGradeRow } from '@/lib/cadastroProdutoV2/hydrateGradeFromProducao';
import {
  linhaTipoLabel,
  loadGradeForContext,
  refreshGradeFromProducao,
  saveGradeCadastroV2,
} from '@/lib/cadastroProdutoV2/saveCadastroProdutoV2';
import CadastroProdutoCompraDialog from '@/components/cadastro-produto-v2/CadastroProdutoCompraDialog';
import CadastroSkuGrade from '@/components/cadastro-produto-v2/CadastroSkuGrade';
import CadastroSkuProdutoEditor from '@/components/cadastro-produto-v2/CadastroSkuProdutoEditor';
import {
  gradeRowToProdutoSeed,
  linkGradeRowFromProduto,
} from '@/lib/cadastroProdutoV2/gradeRowToProdutoSeed';

export default function CadastroProdutoV2Form() {
  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linhas, setLinhas] = useState([]);
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [produtos, setProdutos] = useState([]);

  const [linhaId, setLinhaId] = useState('');
  const [produtoCompraId, setProdutoCompraId] = useState('');
  const [gradeRows, setGradeRows] = useState([]);
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProduto, setEditorProduto] = useState(null);
  const [editorRowKey, setEditorRowKey] = useState(null);

  const linha = useMemo(() => linhas.find((l) => l.id === linhaId), [linhas, linhaId]);
  const produtoCompra = useMemo(
    () => produtosCompra.find((p) => p.id === produtoCompraId),
    [produtosCompra, produtoCompraId],
  );
  const solo = linha && mapTipoLinhaUi(linha.tipo) === 'solo';
  const eixos = useMemo(() => resolveEixosCadastro(produtoCompra, linha), [produtoCompra, linha]);

  const pcsFiltrados = useMemo(
    () => produtosCompra.filter((p) => p.linha_id === linhaId),
    [produtosCompra, linhaId],
  );

  const reloadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [l, pc, prodRows] = await Promise.all([
        fetchModeloLinhas(),
        fetchAllModeloProdutosCompra(),
        fetchProdutosAtivos(base44),
      ]);
      const filtrado = filtrarDadosPilotoModelo({ linhas: l, produtosCompra: pc, skus: [] });
      setLinhas(filtrado.linhas);
      setProdutosCompra(filtrado.produtosCompra);
      setProdutos(prodRows || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar catálogo');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGrade = useCallback(async () => {
    if (!linha || (!solo && !produtoCompra)) {
      setGradeRows([]);
      return;
    }
    setLoadingGrade(true);
    try {
      const rows = await loadGradeForContext({
        produtos,
        linha,
        produtoCompra: solo ? null : produtoCompra,
        solo,
      });
      setGradeRows(rows.length ? rows : [emptyGradeRow()]);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Erro ao carregar grade');
      setGradeRows([emptyGradeRow()]);
    } finally {
      setLoadingGrade(false);
    }
  }, [linha, produtoCompra, solo, produtos]);

  useEffect(() => { reloadCatalog(); }, [reloadCatalog]);

  useEffect(() => {
    loadGrade();
  }, [loadGrade]);

  const handleLinhaChange = (id) => {
    setLinhaId(id);
    setProdutoCompraId('');
  };

  const handleRefreshProducao = () => {
    if (!linha) return;
    const refreshed = refreshGradeFromProducao(gradeRows, produtos, {
      linha,
      produtoCompra: solo ? null : produtoCompra,
      solo,
    });
    setGradeRows(refreshed.length ? refreshed : [emptyGradeRow()]);
    toast.message('Preços e estoque actualizados a partir da produção');
  };

  const resolveSavedProduto = async (row, hintId) => {
    if (hintId) {
      try {
        const full = await base44.entities.Produto.get(hintId);
        if (full?.id) return full;
      } catch {
        /* tenta por código */
      }
    }
    const codigo = String(row?.codigo_interno || '').trim().toUpperCase();
    if (codigo) {
      const hits = await base44.entities.Produto.filter({ codigo_interno: codigo }, '-created_date', 5);
      const list = Array.isArray(hits) ? hits : hits?.data ?? [];
      const match = list.find((p) => String(p.codigo_interno || '').toUpperCase() === codigo);
      if (match) return match;
    }
    const recent = await base44.entities.Produto.list('-created_date', 3);
    const recentList = Array.isArray(recent) ? recent : recent?.data ?? [];
    const nomeAlvo = gradeRowToProdutoSeed({ row, linha, produtoCompra, eixos, solo }).nome;
    return recentList.find((p) => String(p.nome || '').trim().toUpperCase() === String(nomeAlvo).toUpperCase()) || null;
  };

  const handleEditGradeRow = async (row) => {
    setEditorRowKey(row.key);
    if (row.produto_producao_id) {
      try {
        const full = await base44.entities.Produto.get(row.produto_producao_id);
        setEditorProduto(full?.id ? full : { id: row.produto_producao_id });
      } catch {
        setEditorProduto(gradeRowToProdutoSeed({ row, linha, produtoCompra, eixos, solo }));
      }
    } else {
      setEditorProduto(gradeRowToProdutoSeed({ row, linha, produtoCompra, eixos, solo }));
    }
    setEditorOpen(true);
  };

  const handleEditorSave = async () => {
    const row = gradeRows.find((r) => r.key === editorRowKey);
    const hintId = editorProduto?.id || row?.produto_producao_id;
    try {
      const saved = await resolveSavedProduto(row, hintId);
      const prodRows = await fetchProdutosAtivos(base44);
      setProdutos(prodRows || []);
      if (saved && row) {
        setGradeRows((rows) => rows.map((r) => (
          r.key === editorRowKey
            ? linkGradeRowFromProduto(r, saved, { linha, produtoCompra, eixos, solo })
            : r
        )));
        toast.success(saved.id === hintId ? 'SKU actualizado no catálogo' : 'SKU criado no catálogo');
      } else {
        toast.message('Catálogo actualizado — actualize a grade se necessário');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao sincronizar com o catálogo');
    }
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditorProduto(null);
    setEditorRowKey(null);
  };

  const handleSave = async () => {
    if (!linha) {
      toast.error('Seleccione a LINHA');
      return;
    }
    if (!solo && !produtoCompra) {
      toast.error('Seleccione ou crie o produto compra');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveGradeCadastroV2({
        rows: gradeRows,
        linha,
        produtoCompra: solo ? null : produtoCompra,
      });
      toast.success(`${saved.length} linha(s) gravadas (cadastro v2)`);
      setGradeRows(saved.map(cadastroV2ToGradeRow));
    } catch (e) {
      toast.error(e.message || 'Erro ao gravar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        A carregar…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        A grade <strong>hidrata</strong> dos SKUs reais (preço, estoque, código).
        Use <strong>Cadastrar / Editar</strong> para abrir o formulário completo do catálogo (como em Produtos).
        Grava rascunho em <code className="text-[10px]">cadastro_v2_grade_sku</code>.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>LINHA *</Label>
          <Select value={linhaId || '__none__'} onValueChange={(v) => handleLinhaChange(v === '__none__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar LINHA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {linhas.filter(isLinhaPilotoAtiva).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}{' '}
                  <span className="text-muted-foreground">({TIPO_LINHA_LABEL[mapTipoLinhaUi(l.tipo)] || l.tipo})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linha && (
            <Badge variant="outline" className="text-[10px]">
              {linhaTipoLabel(linha)} · {eixos.count} eixo(s)
            </Badge>
          )}
        </div>

        {!solo && linha && (
          <div className="space-y-2">
            <Label>Produto compra *</Label>
            <div className="flex gap-2">
              <Select
                value={produtoCompraId || '__none__'}
                onValueChange={(v) => setProdutoCompraId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar ou criar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {pcsFiltrados.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setPcDialogOpen(true)} title="Novo produto compra">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {linha && (solo || produtoCompra) && (
        <>
          {loadingGrade ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              A hidratar SKUs reais…
            </div>
          ) : (
            <CadastroSkuGrade
              rows={gradeRows}
              onChange={setGradeRows}
              linha={linha}
              produtoCompra={produtoCompra}
              eixos={eixos}
              solo={solo}
              onEditRow={handleEditGradeRow}
            />
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
            <Button type="button" onClick={handleSave} disabled={saving || loadingGrade} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Gravar cadastro
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshProducao}
              disabled={loadingGrade}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar preço/estoque da produção
            </Button>
            <p className="text-[11px] text-muted-foreground self-center">
              {gradeRows.filter((r) => r.from_producao).length} linha(s) ligadas a SKU real
            </p>
          </div>
        </>
      )}

      {!linha && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Escolha a LINHA para hidratar a grade a partir dos SKUs reais.
        </div>
      )}

      <CadastroProdutoCompraDialog
        open={pcDialogOpen}
        linha={linha}
        onClose={() => setPcDialogOpen(false)}
        onSaved={(row) => {
          setPcDialogOpen(false);
          reloadCatalog().then(() => {
            setLinhaId(row.linha_id);
            setProdutoCompraId(row.id);
          });
        }}
      />

      {editorOpen && (
        <CadastroSkuProdutoEditor
          produto={editorProduto}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}
