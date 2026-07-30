import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import {
  P38MobileLine,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { SITUACAO_SERIE, labelValorSerie } from '@/lib/agefinPrevisaoCalculos';

/**
 * Lista de contas fixas: nome + valor/vencimento. Detalhe (fornecedor, CC) no editar.
 */
export default function AgefinPrevisaoModeloRow({ modelo, onEdit, onDelete, striped = false }) {
  const encerrada = (modelo.situacao || '') === SITUACAO_SERIE.ENCERRADA || modelo.ativo === false;
  const dia = modelo.dia_vencimento || 10;

  return (
    <P38MobileLine
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(encerrada ? 'muted' : 'danger')}
      className="max-md:!py-2.5 max-md:min-h-[48px] [&>div>div:first-child]:text-[13px] [&>div>div:first-child]:font-normal sm:[&>div>div:first-child]:text-sm [&>div>div:nth-child(2)]:text-[11px]"
      title={modelo.nome}
      subtitle={`${labelValorSerie(modelo)} · Vence dia ${dia}`}
      meta={encerrada ? <P38StatusLabel tone="muted">Encerrada</P38StatusLabel> : null}
      value={
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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
            className="h-8 w-8 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(modelo);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      }
    />
  );
}
