import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { MODELO_CATALOGO_ENABLED } from '@/config/modeloCatalogoFlags';
import {
  fetchAllModeloProdutosCompra,
  fetchModeloLinhas,
  fetchModeloSkus,
} from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { buildModeloTree, filterModeloTree } from '@/lib/modeloCatalogo/buildModeloTree';
import { buildModeloSupplyLines } from '@/lib/modeloCatalogo/buildModeloSupply';
import ModeloCatalogoTree from '@/components/modelo-catalogo/ModeloCatalogoTree';
import ModeloSmartSupplyPanel from '@/components/modelo-catalogo/ModeloSmartSupplyPanel';
import ModeloLinhaDialog from '@/components/modelo-catalogo/ModeloLinhaDialog';
import ModeloProdutoCompraDialog from '@/components/modelo-catalogo/ModeloProdutoCompraDialog';
import ModeloSkuForm from '@/components/modelo-catalogo/ModeloSkuForm';
import EspelharProdutoDialog from '@/components/modelo-catalogo/EspelharProdutoDialog';

function ModeloCatalogoInner() {
  const supabaseOk = isSupabaseBrowserConfigured();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('cadastro');
  const [linhas, setLinhas] = useState([]);
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [skus, setSkus] = useState([]);
  const [search, setSearch] = useState('');
  const [filtroLinha, setFiltroLinha] = useState('');
  const [somenteAlerta, setSomenteAlerta] = useState(false);

  const [linhaDialog, setLinhaDialog] = useState(false);
  const [pcDialog, setPcDialog] = useState(null);
  const [skuForm, setSkuForm] = useState(null);
  const [espelharOpen, setEspelharOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!supabaseOk) return;
    setLoading(true);
    try {
      const [l, pc, s] = await Promise.all([
        fetchModeloLinhas(),
        fetchAllModeloProdutosCompra(),
        fetchModeloSkus(),
      ]);
      setLinhas(l);
      setProdutosCompra(pc);
      setSkus(s);
    } catch (e) {
      console.error('[ModeloCatalogo]', e);
    } finally {
      setLoading(false);
    }
  }, [supabaseOk]);

  useEffect(() => { reload(); }, [reload]);

  const tree = useMemo(() => buildModeloTree({ linhas, produtosCompra, skus }), [linhas, produtosCompra, skus]);
  const filteredTree = useMemo(() => filterModeloTree(tree, { filtroLinha, search }), [tree, filtroLinha, search]);
  const supplyLines = useMemo(() => buildModeloSupplyLines({ linhas, produtosCompra, skus }), [linhas, produtosCompra, skus]);
  const filteredSupply = useMemo(() => {
    let lines = supplyLines;
    if (filtroLinha) lines = lines.filter((l) => l.linha_codigo === filtroLinha || l.linha_id === filtroLinha);
    const q = search.trim().toLowerCase();
    if (q) lines = lines.filter((l) => l.produto_compra_nome.toLowerCase().includes(q) || l.linha_nome.toLowerCase().includes(q));
    return lines;
  }, [supplyLines, filtroLinha, search]);

  if (!supabaseOk) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Supabase não configurado — laboratório indisponível.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-din-1451 pb-8">
      <div className="max-w-5xl mx-auto px-4 py-4 md:py-6 space-y-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="space-y-1 min-w-0">
            <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
              <Link to={createPageUrl('Produtos')}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Catálogo produção
              </Link>
            </Button>
            <h1 className="text-xl md:text-2xl font-semibold font-glacial text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-violet-600" />
              Catálogo Modelo (laboratório)
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Universo paralelo: LINHA → produto compra → 2 eixos → SKU. Grava só em <code className="text-xs">modelo_*</code>.
              Pode <strong>ler</strong> produção para espelhar — nunca altera o cadastro real.
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-900 dark:text-violet-100 max-w-sm">
            <strong>Não é produção.</strong> {skus.length} SKU(s) modelo · {linhas.length} LINHA(s)
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
          </div>
          <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="LINHA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as LINHAS</SelectItem>
              {linhas.map((l) => <SelectItem key={l.id} value={l.codigo}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}><RefreshCw className={loading ? 'animate-spin h-3.5 w-3.5' : 'h-3.5 w-3.5'} /></Button>
          <Button variant="outline" size="sm" onClick={() => setLinhaDialog(true)}>+ LINHA</Button>
          <Button variant="outline" size="sm" onClick={() => setEspelharOpen(true)}>Espelhar produção</Button>
          <Button size="sm" onClick={() => setSkuForm({})}><Plus className="h-3.5 w-3.5 mr-1" /> SKU</Button>
        </div>

        <GlacialTabsList className="w-full">
          <GlacialTabsTrigger value="cadastro" activeValue={tab} onSelect={setTab} label="Cadastro (árvore)" />
          <GlacialTabsTrigger value="supply" activeValue={tab} onSelect={setTab} label="SMART SUPPLY (simulado)" />
        </GlacialTabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> A carregar laboratório…
          </div>
        ) : tab === 'cadastro' ? (
          <div className="rounded-lg border bg-card p-2 min-h-[320px]">
            <ModeloCatalogoTree
              tree={filteredTree}
              onNovaLinha={() => setLinhaDialog(true)}
              onNovoProdutoCompra={(linha) => setPcDialog(linha)}
              onNovoSku={(ctx) => setSkuForm(ctx)}
              onEditSku={(sku) => setSkuForm({ skuInicial: sku })}
            />
          </div>
        ) : (
          <>
            <Button variant={somenteAlerta ? 'secondary' : 'outline'} size="sm" onClick={() => setSomenteAlerta((v) => !v)}>Só alertas</Button>
            <ModeloSmartSupplyPanel lines={filteredSupply} somenteAlerta={somenteAlerta} />
          </>
        )}
      </div>

      <ModeloLinhaDialog open={linhaDialog} onClose={() => setLinhaDialog(false)} onSaved={() => reload()} initialCategoria="E - PISOS E REVESTIMENTOS" />
      <ModeloProdutoCompraDialog open={!!pcDialog} linha={pcDialog} onClose={() => setPcDialog(null)} onSaved={() => reload()} />
      <ModeloSkuForm
        open={!!skuForm}
        onClose={() => setSkuForm(null)}
        linhas={linhas}
        skuInicial={skuForm?.skuInicial || skuForm?.draft}
        similarBase={skuForm?.similarBase}
        presetLinhaId={skuForm?.linhaId}
        presetProdutoCompraId={skuForm?.produtoCompraId}
        presetEixoA={skuForm?.eixoA}
        presetEixoB={skuForm?.eixoB}
        onSaved={() => reload()}
      />
      <EspelharProdutoDialog
        open={espelharOpen}
        onClose={() => setEspelharOpen(false)}
        linhas={linhas}
        produtosCompra={produtosCompra}
        onEspelhar={({ draft }) => setSkuForm({ draft })}
      />
    </div>
  );
}

export default function ModeloCatalogoPage() {
  if (!MODELO_CATALOGO_ENABLED) {
    return <Navigate to={createPageUrl('Home')} replace />;
  }
  return <ModeloCatalogoInner />;
}
