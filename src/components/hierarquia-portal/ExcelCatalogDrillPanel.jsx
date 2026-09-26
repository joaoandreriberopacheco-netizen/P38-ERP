import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { getPortalCatalogSource } from '@/lib/hierarquiaPortal/portalCatalogStore';
import { PORTAL_EXCEL_SOURCE } from '@/lib/hierarquiaPortal/portalExcelManifest';
import {
  montarNomePortalSku,
  montarSubtituloPortalSku,
} from '@/lib/hierarquiaPortal/montarNomePortalSku';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function SkuMiniList({ skus, max = 12 }) {
  const list = skus || [];
  const shown = list.slice(0, max);
  return (
    <ul className="text-xs space-y-1 max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/20">
      {shown.map((s) => (
        <li key={s.produto?.id || s.novo_sku} className="flex justify-between gap-2">
          <span className="truncate">{montarNomePortalSku(s)}</span>
          <span className="text-muted-foreground shrink-0 tabular-nums">{s.estoque_label || s.estoque}</span>
        </li>
      ))}
      {list.length > max && (
        <li className="text-muted-foreground pt-1">+ {list.length - max} SKU(s)…</li>
      )}
    </ul>
  );
}

export default function ExcelCatalogDrillPanel({ row, onClear }) {
  const payload = row?.payload;
  const fonte = getPortalCatalogSource();
  const fonteLabel = fonte === 'supabase' ? 'portal_catalog (Supabase)' : 'Excel manifest';
  const excelPath = PORTAL_EXCEL_SOURCE || 'docs/P38-catalogo-skus-completo.xlsx';

  const content = useMemo(() => {
    if (!payload) return null;

    if (payload.kind === 'categoria') {
      const linCount = payload.cat?.linhas?.length ?? 0;
      const skuCount = payload.cat?.linhas?.reduce(
        (n, lin) =>
          n + lin.pcs.reduce((s, p) => s + p.skus.length, 0) + lin.solos.length,
        0,
      );
      return (
        <>
          <Field label="Categoria">{payload.categoria}</Field>
          <Field label="Resumo">{linCount} LINHA(s) · {skuCount} SKU(s) nesta categoria</Field>
          <p className="text-xs text-muted-foreground">
            Seleccione uma LINHA na grelha para ver tipo mix/portfolio e produtos compra.
          </p>
        </>
      );
    }

    if (payload.kind === 'linha') {
      const lin = payload.lin;
      const pcs = lin.pcs?.length ?? 0;
      const skus =
        (lin.pcs?.reduce((s, p) => s + p.skus.length, 0) ?? 0) + (lin.solos?.length ?? 0);
      return (
        <>
          <Field label="LINHA">{lin.linha_nome}</Field>
          <Field label="Código">{lin.linha_codigo}</Field>
          <Field label="Tipo">
            <Badge variant="secondary">{TIPO_LABEL[lin.linha_tipo] || lin.linha_tipo}</Badge>
          </Field>
          <Field label="Camada Excel">{pcs} produto(s) compra · {skus} SKU(s)</Field>
          <p className="text-xs text-muted-foreground border-l-2 border-violet-500/50 pl-2">
            Próximo passo: formulário de LINHA (vagas, massa crítica, saldável) — hoje consulta da base Excel;
            gravação continua no laboratório <strong>modelo_*</strong> ou futura sync do Excel.
          </p>
        </>
      );
    }

    if (payload.kind === 'produto_compra') {
      const { pc, lin } = payload;
      const grid =
        pc.eixo_a_rotulo && pc.eixo_b_rotulo
          ? `${pc.eixo_a_rotulo} × ${pc.eixo_b_rotulo}`
          : '—';
      return (
        <>
          <Field label="Produto compra">{pc.produto_compra_nome}</Field>
          <Field label="Código">{pc.produto_compra_codigo}</Field>
          <Field label="LINHA">{lin.linha_nome}</Field>
          <Field label="Grelha (eixos)">{grid}</Field>
          <Field label={`SKUs (${pc.skus.length})`}>
            <SkuMiniList skus={pc.skus} />
          </Field>
        </>
      );
    }

    if (payload.kind === 'sku') {
      const s = payload.enriched;
      const cod = s.produto?.codigo_interno;
      const cadastrado = s.cadastrado_erp !== false && !String(s.produto?.id || '').startsWith('excel:');
      return (
        <>
          <Field label="SKU">{montarNomePortalSku(s)}</Field>
          <Field label="Código interno">{cod || '—'}</Field>
          <Field label="Eixos">
            {[s.eixo_a_rotulo || s.eixo_a, s.eixo_b_rotulo || s.eixo_b].filter(Boolean).join(' · ') || '—'}
          </Field>
          <Field label="Estoque vitrine">{s.estoque_label ?? s.estoque ?? '—'}</Field>
          {montarSubtituloPortalSku(s) && (
            <Field label="Detalhe">{montarSubtituloPortalSku(s)}</Field>
          )}
          <Field label="No ERP">
            {cadastrado ? (
              <Badge className="bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100">Cadastrado</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-800 dark:text-amber-200">Só no Excel — sem produto activo</Badge>
            )}
          </Field>
          {cadastrado && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`${createPageUrl('HierarquiaPortal')}?tab=cadastro`}>
                Abrir cadastro (eixos)
              </Link>
            </Button>
          )}
        </>
      );
    }

    return null;
  }, [payload]);

  if (!row) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground min-h-[200px] flex flex-col justify-center">
        <p>Clique numa linha da TreeGrid para fazer drill-down por camada.</p>
        <p className="text-xs mt-2">Categoria → LINHA → Produto compra → SKU</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border/40 dark:border-white/10 bg-card p-4 space-y-4 min-h-[200px]')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Drill-down</p>
          <p className="text-sm font-medium truncate">{row.label}</p>
        </div>
        {onClear && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={onClear}>
            Limpar
          </Button>
        )}
      </div>
      {content}
      <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/30">
        Fonte: {fonteLabel}
        {fonte !== 'supabase' && excelPath ? ` · ${excelPath}` : ''}
      </p>
    </div>
  );
}
