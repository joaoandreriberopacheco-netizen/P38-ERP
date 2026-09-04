import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import SafeActionButton from '@/components/ui/safe-action-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, X, Signature, Paperclip, Clock3, ChevronRight, Check, Camera, Mic, MicOff
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import ConsumoFormShell from './ConsumoFormShell';
import ConsumoItensDisplay from './ConsumoItensDisplay';

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// ── Mobile step indicator ──────────────────────────────────────────────────
function StepDots({ step, total = 3 }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < step ? 'bg-background dark:bg-card w-5' : i === step ? 'bg-muted-foreground/40 dark:bg-muted/400 w-5' : 'bg-muted w-2'
          }`}
        />
      ))}
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────
function Field({ label, children, actions }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        {actions}
      </div>
      {children}
    </div>
  );
}

function SpeechButton({ isListening, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-colors ${
        isListening
          ? 'bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-300'
          : 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90'
      }`}
      aria-label={isListening ? 'Parar gravação' : 'Falar observações'}
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

// ── Item card ──────────────────────────────────────────────────────────────
// ── DESKTOP: vertical single-column full form ──────────────────────────────
function DesktopForm({ formData, setFormData, turnos, destinacoes, responsaveis, setNovoCadastro, totalAtual, onOpenSelector, currentUser, onOpenAssinatura, onSubmit, onBack, attachedCount, photoCount, onAttachmentChange, onCameraChange, isListening, onToggleVoice, isSubmitting, observationsRef, attachmentInputKey }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      {/* Section: Dados */}
      <div className="rounded-3xl bg-card p-6 shadow-sm dark:bg-muted">
        <p className="mb-5 text-xl font-bold text-foreground">Dados do consumo</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Caixa ativo do dia">
            <Select value={formData.turno_caixa_id || undefined} onValueChange={(v) => setFormData((p) => ({ ...p, turno_caixa_id: v }))}>
              <SelectTrigger className="h-12 rounded-2xl border-0 bg-muted text-sm shadow-sm dark:bg-background">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {turnos.map((t) => <SelectItem key={t.id} value={t.id}>{t.conta_caixa_pdv_nome} · {t.numero}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Destinação">
            <div className="flex items-stretch gap-2 min-w-0">
              <SearchableSelect
                items={destinacoes || []}
                value={formData.destinacao}
                onChange={(v) => setFormData((p) => ({ ...p, destinacao: v }))}
                placeholder="Buscar destino"
                onAddNew={(name) => setNovoCadastro({ tipo: 'destinacao', valor: name })}
                displayField="nome"
                idField="id"
              />
              <Button type="button" variant="ghost" onClick={() => setNovoCadastro({ tipo: 'destinacao', valor: '' })} className="h-12 w-12 shrink-0 rounded-2xl bg-muted shadow-sm dark:bg-background">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          <Field label="Tags">
            <Input
              className="h-12 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background"
              placeholder="obra, manutenção..."
              onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
            />
          </Field>
          <Field label="Interveniente / quem recebeu">
            <div className="flex items-stretch gap-2 min-w-0">
              <SearchableSelect
                items={responsaveis || []}
                value={formData.responsavel_recebimento}
                onChange={(v) => setFormData((p) => ({ ...p, responsavel_recebimento: v }))}
                placeholder="Buscar interveniente"
                onAddNew={(name) => setNovoCadastro({ tipo: 'responsavel', valor: name })}
                displayField="nome"
                idField="id"
              />
              <Button type="button" variant="ghost" onClick={() => setNovoCadastro({ tipo: 'responsavel', valor: '' })} className="h-12 w-12 shrink-0 rounded-2xl bg-muted shadow-sm dark:bg-background">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>
        <Field label="Observações" actions={<SpeechButton isListening={isListening} onToggle={onToggleVoice} />}>
          <Textarea
            ref={observationsRef}
            className="mt-3 min-h-[80px] rounded-2xl border-0 bg-muted shadow-sm dark:bg-background"
            value={formData.observacoes}
            onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
          />
        </Field>
      </div>

      {/* Section: Itens */}
      <div className="relative">
        <ConsumoItensDisplay
          items={formData.itens}
          total={totalAtual}
          onRemove={(index) => setFormData((p) => ({ ...p, itens: p.itens.filter((_, j) => j !== index) }))}
        />
        <button
          type="button"
          onClick={onOpenSelector}
          className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground shadow-xl transition-transform hover:scale-105 dark:bg-card dark:text-foreground"
          aria-label="Adicionar item"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Section: Minuta */}
      <div className="rounded-3xl bg-card p-6 shadow-sm dark:bg-muted">
        <p className="mb-4 text-xl font-bold text-foreground">Minuta</p>
        <div className="grid grid-cols-3 gap-3">
          <Button type="button" variant="outline" onClick={onOpenAssinatura} className="h-14 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background">
            <Signature className="mr-2 h-4 w-4" />
            {formData.assinatura_recolhedor_nome ? `✓ ${formData.assinatura_recolhedor_nome}` : 'Coletar assinatura'}
          </Button>
          <label onClick={(e) => e.stopPropagation()} className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground shadow-sm dark:bg-background">
            <Camera className="h-4 w-4" />
            {photoCount > 0 ? `${photoCount} foto(s)` : 'Câmera'}
            <input key={`camera-${attachmentInputKey}`} id="consumo-camera-input" type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={onCameraChange} />
          </label>
          <label onClick={(e) => e.stopPropagation()} className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-muted text-sm text-muted-foreground shadow-sm dark:bg-background">
            <Paperclip className="h-4 w-4" />
            {attachedCount > 0 ? `${attachedCount} anexo(s)` : 'Anexo'}
            <input key={`attachment-${attachmentInputKey}`} id="consumo-anexo-input" type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={onAttachmentChange} />
          </label>
        </div>
        <div className="mt-4 rounded-2xl bg-muted/40 p-4 dark:bg-background">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" /> Resumo da minuta
          </div>
          <div className="space-y-1 text-sm text-foreground/90">
            <p><strong>Destinação:</strong> {formData.destinacao || '—'}</p>
            <p><strong>Interveniente:</strong> {formData.responsavel_recebimento || '—'}</p>
            <p><strong>Registrado por:</strong> {currentUser?.full_name || currentUser?.email || '—'}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="h-14 flex-1 rounded-2xl border-0 bg-card text-base shadow-sm dark:bg-muted">
          Cancelar
        </Button>
        <SafeActionButton type="button" onClick={onSubmit} isLoading={isSubmitting} loadingText="Processando..." className="h-14 flex-[2] rounded-2xl bg-primary text-base text-primary-foreground shadow-sm hover:bg-primary/90 dark:bg-card dark:text-foreground">
          Concluir
        </SafeActionButton>
      </div>
    </div>
  );
}

