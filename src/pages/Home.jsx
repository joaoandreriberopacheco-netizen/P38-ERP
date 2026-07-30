import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardPenLine, Settings2 } from 'lucide-react';
import P38Logo from '@/components/brand/P38Logo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ALL_QUICK_ACTIONS,
  DEFAULT_QUICK_ACTIONS,
  quickActionsAtivos,
  normalizeQuickActionIds,
} from '@/components/home/quickActions';
import HomeQuickActionLink, {
  HomeAlertsPanelLazy,
  HomeSalesSummaryLazy,
} from '@/components/home/HomeQuickActionLink';
import { getCachedUserSession, setCachedUserSession } from '@/lib/userSessionCache';
import {
  resolverPermissoes,
  idsAtalhosHomePermitidos,
  usuarioLegadoSemMatrizPerfil,
  perfilResolvidoParaUsuario,
} from '@/lib/perfilPermissoes';
import { prefetchP38Page } from '@/next/prefetchP38Route';
import { createPageUrl } from '@/components/utils';

const STORAGE_KEY = 'home_quick_actions';
const PersonalizarHomeDialog = React.lazy(() => import('@/components/home/PersonalizarHomeDialog'));

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [perfilDeAcesso, setPerfilDeAcesso] = useState(null);
  const [quickActionIds, setQuickActionIds] = useState([]);
  const [showPersonalizar, setShowPersonalizar] = useState(false);

  const permissoes = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return null;
    const perfil = perfilResolvidoParaUsuario(currentUser, perfilDeAcesso);
    return resolverPermissoes(perfil, currentUser?.override_permissoes);
  }, [currentUser, perfilDeAcesso]);

  const allowedActionIds = useMemo(
    () => idsAtalhosHomePermitidos(currentUser, perfilDeAcesso, quickActionsAtivos()),
    [currentUser, perfilDeAcesso]
  );

  const podePersonalizar = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (perfilDeAcesso) return !!perfilDeAcesso.permissoes?.homepage?.atalhos_personalizados;
    return true;
  }, [currentUser, perfilDeAcesso]);

  const podeVerResumoVendas = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (usuarioLegadoSemMatrizPerfil(currentUser)) return true;
    return !!(
      permissoes?.dashboard?.acesso ||
      permissoes?.dashboard?.resumo_vendas_home ||
      permissoes?.vendas?.acesso
    );
  }, [currentUser, permissoes]);

  useEffect(() => {
    const loadUser = async () => {
      const cached = getCachedUserSession();
      if (cached?.user) {
        setCurrentUser(cached.user);
        if (cached.perfilDeAcesso) setPerfilDeAcesso(cached.perfilDeAcesso);
        applyQuickActions(cached.user, cached.perfilDeAcesso);
      }

      try {
        const user = await base44.auth.me();
        let perfil = null;
        if (user?.perfil_acesso_id) {
          try {
            const perfis = await base44.entities.PerfilDeAcesso.list();
            perfil = perfis.find((p) => p.id === user.perfil_acesso_id) || null;
          } catch (e) {
            console.warn('Perfil de acesso não encontrado:', e);
          }
        }
        setCurrentUser(user);
        setPerfilDeAcesso(perfil);
        setCachedUserSession(user, perfil);
        applyQuickActions(user, perfil);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };

    const applyQuickActions = (user, perfil) => {
      if (perfil) {
        const podePersonalizarAtalhos = perfil.permissoes?.homepage?.atalhos_personalizados;
        if (podePersonalizarAtalhos) {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const raw = saved ? JSON.parse(saved) : (perfil.atalhos_padrao || DEFAULT_QUICK_ACTIONS);
            setQuickActionIds(normalizeQuickActionIds(raw));
          } catch {
            setQuickActionIds(normalizeQuickActionIds(perfil.atalhos_padrao || DEFAULT_QUICK_ACTIONS));
          }
        } else {
          setQuickActionIds(normalizeQuickActionIds(perfil.atalhos_padrao || []));
        }
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          const raw = saved ? JSON.parse(saved) : DEFAULT_QUICK_ACTIONS;
          setQuickActionIds(normalizeQuickActionIds(raw));
        } catch {
          setQuickActionIds(normalizeQuickActionIds(DEFAULT_QUICK_ACTIONS));
        }
      }
    };

    loadUser();
  }, []);

  const quickActions = quickActionIds
    .filter((id) => allowedActionIds.includes(id))
    .map((id) => ALL_QUICK_ACTIONS.find((a) => a.id === id))
    .filter(Boolean);

  useEffect(() => {
    const pages = [...new Set(quickActions.map((a) => a.page).filter(Boolean))];
    if (!pages.length) return undefined;

    const prefetchAll = () => {
      pages.forEach((page) => prefetchP38Page(page));
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(prefetchAll, 400);
    return () => window.clearTimeout(timer);
  }, [quickActions]);

  const handleSaveActions = (ids) => {
    const limited = normalizeQuickActionIds(ids);
    setQuickActionIds(limited);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6 font-din-1451">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground mt-2">
              Olá, {currentUser?.full_name?.split(' ')[0] || 'Usuário'}
            </h1>
          </div>
          <div className="flex justify-end md:items-start shrink-0">
            <P38Logo surface="home.headerMobile" className="md:hidden" />
            <P38Logo surface="home.headerDesktop" className="hidden md:flex" />
          </div>
        </div>

        {podeVerResumoVendas && <HomeSalesSummaryLazy />}

        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Acesso Rápido
            </h2>
            {podePersonalizar && (
              <button
                type="button"
                onClick={() => setShowPersonalizar(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1 touch-manipulation"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Personalizar</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <HomeQuickActionLink key={action.id} action={action} />
            ))}
          </div>
        </div>

        <HomeAlertsPanelLazy allowedActionIds={allowedActionIds} />

        {allowedActionIds.includes('consumo_interno') && (
          <Link
            to="/ConsumoInterno"
            className="bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-start gap-3 hover:shadow-md transition-shadow touch-manipulation active:scale-[0.99]"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <ClipboardPenLine className="w-5 h-5 text-foreground/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Registrar Consumo Interno</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saída rastreada com destinação, assinatura e anexos.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </Link>
        )}

        {(() => {
          const outrosAtalhos = quickActionsAtivos()
            .filter((a) => allowedActionIds.includes(a.id) && !quickActionIds.includes(a.id))
            .slice(0, 3);

          if (outrosAtalhos.length === 0) return null;

          return (
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/40">
              <h3 className="text-sm font-semibold text-foreground mb-3">Outros Atalhos</h3>
              <div className="space-y-2">
                {outrosAtalhos.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.id}
                      to={createPageUrl(action.page)}
                      onPointerEnter={() => prefetchP38Page(action.page)}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted transition-colors touch-manipulation active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-foreground/90">{action.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {showPersonalizar && (
        <Suspense fallback={null}>
          <PersonalizarHomeDialog
            isOpen={showPersonalizar}
            onClose={() => setShowPersonalizar(false)}
            selected={quickActionIds}
            onSave={handleSaveActions}
            allowedActions={allowedActionIds}
          />
        </Suspense>
      )}
    </div>
  );
}
