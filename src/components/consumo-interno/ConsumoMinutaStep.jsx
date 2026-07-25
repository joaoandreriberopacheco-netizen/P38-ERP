import React from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Signature, Clock3 } from 'lucide-react';

export default function ConsumoMinutaStep({ formData, currentUser, onOpenAssinatura, onBack, onSubmit }) {
  return (
    <div className="space-y-5">
      <div className="rounded-[30px] bg-card p-5 shadow-sm dark:bg-muted">
        <p className="mb-4 text-lg font-semibold text-foreground">Minuta</p>
        <div className="space-y-3">
          <Button type="button" variant="outline" className="h-11 w-full justify-start rounded-2xl border-0 shadow-sm" onClick={onOpenAssinatura}>
            <Signature className="mr-2 h-4 w-4" />{formData.assinatura_recolhedor_nome ? `Assinado por ${formData.assinatura_recolhedor_nome}` : 'Coletar assinatura'}
          </Button>
          <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-[24px] bg-muted text-sm text-muted-foreground shadow-sm dark:bg-background dark:text-muted-foreground">
            <Paperclip className="mb-2 h-5 w-5" />Adicionar anexos
            <input id="consumo-anexo-input" type="file" multiple className="hidden" />
          </label>
        </div>

        <div className="mt-5 rounded-[24px] bg-muted/40 p-4 shadow-sm dark:bg-background">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />Resumo da minuta
          </div>
          <div className="space-y-2 text-sm text-foreground/90">
            <p><strong>Destinação:</strong> {formData.destinacao || '—'}</p>
            <p><strong>Interveniente:</strong> {formData.responsavel_recebimento || '—'}</p>
            <p><strong>Registrado por:</strong> {currentUser?.full_name || currentUser?.email || '—'}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="button" variant="outline" onClick={onBack} className="h-12 flex-1 rounded-2xl border-0 shadow-sm">
            Voltar
          </Button>
          <Button type="button" onClick={onSubmit} className="h-12 flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}