import { useEffect, useMemo, useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Grid3x3, StopCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import ProdutoGradeCompraFields from '@/components/produtos/ProdutoGradeCompraFields';
import { planGradeCompraMassaUpdates } from '@/lib/produtoGradeCompra/planGradeCompraMassa';
import {
  fetchEixoValores,
  fetchLinhasCompra,
  fetchProdutosCompraByLinha,
} from '@/lib/produtoGradeCompra/fetchGradeCompra';

const BATCH_SIZE = 10;
const PREVIEW_LIMIT = 8;

const EMPTY_GRADE = {
  linha_compra_id: '',
  produto_compra_id: '',
  eixo_a_valor_id: '',
  eixo_b_valor_id: '',
  eixo_a_texto: '',
  eixo_b_texto: '',
  no_mix_ativo: false,
  celula_obrigatoria: false,
};

export default function MassGradeCompraDialog({
  products = [],
  onComplete,
  open,
  onOpenChange,
  hideTrigger = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('config');
  const [gradeForm, setGradeForm] = useState(EMPTY_GRADE);
  const [somenteSemLinha, setSomenteSemLinha] = useState(true);
  const [manterEixosExistentes, setManterEixosExistentes] = useState(true);
  const [atualizarNome, setAtualizarNome] = useState(true);
  const [linhas, setLinhas] = useState([]);
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [eixosA, setEixosA] = useState([]);
  const [eixosB, setEixosB] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [abortController, setAbortController] = useState(null);
  const { toast } = useToast();

  const supabaseOk = isSupabaseBrowserConfigured();
  const isControlled = typeof open === 'boolean';
  const isDialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange : setIsOpen;

  const linhaSel = useMemo(
    () => linhas.find((l) => l.id === gradeForm.linha_compra_id) || null,
    [linhas, gradeForm.linha_compra_id],
  );
  const produtoCompraSel = useMemo(
    () => produtosCompra.find((p) => p.id === gradeForm.produto_compra_id) || null,
    [produtosCompra, gradeForm.produto_compra_id],
  );
  const eixoASel = eixosA.find((e) => e.id === gradeForm.eixo_a_valor_id) || null;
  const eixoBSel = eixosB.find((e) => e.id === gradeForm.eixo_b_valor_id) || null;

  useEffect(() => {
    if (!isDialogOpen || !supabaseOk) return;
    fetchLinhasCompra().then(setLinhas).catch(() => setLinhas([]));
  }, [isDialogOpen, supabaseOk]);

  useEffect(() => {
    if (!gradeForm.linha_compra_id || !supabaseOk) {
      setProdutosCompra([]);
      return;
    }
    fetchProdutosCompraByLinha(gradeForm.linha_compra_id).then(setProdutosCompra).catch(() => setProdutosCompra([]));
  }, [gradeForm.linha_compra_id, supabaseOk]);

  useEffect(() => {
    const usaGrelha = linhaSel?.tipo === 'linha_mix' || linhaSel?.tipo === 'portfolio';
    if (!supabaseOk || !usaGrelha || !gradeForm.linha_compra_id) {
      setEixosA([]);
      setEixosB([]);
      return;
    }
    const scope = {
      linhaId: gradeForm.linha_compra_id,
      produtoCompraId: gradeForm.produto_compra_id || undefined,
    };
    Promise.all([
      fetchEixoValores({ ...scope, eixo: 'A' }),
      fetchEixoValores({ ...scope, eixo: 'B' }),
    ])
      .then(([a, b]) => {
        setEixosA(a);
        setEixosB(b);
      })
      .catch(() => {
        setEixosA([]);
        setEixosB([]);
      });
  }, [gradeForm.linha_compra_id, gradeForm.produto_compra_id, linhaSel?.tipo, supabaseOk]);

  const plan = useMemo(() => {
    if (!gradeForm.linha_compra_id) return null;
    return planGradeCompraMassaUpdates(
      products,
      {
        linha: linhaSel,
        produtoCompra: produtoCompraSel,
        eixoA: eixoASel,
        eixoB: eixoBSel,
        eixoATexto: gradeForm.eixo_a_texto,
        eixoBTexto: gradeForm.eixo_b_texto,
        noMixAtivo: linhaSel?.tipo === 'portfolio' ? gradeForm.no_mix_ativo : undefined,
        celulaObrigatoria: linhaSel?.tipo === 'linha_mix' ? gradeForm.celula_obrigatoria : undefined,
      },
      { somenteSemLinha, manterEixosExistentes, atualizarNome },
    );
  }, [
    products,
    gradeForm,
    linhaSel,
    produtoCompraSel,
    eixoASel,
    eixoBSel,
    somenteSemLinha,
    manterEixosExistentes,
    atualizarNome,
  ]);

  const resetState = () => {
    setStep('config');
    setGradeForm(EMPTY_GRADE);
    setSomenteSemLinha(true);
    setManterEixosExistentes(true);
    setAtualizarNome(true);
    setIsProcessing(false);
    setProgress(0);
    setProcessedCount(0);
    setLogs([]);
    setAbortController(null);
  };

  const handleDialogChange = (nextOpen) => {
    if (isProcessing) return;
    if (!nextOpen) resetState();
    setDialogOpen?.(nextOpen);
  };

  const validateConfig = () => {
    if (!products.length) {
      toast({ title: 'Nenhum produto no filtro actual', variant: 'destructive' });
      return false;
    }
    if (!gradeForm.linha_compra_id) {
      toast({ title: 'Selecione a linha de compra', variant: 'destructive' });
      return false;
    }
    if (produtosCompra.length > 0 && !gradeForm.produto_compra_id) {
      toast({ title: 'Selecione o produto de compra', variant: 'destructive' });
      return false;
    }
    const usaGrelha = linhaSel?.tipo === 'linha_mix' || linhaSel?.tipo === 'portfolio';
    if (usaGrelha && !manterEixosExistentes) {
      const hasA = gradeForm.eixo_a_valor_id || String(gradeForm.eixo_a_texto || '').trim();
      const hasB = gradeForm.eixo_b_valor_id || String(gradeForm.eixo_b_texto || '').trim();
      if (!hasA || !hasB) {
        toast({
          title: 'Preencha os eixos da grelha',
          description: 'Ou active "Manter eixos já preenchidos" para só atribuir linha/produto de compra.',
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateConfig()) return;
    if (!plan?.updates.length) {
      toast({
        title: 'Nada a alterar',
        description: 'Todos os itens filtrados já estão com essa atribuição ou foram ignorados pelas opções.',
        variant: 'destructive',
      });
      return;
    }
    setStep('preview');
  };

  const handleApply = async () => {
    if (!plan?.updates.length) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setLogs([]);

    const controller = new AbortController();
    setAbortController(controller);

    const batches = [];
    for (let i = 0; i < plan.updates.length; i += BATCH_SIZE) {
      batches.push(plan.updates.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < batches.length; i++) {
        if (controller.signal.aborted) break;

        const batch = batches[i];
        setLogs((prev) => [`Processando lote ${i + 1}/${batches.length}...`, ...prev]);

        try {
          await Promise.all(
            batch.map(async (item) => {
              await base44.entities.Produto.update(item.produto.id, item.patch);
            }),
          );
          successCount += batch.length;
          setProcessedCount(successCount);
          setProgress(((i + 1) / batches.length) * 100);
        } catch (err) {
          errorCount += batch.length;
          setLogs((prev) => [`Erro no lote ${i + 1}: ${err.message}`, ...prev]);
        }
      }

      if (!controller.signal.aborted) {
        if (errorCount === 0) {
          setLogs((prev) => [`Concluído: ${successCount} produto(s) actualizado(s).`, ...prev]);
          toast({
            title: 'Grelha aplicada',
            description: `${successCount} produto(s) actualizado(s) com a linha de compra.`,
          });
          onComplete?.();
          handleDialogChange(false);
        } else {
          toast({
            title: 'Concluído com erros',
            description: `${successCount} ok, ${errorCount} com falha.`,
            variant: 'destructive',
          });
        }
      } else {
        setLogs((prev) => ['Operação cancelada.', ...prev]);
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao aplicar grelha', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const previewRows = plan?.updates.slice(0, PREVIEW_LIMIT) || [];

  if (!supabaseOk) {
    return null;
  }

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen?.(true)}
          disabled={!products.length}
          className="gap-2"
        >
          <Grid3x3 className="w-4 h-4" />
          <span className="hidden sm:inline">Linha de compra</span>
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-2xl dark:bg-background dark:text-foreground dark:border-border/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 p38-text-accent" />
              Atribuir linha de compra aos filtrados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3 text-sm">
              <p>
                Serão considerados os <strong>{products.length}</strong> produto(s) do filtro actual do catálogo.
              </p>
              {plan && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {plan.updates.length} serão alterados
                  {plan.skipped.sem_linha_necessaria > 0 ? ` · ${plan.skipped.sem_linha_necessaria} já com linha (ignorados)` : ''}
                  {plan.skipped.ja_na_linha > 0 ? ` · ${plan.skipped.ja_na_linha} já na mesma atribuição` : ''}
                </p>
              )}
            </div>

            {step === 'config' && (
              <div className="space-y-4">
                <ProdutoGradeCompraFields
                  formData={gradeForm}
                  onPatch={(patch) => setGradeForm((prev) => ({ ...prev, ...patch }))}
                  showAvulso={false}
                />

                <div className="space-y-3 rounded-lg border border-border/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Opções da atribuição</p>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={somenteSemLinha}
                      onCheckedChange={(v) => setSomenteSemLinha(v === true)}
                    />
                    <span>Só produtos ainda sem linha de compra</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={manterEixosExistentes}
                      onCheckedChange={(v) => setManterEixosExistentes(v === true)}
                    />
                    <span>Manter eixos já preenchidos em cada SKU (só atribuir linha / produto de compra)</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={atualizarNome}
                      onCheckedChange={(v) => setAtualizarNome(v === true)}
                    />
                    <span>Recalcular descrição do SKU com a grelha</span>
                  </label>
                </div>
              </div>
            )}

            {step === 'preview' && plan && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pré-visualização dos primeiros {Math.min(PREVIEW_LIMIT, plan.updates.length)} de {plan.updates.length} itens:
                </p>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome actual</TableHead>
                        <TableHead>Nome novo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((item) => (
                        <TableRow key={item.preview.id}>
                          <TableCell className="text-xs max-w-[180px] truncate" title={item.preview.nomeAtual}>
                            {item.preview.nomeAtual}
                          </TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate" title={item.preview.nomeNovo}>
                            {item.preview.nomeNovo}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>A gravar alterações...</span>
                  <span>{processedCount} / {plan?.updates.length || 0}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="h-24 rounded-md border p-2 text-xs font-mono bg-muted/50 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isProcessing ? (
              <Button variant="destructive" onClick={() => abortController?.abort()}>
                <StopCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            ) : step === 'preview' ? (
              <>
                <Button variant="outline" onClick={() => setStep('config')}>Voltar</Button>
                <Button onClick={handleApply} className="p38-bg-accent text-white hover:opacity-90">
                  Confirmar ({plan?.updates.length || 0} itens)
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleDialogChange(false)}>Fechar</Button>
                <Button onClick={handlePreview} disabled={!products.length || !gradeForm.linha_compra_id}>
                  Pré-visualizar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
