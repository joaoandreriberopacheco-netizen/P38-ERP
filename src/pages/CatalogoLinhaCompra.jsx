import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Grid3x3, Loader2, Package, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import ProdutosAccessGuard from '@/components/guard/ProdutosAccessGuard';
import ProdutoFormCompleto from '@/components/produtos/ProdutoFormCompleto';
import GradeSkuMatrix from '@/components/catalogoLinha/GradeSkuMatrix';
import CatalogoLinhaListaSolo from '@/components/catalogoLinha/CatalogoLinhaListaSolo';
import MassGradeCompraDialog from '@/components/produtos/MassGradeCompraDialog';
import MigracaoGradeIADialog from '@/components/catalogoLinha/MigracaoGradeIADialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import {
  fetchEixoValores,
  fetchLinhasCompra,
  fetchProdutosCompraByLinha,
} from '@/lib/produtoGradeCompra/fetchGradeCompra';
import { buildSiblingDraft, pickSiblingForCell } from '@/lib/produtoGradeCompra/buildSiblingDraft';
import {
  buildGradeMatrix,
  countProdutosPorLinha,
  countProdutosSemLinha,
} from '@/lib/produtoGradeCompra/indexGradeMatrix';
import { useProdutosComIepQuery } from '@/hooks/useP38Entities';
import { base44 } from '@/api/base44Client';

const TIPO_LABEL = {
  solo: 'Solo',
  linha_mix: 'Mix',
  portfolio: 'Portfolio',
};

