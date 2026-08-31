import React from 'react';
import { cn } from '@/components/utils';
import {
  CATALOGO_MIX_TABLE,
  CATALOGO_MIX_TABLE_CAP,
  CATALOGO_MIX_TABLE_CAP_CORE,
  CATALOGO_MIX_TABLE_CAP_LINHA,
  CATALOGO_MIX_TABLE_CAP_TITLE,
  CATALOGO_MIX_TABLE_CHIP,
  CATALOGO_MIX_TABLE_CHIP_ALERT,
  CATALOGO_MIX_TABLE_DOT,
  CATALOGO_MIX_TABLE_EIXOS,
  CATALOGO_MIX_TABLE_HEAD,
  CATALOGO_MIX_TABLE_PC,
  CATALOGO_MIX_TABLE_ROW,
  CATALOGO_MIX_TABLE_SKU,
} from '@/lib/catalogoP38Theme';
import {
  buildPcEixoDisplay,
  collectLinhaBitolas,
  coreDisplaySlug,
  sortProdutoCompraRows,
} from '@/lib/estudoCatalog/catalogoLinhaMixTable';

function EixosCell({ produtoCompraNome, skus }) {
  const { prefix, chips } = buildPcEixoDisplay(produtoCompraNome, skus);
  if (!chips.length) return <span className="text-muted-foreground/50">—</span>;

  return (
    <span className={CATALOGO_MIX_TABLE_EIXOS}>
      {prefix ? <span>{prefix}</span> : null}
      {chips.map((chip, i) => (
        <React.Fragment key={`${chip.text}-${i}`}>
          {i > 0 ? <span className={CATALOGO_MIX_TABLE_DOT}>·</span> : null}
          <span className={cn(CATALOGO_MIX_TABLE_CHIP, chip.alert && CATALOGO_MIX_TABLE_CHIP_ALERT)}>
            {chip.text}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function MixTableRow({ name, skus }) {
  return (
    <div className={CATALOGO_MIX_TABLE_ROW}>
      <span className={CATALOGO_MIX_TABLE_PC}>{name}</span>
      <span className={CATALOGO_MIX_TABLE_SKU}>{skus.length}</span>
      <EixosCell produtoCompraNome={name} skus={skus} />
    </div>
  );
}

/** Tabela validada no chat: Produto compra | SKUs | Eixos (grelha). */
export default function CatalogoLinhaMixTable({ linha }) {
  const pcs = sortProdutoCompraRows(linha.pcs || []);
  const solos = linha.solos || [];
  const linhaNome = linha.pathway_sufixo
    ? `${linha.linha_display || linha.linha_nome} ·${linha.pathway_sufixo}`
    : (linha.linha_display || linha.linha_nome);
  const skuTotal = linha.sku_count ?? pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;
  const pcCount = pcs.length || (linha.linha_tipo === 'solo' && solos.length ? 1 : 0);
  const bitolas = collectLinhaBitolas(pcs, solos);
  const coreSlug = coreDisplaySlug(linha.core);
  const tipoLabel = linha.linha_tipo === 'solo' ? 'solo' : `${pcCount} PC ${linha.linha_tipo}`;

  return (
    <div className={CATALOGO_MIX_TABLE}>
      <div className={CATALOGO_MIX_TABLE_CAP}>
        <p className={CATALOGO_MIX_TABLE_CAP_TITLE}>
          <span className={CATALOGO_MIX_TABLE_CAP_CORE}>{coreSlug}</span>
          {' '}
          —
          {' '}
          {skuTotal}
          {' '}
          SKUs
          {' '}
          ·
          {' '}
          {tipoLabel}
        </p>
        <p className={CATALOGO_MIX_TABLE_CAP_LINHA}>
          LINHA:
          {' '}
          {linhaNome}
          {bitolas.length ? (
            <>
              {' '}
              · Bitolas da loja:
              {' '}
              {bitolas.join(' · ')}
              {' '}
              mm
            </>
          ) : null}
        </p>
      </div>

      <div className={CATALOGO_MIX_TABLE_HEAD}>
        <span>Produto compra</span>
        <span className="text-center">SKUs</span>
        <span>Eixos (grelha)</span>
      </div>

      {linha.linha_tipo === 'solo' && solos.length > 0 ? (
        <MixTableRow name="(solo)" skus={solos} />
      ) : null}

      {pcs.map((pc) => (
        <MixTableRow key={pc.produto_compra_codigo} name={pc.produto_compra_nome} skus={pc.skus || []} />
      ))}
    </div>
  );
}
