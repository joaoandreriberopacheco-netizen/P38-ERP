import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
import { getCachedUserSession } from '@/lib/userSessionCache';
import { podeVisualizarCatalogoProdutos } from '@/lib/perfilPermissoes';

export default function ProdutosAccessGuard({ children }) {
  const [acessoPermitido, setAcessoPermitido] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const cached = getCachedUserSession();
        const userCached = cached?.user;
        if (userCached && podeVisualizarCatalogoProdutos(userCached, cached?.perfilDeAcesso)) {
          setAcessoPermitido(true);
        }

        const user = await base44.auth.me();
        if (!user) {
          setAcessoPermitido(false);
          return;
        }

        let perfil = null;
        if (user?.perfil_acesso_id) {
          try {
            const perfis = await base44.entities.PerfilDeAcesso.list();
            perfil = perfis.find((p) => p.id === user.perfil_acesso_id) || null;
          } catch (e) {
            console.warn('Perfil de acesso:', e);
          }
        }

        setAcessoPermitido(podeVisualizarCatalogoProdutos(user, perfil));
      } catch (error) {
        console.error('Erro ao validar acesso a Produtos:', error);
        setAcessoPermitido(false);
      }
    };
    checkAccess();
  }, []);

  if (acessoPermitido === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!acessoPermitido) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-card p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Package className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground max-w-sm">
            Seu perfil de acesso não possui permissão para visualizar o catálogo de produtos.
          </p>
          <a
            href={createPageUrl('Home')}
            className="inline-block mt-6 px-6 py-2 bg-background dark:bg-muted text-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Voltar para Home
          </a>
        </div>
      </div>
    );
  }

  return children;
}
