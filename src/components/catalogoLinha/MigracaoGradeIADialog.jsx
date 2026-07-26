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
import { Progress } from '@/components/ui/progress';
import { ListTree, Sparkles, StopCircle } from 'lucide-react';
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
import { planMigracaoPorRegrasBatch } from '@/lib/produtoGradeCompra/migrarPorRegras';
import {
  describeInvokeLlmError,
  normalizeInvokeLlmJsonResponse,
} from '@/lib/invokeLLM/normalizeInvokeLlmResponse';

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
  const [migrationMode, setMigrationMode] = useState(null);
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
      setMigrationMode(null);
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

  const applyResolvedPatch = async (original, patch, linhasRef) => {
    if (somenteAltaConfianca && patch.confianca !== 'alta') {
      appendLog(`◌ ${original.nome}: confiança ${patch.confianca} (só alta activa)`);
      return { applied: 0, skipped: 1 };
    }

    const resolved = resolveGradeIAUpdate(
      { acao: 'atribuir', ...patch },
      linhasRef,
    );
    if (!resolved.ok || resolved.skip) {
      appendLog(`⚠ ${original.nome}: ${resolved.reason || 'ignorado'}`);
      return { applied: 0, skipped: 1 };
    }

    const { produtoPatch } = await applyGradeIAAssignment(original, resolved.patch);
    await base44.entities.Produto.update(original.id, produtoPatch);
    appendLog(
      `✓ ${original.nome} → ${resolved.patch.linha_codigo} / ${resolved.patch.produto_compra_nome}`,
    );
    return { applied: 1, skipped: 0 };
  };

  const processBatchIA = async (batch, linhas) => {
    const prompt = buildGradeMigrationPrompt(batch, catalogo);

    let raw;
    try {
      raw = await base44.integrations.Core.InvokeLLM({
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
    } catch (error) {
      throw new Error(describeInvokeLlmError(error));
    }

    const response = normalizeInvokeLlmJsonResponse(raw);
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

  const runMigration = async (mode) => {
    if (!pendentes.length) {
      toast({ title: 'Nenhum produto pendente', variant: 'destructive' });
      return;
    }
    if (!catalogoReady) {
      toast({ title: 'A carregar catálogo de linhas…', variant: 'destructive' });
      return;
    }

    setMigrationMode(mode);
    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setLogs([]);

    const controller = new AbortController();
    setAbortController(controller);

    let appliedTotal = 0;
    let linhasRef = [...catalogo.linhas];

    try {
      if (mode === 'regras') {
        appendLog(`Migração por regras (${pendentes.length} produtos)…`);
        const { updates, skipped } = planMigracaoPorRegrasBatch(pendentes);
        const total = updates.length + skipped.length;
        let done = 0;

        for (const { produto, patch } of updates) {
          if (controller.signal.aborted) break;
          try {
            const { applied } = await applyResolvedPatch(produto, patch, linhasRef);
            appliedTotal += applied;
          } catch (err) {
            appendLog(`✗ ${produto.nome}: ${err.message}`);
          }
          done += 1;
          setProcessedCount(done);
          setProgress((done / total) * 100);
        }

        for (const { produto, reason } of skipped) {
          if (controller.signal.aborted) break;
          appendLog(`— ${produto.nome}: ${reason}`);
          done += 1;
          setProcessedCount(done);
          setProgress((done / total) * 100);
        }

        const freshLinhas = await fetchLinhasCompra();
        linhasRef = freshLinhas;
        setCatalogo((prev) => ({ ...prev, linhas: freshLinhas }));
      } else {
        const batches = [];
        for (let i = 0; i < pendentes.length; i += BATCH_SIZE) {
          batches.push(pendentes.slice(i, i + BATCH_SIZE));
        }

        for (let i = 0; i < batches.length; i++) {
          if (controller.signal.aborted) break;

          appendLog(`Lote IA ${i + 1}/${batches.length} (${batches[i].length} produtos)…`);
          const { applied } = await processBatchIA(batches[i], linhasRef);
          appliedTotal += applied;
          setProcessedCount(Math.min((i + 1) * BATCH_SIZE, pendentes.length));
          setProgress(((i + 1) / batches.length) * 100);

          const freshLinhas = await fetchLinhasCompra();
          linhasRef = freshLinhas;
          setCatalogo((prev) => ({ ...prev, linhas: freshLinhas }));
        }
      }

      if (!controller.signal.aborted) {
        const label = mode === 'regras' ? 'por regras' : 'IA';
        toast({
          title: `Migração ${label} concluída`,
          description: `${appliedTotal} produto(s) atribuído(s) a linhas de compra.`,
        });
        onComplete?.();
        setDialogOpen?.(false);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: mode === 'regras' ? 'Erro na migração por regras' : 'Erro na migração IA',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      setMigrationMode(null);
    }
  };

  if (!supabaseOk) return null;

  return (
    <>
      {!hideTrigger && (
        <Button variant="outline" size="sm" onClick={() => setDialogOpen?.(true)} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Migrar catálogo
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(v) => { if (!isProcessing) setDialogOpen?.(v); }}>
        <DialogContent className={`sm:max-w-xl ${DIALOG_Z} dark:bg-background`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 p38-text-accent" />
              Migração para linha de compra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3 text-sm">
              <p>
                <strong>{pendentes.length}</strong>
                {' '}
                produto(s) sem linha de compra.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Migrar por regras</strong>
                {' '}
                usa h1–h5 (sem IA, recomendado).
                {' '}
                <strong>Migrar com IA</strong>
                {' '}
                precisa da Edge Function p38-core no Supabase.
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
                <p className="text-xs text-muted-foreground">
                  {processedCount}
                  {' '}
                  /
                  {' '}
                  {pendentes.length}
                  {' '}
                  —
                  {' '}
                  {migrationMode === 'regras' ? 'regras' : 'IA'}
                </p>
                <div className="h-32 overflow-y-auto rounded border p-2 text-xs font-mono bg-muted/30">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isProcessing ? (
              <Button variant="destructive" onClick={() => abortController?.abort()}>
                <StopCircle className="w-4 h-4 mr-2" />
                Parar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen?.(false)}>Fechar</Button>
                <Button
                  variant="secondary"
                  onClick={() => runMigration('regras')}
                  disabled={!pendentes.length || isPreparing || !catalogoReady}
                  className="gap-2"
                >
                  <ListTree className="w-4 h-4" />
                  Migrar por regras
                </Button>
                <Button
                  onClick={() => runMigration('ia')}
                  disabled={!pendentes.length || isPreparing || !catalogoReady}
                  className="p38-bg-accent text-white gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Migrar com IA
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
