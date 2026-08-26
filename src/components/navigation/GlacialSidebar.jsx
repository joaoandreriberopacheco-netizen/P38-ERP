import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { ChevronRight, Sun, Moon, ALargeSmall, Shield, User, Settings, LogOut, RotateCw, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PinSetupDialog from '@/components/auth/PinSetupDialog';
import P38Logo from '@/components/brand/P38Logo';
import MenuSearchBar from '@/components/navigation/MenuSearchBar';
import { getP38ShellColors } from '@/lib/p38ShellColors';
import { usePreferredOrientation } from '@/hooks/usePreferredOrientation';
import { pulseSensor } from '@/lib/pulseSensor';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export default function GlacialSidebar({
  isOpen,
  onClose,
  menuItems,
  currentPageName,
  isMobile,
  currentUser: currentUserProp,
  darkMode: darkModeProp,
  toggleDarkMode,
  searchableItems = [],
  onSearchCollapsedActivate,
  showConfiguracoesLink = false,
}) {
  const [expandedMenus, setExpandedMenus] = useState({});
  const [currentUser, setCurrentUser] = useState(currentUserProp || null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [isDarkLocal, setIsDarkLocal] = useState(() =>
    darkModeProp ?? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  );
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('font_scale');
    return saved ? parseFloat(saved) : 1;
  });
  const location = useLocation();
  const isDark = useDarkMode();
  const { rotationUnlocked, toggle: toggleRotationLock } = usePreferredOrientation();

  useEffect(() => {
    if (!currentUser) {
      base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
    }
  }, []);

  const toggleDark = () => {
    if (toggleDarkMode) {
      toggleDarkMode();
      setIsDarkLocal(d => !d);
    } else {
      const next = !isDarkLocal;
      setIsDarkLocal(next);
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  };

  const cycleFontSize = () => {
    const steps = [0.85, 1, 1.1, 1.2];
    const idx = steps.indexOf(fontSize);
    const next = steps[(idx + 1) % steps.length];
    setFontSize(next);
    localStorage.setItem('font_scale', String(next));
    document.documentElement.style.setProperty('--app-font-scale', String(next));
  };

  const fontLabel = fontSize === 1 ? 'A' : fontSize < 1 ? 'A-' : 'A+';

  const c = getP38ShellColors(isDark);

  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => {
      const newExpanded = {};
      if (!prev[menuName]) newExpanded[menuName] = true;
      return newExpanded;
    });
  };

  const isPageActive = (item) => {
    if (item.page) return currentPageName === item.page || location.pathname.includes(item.page);
    if (item.submenu) return item.submenu.some(sub => currentPageName === sub.page || location.pathname.includes(sub.page));
    return false;
  };

  const closeMobileMenu = () => { if (isMobile) onClose?.(); };

  // Desktop: recolhido=64px, expandido=300px
  const desktopWidth = isOpen ? '300px' : '64px';
  const mobileTranslate = isOpen ? 'translateX(0)' : 'translateX(-100%)';

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.25)' }}
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className="p38-sidebar fixed left-0 top-0 z-40 flex flex-col font-din-1451"
        style={{
          height: '100dvh',
          overflow: 'hidden',
          background: c.bg,
          width: isMobile ? '300px' : desktopWidth,
          transform: isMobile ? mobileTranslate : 'none',
          transition: isMobile ? 'transform 0.22s ease-out' : 'width 0.22s ease-out',
          boxShadow: `1px 0 0 0 ${c.border}`,
          willChange: isMobile ? 'transform' : 'width',
        }}
      >
        {/* Header com logo */}
        <div
          className="flex items-center flex-shrink-0 px-4"
          style={{
            height: 64,
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          {isOpen ? (
            <P38Logo surface={isMobile ? 'sidebar.expandedMobile' : 'sidebar.expanded'} />
          ) : (
            <div className="mx-auto">
              <P38Logo surface="sidebar.collapsed" />
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="px-2 py-3 space-y-0.5" style={{ flex: '1 1 0', overflowY: 'auto', minHeight: 0 }}>
          {isOpen && (
            <p
              className="p38-sidebar-section-label text-[10px] tablet-landscape:text-xs px-3 mb-2 uppercase tracking-widest"
              style={{ color: c.sectionLabel }}
            >
              Menu
            </p>
          )}

          <MenuSearchBar
            isDark={isDark}
            expanded={isOpen}
            onOpen={isMobile ? closeMobileMenu : undefined}
            onCollapsedActivate={onSearchCollapsedActivate}
            searchableItems={searchableItems}
            showShortcutHint={!isMobile}
            className={isOpen ? "mb-2 mx-1" : "mb-1"}
          />

          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = isPageActive(item);
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isExpanded = expandedMenus[item.name];

            return (
              <div key={item.name}>
                {hasSubmenu ? (
                  <>
                    <button
                      onClick={() => toggleSubmenu(item.name)}
                      className="w-full flex items-center rounded-xl transition-colors"
                      style={{
                        gap: 10,
                        padding: isOpen ? '10px 12px' : '10px',
                        justifyContent: isOpen ? 'flex-start' : 'center',
                        background: isActive ? c.activeBg : 'transparent',
                        color: isActive ? c.text : c.textSub,
                      }}
                    >
                      <Icon className="flex-shrink-0 tablet-landscape:w-5 tablet-landscape:h-5" size={18} style={{ color: c.iconColor }} />
                      {isOpen && (
                        <>
                          <span className="flex-1 text-left text-sm tablet-landscape:text-base font-medium" style={{ color: c.text }}>{item.name}</span>
                          <ChevronRight
                            size={14}
                            style={{ color: c.chevron, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                          />
                        </>
                      )}
                    </button>

                    {isExpanded && isOpen && (
                      <div
                        className="ml-8 mt-1 space-y-1 pl-2"
                      >
                        {item.submenu.map(subItem => {
                          const isSubActive = currentPageName === subItem.page || location.pathname.includes(subItem.page);
                          return (
                            <Link
                              key={subItem.page}
                              to={createPageUrl(subItem.page)}
                              onClick={closeMobileMenu}
                              className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors min-h-[36px]"
                              style={{
                                background: isSubActive ? c.activeBg : 'transparent',
                                color: isSubActive ? c.text : c.textSub,
                                fontWeight: isSubActive ? 600 : 400,
                              }}
                            >
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={createPageUrl(item.page)}
                    onClick={closeMobileMenu}
                    className="flex items-center rounded-xl transition-colors"
                    style={{
                      gap: 10,
                      padding: isOpen ? '10px 12px' : '10px',
                      justifyContent: isOpen ? 'flex-start' : 'center',
                      background: isActive ? c.activeBg : 'transparent',
                      color: isActive ? c.text : c.textSub,
                    }}
                  >
                    <Icon className="flex-shrink-0 tablet-landscape:w-5 tablet-landscape:h-5" size={18} style={{ color: c.iconColor }} />
                    {isOpen && (
                      <span className="text-sm tablet-landscape:text-base font-medium" style={{ color: c.text }}>{item.name}</span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}

          <div style={{ height: 12 }} />
        </nav>

        {/* Rodapé do usuário */}
        <div
          className="flex-shrink-0 p-3 flex justify-center"
          style={{ borderTop: `1px solid ${c.border}`, position: 'relative' }}
          onMouseLeave={() => setUserPanelOpen(false)}
        >
          <button
            onClick={() => setUserPanelOpen(p => !p)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: userPanelOpen ? c.activeBg : c.hoverBg }}
            title={currentUser?.full_name}
          >
            <User size={15} style={{ color: c.iconColor }} />
          </button>

          {/* Popover estilo cracha mobile */}
          {userPanelOpen && (
            <div
              className="absolute bottom-14 left-3 z-50 rounded-2xl p-4 space-y-3"
              style={{
                background: c.bg,
                boxShadow: isDark
                  ? '0 8px 32px rgba(0,0,0,0.55)'
                  : '0 8px 32px rgba(0,0,0,0.14)',
                minWidth: 220,
                border: `1px solid ${c.border}`,
              }}
            >
              {/* Info do usuário */}
              {currentUser && (
                <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${c.border}` }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.hoverBg }}>
                    <span className="text-sm font-semibold" style={{ color: c.text }}>
                      {currentUser.full_name?.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: c.text }}>{currentUser.full_name}</p>
                    <p className="text-[11px] truncate" style={{ color: c.textSub }}>{currentUser.email}</p>
                  </div>
                </div>
              )}

              {/* Ações rápidas */}
              <div className="space-y-0.5">
                <button
                  onClick={toggleDark}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                  style={{ color: c.text }}
                  onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {isDarkLocal ? <Sun size={15} style={{ color: c.iconColor }} /> : <Moon size={15} style={{ color: c.iconColor }} />}
                  <span className="text-sm">{isDarkLocal ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>

                <button
                  onClick={() => { toggleRotationLock(); setUserPanelOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                  style={{ color: c.text }}
                  onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  {...pulseSensor('perfil.modo-paisagem')}
                >
                  {rotationUnlocked
                    ? <Lock size={15} style={{ color: c.iconColor }} />
                    : <RotateCw size={15} style={{ color: c.iconColor }} />
                  }
                  <span className="text-sm">{rotationUnlocked ? 'Bloquear rotação' : 'Rotação livre'}</span>
                </button>

                <button
                  onClick={cycleFontSize}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                  style={{ color: c.text }}
                  onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ALargeSmall size={15} style={{ color: c.iconColor }} />
                  <span className="text-sm">Fonte ({fontLabel})</span>
                </button>

                <button
                  onClick={() => { setShowPinSetup(true); setUserPanelOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                  style={{ color: c.text }}
                  onMouseEnter={e => e.currentTarget.style.background = c.hoverBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Shield size={15} style={{ color: currentUser?.pin_definido ? c.iconColor : '#f59e0b' }} />
                  <span className="text-sm">{currentUser?.pin_definido ? 'Alterar PIN' : 'Cadastrar PIN'}</span>
                </button>

                <div style={{ height: 1, background: c.border, margin: '4px 0' }} />

                {showConfiguracoesLink ? (
                  <Link
                    to={createPageUrl('Configuracoes')}
                    onClick={() => setUserPanelOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                    style={{ color: c.text }}
                    onMouseEnter={e => { e.currentTarget.style.background = c.hoverBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Settings size={15} style={{ color: c.iconColor }} />
                    <span className="text-sm">Configurações</span>
                  </Link>
                ) : null}

                <button
                  onClick={() => base44.auth.logout()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left"
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={15} style={{ color: '#ef4444' }} />
                  <span className="text-sm" style={{ color: '#ef4444' }}>Sair</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <PinSetupDialog
        isOpen={showPinSetup}
        onClose={() => {
          setShowPinSetup(false);
          base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
        }}
        user={currentUser}
      />
    </>
  );
}
