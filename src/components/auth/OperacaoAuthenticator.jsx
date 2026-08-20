import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle, KeyRound, Shield, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { gerenciarPin } from '@/functions/gerenciarPin';
import PinSetupDialog from './PinSetupDialog';
import {
    OPERACAO_AUTH_ENABLED,
    OPERACAO_AUTH_PHOTO_ENABLED,
    buildBypassAuthPayload,
    makeOperationCode,
} from './operacaoAuthFlags';

export default function OperacaoAuthenticator({ isOpen, onClose, onSuccess, operationName = "Nova Operação" }) {
    const bypassedForOpen = useRef(false);

    const [step, setStep] = useState(OPERACAO_AUTH_PHOTO_ENABLED ? 'camera' : 'pin'); // camera | pin | need_setup
    const [stream, setStream] = useState(null);
    const [photoData, setPhotoData] = useState(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [operationCode, setOperationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showPinSetup, setShowPinSetup] = useState(false);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const inputRef = useRef(null);

    // adormecido — sem modal: sucesso imediato para o fluxo do pai continuar
    useEffect(() => {
        if (!isOpen) {
            bypassedForOpen.current = false;
            return;
        }
        if (OPERACAO_AUTH_ENABLED) return;
        if (bypassedForOpen.current) return;
        bypassedForOpen.current = true;

        let cancelled = false;
        (async () => {
            const payload = await buildBypassAuthPayload(() => base44.auth.me());
            if (cancelled) return;
            onSuccess?.(payload);
            onClose?.();
        })();

        return () => { cancelled = true; };
    }, [isOpen, onSuccess, onClose]);

    useEffect(() => {
        if (!OPERACAO_AUTH_ENABLED || !isOpen) {
            if (!isOpen) stopCamera();
            return;
        }

        const code = makeOperationCode();
        setOperationCode(code);
        setPhotoData(null);
        setPin('');
        setError('');

        base44.auth.me().then((u) => {
            setCurrentUser(u);
            if (!OPERACAO_AUTH_PHOTO_ENABLED) {
                setStep(u?.pin_definido ? 'pin' : 'need_setup');
            }
        }).catch(() => {
            if (!OPERACAO_AUTH_PHOTO_ENABLED) setStep('pin');
        });

        if (OPERACAO_AUTH_PHOTO_ENABLED) {
            setStep('camera');
            startCamera();
        } else {
            stopCamera();
        }

        return () => stopCamera();
    }, [isOpen]);

    useEffect(() => {
        if (step === 'pin') {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [step]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: false 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Não foi possível acessar a câmera. Verifique as permissões.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const userName = currentUser?.full_name || 'Usuário Desconhecido';
        const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        
        const gradient = context.createLinearGradient(0, canvas.height - 100, 0, canvas.height);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, "rgba(0,0,0,0.8)");
        context.fillStyle = gradient;
        context.fillRect(0, canvas.height - 100, canvas.width, 100);

        context.font = 'bold 16px "DIN 1451", DINish, system-ui, sans-serif';
        context.fillStyle = "#ffffff";
        context.textAlign = "left";
        context.shadowColor = "rgba(0,0,0,0.5)";
        context.shadowBlur = 4;

        const padding = 20;
        context.fillText(`Op: ${operationCode}`, padding, canvas.height - 50);
        context.fillText(`User: ${userName}`, padding, canvas.height - 30);
        context.fillText(`Data: ${timestamp}`, padding, canvas.height - 10);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoData(dataUrl);
        stopCamera();

        // Verificar se usuário tem PIN cadastrado
        if (!currentUser?.pin_definido) {
            setStep('need_setup');
        } else {
            setStep('pin');
        }
    };

    const handlePinSubmit = async () => {
        if (pin.length < 6) {
            setError('PIN deve ter 6 dígitos.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await gerenciarPin({ operacao: 'verify_pin', pin });

            if (!res.data?.sucesso) {
                throw new Error(res.data?.error || 'PIN incorreto.');
            }

            let evidenceUrl = null;
            if (OPERACAO_AUTH_PHOTO_ENABLED && photoData) {
                const blob = await (await fetch(photoData)).blob();
                const file = new File([blob], `auth_${operationCode}.jpg`, { type: 'image/jpeg' });
                const uploadResult = await base44.integrations.Core.UploadFile({ file });
                if (!uploadResult?.file_url) throw new Error('Erro ao salvar evidência fotográfica.');
                evidenceUrl = uploadResult.file_url;
            }

            const name = currentUser?.full_name;
            onSuccess({
                operationCode,
                userId: currentUser?.id,
                userName: name,
                intervenienteName: name,
                intervenienteId: currentUser?.id,
                evidenceUrl,
                timestamp: new Date().toISOString()
            });
            onClose();

        } catch (err) {
            setError(err?.response?.data?.error || err.message || 'Erro na autenticação.');
            setPin('');
            setTimeout(() => inputRef.current?.focus(), 50);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setPin('');
        setError('');
        if (OPERACAO_AUTH_PHOTO_ENABLED) {
            setStep('camera');
            setPhotoData(null);
            startCamera();
        } else {
            setStep(currentUser?.pin_definido ? 'pin' : 'need_setup');
        }
    };

    const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

    if (!OPERACAO_AUTH_ENABLED) return null;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-card border-none shadow-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-glacial text-foreground">
                        <KeyRound className="w-5 h-5 text-indigo-600" />
                        Autenticação de Operação
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {operationName} — <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{operationCode}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-2">

                    {/* Step: Camera */}
                    {step === 'camera' && (
                        <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-inner">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                <button
                                    onClick={takePhoto}
                                    className="rounded-full w-16 h-16 bg-card/20 hover:bg-card/40 border-2 border-white backdrop-blur-sm flex items-center justify-center transition-all active:scale-90"
                                >
                                    <div className="w-12 h-12 bg-card rounded-full" />
                                </button>
                            </div>
                            {error && (
                                <div className="absolute top-3 left-3 right-3 bg-red-500/90 rounded-xl px-3 py-2 text-white text-xs">{error}</div>
                            )}
                        </div>
                    )}

                    {/* Step: Precisa configurar PIN */}
                    {step === 'need_setup' && (
                        <div className="w-full flex flex-col items-center gap-4 py-4 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                                <Shield className="w-8 h-8 text-amber-500" />
                            </div>
                            <div>
                                <p className="font-medium text-foreground text-base">PIN não configurado</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                    Você precisa definir um PIN de 6 dígitos antes de autorizar operações.
                                </p>
                            </div>
                            <Button
                                onClick={() => setShowPinSetup(true)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground gap-2"
                            >
                                Configurar PIN agora
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            {OPERACAO_AUTH_PHOTO_ENABLED && (
                                <button onClick={reset} className="text-xs text-muted-foreground hover:text-muted-foreground">Tirar nova foto</button>
                            )}
                        </div>
                    )}

                    {/* Step: PIN */}
                    {step === 'pin' && (
                        <div className="w-full space-y-4">
                            {OPERACAO_AUTH_PHOTO_ENABLED && photoData && (
                            <div className="w-full h-24 rounded-xl overflow-hidden relative">
                                <img src={photoData} alt="Evidência" className="w-full h-full object-cover opacity-70" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <button onClick={reset} className="absolute bottom-2 right-2 text-white/70 text-xs hover:text-white flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Nova foto
                                </button>
                            </div>
                            )}

                            <div className="flex justify-center gap-3 py-2">
                                {dots.map((filled, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full transition-all duration-150 ${
                                        filled ? 'bg-primary dark:bg-card scale-110' : 'bg-muted'
                                    }`} />
                                ))}
                            </div>

                            <div className="px-2">
                                <input
                                    ref={inputRef}
                                    type="password"
                                    inputMode="numeric"
                                    value={pin}
                                    onChange={e => { setError(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                                    onKeyDown={e => e.key === 'Enter' && pin.length === 6 && handlePinSubmit()}
                                    className="w-full h-14 rounded-2xl bg-muted/50 border-0 text-center text-2xl tracking-[0.6em] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring"
                                    maxLength={6}
                                    placeholder="••••••"
                                    autoComplete="one-time-code"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center justify-center gap-1.5 text-red-500 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-muted-foreground">
                        Cancelar
                    </Button>
                    {step === 'pin' && (
                        <Button
                            onClick={handlePinSubmit}
                            disabled={loading || pin.length < 6}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground min-w-[120px]"
                        >
                            {loading ? (
                                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Validando...</>
                            ) : (
                                <><CheckCircle className="w-4 h-4 mr-2" />Confirmar</>
                            )}
                        </Button>
                    )}
                </DialogFooter>

                <canvas ref={canvasRef} className="hidden" />
            </DialogContent>
        </Dialog>

        {/* Setup de PIN (se usuário não tem) */}
        <PinSetupDialog
            isOpen={showPinSetup}
            onClose={() => {
                setShowPinSetup(false);
                // Recarregar user para verificar se definiu o PIN
                base44.auth.me().then(u => {
                    setCurrentUser(u);
                    if (u?.pin_definido) setStep('pin');
                }).catch(() => {});
            }}
            user={currentUser}
        />
        </>
    );
}