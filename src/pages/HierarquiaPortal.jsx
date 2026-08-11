import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import {
  enrichProdutoPortal,
  buildPortalTree,
  buildPortalSupplyLines,
  listPortalLinhas,
} from '@/lib/hierarquiaPortal/buildPortalModel';
import {
  filterProdutosPortalExcel,
  PORTAL_EXCEL_LINHAS,
  PORTAL_EXCEL_SKU_COUNT,
} from '@/lib/hierarquiaPortal/portalExcelManifest';
import PortalTreeGrid from '@/components/hierarquia-portal/PortalTreeGrid';
import PortalSmartSupplyPanel from '@/components/hierarquia-portal/PortalSmartSupplyPanel';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import {
  HIERARQUIA_PORTAL_ENABLED,
  HIERARQUIA_PORTAL_PILOTO_LINHAS,
} from '@/config/hierarquiaPortalFlags';
import { MODELO_PILOTO_LINHAS_PLANEADAS } from '@/config/modeloCatalogoFlags';

function HierarquiaPortalInner() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [tab, setTab] = useState('cadastro');
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['portfolio']));
  const [search, setSearch] = useState('');
  const [somenteAlerta, setSomenteAlerta] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchProdutosAtivos(base44);
        if (!cancelled) setProdutos(rows || []);
      } catch (e) {
        console.error('[HierarquiaPortal]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const produtosPiloto = useMemo(() => filterProdutosPortalExcel(produtos), [produtos]);
  const enriched = useMemo(
    () => produtosPiloto.map(enrichProdutoPortal).filter((r) => r.fonte_excel),
    [produtosPiloto],
  );
  const tree = useMemo(() => buildPortalTree(enriched), [enriched]);
  const supplyLines = useMemo(() => buildPortalSupplyLines(enriched), [enriched]);
  const linhas = useMemo(() => listPortalLinhas(enriched), [enriched]);

  const filteredSupply = useMemo(() => {
    let lines = supplyLines;
    if (filtroLinha) lines = lines.filter((l) => l.linha_codigo === filtroLinha);
    if (filtroTipos?.size) lines = lines.filter((l) => filtroTipos.has(l.linha_tipo));
    const q = search.trim().toLowerCase();
    if (q) {
      lines = lines.filter(
        (l) =>
          l.produto_compra_nome.toLowerCase().includes(q) ||
          l.linha_nome.toLowerCase().includes(q) ||
          l.categoria.toLowerCase().includes(q),
      );
    }
    return lines;
  }, [supplyLines, filtroLinha, filtroTipos, search]);

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0 };
    const source = tab === 'supply' ? supplyLines : linhas;
    for (const l of source) {
      const tipo = l.linha_tipo ?? l.tipo;
      if (counts[tipo] != null) counts[tipo] += 1;
    }
    return counts;
  }, [linhas, supplyLines, tab]);

  const linhasPilotoLabel = HIERARQUIA_PORTAL_PILOTO_LINHAS.map((l) => l.nome).join(' · ');

  return (
    <div className="min-h-screen bg-background font-din-1451 pb-8">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 space-y-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="space-y-1 min-w-0">
            <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
              <Link to={createPageUrl('Compras')}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar a Compras
              </Link>
            </Button>
            <h1 className="text-xl md:text-2xl font-semibold font-glacial text-foreground">
              Portal hierarquia — piloto cerâmica
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Mesmo universo do Excel mestre e do laboratório Modelo:{' '}
              <strong className="text-foreground font-normal">{linhasPilotoLabel}</strong>
              {' '}({PORTAL_EXCEL_SKU_COUNT} SKUs, prefixo CERAM). Hierarquia{' '}
              <strong className="text-foreground font-normal">Categoria → LINHA → Produto compra → SKU</strong>
              {' '}· estoque em unidade vitrine · só leitura.
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-900 dark:text-violet-100 max-w-sm space-y-1">
            <p>
              <strong>Piloto portfolio:</strong> {enriched.length} SKUs carregados
              {enriched.length < PORTAL_EXCEL_SKU_COUNT && (
                <span className="opacity-80"> · {PORTAL_EXCEL_SKU_COUNT - enriched.length} no Excel ainda sem match no cadastro</span>
              )}
            </p>
            <p className="opacity-80">
              Em breve (mix): {MODELO_PILOTO_LINHAS_PLANEADAS.map((l) => l.nome).join(' · ')}
            </p>
          </div>
        </div>

        <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar esquadra ou SKU…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="LINHA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as LINHAS (piloto)</SelectItem>
              {linhas.map((l) => (
                <SelectItem key={l.codigo} value={l.codigo}>
                  {l.nome} ({l.tipo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tab === 'supply' && (
            <Button
              variant={somenteAlerta ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSomenteAlerta((v) => !v)}
            >
              Só alertas
            </Button>
          )}
        </div>

        <GlacialTabsList className="w-full">
          <GlacialTabsTrigger
            value="cadastro"
            activeValue={tab}
            onSelect={setTab}
            label="Cadastro (treegrid)"
          />
          <GlacialTabsTrigger
            value="supply"
            activeValue={tab}
            onSelect={setTab}
            label="SMART SUPPLY (preview)"
          />
        </GlacialTabsList>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Montando piloto cerâmica…
          </div>
        ) : tab === 'cadastro' ? (
          <PortalTreeGrid
            tree={tree}
            filtroLinha={filtroLinha}
            filtroTipos={filtroTipos}
            search={search}
          />
        ) : (
          <PortalSmartSupplyPanel lines={filteredSupply} somenteAlerta={somenteAlerta} />
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          {enriched.length} SKUs · {supplyLines.length} esquadras · {PORTAL_EXCEL_LINHAS.length} LINHAS piloto · Excel mestre
        </p>
      </div>
    </div>
  );
}

export default function HierarquiaPortalPage() {
  if (!HIERARQUIA_PORTAL_ENABLED) {
    return <Navigate to={createPageUrl('Home')} replace />;
  }
  return <HierarquiaPortalInner />;
}
