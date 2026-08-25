import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createPageUrl } from '@/components/utils';

export default function AccessDeniedScreen({
  title = 'Acesso Restrito',
  message = 'Seu perfil de acesso não inclui esta função. Solicite ajuste ao administrador.',
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      <a
        href={createPageUrl('Home')}
        className="inline-block mt-6 px-6 py-2 bg-background dark:bg-muted text-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Voltar para Início
      </a>
    </div>
  );
}
