import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getCachedUserSession } from '@/lib/userSessionCache';
import { permissoesEfetivas, temPermissaoKit } from '@/lib/permissaoKit';

/**
 * Carrega user + perfil e expõe `tem(path, fallback?)` para ações finas no kit.
 */
export function usePermissoesUsuario() {
  const [user, setUser] = useState(null);
  const [perfilDeAcesso, setPerfilDeAcesso] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedUserSession();
    if (cached?.user) {
      setUser(cached.user);
      setPerfilDeAcesso(cached.perfilDeAcesso ?? null);
    }

    base44.auth.me().then(async (u) => {
      if (cancelled) return;
      setUser(u);
      let perfil = cached?.perfilDeAcesso ?? null;
      if (u?.perfil_acesso_id) {
        try {
          const perfis = await base44.entities.PerfilDeAcesso.filter({ id: u.perfil_acesso_id });
          perfil = perfis?.[0] ?? null;
        } catch {
          perfil = null;
        }
      }
      setPerfilDeAcesso(perfil);
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => { cancelled = true; };
  }, []);

  const permissoes = useMemo(
    () => permissoesEfetivas(user, perfilDeAcesso),
    [user, perfilDeAcesso]
  );

  const tem = useCallback(
    (path, fallback = null) => temPermissaoKit(user, perfilDeAcesso, path, fallback),
    [user, perfilDeAcesso]
  );

  return { user, perfilDeAcesso, permissoes, tem, loaded };
}
