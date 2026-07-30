import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { getCachedUserSession, setCachedUserSession } from '@/lib/userSessionCache';

import { base44, p38 } from '@/api/base44Client';
import FontScaleInitializer from '@/components/accessibility/FontScaleInitializer';
import { buildMenuItems } from '@/components/config/usePermissoesResolvidas';
import { WifiOff } from 'lucide-react';
import PinSetupDialog from '@/components/auth/PinSetupDialog';
import { Button } from '@/components/ui/button';
import GlacialBottomNav from '@/components/navigation/GlacialBottomNav';
import GlacialSidebar from '@/components/navigation/GlacialSidebar';
import GlobalSearchOverlay from '@/components/navigation/GlobalSearchOverlay';
import MobileUserMenu from '@/components/layout/MobileUserMenu';
import MobileFunctionSelector from '@/components/navigation/MobileFunctionSelector';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { useBottomNavScrollVisibility } from '@/hooks/useBottomNavScrollVisibility';
import { shouldHideBottomNavOnScroll } from '@/config/bottomNavScrollPolicy';
import { shouldOpenGlobalSearchFromKeyboard } from '@/lib/globalSearchShortcut';
import { armGlobalSearchOpenGuard, registerOpenSearchOverlaySync } from '@/lib/openGlobalSearch';
import FinanceiroAccessGuard from '@/components/guard/FinanceiroAccessGuard';
import { isFinanceiroProtectedPage } from '@/config/financeiroGate';
import { isSupabaseAuthEnabled } from '@/integrations/p38/providers';

/** Páginas com scroll interno no mobile (evita body + nested scroll e zoom por overflow). */
const MOBILE_FULL_VIEWPORT_PAGES = new Set([
  'Produtos',
  'RelatorioMargem',
  'RelatorioCatalogoEstoque',
  'CaixasAtivos',
  'TurnosFechados',
  'PDVCaixa',
  'PDVVendedor',
  'PDV',
  'TabelaPrecosConsulta',
  'Compras',
]);

/** Rotas PDV no mobile: mantêm GlacialBottomNav (atalho rápido em overlay continua fullscreen). */
const MOBILE_PDV_IN_SHELL_ROUTES = new Set(['PDV', 'PDVCaixa', 'PDVVendedor']);
/** Páginas pesadas onde expandir o menu não deve reflowar todo o conteúdo. */
const DESKTOP_OVERLAY_SIDEBAR_PAGES = new Set(['VendasGestao', 'Produtos']);

