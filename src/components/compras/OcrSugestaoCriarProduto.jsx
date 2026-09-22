import { useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NovoProdutoRapidoDialog from '@/components/compras/NovoProdutoRapidoDialog';
import { getProdutoLabel } from '@/components/compras/productMatchingUtils';
import { cn } from '@/lib/utils';

/**
 * Sugere cadastrar produto novo quando o OCR não acha match bom no catálogo.
 * Usa descrição + preço do PDF e um produto “irmão” como modelo.
 */
export default function OcrSugestaoCriarProduto({
  item,
  index,
  produtos = [],
  onProductCreated,
  className,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!item?.sugerir_criar_novo) return null;
  if (item.selected_product_id && item.selected_product_id !== 'create_new') return null;

  const irmao = item.produto_irmao_id
    ? produtos.find((p) => p.id === item.produto_irmao_id)
    : null;
  const irmaoLabel = irmao ? getProdutoLabel(irmao) : null;
  const descricao = String(item.descricao || item.descricao_pdf || '').trim();
  const preco = Number(item.preco_unitario ?? item.preco_unitario_pdf) || 0;

  const handleSuccess = (novoProduto) => {
    onProductCreated?.(novoProduto, index);
    setDialogOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'rounded-2xl border border-violet-200/80 bg-violet-50/90 px-3 py-3 dark:border-violet-800/50 dark:bg-violet-950/30',
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 flex-none text-violet-600 dark:text-violet-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
              Cadastrar produto novo?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/80">
              {item.criar_novo_motivo || 'Este item parece não existir no catálogo.'}
              {irmaoLabel ? (
                <>
                  {' '}
                  Podemos usar <span className="font-medium">{irmaoLabel}</span> como base (produto irmão).
                </>
              ) : null}
            </p>
            {preco > 0 ? (
              <p className="mt-1 text-xs text-violet-800/70 dark:text-violet-300/70">
                Compra sugerida: R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-3 h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar produto com dados do PDF
        </Button>
      </div>

      <NovoProdutoRapidoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleSuccess}
        nomeInicial={descricao}
        valorCompraInicial={preco > 0 ? preco : null}
        marcaInicial={item.marca || item.marca_pdf || ''}
        produtoSimilarBase={irmao}
      />
    </>
  );
}
