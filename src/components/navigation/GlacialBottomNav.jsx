import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Search, 
  CalendarDays, 
  User, 
  Menu as MenuIcon 
} from 'lucide-react';
import { openGlobalSearch } from '@/lib/openGlobalSearch';

export default function GlacialBottomNav({ onMenuClick, onProfileClick, currentPageName, visible = true }) {
  const location = useLocation();

  const navItems = [
    { id: 'menu', icon: MenuIcon, label: 'Menu', action: 'menu' },
    { id: 'home', icon: Home, label: 'Início', page: 'Home', action: null },
    { id: 'search', icon: Search, label: 'Busca', action: 'search' },
    { id: 'notifications', icon: CalendarDays, label: 'Agenda', page: 'Notificacoes', action: null },
    { id: 'profile', icon: User, label: 'Perfil', action: 'profile' },
  ];

  const isActive = (item) => {
    if (item.page) return currentPageName === item.page || location.pathname.includes(item.page);
    return false;
  };

  const handleClick = (e, item) => {
    if (item.action === 'menu') {
      e.preventDefault();
      onMenuClick?.();
    } else if (item.action === 'search') {
      e.preventDefault();
      openGlobalSearch();
    } else if (item.action === 'profile') {
      e.preventDefault();
      onProfileClick?.();
    }
  };

  return (
    <nav 
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 desktop-layout:hidden bg-background/96 backdrop-blur-xl border-t border-border/80 font-din-1451',
        'transition-transform duration-300 ease-out will-change-transform',
        !visible && 'translate-y-full pointer-events-none'
      )}
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -6px 24px -12px rgba(0,0,0,0.18)'
      }}
      aria-hidden={!visible}
    >
      <div className="flex items-stretch h-[68px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          const content = (
            <div className="flex flex-col items-center justify-center gap-1 w-full h-full pt-1">
              <div
                className={`h-0.5 w-8 rounded-full transition-all duration-200 ${
                  active ? 'bg-[#4a5240]/65 dark:bg-[#a4ce33]/60' : 'bg-transparent'
                }`}
              />
              <div className="flex items-center justify-center w-12 h-7">
                <Icon 
                  className={`transition-all duration-200 ${
                    active 
                      ? 'w-5 h-5 text-foreground stroke-[2]' 
                      : 'w-5 h-5 text-muted-foreground stroke-[1.75]'
                  }`} 
                />
              </div>
              <span 
                className={`text-xs font-medium transition-colors duration-200 ${
                  active 
                    ? 'text-foreground' 
                    : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </div>
          );

          if (item.action) {
            const isSearch = item.action === 'search';
            return (
              <button
                key={item.id}
                type="button"
                {...(isSearch
                  ? {
                      onTouchStart: (e) => {
                        e.preventDefault();
                        handleClick(e, item);
                      },
                    }
                  : {
                      onMouseDown: (e) => handleClick(e, item),
                      onClick: (e) => handleClick(e, item),
                    })}
                className="flex-1 relative touch-manipulation"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              to={createPageUrl(item.page)}
              className="flex-1 relative"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}