const LayoutOutlet = React.memo(function LayoutOutlet({ children }) {
  return children;
});

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useCompactShell();
  const [currentUser, setCurrentUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [perfilDeAcesso, setPerfilDeAcesso] = useState(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);
  const [showDesktopUserPanel, setShowDesktopUserPanel] = useState(false);

  const fullscreenPages = ['PDV', 'PDVVendedor', 'PDVCaixa', 'AutoAtendimento', 'PedidoCompraDetalhe', 'AnexoCompartilhado'];
  const routePage = location.pathname.split('/').filter(Boolean)[0] || '';
  /** Mobile: PDV dentro do shell (bottom nav fixo); atalho lateral navega para a rota em vez de overlay. */
  const isMobilePdvInShell = isMobile && MOBILE_PDV_IN_SHELL_ROUTES.has(routePage);
  const isFullscreen =
    !isMobilePdvInShell &&
    fullscreenPages.some((page) => location.pathname.includes(page));
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const useDesktopOverlaySidebar = !isMobile && DESKTOP_OVERLAY_SIDEBAR_PAGES.has(currentPageName);
  const bottomNavScrollEnabled =
    isMobile &&
    !isFullscreen &&
    !showMobileMenu &&
    !searchOverlayOpen &&
    !showMobileUserMenu &&
    shouldHideBottomNavOnScroll(currentPageName);
  const bottomNavVisible = useBottomNavScrollVisibility(bottomNavScrollEnabled);

  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    loadUser();
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    
  }, []);

  const loadUser = async () => {
    try {
      const user = await p38.auth.me();
      if (user) {
        let perfil = null;
        if (user.perfil_acesso_id) {
          try {
            const perfis = await base44.entities.PerfilDeAcesso.filter({ id: user.perfil_acesso_id });
            perfil = perfis?.[0] || null;
          } catch (e) {
            console.warn('Perfil de acesso não encontrado:', e);
          }
        }
        setCurrentUser(user);
        setPerfilDeAcesso(perfil);
        setCachedUserSession(user, perfil);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      const cached = getCachedUserSession();
      if (cached?.user) {
        setCurrentUser(cached.user);
        if (cached.perfilDeAcesso) setPerfilDeAcesso(cached.perfilDeAcesso);
      } else if (
        isSupabaseAuthEnabled() &&
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login'
      ) {
        // Sem sessão Supabase → login (não mostrar "Erro de Conexão" genérico).
        try {
          base44.auth.redirectToLogin(window.location.href);
        } catch {
          window.location.href = '/login';
        }
      } else {
        setLoadError(error);
      }
    } finally {
      setIsLoadingUser(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleProfileSwitch = async (newProfile) => {
    try {
      // Para admins: trocar perfil simula permissões — usa perfil_acesso_id se disponível
      await base44.auth.updateMe({ perfil: newProfile });
      window.location.reload();
    } catch (error) {
      console.error("Erro ao trocar perfil:", error);
    }
  };

  const toggleSubmenu = React.useCallback((menuName) => {
    setExpandedMenus(prev => {
      const newState = { ...prev };
      newState[menuName] = !newState[menuName];
      return newState;
    });
  }, []);

  // ── Quarter Master Logic: monta menu baseado em permissões resolvidas ──────
  const menuItems = React.useMemo(() => {
   if (!currentUser) return [];
   return buildMenuItems(currentUser, perfilDeAcesso);
  }, [currentUser, perfilDeAcesso]);

  const allSearchableItems = React.useMemo(() => {
   const items = [];
   menuItems.forEach(item => {
     if (item.page) items.push({ name: item.name, page: item.page, icon: item.icon, parent: null });
     if (item.submenu) {
       item.submenu.forEach(sub => {
         items.push({ name: sub.name, page: sub.page, icon: item.icon, parent: item.name });
       });
     }
   });
   return items;
  }, [menuItems]);

  const openSearchOverlay = React.useCallback(() => {
    armGlobalSearchOpenGuard();
    setSearchOverlayOpen(true);
    setShowMobileMenu(false);
  }, []);

  const closeSearchOverlay = React.useCallback(() => {
    setSearchOverlayOpen(false);
  }, []);

  useEffect(() => {
    registerOpenSearchOverlaySync(() => {
      flushSync(() => {
        setSearchOverlayOpen(true);
        setShowMobileMenu(false);
      });
    });
    return () => registerOpenSearchOverlaySync(null);
  }, []);

  useEffect(() => {
    const down = (e) => {
      if (shouldOpenGlobalSearchFromKeyboard(e)) {
        e.preventDefault();
        setSearchOverlayOpen((open) => !open);
        setShowMobileMenu(false);
        return;
      }
      if (e.key === 'Escape') {
        setSearchOverlayOpen(false);
      }
    };
    document.addEventListener('keydown', down, true);

    const handleGlobalSearch = () => {
      openSearchOverlay();
    };
    window.addEventListener('open-global-search', handleGlobalSearch);

    return () => {
      document.removeEventListener('keydown', down, true);
      window.removeEventListener('open-global-search', handleGlobalSearch);
    };
  }, [openSearchOverlay]);

  useEffect(() => {
    if (!showDesktopUserPanel) return;

    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-desktop-user-panel]')) {
        setShowDesktopUserPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDesktopUserPanel]);

  const handleMouseEnter = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleMobileMenuToggle = () => {
    setIsOpen(!isOpen);
  };

  const closeMobileMenu = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const isPageActive = (item) => {
    if (item.page) {
      return currentPageName === item.page;
    }
    if (item.submenu) {
      return item.submenu.some(subItem => currentPageName === subItem.page);
    }
    return false;
  };

  if (isLoadingUser) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    const errMsg = String(loadError?.message || '');
    const isConfigError =
      /base44 indispon|supabase não configurado|VITE_SUPABASE|P38_SUPABASE_NOT_CONFIGURED/i.test(errMsg);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 font-din-1451 p38-app">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
          <WifiOff className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {isConfigError ? 'Configuração em falta' : 'Erro de Conexão'}
        </h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {isConfigError
            ? 'O servidor não está configurado para ligar ao Supabase. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no deploy.'
            : 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.'}
        </p>
        <Button onClick={() => window.location.reload()}>
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const searchOverlay = (
    <GlobalSearchOverlay
      open={searchOverlayOpen}
      onClose={closeSearchOverlay}
      isMobile={isMobile}
      isDark={darkMode}
      searchableItems={allSearchableItems}
      onNavigate={() => {
        closeSearchOverlay();
        setIsOpen(false);
      }}
    />
  );

  const financeGateActive = isFinanceiroProtectedPage(currentPageName);
  const pageContent = financeGateActive ? (
    <FinanceiroAccessGuard>{children}</FinanceiroAccessGuard>
  ) : (
    children
  );

  if (isFullscreen) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-white dark:bg-background p38-app">
          {pageContent}
        </div>
        {searchOverlay}
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <FontScaleInitializer />
      <div className="min-h-screen flex font-din-1451 p38-app bg-background">


        {/* Sidebar Desktop */}
        {!isMobile && !showMobileMenu && (
          <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              height: '100%',
              width: isOpen ? '300px' : '64px',
              zIndex: 40,
              transition: 'width 0.22s ease-out',
            }}
          >
            <GlacialSidebar
              isOpen={isOpen}
              menuItems={menuItems}
              currentPageName={currentPageName}
              isMobile={false}
              currentUser={currentUser}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              searchableItems={allSearchableItems}
              onSearchCollapsedActivate={openSearchOverlay}
            />
          </div>
        )}

        <div 
          className={`flex-1 transition-[margin] duration-200 ease-out ${
            isMobile 
              ? `ml-0 pt-12 ${MOBILE_FULL_VIEWPORT_PAGES.has(currentPageName) ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'p38-layout-mobile-scroll-pad'}`
              : (useDesktopOverlaySidebar ? 'ml-16' : (isOpen ? 'ml-[300px]' : 'ml-16'))
          } ${MOBILE_FULL_VIEWPORT_PAGES.has(currentPageName) && !isMobile ? 'h-screen max-h-screen overflow-hidden' : ''}`}
          style={{ willChange: 'margin', paddingTop: isMobile ? `calc(3rem + env(safe-area-inset-top))` : undefined }}
        >
          {MOBILE_FULL_VIEWPORT_PAGES.has(currentPageName) ? (
            <div className="h-full min-h-0 overflow-hidden">
              <LayoutOutlet>{pageContent}</LayoutOutlet>
            </div>
          ) : (
            <div className="p-4 md:p-6 tablet-landscape:p-7 overflow-x-hidden max-w-full">
              <LayoutOutlet>{pageContent}</LayoutOutlet>
            </div>
          )}
        </div>
        {isMobile && !isFullscreen && (
          <GlacialBottomNav
            onMenuClick={() => setShowMobileMenu(true)}
            onProfileClick={() => setShowMobileUserMenu(true)}
            currentPageName={currentPageName}
            visible={bottomNavVisible}
          />
        )}
        {!isFullscreen && (
          <MobileFunctionSelector
            isOpen={showMobileMenu}
            onClose={() => setShowMobileMenu(false)}
            menuItems={menuItems}
            currentUser={currentUser}
            searchableItems={allSearchableItems}
          />
        )}
        {!isFullscreen && (
          <MobileUserMenu
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            externalOpen={showMobileUserMenu}
            onExternalClose={() => setShowMobileUserMenu(false)}
          />
        )}
      </div>
      {showPinSetup && (
        <PinSetupDialog
          isOpen={showPinSetup}
          onClose={() => { setShowPinSetup(false); loadUser(); }}
          user={currentUser}
        />
      )}
      {searchOverlay}
    </div>
  );
}