// ── MOBILE: PDV-style step flow ────────────────────────────────────────────
function MobileForm({ step, setStep, formData, setFormData, turnos, destinacoes, responsaveis, setNovoCadastro, totalAtual, onOpenSelector, currentUser, onOpenAssinatura, onSubmit, onBack, attachedCount, photoCount, onAttachmentChange, onCameraChange, isListening, onToggleVoice, isSubmitting, observationsRef, attachmentInputKey }) {

  // Step 0: Dados básicos
  if (step === 0) return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Caixa ativo do dia">
          <Select value={formData.turno_caixa_id || undefined} onValueChange={(v) => setFormData((p) => ({ ...p, turno_caixa_id: v }))}>
            <SelectTrigger className="h-14 rounded-2xl border-0 bg-muted text-base shadow-sm dark:bg-muted">
              <SelectValue placeholder="Selecione o caixa" />
            </SelectTrigger>
            <SelectContent>
              {turnos.map((t) => <SelectItem key={t.id} value={t.id}>{t.conta_caixa_pdv_nome} · {t.numero}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Destinação">
          <div className="flex items-stretch gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                items={destinacoes || []}
                value={formData.destinacao}
                onChange={(v) => setFormData((p) => ({ ...p, destinacao: v }))}
                placeholder="Buscar destino"
                onAddNew={(name) => setNovoCadastro({ tipo: 'destinacao', valor: name })}
                displayField="nome"
                idField="id"
              />
            </div>
            <button type="button" onClick={() => setNovoCadastro({ tipo: 'destinacao', valor: '' })} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted shadow-sm dark:bg-muted">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </Field>
        <Field label="Interveniente / quem recebeu">
          <div className="flex items-stretch gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <SearchableSelect
                items={responsaveis || []}
                value={formData.responsavel_recebimento}
                onChange={(v) => setFormData((p) => ({ ...p, responsavel_recebimento: v }))}
                placeholder="Buscar interveniente"
                onAddNew={(name) => setNovoCadastro({ tipo: 'responsavel', valor: name })}
                displayField="nome"
                idField="id"
              />
            </div>
            <button type="button" onClick={() => setNovoCadastro({ tipo: 'responsavel', valor: '' })} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted shadow-sm dark:bg-muted">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </Field>
        <Field label="Tags (opcional)">
          <Input className="h-14 rounded-2xl border-0 bg-muted text-base shadow-sm dark:bg-muted" placeholder="obra, manutenção..." onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
        </Field>
        <Field label="Observações (opcional)" actions={<SpeechButton isListening={isListening} onToggle={onToggleVoice} />}>
          <Textarea ref={observationsRef} className="rounded-2xl border-0 bg-muted text-base shadow-sm dark:bg-muted" value={formData.observacoes} onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))} />
        </Field>
      </div>
      <div className="shrink-0 border-t border-border/40 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] dark:border-border/40 dark:bg-background">
        <button type="button" onClick={() => setStep(1)} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm dark:bg-card dark:text-foreground">
          Próximo <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  // Step 1: Itens
  if (step === 1) return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="relative">
          <ConsumoItensDisplay
            items={formData.itens}
            total={totalAtual}
            compact
            onRemove={(index) => setFormData((p) => ({ ...p, itens: p.itens.filter((_, j) => j !== index) }))}
          />
          <button
            type="button"
            onClick={onOpenSelector}
            className="absolute bottom-5 right-5 flex h-16 w-16 items-center justify-center rounded-full bg-card text-foreground shadow-xl transition-transform active:scale-95 dark:bg-card dark:text-foreground"
            aria-label="Adicionar item"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div className="shrink-0 border-t border-border/40 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] dark:border-border/40 dark:bg-background">
        <div className="mb-3 flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span>{formData.itens.length} item(ns)</span>
          <span className="text-lg font-bold text-foreground">{fmt(totalAtual)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setStep(0)} className="flex h-14 items-center justify-center rounded-2xl bg-muted text-base font-semibold text-foreground/90 dark:bg-muted dark:text-foreground">
            Voltar
          </button>
          <button type="button" onClick={() => setStep(2)} className="flex h-14 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground dark:bg-card dark:text-foreground">
            Próximo <ChevronRight className="ml-1 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  // Step 2: Minuta
  if (step === 2) return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <button type="button" onClick={onOpenAssinatura} className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-muted text-base font-semibold text-foreground/90 shadow-sm dark:bg-muted dark:text-foreground">
          <Signature className="h-5 w-5" />
          {formData.assinatura_recolhedor_nome ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> {formData.assinatura_recolhedor_nome}</span>
          ) : 'Coletar assinatura'}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <label onClick={(e) => e.stopPropagation()} className="flex h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-muted text-base font-semibold text-foreground/90 shadow-sm dark:bg-muted dark:text-foreground">
            <Camera className="h-5 w-5" />
            {photoCount > 0 ? `${photoCount} foto(s)` : 'Câmera'}
            <input key={`camera-mobile-${attachmentInputKey}`} id="consumo-camera-input" type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={onCameraChange} />
          </label>
          <label onClick={(e) => e.stopPropagation()} className="flex h-16 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-muted text-base font-semibold text-foreground/90 shadow-sm dark:bg-muted dark:text-foreground">
            <Paperclip className="h-5 w-5" />
            {attachedCount > 0 ? `${attachedCount} anexo(s)` : 'Anexo'}
            <input key={`attachment-mobile-${attachmentInputKey}`} id="consumo-anexo-input" type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={onAttachmentChange} />
          </label>
        </div>
        <div className="rounded-2xl bg-muted/40 p-5 dark:bg-muted">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" /> Resumo
          </div>
          <div className="space-y-2 text-base text-foreground/90">
            <p><span className="font-semibold">Destinação:</span> {formData.destinacao || '—'}</p>
            <p><span className="font-semibold">Interveniente:</span> {formData.responsavel_recebimento || '—'}</p>
            <p><span className="font-semibold">Total:</span> {fmt(totalAtual)}</p>
            <p><span className="font-semibold">Itens:</span> {formData.itens.length}</p>
            <p><span className="font-semibold">Registrado por:</span> {currentUser?.full_name || '—'}</p>
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-border/40 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] dark:border-border/40 dark:bg-background">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setStep(1)} className="flex h-16 items-center justify-center rounded-2xl bg-muted text-base font-semibold text-foreground/90 dark:bg-muted dark:text-foreground">
            Voltar
          </button>
          <SafeActionButton type="button" onClick={onSubmit} isLoading={isSubmitting} loadingText="Processando..." className="flex h-16 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground dark:bg-card dark:text-foreground">
            Concluir
          </SafeActionButton>
        </div>
      </div>
    </div>
  );

  return null;
}

