import React, { useState } from 'react';
import { ChevronRight, FolderTree, Layers, Box, Plus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/utils';
import { TIPO_LINHA_LABEL } from '@/lib/modeloCatalogo/montarNomeSku';

const TIPO_BADGE = {
  solo: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  linha_mix: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  portfolio: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
};

function TipoBadge({ tipo }) {
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal', TIPO_BADGE[tipo] || '')}>
      {TIPO_LINHA_LABEL[tipo] || tipo}
    </Badge>
  );
}

export default function ModeloCatalogoTree({
  tree,
  onNovoSku,
  onEditSku,
  onNovaLinha,
  onNovoProdutoCompra,
}) {
  const [openCats, setOpenCats] = useState({});
  const [openLinhas, setOpenLinhas] = useState({});
  const [openPcs, setOpenPcs] = useState({});

  const toggle = (map, setMap, key) => setMap((m) => ({ ...m, [key]: !m[key] }));

  if (!tree.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground space-y-3">
        <p>Nenhum dado no laboratório ainda.</p>
        <Button size="sm" onClick={onNovaLinha}>+ Nova LINHA</Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((cat) => {
        const catKey = cat.categoria;
        const catOpen = openCats[catKey] !== false;
        return (
          <div key={catKey}>
            <button
              type="button"
              className="w-full flex items-center gap-2 py-2 px-1 hover:bg-muted/50 rounded-md text-sm font-semibold"
              onClick={() => toggle(openCats, setOpenCats, catKey)}
            >
              <ChevronRight className={cn('h-4 w-4', catOpen && 'rotate-90')} />
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              {cat.categoria}
              <span className="text-xs text-muted-foreground font-normal">({cat.linhas.length} LINHA(s))</span>
            </button>
            {catOpen && cat.linhas.map((node) => {
              const lKey = node.linha.id;
              const lOpen = openLinhas[lKey] !== false;
              return (
                <div key={lKey} className="ml-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex-1 flex items-center gap-2 py-1.5 pr-1 hover:bg-muted/50 rounded-md text-sm"
                      onClick={() => toggle(openLinhas, setOpenLinhas, lKey)}
                    >
                      <ChevronRight className={cn('h-3.5 w-3.5', lOpen && 'rotate-90')} />
                      <span className="font-medium truncate">{node.linha.nome}</span>
                      <TipoBadge tipo={node.tipo} />
                      <span className="text-[10px] text-muted-foreground">{node.skuCount} SKU</span>
                    </button>
                    {!node.solo && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Novo produto compra" onClick={() => onNovoProdutoCompra?.(node.linha)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Novo SKU" onClick={() => onNovoSku?.({ linhaId: node.linha.id })}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {lOpen && node.solo && node.soloSkus.map((sku) => (
                    <SkuRow key={sku.id} sku={sku} depth={2} onEdit={onEditSku} onClone={(s) => onNovoSku?.({ linhaId: node.linha.id, similarBase: s })} />
                  ))}
                  {lOpen && !node.solo && node.produtosCompra.map((pc) => {
                    const pcKey = pc.id;
                    const pcOpen = openPcs[pcKey] !== false;
                    return (
                      <div key={pcKey} className="ml-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="flex-1 flex items-center gap-2 py-1 pr-1 hover:bg-muted/40 rounded text-sm"
                            onClick={() => toggle(openPcs, setOpenPcs, pcKey)}
                          >
                            <ChevronRight className={cn('h-3 w-3', pcOpen && 'rotate-90')} />
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{pc.nome}</span>
                            <span className="text-[10px] text-muted-foreground">{pc.skus.length}</span>
                          </button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onNovoSku?.({ linhaId: node.linha.id, produtoCompraId: pc.id, similarBase: pc.skus[0] })}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {pcOpen && pc.skus.map((sku) => (
                          <SkuRow key={sku.id} sku={sku} depth={3} onEdit={onEditSku} onClone={(s) => onNovoSku?.({ linhaId: node.linha.id, produtoCompraId: pc.id, similarBase: s })} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SkuRow({ sku, depth, onEdit, onClone }) {
  return (
    <div className="flex items-center gap-1 py-0.5 text-xs" style={{ paddingLeft: 8 + depth * 14 }}>
      <Box className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="truncate flex-1">{sku.nome}</span>
      {sku.espelho_codigo_interno && (
        <span className="text-[9px] text-amber-700 dark:text-amber-300 shrink-0">↗{sku.espelho_codigo_interno}</span>
      )}
      <span className="tabular-nums text-muted-foreground shrink-0">{Number(sku.estoque_simulado) || 0}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit?.(sku)}><Pencil className="h-3 w-3" /></Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onClone?.(sku)} title="Clonar irmão"><Plus className="h-3 w-3" /></Button>
    </div>
  );
}
