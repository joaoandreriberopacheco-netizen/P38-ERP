import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import {
  P38MobileLine,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { SITUACAO_SERIE, labelFrequenciaSerie, labelValorSerie } from '@/lib/agefinPrevisaoCalculos';

export default function AgefinPrevisaoModeloRow({ modelo, onEdit, onDelete, striped = false }) {
  const encerrada = (modelo.situacao || '') === SITUACAO_SERIE.ENCERRADA || modelo.ativo === false;
  const centroCusto = String(modelo.centro_custo || '').trim();

  const meta = (
    <>
      {modelo.terceiro_nome && <span>{modelo.terceiro_nome}</span>}
      <span>CC {centroCusto || 'não informado'}</span>
      <span>{labelFrequenciaSerie(modelo)}</span>
      <span>Vence dia {modelo.dia_vencimento || 10}</span>
      {encerrada && <P38StatusLabel tone="muted">Encerrada</P38StatusLabel>}
    </>
  );

  return (
    <P38MobileLine
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(encerrada ? 'muted' : 'danger')}
      className="max-md:!py-3.5"
      title={modelo.nome}
      subtitle={labelValorSerie(modelo)}
      meta={meta}
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
