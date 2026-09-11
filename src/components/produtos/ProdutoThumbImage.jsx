import React, { useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveProdutoThumbUrl } from '@/lib/produtoThumbUrl';

const SIZE_PX = { xs: 36, sm: 40, md: 48, lg: 52 };

/**
 * Imagem leve de produto para listas — só miniatura WebP (~2 KB).
 * Nunca carrega imagem_url; foto completa só na galeria (clique).
 */
export default function ProdutoThumbImage({
  produto,
  size = 'md',
  className,
  iconClassName = 'w-5 h-5 text-muted-foreground',
}) {
  const thumbUrl = useMemo(() => resolveProdutoThumbUrl(produto), [produto]);
  const [failed, setFailed] = useState(false);
  const px = SIZE_PX[size] || SIZE_PX.md;
  const temFoto = Boolean(String(produto?.imagem_url || '').trim());

  if (!thumbUrl || failed) {
    return (
      <Package
        className={cn(iconClassName, temFoto && 'opacity-60')}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={thumbUrl}
      alt=""
      width={px}
      height={px}
      className={cn('w-full h-full object-cover pointer-events-none', className)}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
