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
import PortalCadastroPanel from '@/components/hierarquia-portal/PortalCadastroPanel';
import PortalSmartSupplyPanel from '@/components/hierarquia-portal/PortalSmartSupplyPanel';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import { HIERARQUIA_PORTAL_ENABLED } from '@/config/hierarquiaPortalFlags';

const TIPOS_LINHA = ['solo', 'mix', 'portfolio'];

function HierarquiaPortalInner() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [tab, setTab] = useState('cadastro');
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(TIPOS_LINHA));
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

  const enriched = useMemo(() => produtos.map(enrichProdutoPortal), [produtos]);
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

  const soldavelCount = enriched.filter((r) => r.linha_codigo === 'SOLDAVEL').length;

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0 };
    const source = tab === 'supply' ? supplyLines : linhas;
    for (const l of source) {
      const tipo = l.linha_tipo ?? l.tipo;
      if (counts[tipo] != null) counts[tipo] += 1;
    }
    return counts;
  }, [linhas, supplyLines, tab]);

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
              Portal hierarquia
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Preview da hierarquia completa: <strong className="text-foreground font-normal">Categoria → LINHA → Produto compra → SKU</strong>.
              Solo, Mix e Portfolio no mesmo ecrã — só leitura, não altera o cadastro.
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 max-w-sm">
            <strong>Exemplo Mix:</strong> SOLDÁVEL — {soldavelCount} SKUs. Filtre por LINHA ou expanda a tabela.
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
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="LINHA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as LINHAS</SelectItem>
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
            label="Cadastro (árvore)"
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
            Montando preview…
          </div>
        ) : tab === 'cadastro' ? (
          <PortalCadastroPanel
            tree={tree}
            filtroLinha={filtroLinha}
            filtroTipos={filtroTipos}
            search={search}
          />
        ) : (
          <PortalSmartSupplyPanel lines={filteredSupply} somenteAlerta={somenteAlerta} />
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          {enriched.length} SKUs · {supplyLines.length} linhas de compra (proposta) · dados só leitura
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
