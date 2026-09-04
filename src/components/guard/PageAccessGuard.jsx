import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getCachedUserSession } from '@/lib/userSessionCache';
import { podeAcessarPagina } from '@/lib/pagePermissions';
import AccessDeniedScreen from '@/components/guard/AccessDeniedScreen';

/**
 * Guarda de rota — impede acesso direto, botão voltar e links profundos
 * a páginas fora do kit do utilizador.
 */
export default function PageAccessGuard({ pageName, children }) {
  const [acessoPermitido, setAcessoPermitido] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const validar = async () => {
      try {
        const cached = getCachedUserSession();
        const userCached = cached?.user;
        if (userCached && podeAcessarPagina(userCached, cached?.perfilDeAcesso, pageName)) {
          if (!cancelled) setAcessoPermitido(true);
          return;
        }

        const user = await base44.auth.me();
        if (!user) {
          if (!cancelled) setAcessoPermitido(false);
          return;
        }

        let perfil = cached?.perfilDeAcesso ?? null;
        if (user.perfil_acesso_id) {
          try {
            const perfis = await base44.entities.PerfilDeAcesso.filter({ id: user.perfil_acesso_id });
            perfil = perfis?.[0] || null;
          } catch (e) {
            console.warn('[PageAccessGuard] Perfil de acesso:', e);
          }
        }

        if (!cancelled) {
          setAcessoPermitido(podeAcessarPagina(user, perfil, pageName));
        }
      } catch (error) {
        console.error('[PageAccessGuard] Erro ao validar acesso:', error);
        if (!cancelled) setAcessoPermitido(false);
      }
    };

    validar();
    return () => {
      cancelled = true;
    };
  }, [pageName]);

  if (acessoPermitido === null) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-muted-foreground text-sm">A validar acesso…</div>
      </div>
    );
  }

  if (!acessoPermitido) {
    return (
      <AccessDeniedScreen message="Esta página não faz parte do seu kit de acesso. Peça ao administrador para ajustar o perfil." />
    );
  }

  return children;
}
