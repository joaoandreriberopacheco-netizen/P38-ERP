import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { P38Data } from '@/components/ui/p38-data';
import { P38StatusLabel } from '@/components/ui/p38-mobile-line';
import { SITUACAO_SERIE, labelValorSerie } from '@/lib/agefinPrevisaoCalculos';
import { cn } from '@/lib/utils';

/**
 * Linha de conta fixa — mesma hierarquia flex da lista de previsão.
 */
export default function AgefinPrevisaoModeloRow({ modelo, onEdit, onDelete }) {
  const encerrada = (modelo.situacao || '') === SITUACAO_SERIE.ENCERRADA || modelo.ativo === false;
  const dia = modelo.dia_vencimento || 10;

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-gray-50 py-4',
        'last:border-b-0',
        encerrada && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <P38Data as="span" className="truncate text-sm font-medium text-gray-900">
          {modelo.nome}
        </P38Data>
        <span className="text-xs font-normal text-gray-400">
          {labelValorSerie(modelo)} · Vence dia {dia}
          {encerrada ? ' · Encerrada' : ''}
        </span>
        {encerrada ? (
          <span className="mt-0.5">
            <P38StatusLabel tone="muted">Encerrada</P38StatusLabel>
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-500 hover:text-gray-900"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(modelo);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-red-400 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(modelo);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
