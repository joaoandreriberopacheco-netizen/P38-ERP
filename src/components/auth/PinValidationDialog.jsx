import React, { useState, useEffect, useRef } from 'react';
import { Shield, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { gerenciarPin } from '@/functions/gerenciarPin';
import { allowProgrammaticFocusBriefly, focusField } from '@/lib/focusPolicy';
import { OPERACAO_AUTH_ENABLED } from './operacaoAuthFlags';

/**
 * PinValidationDialog — Solicita o PIN do usuário logado para autorizar ações críticas.
 * 
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onSuccess: (userData) => void   — chamado após PIN válido
 *   operationName: string           — ex: "Cancelar Venda PV-00042"
 * 
 * Uso:
 *   <PinValidationDialog
 *     isOpen={showPin}
 *     onClose={() => setShowPin(false)}
 *     onSuccess={() => executarCancelamento()}
 *     operationName="Cancelar Venda"
 *   />
 */
export default function PinValidationDialog({
  isOpen,
  onClose,
  onSuccess,
  operationName = 'Operação Crítica',
  /** Quando true, exige PIN mesmo com auth global desligada (ex.: salvar pedido de compra). */
  forceEnabled = false,
  /** Teclado nativo do sistema (sem teclado virtual na tela). */
  useNativeKeyboard = false,
}) {
  const authActive = forceEnabled || OPERACAO_AUTH_ENABLED;
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const inputRef = useRef(null);
  const bypassedForOpen = useRef(false);

  // adormecido — mesmo flag que OperacaoAuthenticator; lote PedidosCompra segue sem PIN
  useEffect(() => {
    if (!isOpen) {
      bypassedForOpen.current = false;
      return;
    }
    if (authActive) {
      setPin(''); setErro(''); setEmailEnviado(false);
      allowProgrammaticFocusBriefly();
      const timer = window.setTimeout(() => {
        allowProgrammaticFocusBriefly();
        focusField(inputRef.current, { preventScroll: true });
      }, 150);
      return () => window.clearTimeout(timer);
    }
    if (bypassedForOpen.current) return;
    bypassedForOpen.current = true;
    onSuccess?.();
    onClose?.();
  }, [isOpen, onSuccess, onClose, authActive]);

  const handleValidar = async () => {
    if (pin.length < 6) return setErro('PIN deve ter 6 dígitos.');
    setLoading(true); setErro('');
    try {
      const res = await gerenciarPin({ operacao: 'verify_pin', pin });
      if (res.data?.sucesso) {
        onSuccess?.();
      } else {
        setErro(res.data?.error || 'PIN incorreto.');
        setPin('');
      }
    } catch (e) {
      setErro(e?.response?.data?.error || 'PIN incorreto.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleResetEmail = async () => {
    setEnviandoEmail(true);
    try {
      await gerenciarPin({ operacao: 'reset_pin_email' });
      setEmailEnviado(true);
    } catch (e) {
      setErro('Não foi possível enviar o e-mail.');
    } finally {
      setEnviandoEmail(false);
    }
  };

  // PIN numérico estilo teclado virtual — 4 dots
  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  if (!authActive) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="sm:max-w-xs bg-card border-none shadow-xl text-center">
        <DialogHeader>
          <div className="flex justify-center mb-1">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Shield className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          <DialogTitle className="font-glacial text-foreground text-center">
            {forceEnabled ? 'Digite sua senha' : 'Confirmação de Segurança'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs text-center">
            {operationName}
            {forceEnabled ? ' — PIN de 6 dígitos, sem foto.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-5">
          {useNativeKeyboard ? (
            <Input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => {
                setErro('');
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidar()}
              placeholder="6 dígitos"
              maxLength={6}
              className="h-14 text-center text-2xl font-din-1451 tracking-[0.35em]"
            />
          ) : (
            <>
              <div className="flex justify-center gap-3">
                {dots.map((filled, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${
                      filled
                        ? 'bg-primary dark:bg-card scale-110'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <input
                autoComplete="off"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setErro('');
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidar()}
                className="absolute opacity-0 w-0 h-0"
                maxLength={6}
              />

              <div className="grid grid-cols-3 gap-2 px-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((key, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (key === '⌫') {
                        setPin((p) => p.slice(0, -1));
                      } else if (key !== '') {
                        const next = (pin + key).slice(0, 6);
                        setPin(next);
                        setErro('');
                      }
                    }}
                    className={`h-12 rounded-xl text-lg font-medium transition-all active:scale-95 ${
                      key === ''
                        ? 'pointer-events-none'
                        : key === '⌫'
                          ? 'bg-muted text-muted-foreground text-sm'
                          : 'bg-muted/50 text-foreground hover:bg-muted'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </>
          )}

          {erro && (
            <div className="flex items-center justify-center gap-1.5 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {erro}
            </div>
          )}

          {emailEnviado && (
            <div className="flex items-center justify-center gap-1.5 text-green-600 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              PIN temporário enviado ao seu e-mail.
            </div>
          )}

          <Button
            onClick={handleValidar}
            disabled={loading || pin.length < 6}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground"
          >
            {loading ? 'Verificando...' : 'Confirmar'}
          </Button>

          <button
            onClick={handleResetEmail}
            disabled={enviandoEmail || emailEnviado}
            className="text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground flex items-center justify-center gap-1 w-full"
          >
            <Mail className="w-3 h-3" />
            {enviandoEmail ? 'Enviando...' : 'Esqueci meu PIN'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}