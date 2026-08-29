import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOGO_LIST_SHELL,
  CATALOGO_TREE_ROW,
  CATALOGO_TREE_ROW_HINT,
  CATALOGO_TREE_TABLE_SLOT,
} from '@/lib/catalogoP38Theme';
import { pathwayPapelLabel } from '@/lib/estudoCatalog/pathwayMeta';
import CatalogoLinhaValueTable from '@/components/catalogo-novo/CatalogoLinhaValueTable';

const HIER_STEP = 16;
const BASE_PAD = 10;

function padLeft(depth) {
  return BASE_PAD + depth * HIER_STEP;
}

function TreeToggle({ depth, open, onToggle, label, hint, comfortable }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ paddingLeft: padLeft(depth) }}
      className={cn(CATALOGO_TREE_ROW, comfortable && 'min-h-[44px] py-2.5')}
    >
      <ChevronRight
        className={cn(
          'h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform',
          open && 'rotate-90',
        )}
        aria-hidden
      />
      <span className="flex-1 min-w-0 truncate font-light normal-case text-left">{label}</span>
      {hint ? <span className={CATALOGO_TREE_ROW_HINT}>{hint}</span> : null}
    </button>
  );
}

function LinhaBlock({ linha, depth, tipo, comfortable }) {
  const [open, setOpen] = useState(false);
  const title = linha.pathway_sufixo
    ? `${linha.linha_nome || linha.linha_display} ·${linha.pathway_sufixo}`
    : (linha.linha_nome || linha.linha_display);
  const pcs = linha.pcs || [];
  const solos = linha.solos || [];
  const skuCount = linha.sku_count ?? pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;

  return (
    <>
      <TreeToggle
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={title}
        hint={`${skuCount} SKU`}
        comfortable={comfortable}
      />
      {open ? (
        <div className={CATALOGO_TREE_TABLE_SLOT} style={{ paddingLeft: padLeft(depth + 1) }}>
          <CatalogoLinhaValueTable linha={linha} tipo={tipo} />
        </div>
      ) : null}
    </>
  );
}

function PathwayBlock({ pathway, depth, tipo, comfortable }) {
  const [open, setOpen] = useState(false);
  const linhas = pathway.linhas || [];
  if (!linhas.length) return null;

  const hideHeader = pathway.pathway_papel === 'default' && linhas.length === 1;
  if (hideHeader) {
    return (
      <LinhaBlock
        key={linhas[0].linha_pathway_key}
        linha={linhas[0]}
        depth={depth}
        tipo={tipo}
        comfortable={comfortable}
      />
    );
  }

  return (
    <>
      <TreeToggle
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={pathwayPapelLabel(pathway.pathway_papel)}
        hint={`${linhas.length} LINHA`}
        comfortable={comfortable}
      />
      {open
        ? linhas.map((linha) => (
            <LinhaBlock
              key={linha.linha_pathway_key}
              linha={linha}
              depth={depth + 1}
              tipo={tipo}
              comfortable={comfortable}
            />
          ))
        : null}
    </>
  );
}

function CoreBlock({ coreNode, depth, tipo, comfortable }) {
  const [open, setOpen] = useState(false);
  const pathways = coreNode.pathways || [];
  const linhaCount = pathways.reduce((a, pw) => a + (pw.linhas?.length || 0), 0);
  if (!linhaCount) return null;

  if (pathways.length === 1) {
    return (
      <PathwayBlock pathway={pathways[0]} depth={depth} tipo={tipo} comfortable={comfortable} />
    );
  }

  return (
    <>
      <TreeToggle
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={coreNode.core}
        hint={`${linhaCount} LINHA`}
        comfortable={comfortable}
      />
      {open
        ? pathways.map((pw) => (
            <PathwayBlock
              key={pw.pathway_papel}
              pathway={pw}
              depth={depth + 1}
              tipo={tipo}
              comfortable={comfortable}
            />
          ))
        : null}
    </>
  );
}

function GrupoBlock({ grupoNode, depth, tipo, comfortable }) {
  const [open, setOpen] = useState(false);
  const cores = grupoNode.cores || [];
  const hasGrupo = Boolean(grupoNode.grupo);

  if (!hasGrupo) {
    return cores.map((coreNode) => (
      <CoreBlock key={coreNode.core} coreNode={coreNode} depth={depth} tipo={tipo} comfortable={comfortable} />
    ));
  }

  const linhaCount = cores.reduce(
    (a, c) => a + (c.pathways || []).reduce((b, pw) => b + (pw.linhas?.length || 0), 0),
    0,
  );
  if (!linhaCount) return null;

  return (
    <>
      <TreeToggle
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={grupoNode.grupo}
        hint={`${linhaCount} LINHA`}
        comfortable={comfortable}
      />
      {open
        ? cores.map((coreNode) => (
            <CoreBlock
              key={coreNode.core}
              coreNode={coreNode}
              depth={depth + 1}
              tipo={tipo}
              comfortable={comfortable}
            />
          ))
        : null}
    </>
  );
}

function SubBlocoBlock({ sub, depth, tipo, comfortable }) {
  const [open, setOpen] = useState(false);
  const grupos = sub.grupos || [];

  return (
    <>
      <TreeToggle
        depth={depth}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={sub.sub_bloco}
        hint={sub.sku_count != null ? `${sub.sku_count} SKU` : undefined}
        comfortable={comfortable}
      />
      {open
        ? grupos.map((grupoNode) => (
            <GrupoBlock
              key={grupoNode.grupo || '__direct__'}
              grupoNode={grupoNode}
              depth={depth + 1}
              tipo={tipo}
              comfortable={comfortable}
            />
          ))
        : null}
    </>
  );
}

function BlocoBlock({ bloco, tipo, comfortable }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TreeToggle
        depth={0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={bloco.bloco}
        hint={`${bloco.sub_blocos?.length || 0} ramo`}
        comfortable={comfortable}
      />
      {open
        ? (bloco.sub_blocos || []).map((sub) => (
            <SubBlocoBlock key={sub.sub_bloco} sub={sub} depth={1} tipo={tipo} comfortable={comfortable} />
          ))
        : null}
    </>
  );
}

/** Árvore pathway — expande à direita até LINHA; valores em tabela. */
export default function CatalogoEstudoTree({ tree, tipo = 'mix', mobileComfortable = false }) {
  return (
    <div className={CATALOGO_LIST_SHELL}>
      {tree.map((bloco) => (
        <BlocoBlock key={bloco.bloco} bloco={bloco} tipo={tipo} comfortable={mobileComfortable} />
      ))}
    </div>
  );
}