// ── Main exported component ────────────────────────────────────────────────
export default function ConsumoInternoFormPage({
  onBack,
  formData, setFormData,
  turnos, destinacoes, responsaveis,
  setNovoCadastro,
  totalAtual,
  onOpenSelector,
  currentUser,
  onOpenAssinatura,
  onSubmit,
  isSubmitting = false,
}) {
  const [attachedCount, setAttachedCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const attachmentInputKey = `${attachedCount}-${photoCount}`;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const observationsRef = useRef(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  const handleAttachmentChange = (e) => {
    e.stopPropagation();
    const files = Array.from(e.target.files || []);
    setAttachedCount(files.length);
    setFormData((prev) => ({ ...prev, anexos_temporarios: files }));
  };

  const handleCameraChange = (e) => {
    e.stopPropagation();
    const files = Array.from(e.target.files || []);
    setPhotoCount(files.length);
    setFormData((prev) => ({ ...prev, fotos_temporarias: files }));
  };

  const handleToggleVoice = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    observationsRef.current?.focus?.();

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      let partialTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const texto = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript = `${finalTranscript} ${texto}`.trim();
        } else {
          partialTranscript = `${partialTranscript} ${texto}`.trim();
        }
      }

      const textoCompleto = `${finalTranscript} ${partialTranscript}`.trim();

      setFormData((prev) => ({
        ...prev,
        observacoes: textoCompleto || prev.observacoes,
      }));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <ConsumoFormShell
      onBack={onBack}
      desktop={(
        <div className="h-full overflow-y-auto p-6">
          <DesktopForm
            formData={formData}
            setFormData={setFormData}
            turnos={turnos}
            destinacoes={destinacoes}
            responsaveis={responsaveis}
            setNovoCadastro={setNovoCadastro}
            totalAtual={totalAtual}
            onOpenSelector={onOpenSelector}
            currentUser={currentUser}
            onOpenAssinatura={onOpenAssinatura}
            onSubmit={onSubmit}
            onBack={onBack}
            attachedCount={attachedCount}
            photoCount={photoCount}
            onAttachmentChange={handleAttachmentChange}
            onCameraChange={handleCameraChange}
            isListening={isListening}
            onToggleVoice={handleToggleVoice}
            isSubmitting={isSubmitting}
            observationsRef={observationsRef}
            attachmentInputKey={attachmentInputKey}
          />
        </div>
      )}
      mobile={({ mobileStep, setMobileStep }) => (
        <div className="flex h-full flex-col overflow-hidden">
          <MobileForm
            step={mobileStep}
            setStep={setMobileStep}
            formData={formData}
            setFormData={setFormData}
            turnos={turnos}
            destinacoes={destinacoes}
            responsaveis={responsaveis}
            setNovoCadastro={setNovoCadastro}
            totalAtual={totalAtual}
            onOpenSelector={onOpenSelector}
            currentUser={currentUser}
            onOpenAssinatura={onOpenAssinatura}
            onSubmit={onSubmit}
            onBack={onBack}
            attachedCount={attachedCount}
            photoCount={photoCount}
            onAttachmentChange={handleAttachmentChange}
            onCameraChange={handleCameraChange}
            isListening={isListening}
            onToggleVoice={handleToggleVoice}
            isSubmitting={isSubmitting}
            observationsRef={observationsRef}
            attachmentInputKey={attachmentInputKey}
          />
        </div>
      )}
    />
  );
}