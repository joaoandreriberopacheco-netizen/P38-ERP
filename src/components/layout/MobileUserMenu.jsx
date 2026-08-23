import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
import { User, LogOut, Settings, Sun, Moon, X, HelpCircle, Shield, RectangleHorizontal, Smartphone } from 'lucide-react';
import PinSetupDialog from '@/components/auth/PinSetupDialog';
import FontScaleControl from '@/components/accessibility/FontScaleControl';
import { usePreferredOrientation } from '@/hooks/usePreferredOrientation';
import { pulseSensor } from '@/lib/pulseSensor';

export default function MobileUserMenu({ darkMode, toggleDarkMode, externalOpen, onExternalClose }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const { landscape, toggle: toggleLandscape } = usePreferredOrientation();

  useEffect(() => {
    base44.auth.me().then(u => u && setUser(u)).catch(() => {});
  }, []);

  // Suporte a abertura externa (pelo BottomNav)
  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleClose = () => {
    setOpen(false);
    onExternalClose?.();
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?';

  return (
    <>
      {/* Drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl px-5 pt-5 pb-8 safe-area-container">
            {/* Handle */}
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-5" />

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-foreground/90 font-glacial">
                    {initials}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email || user.perfil || 'Admin'}</p>
                </div>
                <button
                  onClick={handleClose}
                  className="ml-auto w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Opções */}
            <div className="space-y-1">
              {/* Modo escuro */}
              <button
                onClick={() => { toggleDarkMode(); handleClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/40 dark:hover:bg-muted transition-colors"
              >
                {darkMode
                  ? <Sun className="w-5 h-5 text-muted-foreground" />
                  : <Moon className="w-5 h-5 text-muted-foreground" />
                }
                <span className="text-sm text-foreground/90">
                  {darkMode ? 'Modo Claro' : 'Modo Escuro'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { toggleLandscape(); handleClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/40 dark:hover:bg-muted transition-colors"
                {...pulseSensor('perfil.modo-paisagem')}
              >
                {landscape
                  ? <Smartphone className="w-5 h-5 text-muted-foreground" />
                  : <RectangleHorizontal className="w-5 h-5 text-muted-foreground" />
                }
                <span className="text-sm text-foreground/90">
                  {landscape ? 'Modo Retrato' : 'Modo Paisagem'}
                </span>
              </button>

              {/* Ajuda IA */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/40 dark:hover:bg-muted transition-colors"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground/90">Ajuda (IA)</span>
              </button>

              {/* Meu PIN */}
              <button
                onClick={() => { setShowPin(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/40 dark:hover:bg-muted transition-colors"
              >
                <Shield className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground/90">
                  {user?.pin_definido ? 'Alterar PIN' : 'Cadastrar PIN'}
                </span>
              </button>

              <div className="px-4 py-3.5 rounded-2xl bg-muted/50/80">
                <FontScaleControl compact />
              </div>

              {/* Divisor */}
              <div className="h-px bg-muted my-2" />

              {/* Configurações */}
              <button
                onClick={() => { navigate(createPageUrl('Configuracoes')); handleClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/40 dark:hover:bg-muted transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground/90">Configurações</span>
              </button>

              {/* Sair */}
              <button
                onClick={() => base44.auth.logout()}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                <span className="text-sm text-red-500">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}
      {showPin && (
        <PinSetupDialog
          isOpen={showPin}
          onClose={() => { setShowPin(false); base44.auth.me().then(u => u && setUser(u)).catch(()=>{}); }}
          user={user}
        />
      )}
    </>
  );
}