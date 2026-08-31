import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import P38Logo from '@/components/brand/P38Logo';
import MenuSearchBar from '@/components/navigation/MenuSearchBar';
import { getP38ShellColors } from '@/lib/p38ShellColors';
import { useForceLandscape } from '@/hooks/useForceLandscape';
import { getP38PortalRoot } from '@/lib/p38PortalRoot';
import { menuItemContainsPage } from '@/lib/menuNavUtils';

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

export default function MobileFunctionSelector({ isOpen, onClose, menuItems = [], currentUser, searchableItems = [] }) {
  const location = useLocation();
  const isDark = useDarkMode();
  const forceLandscape = useForceLandscape();
  const [drillStack, setDrillStack] = useState([]);

  const groupedItems = useMemo(() => menuItems.filter(item => item.submenu?.length || item.page), [menuItems]);
  const currentGroup = drillStack.length ? drillStack[drillStack.length - 1] : null;
  const currentList = currentGroup?.submenu || groupedItems;

  useEffect(() => {
    if (!isOpen) setDrillStack([]);
  }, [isOpen]);

  const isItemActive = (item) => menuItemContainsPage(item, null, location.pathname);

  const c = getP38ShellColors(isDark);

  if (!isOpen) return null;

  const portalRoot = typeof document !== 'undefined' ? getP38PortalRoot() : null;
  if (!portalRoot) return null;

  const headerTopPad = forceLandscape
    ? 'pt-4'
    : 'pt-[max(1rem,env(safe-area-inset-top))]';

  return createPortal(
    <div
      className="p38-portal-overlay z-[60] sidebar-shell:hidden font-din-1451 flex flex-col min-h-0 h-full max-h-full"
      style={{ background: c.bg }}
    >
      <div
        style={{ background: c.headerBg, boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
        className={`shrink-0 px-4 pb-4 ${headerTopPad}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <P38Logo surface="mobile.functionSelector" className="flex-none" />
            <div className="min-w-0 text-right flex-1">
              <p className="text-sm" style={{ color: c.textMuted }}>
                Olá{currentUser?.full_name ? `, ${currentUser.full_name.split(' ')[0]}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: c.closeBg, color: c.closeColor }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <MenuSearchBar isDark={isDark} onOpen={onClose} searchableItems={searchableItems} />
      </div>

      {!currentGroup ? (
        <div className="flex flex-1 min-h-0 flex-col p38-stage-panel-scroll p38-nav-menu px-4 py-4 touch-pan-y">
          <div className="rounded-[24px] p-4" style={{ background: c.cardBg, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 className="text-base font-semibold mb-3" style={{ color: c.textMuted }}>Funções</h3>
            <div className="space-y-0.5">
              {groupedItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);

                const itemStyle = { background: active ? c.btnBg : 'transparent' };

                if (item.page && !item.submenu?.length) {
                  return (
                    <Link
                      key={item.name}
                      to={createPageUrl(item.page)}
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors"
                      style={itemStyle}
                    >
                      <Icon className="w-5 h-5" style={{ color: c.iconColor }} />
                      <span className="flex-1 text-[1.02rem] font-semibold tracking-[0.01em]" style={{ color: c.text }}>{item.name}</span>
                      <ChevronRight className="w-4 h-4" style={{ color: c.chevron }} />
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.name}
                    onClick={() => setDrillStack([item])}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors"
                    style={itemStyle}
                  >
                    <Icon className="w-5 h-5" style={{ color: c.iconColor }} />
                    <span className="flex-1 text-left text-[1.02rem] font-semibold tracking-[0.01em]" style={{ color: c.text }}>{item.name}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: c.chevron }} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="h-8" />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col p38-stage-panel-scroll p38-nav-menu px-4 py-4 touch-pan-y">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setDrillStack((prev) => prev.slice(0, -1))}
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: c.backBg, color: c.textSub }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-[1.6rem] font-semibold truncate" style={{ color: c.text }}>{currentGroup.name}</h3>
          </div>

          <div>
            {currentList.map((subItem) => {
              const Icon = subItem.icon || currentGroup?.icon;
              const hasNested = subItem.submenu?.length > 0;
              const active = subItem.page
                ? location.pathname.includes(subItem.page)
                : menuItemContainsPage(subItem, null, location.pathname);

              if (hasNested) {
                return (
                  <button
                    key={subItem.name}
                    type="button"
                    onClick={() => setDrillStack((prev) => [...prev, subItem])}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors"
                    style={{
                      background: active ? c.btnBg : 'transparent',
                      color: active ? c.text : c.textSub,
                    }}
                  >
                    {Icon && <Icon className="w-5 h-5 flex-none" style={{ color: c.iconColor }} />}
                    <span className="flex-1 text-left text-[1.04rem] font-semibold leading-tight tracking-[0.01em]">{subItem.name}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: c.chevron }} />
                  </button>
                );
              }

              return (
                <Link
                  key={subItem.page || subItem.name}
                  to={createPageUrl(subItem.page)}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-colors"
                  style={{
                    background: active ? c.btnBg : 'transparent',
                    color: active ? c.text : c.textSub,
                  }}
                >
                  {Icon && <Icon className="w-5 h-5 flex-none" style={{ color: c.iconColor }} />}
                  <span className="flex-1 text-[1.04rem] font-semibold leading-tight tracking-[0.01em]">{subItem.name}</span>
                  <ChevronRight className="w-4 h-4" style={{ color: c.chevron }} />
                </Link>
              );
            })}
          </div>
          <div className="h-8" />
        </div>
      )}
    </div>,
    portalRoot
  );
}
