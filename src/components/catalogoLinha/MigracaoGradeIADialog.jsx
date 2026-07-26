import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sparkles, StopCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { fetchLinhasCompra, fetchProdutosCompraByLinha } from '@/lib/produtoGradeCompra/fetchGradeCompra';
import {
  buildGradeMigrationPrompt,
  produtoSemLinhaCompra,
  resolveGradeIAUpdate,
} from '@/lib/produtoGradeCompra/catalogoGradeIA';
import { applyGradeIAAssignment } from '@/lib/produtoGradeCompra/applyGradeIAAssignment';

const BATCH_SIZE = 8;
const DIALOG_Z = 'z-[100]';

export default function MigracaoGradeIADialog({
  products = [],
  open,
  onOpenChange,
  onComplete,
  hideTrigger = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [abortController, setAbortController] = useState(null);
  const [somenteAltaConfianca, setSomenteAltaConfianca] = useState(true);
  const [catalogo, setCatalogo] = useState({ linhas: [], produtosCompra: [] });
  const [catalogoReady, setCatalogoReady] = useState(false);
  const prepareRef = useRef(0);
  const { toast } = useToast();

  const supabaseOk = isSupabaseBrowserConfigured();
  const isControlled = typeof open === 'boolean';
  const isDialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange : setIsOpen;

  const pendentes = useMemo(
    () => (products || []).filter(produtoSemLinhaCompra),
    [products],
  );

  useEffect(() => {
    if (!isDialogOpen) {
      prepareRef.current += 1;
      setLogs([]);
      setProgress(0);
      setProcessedCount(0);
      setCatalogoReady(false);
      setCatalogo({ linhas: [], produtosCompra: [] });
      setIsPreparing(false);
      return;
    }

    if (!supabaseOk || catalogoReady || isProcessing) return;

    const runId = prepareRef.current + 1;
    prepareRef.current = runId;
    setIsPreparing(true);

    (async () => {
      try {
        const linhas = await fetchLinhasCompra();
        const pcs = [];
        for (const l of linhas) {
          const rows = await fetchProdutosCompraByLinha(l.id);
          pcs.push(...rows);
        }
        if (prepareRef.current !== runId) return;
        setCatalogo({ linhas, produtosCompra: pcs });
        setCatalogoReady(true);
      } catch (error) {
        if (prepareRef.current !== runId) return;
        toast({
          title: 'Erro ao carregar linhas',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        if (prepareRef.current !== runId) return;
        setIsPreparing(false);
      }
    })();
  }, [isDialogOpen, catalogoReady, isProcessing, supabaseOk, toast]);

  const appendLog = (msg) => setLogs((prev) => [msg, ...prev]);

  const processBatch = async (batch, linhas) => {
    const prompt = buildGradeMigrationPrompt(batch, catalogo);

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                acao: { type: 'string' },
                linha_codigo: { type: 'string' },
                linha_nome: { type: 'string' },
                linha_tipo: { type: 'string' },
                produto_compra_nome: { type: 'string' },
                eixo_a: { type: 'string' },
                eixo_b: { type: 'string' },
                eixo_a_rotulo: { type: 'string' },
                eixo_b_rotulo: { type: 'string' },
                confianca: { type: 'string' },
                motivo_curto: { type: 'string' },
              },
              required: ['id'],
            },
          },
        },
        required: ['updates'],
      },
    });

    if (!response?.updates?.length) return { applied: 0, skipped: batch.length };

    let applied = 0;
    let skipped = 0;

    for (const update of response.updates) {
      const original = batch.find((p) => p.id === update.id);
      if (!original) {
        skipped += 1;
        continue;
      }

      const resolved = resolveGradeIAUpdate(update, linhas);
      if (resolved.skip) {
        skipped += 1;
        appendLog(`— ${original.nome}: ${update.acao || 'ignorar'}`);
        continue;
      }
      if (!resolved.ok) {
        skipped += 1;
        appendLog(`⚠ ${original.nome}: ${resolved.reason}`);
        continue;
      }

      if (somenteAltaConfianca && resolved.patch.confianca !== 'alta') {
        skipped += 1;
        appendLog(`◌ ${original.nome}: confiança ${resolved.patch.confianca} (só alta activa)`);
        continue;
      }

      try {
        const { produtoPatch } = await applyGradeIAAssignment(original, resolved.patch);
        await base44.entities.Produto.update(original.id, produtoPatch);
        applied += 1;
        appendLog(
          `✓ ${original.nome} → ${resolved.patch.linha_codigo} / ${resolved.patch.produto_compra_nome}`,
        );
      } catch (err) {
        skipped += 1;
        appendLog(`✗ ${original.nome}: ${err.message}`);
      }
    }

    return { applied, skipped };
  };

  const handleMigrate = async () => {
    if (!pendentes.length) {
      toast({ title: 'Nenhum produto pendente', variant: 'destructive' });
      return;
    }
    if (!catalogoReady) {
      toast({ title: 'A carregar catálogo de linhas…', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setLogs([]);

    const controller = new AbortController();
    setAbortController(controller);

    const batches = [];
    for (let i = 0; i < pendentes.length; i += BATCH_SIZE) {
      batches.push(pendentes.slice(i, i + BATCH_SIZE));
    }

    let appliedTotal = 0;
    let linhasRef = [...catalogo.linhas];

    try {
      for (let i = 0; i < batches.length; i++) {
        if (controller.signal.aborted) break;

        appendLog(`Lote ${i + 1}/${batches.length} (${batches[i].length} produtos)…`);
        const { applied } = await processBatch(batches[i], linhasRef);
        appliedTotal += applied;
        setProcessedCount((i + 1) * BATCH_SIZE);
        setProgress(((i + 1) / batches.length) * 100);

        const freshLinhas = await fetchLinhasCompra();
        linhasRef = freshLinhas;
        setCatalogo((prev) => ({ ...prev, linhas: freshLinhas }));
      }

      if (!controller.signal.aborted) {
        toast({
          title: 'Migração IA concluída',
          description: `${appliedTotal} produto(s) atribuído(s) a linhas de compra.`,
        });
        onComplete?.();
        setDialogOpen?.(false);
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro na migração IA', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  if (!supabaseOk) return null;

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" size="sm" onClick={() => setDialogOpen?.(true)} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Migrar com IA
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(v) => { if (!isProcessing) setDialogOpen?.(v); }}>
        <DialogContent className={`sm:max-w-xl ${DIALOG_Z} dark:bg-background`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 p38-text-accent" />
              Migração para linha de compra (IA)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3 text-sm">
              <p>
                <strong>{pendentes.length}</strong>
                {' '}
                produto(s) sem linha de compra serão analisados em lotes de
                {' '}
                {BATCH_SIZE}
                .
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A IA usa hierarquia h1–h5 + nome para sugerir linha, produto de compra e eixos.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={somenteAltaConfianca}
                onCheckedChange={(v) => setSomenteAltaConfianca(v === true)}
                disabled={isProcessing}
              />
              <span>
                Aplicar só sugestões com <strong>confiança alta</strong>
                {' '}
                (recomendado na 1ª passagem)
              </span>
            </label>

            {isPreparing ? (
              <p className="text-xs text-muted-foreground">A carregar linhas existentes…</p>
            ) : null}

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="h-32 overflow-y-auto rounded border p-2 text-xs font-mono bg-muted/30">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {isProcessing ? (
              <Button variant="destructive" onClick={() => abortController?.abort()}>
                <StopCircle className="w-4 h-4 mr-2" />
                Parar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen?.(false)}>Fechar</Button>
                <Button
                  onClick={handleMigrate}
                  disabled={!pendentes.length || isPreparing || !catalogoReady}
                  className="p38-bg-accent text-white"
                >
                  Iniciar migração
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