export default function CatalogoLinhaCompra() {
  const supabaseOk = isSupabaseBrowserConfigured();
  const { data: produtos = [], isLoading: loadingProdutos, refetch: refetchProdutos } = useProdutosComIepQuery();

  const [linhas, setLinhas] = useState([]);
  const [linhaId, setLinhaId] = useState('');
  const [produtoCompraId, setProdutoCompraId] = useState('');
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [eixosA, setEixosA] = useState([]);
  const [eixosB, setEixosB] = useState([]);
  const [loadLinhasErr, setLoadLinhasErr] = useState('');
  const [search, setSearch] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [produtoSimilarBase, setProdutoSimilarBase] = useState(null);
  const [isMassOpen, setIsMassOpen] = useState(false);
  const [isMigracaoIAOpen, setIsMigracaoIAOpen] = useState(false);

  const semLinhaCount = useMemo(() => countProdutosSemLinha(produtos), [produtos]);

  useEffect(() => {
    if (!supabaseOk) return;
    fetchLinhasCompra()
      .then((rows) => {
        setLinhas(rows);
        if (rows.length && !linhaId) setLinhaId(rows[0].id);
      })
      .catch((e) => setLoadLinhasErr(e?.message || String(e)));
  }, [supabaseOk]);

  useEffect(() => {
    if (!linhaId || !supabaseOk) {
      setProdutosCompra([]);
      return;
    }
    fetchProdutosCompraByLinha(linhaId).then((rows) => {
      setProdutosCompra(rows);
      if (rows.length === 1) {
        setProdutoCompraId(rows[0].id);
      } else if (rows.length && produtoCompraId && !rows.find((r) => r.id === produtoCompraId)) {
        setProdutoCompraId('');
      }
    }).catch(() => setProdutosCompra([]));
  }, [linhaId, supabaseOk]);

  const linhaSel = useMemo(() => linhas.find((l) => l.id === linhaId) || null, [linhas, linhaId]);
  const produtoCompraSel = useMemo(
    () => produtosCompra.find((p) => p.id === produtoCompraId) || null,
    [produtosCompra, produtoCompraId],
  );
  const usaGrelha = linhaSel?.tipo === 'linha_mix' || linhaSel?.tipo === 'portfolio';

  useEffect(() => {
    if (!supabaseOk || !linhaId || !usaGrelha) {
      setEixosA([]);
      setEixosB([]);
      return;
    }
    const scope = { linhaId, produtoCompraId: produtoCompraId || undefined };
    Promise.all([
      fetchEixoValores({ ...scope, eixo: 'A' }),
      fetchEixoValores({ ...scope, eixo: 'B' }),
    ])
      .then(([a, b]) => {
        setEixosA(a);
        setEixosB(b);
      })
      .catch(() => {
        setEixosA([]);
        setEixosB([]);
      });
  }, [linhaId, produtoCompraId, usaGrelha, supabaseOk]);

  const produtosLinha = useMemo(() => {
    let list = produtos.filter((p) => p.linha_compra_id === linhaId);
    if (produtoCompraId) list = list.filter((p) => p.produto_compra_id === produtoCompraId);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => (p.nome || '').toLowerCase().includes(q));
    return list;
  }, [produtos, linhaId, produtoCompraId, search]);

  const matrix = useMemo(
    () => buildGradeMatrix({
      produtos,
      linhaId,
      produtoCompraId: produtoCompraId || undefined,
      produtosCompra,
      eixosA,
      eixosB,
    }),
    [produtos, linhaId, produtoCompraId, produtosCompra, eixosA, eixosB],
  );

  const matricesPorProdutoCompra = useMemo(() => {
    if (!usaGrelha || produtoCompraId || produtosCompra.length <= 1) return [];
    if (matrix.gridMode === 'produto_compra_x_b') return [];

    return produtosCompra
      .map((pc) => ({
        pc,
        matrix: buildGradeMatrix({
          produtos,
          linhaId,
          produtoCompraId: pc.id,
          produtosCompra,
          eixosA,
          eixosB,
        }),
      }))
      .filter(({ matrix: m }) => m.hasGrid);
  }, [usaGrelha, produtoCompraId, produtosCompra, matrix.gridMode, produtos, linhaId, eixosA, eixosB]);

  const eixoARotulo = produtoCompraSel?.eixo_a_rotulo || linhaSel?.eixo_a_rotulo || 'Eixo A';
  const eixoBRotulo = produtoCompraSel?.eixo_b_rotulo || linhaSel?.eixo_b_rotulo || 'Eixo B';

  const produtosPendentes = useMemo(
    () => produtos.filter((p) => !p.linha_compra_id),
    [produtos],
  );

  const handleOpenProduto = useCallback((produto) => {
    setProdutoSimilarBase(null);
    setSelectedProduto(produto);
    setIsFormOpen(true);
    if (produto?.id) {
      base44.entities.Produto.get(produto.id)
        .then((full) => {
          if (full) setSelectedProduto((prev) => (prev?.id === produto.id ? { ...prev, ...full } : prev));
        })
        .catch(() => {});
    }
  }, []);

  const handleCreateSibling = useCallback(({ irmao, eixoA, eixoB } = {}) => {
    const pcFromGrid = eixoA?.isProdutoCompra
      ? produtosCompra.find((p) => p.id === eixoA.id)
      : null;
    const effectivePcId = pcFromGrid?.id || produtoCompraId;
    const pool = produtos.filter((p) => p.linha_compra_id === linhaId);
    const base = irmao || pickSiblingForCell(pool, {
      linhaId,
      produtoCompraId: effectivePcId,
      eixoA: pcFromGrid ? null : eixoA,
    }) || pool[0] || null;

    const draft = buildSiblingDraft(base || {}, {
      linha: linhaSel,
      produtoCompra: pcFromGrid || produtoCompraSel,
      eixoA: pcFromGrid ? null : eixoA,
      eixoB,
      limparEixoA: Boolean(pcFromGrid) || (!eixoA && !base),
      limparEixoB: !eixoB && !base,
    });

    setSelectedProduto(null);
    setProdutoSimilarBase(draft);
    setIsFormOpen(true);
  }, [produtos, linhaId, produtoCompraId, produtosCompra, linhaSel, produtoCompraSel]);

  const handleSave = useCallback(async () => {
    await refetchProdutos();
    setIsFormOpen(false);
    setProdutoSimilarBase(null);
    setSelectedProduto(null);
  }, [refetchProdutos]);

  const handleLinhaChange = (id) => {
    setLinhaId(id);
    setProdutoCompraId('');
    setSearch('');
  };

  if (!supabaseOk) {
    return (
      <ProdutosAccessGuard>
        <div className="p-8 max-w-lg mx-auto text-center space-y-3">
          <Package className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Supabase não configurado — catálogo por linha indisponível neste ambiente.
          </p>
          <Button asChild variant="outline">
            <Link to={createPageUrl('Produtos')}>Abrir catálogo legado</Link>
          </Button>
        </div>
      </ProdutosAccessGuard>
    );
  }

  return (
    <ProdutosAccessGuard>
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <header className="flex-none border-b border-border/40 px-4 py-3 md:px-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Grid3x3 className="w-5 h-5 p38-text-accent" />
                <h1 className="text-lg font-semibold text-foreground">Catálogo por linha</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Vista em grelha — cada célula é um SKU (preço e estoque próprios).
                {' '}
                Ex.: soldável = peças × medidas; argamassa = classe × embalagem.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={createPageUrl('Produtos')}>Catálogo legado</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchProdutos()}
                disabled={loadingProdutos}
                className="gap-1.5"
              >
                <RefreshCw className={cn('w-4 h-4', loadingProdutos && 'animate-spin')} />
                Actualizar
              </Button>
              {semLinhaCount > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setIsMigracaoIAOpen(true)} className="gap-1.5">
                  <Sparkles className="w-4 h-4 p38-text-accent" />
                  Migrar com IA ({semLinhaCount})
                </Button>
              ) : null}
              {semLinhaCount > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setIsMassOpen(true)} className="gap-1.5">
                  Atribuir manual ({semLinhaCount})
                </Button>
              ) : null}
              <Button size="sm" className="p38-bg-accent text-white gap-1.5" onClick={() => handleCreateSibling({})}>
                <Plus className="w-4 h-4" />
                Novo SKU
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="flex flex-wrap gap-2 flex-1">
              <Select value={linhaId || '__none__'} onValueChange={(v) => handleLinhaChange(v === '__none__' ? '' : v)}>
                <SelectTrigger className="w-full md:w-[220px] h-10">
                  <SelectValue placeholder="Linha de compra" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {linhas.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                      {' '}
                      <span className="text-muted-foreground text-[10px]">
                        (
                        {TIPO_LABEL[l.tipo] || l.tipo}
                        ·
                        {countProdutosPorLinha(produtos, l.id)}
                        )
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {produtosCompra.length > 1 ? (
                <Select
                  value={produtoCompraId || '__all__'}
                  onValueChange={(v) => setProdutoCompraId(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="w-full md:w-[240px] h-10">
                    <SelectValue placeholder="Produto de compra" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all__">Todos os produtos de compra</SelectItem>
                    {produtosCompra.map((pc) => (
                      <SelectItem key={pc.id} value={pc.id}>{pc.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar SKUs desta linha…"
                  className="pl-9 h-10"
                />
              </div>
            </div>
          </div>

          {loadLinhasErr ? (
            <p className="text-xs text-destructive">{loadLinhasErr}</p>
          ) : null}

          {linhaSel ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{TIPO_LABEL[linhaSel.tipo] || linhaSel.tipo}</Badge>
              <Badge variant="secondary">{produtosLinha.length} SKU(s) nesta vista</Badge>
              {usaGrelha && matrix.hasGrid ? (
                <Badge variant="outline">
                  Grelha
                  {' '}
                  {matrix.gridMode === 'produto_compra_x_b'
                    ? `${matrix.rowsA.length} peças × ${matrix.colsB.length} medidas`
                    : matrix.gridMode === 'cols_only'
                      ? `${matrix.colsB.length} medidas`
                      : `${matrix.rowsA.length} × ${matrix.colsB.length}`}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {loadingProdutos && !produtos.length ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              A carregar produtos…
            </div>
          ) : !linhaSel ? (
            <p className="text-sm text-muted-foreground text-center py-12">Seleccione uma linha de compra.</p>
          ) : usaGrelha && matricesPorProdutoCompra.length > 0 ? (
            <div className="space-y-8">
              {matricesPorProdutoCompra.map(({ pc, matrix: sub }) => (
                <GradeSkuMatrix
                  key={pc.id}
                  rowsA={sub.rowsA}
                  colsB={sub.colsB}
                  cells={sub.cells}
                  gridMode={sub.gridMode}
                  eixoARotulo={pc.eixo_a_rotulo || eixoARotulo}
                  eixoBRotulo={pc.eixo_b_rotulo || eixoBRotulo}
                  sectionTitle={pc.nome}
                  onOpenProduto={handleOpenProduto}
                  onCreateSibling={handleCreateSibling}
                />
              ))}
            </div>
          ) : usaGrelha && matrix.hasGrid ? (
            <GradeSkuMatrix
              rowsA={matrix.rowsA}
              colsB={matrix.colsB}
              cells={matrix.cells}
              gridMode={matrix.gridMode}
              eixoARotulo={eixoARotulo}
              eixoBRotulo={eixoBRotulo}
              sectionTitle={
                matrix.gridMode === 'cols_only' && produtoCompraSel?.nome
                  ? produtoCompraSel.nome
                  : ''
              }
              onOpenProduto={handleOpenProduto}
              onCreateSibling={handleCreateSibling}
            />
          ) : (
            <CatalogoLinhaListaSolo
              produtos={produtosLinha}
              onOpenProduto={handleOpenProduto}
              onCreateSibling={handleCreateSibling}
            />
          )}
        </main>

        {isFormOpen ? (
          <div className="fixed inset-0 z-[70] bg-background dark:bg-[#1f1d22]">
            <ProdutoFormCompleto
              produto={selectedProduto}
              produtoSimilarBase={produtoSimilarBase}
              onSave={handleSave}
              onClose={() => {
                setIsFormOpen(false);
                setProdutoSimilarBase(null);
                setSelectedProduto(null);
              }}
            />
          </div>
        ) : null}

        <MassGradeCompraDialog
          products={produtosPendentes}
          open={isMassOpen}
          onOpenChange={setIsMassOpen}
          onComplete={() => refetchProdutos()}
          hideTrigger
        />

        <MigracaoGradeIADialog
          products={produtos}
          open={isMigracaoIAOpen}
          onOpenChange={setIsMigracaoIAOpen}
          onComplete={() => refetchProdutos()}
          hideTrigger
        />
      </div>
    </ProdutosAccessGuard>
  );
}
