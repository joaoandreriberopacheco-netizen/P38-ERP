import React, { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isProdutoPilotoGaleria, resolveProdutoGaleria, resolveProdutoThumbUrl } from '@/lib/produtoImagens';
import { getSaleUnitContextForTabela } from '@/lib/orcamentoPrecoTabela';
import ProdutoGaleriaModal from '@/components/produtos/ProdutoGaleriaModal';

function buildGaleriaPrecoLabel(produto, tabelaPreco) {
  if (!produto) return '';
  const ctx = getSaleUnitContextForTabela(produto, tabelaPreco);
  const unit = ctx.unidadeDefault;
  const preco = Number(ctx.precoSelecionado ?? produto.preco_venda_padrao ?? 0);
  if (!(preco > 0)) return '';
  const sigla = unit?.unidade || produto.unidade_principal || 'UN';
  const valor = preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${valor}/${sigla}`;
}

const SIZE_CLASS = {
  xs: 'w-9 h-9',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-[52px] h-[52px]',
};

/**
 * Miniatura de produto — só pré-visualização: toque abre galeria fullscreen.
 * Não seleciona nem adiciona ao carrinho; ao fechar a galeria o ecrã anterior permanece.
 */
export default function ProdutoThumb({
  produto,
  size = 'md',
  className,
  roundedClassName = 'rounded-2xl',
  fallbackClassName,
  enableGaleria,
  tabelaPreco = null,
  precoLabel,
  onClick,
  stopPropagation = true,
  /** Evita <button> dentro de <button> (ex.: linha clicável do orçamento rápido). */
  asDiv = false,
}) {
  const [galeriaOpen, setGaleriaOpen] = useState(false);
  const [galeriaImagens, setGaleriaImagens] = useState([]);
  const [loadingGaleria, setLoadingGaleria] = useState(false);

  const nome = produto?.nome || produto?.produto_nome || '';
  const temFoto = Boolean(String(produto?.imagem_url || '').trim());
  const thumbUrl = resolveProdutoThumbUrl(produto);
  const galeriaAtiva = enableGaleria ?? isProdutoPilotoGaleria(produto);
  const sizeClass = SIZE_CLASS[size] || size;

  const stopGalleryPointer = (e) => {
    if (!stopPropagation) return;
    e?.stopPropagation?.();
    e?.nativeEvent?.stopImmediatePropagation?.();
  };

  const handleOpenGaleria = async (e) => {
    stopGalleryPointer(e);
    if (!galeriaAtiva || !produto?.id) return;

    setLoadingGaleria(true);
    try {
      const imagens = await resolveProdutoGaleria(produto);
      if (imagens.length === 0) return;
      setGaleriaImagens(imagens);
      setGaleriaOpen(true);
    } finally {
      setLoadingGaleria(false);
    }
  };

  const thumbInner = thumbUrl ? (
    <img
      src={thumbUrl}
      alt=""
      className="w-full h-full object-cover pointer-events-none"
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  ) : temFoto ? (
    <Package className="w-5 h-5 text-muted-foreground opacity-70" aria-hidden="true" />
  ) : (
    <Package className="w-5 h-5 text-muted-foreground" />
  );

  const shellClass = cn(
    sizeClass,
    roundedClassName,
    'flex items-center justify-center flex-shrink-0 overflow-hidden bg-muted',
    fallbackClassName,
    galeriaAtiva && produto?.id && 'cursor-pointer active:scale-[0.98]',
    className,
  );

  const handleShellClick = (e) => {
    onClick?.(e);
    if (!e?.defaultPrevented) handleOpenGaleria(e);
  };

  const handleShellKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleShellClick(e);
    }
  };

  const shellContent = loadingGaleria ? (
    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  ) : (
    thumbInner
  );

  const ariaLabel = temFoto ? `Ver fotos de ${nome}` : `Produto ${nome}`;
  const galeriaPrecoLabel = precoLabel ?? buildGaleriaPrecoLabel(produto, tabelaPreco);

  return (
    <>
      {galeriaAtiva && produto?.id ? (
        asDiv ? (
          <div
            role="button"
            tabIndex={0}
            className={shellClass}
            onClick={handleShellClick}
            onPointerDown={stopGalleryPointer}
            onKeyDown={handleShellKeyDown}
            aria-label={ariaLabel}
          >
            {shellContent}
          </div>
        ) : (
          <button
            type="button"
            className={shellClass}
            onClick={handleShellClick}
            onPointerDown={stopGalleryPointer}
            aria-label={ariaLabel}
          >
            {shellContent}
          </button>
        )
      ) : (
        <div className={shellClass} onClick={onClick}>
          {thumbInner}
        </div>
      )}

      <ProdutoGaleriaModal
        open={galeriaOpen}
        onClose={() => setGaleriaOpen(false)}
        produtoNome={nome}
        precoLabel={galeriaPrecoLabel}
        imagens={galeriaImagens}
      />
    </>
  );
}
