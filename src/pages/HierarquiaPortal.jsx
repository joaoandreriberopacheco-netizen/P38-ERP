import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
import { fetchAllProdutosCatalogo, fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import {
  enrichProdutoPortal,
  buildPortalTree,
  buildPortalSupplyLines,
  listPortalLinhas,
} from '@/lib/hierarquiaPortal/buildPortalModel';
import {
  buildPortalSupplyHierarchy,
  enrichSupplyLinesWithMetrics,
} from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import {
  filterProdutosPortalExcel,
  PORTAL_EXCEL_LINHAS,
  PORTAL_EXCEL_SKU_COUNT,
} from '@/lib/hierarquiaPortal/portalExcelManifest';
import PortalTreeGrid from '@/components/hierarquia-portal/PortalTreeGrid';
import PortalSmartSupplyPanel from '@/components/hierarquia-portal/PortalSmartSupplyPanel';
import PortalReservaPanel from '@/components/hierarquia-portal/PortalReservaPanel';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import { isProdutoReservaPortal, contagemReservaLine } from '@/lib/hierarquiaPortal/portalReservaCeramica';
import {
  HIERARQUIA_PORTAL_ENABLED,
  HIERARQUIA_PORTAL_PILOTO_LINHAS,
} from '@/config/hierarquiaPortalFlags';
import { MODELO_PILOTO_LINHAS_PLANEADAS } from '@/config/modeloCatalogoFlags';
import { SMART_SUPPLY_PORTAL_PREVIEW_LABEL } from '@/config/smartSupplyFlags';

function HierarquiaPortalInner() {
  const [loading, setLoading] = useState(true);
  const [loadingVelocity, setLoadingVelocity] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [pedidos90d, setPedidos90d] = useState([]);
  const [tab, setTab] = useState('cadastro');
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['portfolio']));
  const [search, setSearch] = useState('');
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [reservados, setReservados] = useState([]);

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const [activos, todos] = await Promise.all([
        fetchProdutosAtivos(base44),
        fetchAllProdutosCatalogo(),
      ]);
      setProdutos(activos || []);
      const reservaRows = filterProdutosPortalExcel(todos || []).filter((p) => isProdutoReservaPortal(p));
      setReservados(reservaRows);
    } catch (e) {
      console.error('[HierarquiaPortal]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProdutos();
  }, [loadProdutos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVelocity(true);
      try {
        const pedidos = await fetchPedidosVenda90d();
        if (!cancelled) setPedidos90d(pedidos || []);
      } catch (e) {
        console.error('[HierarquiaPortal] vendas 90d', e);
      } finally {
        if (!cancelled) setLoadingVelocity(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const produtosPiloto = useMemo(() => filterProdutosPortalExcel(produtos), [produtos]);
  const velocityMap = useMemo(
    () => buildCatalogSalesVelocityMap(produtosPiloto, pedidos90d),
    [produtosPiloto, pedidos90d],
  );
  const enriched = useMemo(
    () => produtosPiloto.map(enrichProdutoPortal).filter((r) => r.fonte_excel),
    [produtosPiloto],
  );
  const tree = useMemo(() => buildPortalTree(enriched), [enriched]);
  const supplyLines = useMemo(
    () => enrichSupplyLinesWithMetrics(buildPortalSupplyLines(enriched), velocityMap),
    [enriched, velocityMap],
  );
  const linhas = useMemo(() => listPortalLinhas(enriched), [enriched]);

  const reservadosEnriched = useMemo(
    () => reservados.map(enrichProdutoPortal).filter((r) => r.fonte_excel),
    [reservados],
  );

  const enrichedComReserva = useMemo(() => {
    const byId = new Map();
    for (const row of enriched) byId.set(row.produto.id, row);
    for (const row of reservadosEnriched) {
      if (!byId.has(row.produto.id)) byId.set(row.produto.id, row);
    }
    return [...byId.values()];
  }, [enriched, reservadosEnriched]);

  const supplyLinesReserva = useMemo(
    () => enrichSupplyLinesWithMetrics(buildPortalSupplyLines(enrichedComReserva), velocityMap),
    [enrichedComReserva, velocityMap],
  );

  const filteredSupply = useMemo(() => {
    let lines = tab === 'reserva' ? supplyLinesReserva : supplyLines;
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
  }, [supplyLines, supplyLinesReserva, tab, filtroLinha, filtroTipos, search]);

  const excedentesReserva = useMemo(
    () => filteredSupply.filter((line) => contagemReservaLine(line).excedente > 0).length,
    [filteredSupply],
  );

  const filteredHierarchy = useMemo(
    () => buildPortalSupplyHierarchy(filteredSupply, velocityMap),
    [filteredSupply, velocityMap],
  );

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
    <div className="flex flex-col min-h-full w-full max-w-full font-din-1451 bg-background -mx-4 md:-mx-6 tablet-landscape:-mx-7">
      {/* Barra fixa — filtros + tabs (estilo catálogo) */}
      <div className="sticky top-0 z-30 bg-background border-b border-border/40 shadow-sm">
        <div className="w-full px-3 md:px-4 py-3 space-y-3">
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
              <p className="text-sm text-muted-foreground max-w-3xl hidden md:block">
                Preview por LINHA ({PORTAL_EXCEL_SKU_COUNT} SKUs). Cadastro = hierarquia · Preview = SMART SUPPLY piloto.
              </p>
            </div>
            <div className="rounded-lg border border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-900 dark:text-violet-100 max-w-sm space-y-1 shrink-0">
              <p>
                <strong>Piloto:</strong> {enriched.length} SKUs · {linhasPilotoLabel}
              </p>
              <p className="opacity-80 hidden sm:block">
                Em breve: {MODELO_PILOTO_LINHAS_PLANEADAS.map((l) => l.nome).join(' · ')}
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
            {tab === 'reserva' && excedentesReserva > 0 && (
              <span className="text-xs text-amber-800 dark:text-amber-200 px-2 py-1 rounded bg-amber-100/80 dark:bg-amber-950/40">
                {excedentesReserva} esquadra(s) acima de 12 pos.
              </span>
            )}
          </div>

          <GlacialTabsList className="w-full">
            <GlacialTabsTrigger
              value="cadastro"
              activeValue={tab}
              onSelect={setTab}
              label="Cadastro (hierarquia)"
            />
            <GlacialTabsTrigger
              value="supply"
              activeValue={tab}
              onSelect={setTab}
              label={SMART_SUPPLY_PORTAL_PREVIEW_LABEL}
            />
            <GlacialTabsTrigger
              value="reserva"
              activeValue={tab}
              onSelect={setTab}
              label="Reserva (12 pos.)"
            />
          </GlacialTabsList>
        </div>
      </div>

      {/* Conteúdo — scroll da página (sem caixa max-h) */}
      <div className="flex-1 w-full min-w-0 px-3 md:px-4 py-4 pb-10">
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
        ) : tab === 'supply' ? (
          <PortalSmartSupplyPanel
            hierarchy={filteredHierarchy}
            flatLines={filteredSupply}
            somenteAlerta={somenteAlerta}
            loadingVelocity={loadingVelocity}
          />
        ) : (
          <PortalReservaPanel
            supplyLines={filteredSupply}
            reservadosEnriched={reservadosEnriched}
            onRefresh={loadProdutos}
          />
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4">
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
