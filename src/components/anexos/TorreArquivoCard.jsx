import { File, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE, P38_ACCENT } from '@/components/financeiro/fluxo/financeiroP38';

function formatarTamanho(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tipoArquivoLabel(arquivo) {
  if (!arquivo?.file) {
    if (arquivo?.texto) return 'Texto';
    return 'Arquivo';
  }
  const mime = String(arquivo.file.type || arquivo.tipo || '').toLowerCase();
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Imagem';
  return 'Arquivo';
}

/**
 * Cartão de preview do arquivo na Torre de Controle — estilo Planejamento financeiro.
 */
export default function TorreArquivoCard({ arquivo, className, compact = false }) {
  if (!arquivo) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/50 px-5 py-8 text-center dark:border-white/10',
          P38_FIELD_SURFACE,
          className,
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
          <File className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhum arquivo ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecione ou cole um PDF, imagem ou comprovante
          </p>
        </div>
      </div>
    );
  }

  const mime = String(arquivo.file?.type || arquivo.tipo || '').toLowerCase();
  const isPdf = mime === 'application/pdf';
  const isImage = mime.startsWith('image/');
  const tamanho = formatarTamanho(arquivo.file?.size);
  const tipoLabel = tipoArquivoLabel(arquivo);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl',
        P38_FIELD_SURFACE,
        className,
      )}
    >
      <div className={cn('flex gap-3', compact ? 'p-3' : 'p-4')}>
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/50',
            compact ? 'h-14 w-14' : 'h-[72px] w-[72px]',
          )}
        >
          {isImage && arquivo.previewUrl ? (
            <img
              src={arquivo.previewUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              {isPdf ? (
                <FileText className={cn('h-7 w-7', P38_ACCENT)} />
              ) : isImage ? (
                <ImageIcon className={cn('h-7 w-7', P38_ACCENT)} />
              ) : (
                <File className="h-7 w-7 text-muted-foreground" />
              )}
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tipoLabel}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 self-center">
          <p className="truncate text-sm font-semibold text-foreground">{arquivo.nome}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className={cn('font-medium', P38_ACCENT)}>{tipoLabel}</span>
            {tamanho ? <span>· {tamanho}</span> : null}
            {arquivo.file ? <span>· Pronto para enviar</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
