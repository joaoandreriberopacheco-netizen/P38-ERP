import { useMemo, useState } from 'react';
import { FileDown, Loader2, Scissors, Tag, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  CATALOG_TAG_HEIGHT_MM,
  CATALOG_TAG_WIDTH_MM,
  CATALOG_TAGS_PER_PAGE,
  generateCatalogTagsPdf,
  getCatalogTagCode,
  getCatalogTagDescription,
  sortCatalogTagProducts,
} from '@/lib/catalogTagsPrint';
import { shareOrDownloadBlob } from '@/lib/mobilePrintAndShare';

export default function CatalogTagPrintDialog({
  open,
  onOpenChange,
  products = [],
  filtersSummary = '',
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const sortedProducts = useMemo(() => sortCatalogTagProducts(products), [products]);
  const productCount = sortedProducts.length;
  const pageCount = Math.ceil(productCount / CATALOG_TAGS_PER_PAGE);
  const previewProduct = sortedProducts[0];
  const previewDescription = getCatalogTagDescription(previewProduct) || 'DESCRIÇÃO DO PRODUTO';
  const previewCode = getCatalogTagCode(previewProduct) || '000000';

  const fileName = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return `etiquetas_catalogo_${date}.pdf`;
  }, []);

  const handleGeneratePdf = async () => {
    if (!productCount) return;

    setIsGenerating(true);
    try {
      const blob = await generateCatalogTagsPdf({
        products: sortedProducts,
        filtrosResumo: filtersSummary,
      });
      const result = await shareOrDownloadBlob(
        blob,
        fileName,
        'application/pdf',
        'Etiquetas do catálogo',
      );

      if (result !== 'aborted') {
        toast({
          title: result === 'shared' ? 'PDF compartilhado' : 'PDF A4 gerado',
          description: `${productCount} etiqueta(s) em ${pageCount} folha(s).`,
        });
        onOpenChange?.(false);
      }
    } catch (error) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error?.message || String(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isGenerating && onOpenChange?.(nextOpen)}>
      <DialogContent
        overlayClassName="z-[100] bg-black/80"
        className="z-[100] sm:max-w-xl dark:bg-background dark:text-foreground dark:border-border/40"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a4ce33]/15 text-[#4a5240] dark:text-[#a4ce33]">
              <Tags className="h-5 w-5" />
            </span>
            Etiquetas para impressão
          </DialogTitle>
          <DialogDescription>
            Gera um PDF A4 com os produtos do filtro atual, pronto para imprimir e cortar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2 sm:grid-cols-[190px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative flex w-[172px] flex-col border-2 border-foreground/55 bg-white px-3 pb-3 pt-9 text-center text-slate-900 shadow-sm"
              style={{ aspectRatio: `${CATALOG_TAG_WIDTH_MM} / ${CATALOG_TAG_HEIGHT_MM}` }}
            >
              <span className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-dashed border-slate-500" />
              <div className="flex flex-1 flex-col justify-center">
                <p className="line-clamp-4 text-sm font-bold leading-tight">{previewDescription}</p>
              </div>
              <div className="border-t border-slate-200 pt-2 text-sm font-semibold tracking-wide text-slate-700">
                {previewCode}
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              Prévia da etiqueta
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/50 bg-muted/35 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tamanho</p>
                <p className="mt-1 text-sm font-semibold">4,3 × 4,8 cm</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/35 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Por folha</p>
                <p className="mt-1 text-sm font-semibold">{CATALOG_TAGS_PER_PAGE} etiquetas</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/35 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Produtos</p>
                <p className="mt-1 text-sm font-semibold">{productCount}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/35 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Folhas A4</p>
                <p className="mt-1 text-sm font-semibold">{pageCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-[#a4ce33]/10 p-3 text-xs text-foreground/80">
              <Scissors className="mt-0.5 h-4 w-4 flex-none text-[#4a5240] dark:text-[#a4ce33]" />
              <span>Sem espaço entre etiquetas: cada linha de corte é compartilhada. O círculo tracejado indica o furo.</span>
            </div>

            {filtersSummary ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                <strong>Filtro:</strong> {filtersSummary}
              </p>
            ) : null}

            {!productCount ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Nenhum produto no filtro atual. Ajuste os filtros para gerar o PDF.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={handleGeneratePdf}
            disabled={!productCount || isGenerating}
            className="gap-2 bg-[#4a5240] text-white hover:bg-[#3c4334] dark:bg-[#a4ce33] dark:text-slate-950 dark:hover:bg-[#b2dc3e]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Gerar PDF A4
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
