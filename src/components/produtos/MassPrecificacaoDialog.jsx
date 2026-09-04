import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SlidersHorizontal, StopCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/financialUtils';
import {
  PRECIFICACAO_MASSA_CAMPOS,
  parseValorCampo,
  planPrecificacaoMassaUpdates,
} from '@/lib/catalogPrecificacaoMassa';

const BATCH_SIZE = 10;
const PREVIEW_LIMIT = 8;

export default function MassPrecificacaoDialog({
  products = [],
  onComplete,
  open,
  onOpenChange,
  hideTrigger = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [campoId, setCampoId] = useState('preco_venda_percentual');
  const [valorInput, setValorInput] = useState('40');
  const [somenteSeDiferente, setSomenteSeDiferente] = useState(true);
  const [manterMarkup, setManterMarkup] = useState(true);
  const [step, setStep] = useState('config');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [abortController, setAbortController] = useState(null);
  const { toast } = useToast();

  const isControlled = typeof open === 'boolean';
  const isDialogOpen = isControlled ? open : isOpen;
  const setDialogOpen = isControlled ? onOpenChange : setIsOpen;

  const campoSelecionado = PRECIFICACAO_MASSA_CAMPOS.find((c) => c.id === campoId);
  const valorNovo = parseValorCampo(valorInput, campoSelecionado?.tipo);

  const plan = useMemo(() => {
    if (valorNovo === null) return null;
    return planPrecificacaoMassaUpdates(products, campoId, valorNovo, {
      somenteSeDiferente,
      manterMarkup: campoSelecionado?.isCusto ? manterMarkup : false,
    });
  }, [products, campoId, valorNovo, somenteSeDiferente, manterMarkup, campoSelecionado?.isCusto]);

  const resetState = () => {
    setStep('config');
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

  const handlePreview = () => {
    if (!products.length) {
      toast({ title: 'Nenhum produto no filtro atual', variant: 'destructive' });
      return;
    }
    if (valorNovo === null) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }
    if (!plan?.updates.length) {
      toast({
        title: 'Nada a alterar',
        description: 'Todos os itens filtrados já estão com esse valor ou não têm custo.',
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
          setLogs((prev) => [`Concluído: ${successCount} produto(s) atualizado(s).`, ...prev]);
          toast({
            title: 'Precificação aplicada',
            description: `${successCount} produto(s) atualizado(s).`,
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
      toast({ title: 'Erro ao aplicar', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleCancelProcessing = () => {
    abortController?.abort();
  };

  const previewRows = plan?.updates.slice(0, PREVIEW_LIMIT) || [];
  const sufixoValor = campoSelecionado?.tipo === 'percentual' ? '%' : 'R$';

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
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Precificação em massa</span>
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-2xl dark:bg-background dark:text-foreground dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 p38-text-accent" />
              Ajustar precificação nos filtrados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/40 bg-muted/40 p-3 text-sm">
              <p>
                Serão considerados os <strong>{products.length}</strong> produto(s) do filtro atual do catálogo.
              </p>
              {plan && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {plan.updates.length} serão alterados
                  {plan.skipped.sem_custo > 0 ? ` · ${plan.skipped.sem_custo} sem custo` : ''}
                  {plan.skipped.sem_alteracao > 0 ? ` · ${plan.skipped.sem_alteracao} já no valor` : ''}
                </p>
              )}
            </div>

            {step === 'config' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Campo a ajustar</Label>
                  <Select value={campoId} onValueChange={setCampoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRECIFICACAO_MASSA_CAMPOS.map((campo) => (
                        <SelectItem key={campo.id} value={campo.id}>
                          {campo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valor-precificacao">Novo valor</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="valor-precificacao"
                      inputMode="decimal"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      placeholder={campoSelecionado?.tipo === 'percentual' ? 'Ex: 5' : 'Ex: 12,50'}
                      className="max-w-[200px]"
                    />
                    <span className="text-sm text-muted-foreground">{sufixoValor}</span>
                  </div>
                </div>

                {campoSelecionado?.isCusto && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={manterMarkup}
                      onCheckedChange={(v) => setManterMarkup(v === true)}
                    />
                    <span>
                      Manter markup atual e recalcular o preço de venda
                    </span>
                  </label>
                )}

                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={somenteSeDiferente}
                    onCheckedChange={(v) => setSomenteSeDiferente(v === true)}
                  />
                  <span>
                    Só alterar produtos cujo valor for diferente do informado
                  </span>
                </label>
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
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Campo</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((item) => (
                        <TableRow key={item.preview.id}>
                          <TableCell className="text-xs max-w-[180px] truncate" title={item.preview.nome}>
                            {item.preview.nome}
                          </TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap">
                            {item.preview.valorAtual.toFixed(2)} → {item.preview.valorNovo.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap">
                            R$ {formatCurrency(item.preview.precoAntes)} → R$ {formatCurrency(item.preview.precoDepois)}
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
                  <span>Gravando alterações...</span>
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
              <Button variant="destructive" onClick={handleCancelProcessing}>
                <StopCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            ) : step === 'config' ? (
              <>
                <Button variant="outline" onClick={() => handleDialogChange(false)}>Fechar</Button>
                <Button onClick={handlePreview}>Pré-visualizar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep('config')} disabled={isProcessing}>
                  Voltar
                </Button>
                <Button onClick={handleApply} disabled={isProcessing || !plan?.updates.length}>
                  Aplicar a {plan?.updates.length || 0} produto(s)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
