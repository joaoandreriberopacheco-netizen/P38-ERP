import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Paperclip, ExternalLink, Signature, Camera, FileText } from 'lucide-react';

const getIcon = (anexo) => {
  const tipo = (anexo.tipo_documento || '').toLowerCase();
  const nome = (anexo.nome_arquivo || '').toLowerCase();
  const descricao = (anexo.descricao || '').toLowerCase();

  if (descricao.includes('assinatura') || nome.includes('assinatura') || tipo === 'contrato') return Signature;
  if (nome.match(/\.(png|jpg|jpeg|webp)$/) || tipo === 'outro' || tipo === 'comprovante') return Camera;
  return FileText;
};

export default function ConsumoAnexosDialog({ open, onOpenChange, anexos = [], consumoNumero }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[28px] border-0 bg-card p-0 shadow-2xl dark:bg-background">
        <div className="p-5 md:p-6">
          <div className="mb-5">
            <p className="text-lg font-semibold text-foreground">Anexos do consumo</p>
            <p className="text-sm text-muted-foreground">{consumoNumero || 'Consumo interno'} · arquivos abertos por link</p>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {anexos.length === 0 && (
              <div className="rounded-[24px] bg-muted/40 p-5 text-sm text-muted-foreground shadow-sm dark:bg-muted dark:text-muted-foreground">
                Nenhum anexo encontrado.
              </div>
            )}

            {anexos.map((anexo) => {
              const Icon = getIcon(anexo);
              return (
                <div key={anexo.id} className="flex items-center gap-3 rounded-[24px] bg-muted/40 p-4 shadow-sm dark:bg-muted">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-sm dark:bg-background dark:text-foreground/90">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{anexo.nome_arquivo || 'Arquivo'}</p>
                    <p className="truncate text-xs text-muted-foreground">{anexo.descricao || anexo.tipo_documento || 'Anexo'}</p>
                  </div>
                  <Button asChild className="h-10 rounded-2xl bg-primary px-3 text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">
                    <a href={anexo.url_drive} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}