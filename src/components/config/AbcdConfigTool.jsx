import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { calcularIEP } from '@/functions/calcularIEP';

const BATCH_SIZE = 50;

/** @typedef {'idle' | 'preparing' | 'writing' | 'success' | 'empty' | 'error'} DialogPhase */

function normalizeJobResponse(resp) {
  const data = resp?.data ?? resp;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { mensagem: data };
    }
  }
  return data && typeof data === 'object' ? data : {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractInvokeError(error) {
  const msg = error?.message || String(error);
  const match = msg.match(/HTTP (\d+)/);
  if (match) {
    return msg.replace(/^.*?:\s*/, '').trim() || `Erro HTTP ${match[1]}`;
  }
  return msg;
}

export default function AbcdConfigTool() {
  const [running, setRunning] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** @type {[DialogPhase, React.Dispatch<React.SetStateAction<DialogPhase>>]} */
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({
    bloco: 0,
    totalBlocos: 0,
    atualizados: 0,
    totalPendentes: 0,
    etapa: '',
  });
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef(false);

  const resetDialog = () => {
    setPhase('idle');
    setProgress({ bloco: 0, totalBlocos: 0, atualizados: 0, totalPendentes: 0, etapa: '' });
    setResult(null);
    setErrorMessage('');
    abortRef.current = false;
  };

  const closeDialog = () => {
    if (running) return;
    setDialogOpen(false);
    resetDialog();
  };

  const runJob = async (somenteAbcdVazio) => {
    const key = somenteAbcdVazio ? 'vazios' : 'completo';
    setRunning(key);
    setDialogOpen(true);
    resetDialog();
    setPhase('preparing');
    setProgress((p) => ({
      ...p,
      etapa: 'Analisando vendas dos últimos 90 dias e calculando a curva ABCD…',
    }));

    try {
      setProgress((p) => ({
        ...p,
        etapa: 'Etapa 1: montando lista com vendas dos últimos 90 dias (sem outliers)…',
      }));

      const listarResp = await calcularIEP({
        fase: 'listar',
        somente_abcd_vazio: somenteAbcdVazio,
        modo: 'manual',
        batch_size: BATCH_SIZE,
      });
      const listado = normalizeJobResponse(listarResp);

      if (listado.error || listado.status === 'erro') {
        throw new Error(listado.error || 'Falha na etapa 1 (lista).');
      }

      if (listado.status === 'sem_alteracao' || listado.concluido) {
        setPhase('empty');
        setResult({
          mensagem: listado.mensagem || 'Nenhum produto pendente de atualização.',
          somente_abcd_vazio: somenteAbcdVazio,
        });
        return;
      }

      setProgress((p) => ({
        ...p,
        etapa: 'Etapa 2–3: ordenando por lucro e aplicando A / B / C / D / E…',
      }));

      const classificarResp = await calcularIEP({
        fase: 'classificar',
        run_id: listado.run_id,
        ...(listado.job_cache ? { job_cache: listado.job_cache } : {}),
        modo: 'manual',
      });
      const classificado = normalizeJobResponse(classificarResp);

      if (classificado.error || classificado.status === 'erro') {
        throw new Error(classificado.error || 'Falha na etapa 3 (classificação).');
      }

      if (classificado.concluido && (classificado.total_pendentes ?? 0) === 0) {
        setPhase('empty');
        setResult({
          mensagem: 'Nenhum produto para gravar após a classificação.',
          somente_abcd_vazio: somenteAbcdVazio,
        });
        return;
      }

      const jobCache = classificado.job_cache;
      const cacheNoServidor = Boolean(classificado.cache_no_servidor);
      if (!cacheNoServidor && (!jobCache?.run_id || !jobCache?.updates_by_id)) {
        throw new Error('Resposta incompleta do servidor. Republica a função calcularIEP no Base44.');
      }

      const runId = classificado.run_id || jobCache?.run_id;
      const totalPendentes = classificado.total_pendentes ?? jobCache?.produto_ids?.length ?? 0;
      const totalBlocos = classificado.total_blocos ?? Math.ceil(totalPendentes / BATCH_SIZE);
      let offset = 0;
      let totalAtualizados = 0;

      setPhase('writing');
      setProgress({
        bloco: 0,
        totalBlocos,
        atualizados: 0,
        totalPendentes,
        etapa: 'Etapa 4: gravando classificação nos produtos…',
      });

      while (offset < totalPendentes) {
        if (abortRef.current) {
          throw new Error('Operação cancelada.');
        }

        const gravarResp = await calcularIEP({
          fase: 'gravar',
          run_id: runId,
          ...(cacheNoServidor ? {} : { job_cache: jobCache }),
          offset,
          batch_size: BATCH_SIZE,
          modo: 'manual',
        });
        const bloco = normalizeJobResponse(gravarResp);

        if (bloco.error || bloco.status === 'erro') {
          throw new Error(bloco.error || 'Falha ao gravar um bloco de produtos.');
        }

        totalAtualizados += bloco.atualizados ?? 0;
        offset = bloco.proximo_offset ?? offset + BATCH_SIZE;

        setProgress({
          bloco: bloco.bloco_atual ?? Math.ceil(offset / BATCH_SIZE),
          totalBlocos: bloco.total_blocos ?? totalBlocos,
          atualizados: totalAtualizados,
          totalPendentes,
          etapa: 'Etapa 4: gravando classificação nos produtos…',
        });

        if (bloco.concluido) break;
        await sleep(150);
      }

      const finalResult = {
        status: 'sucesso',
        atualizados: totalAtualizados,
        total_pendentes: totalPendentes,
        total_blocos: totalBlocos,
        somente_abcd_vazio: somenteAbcdVazio,
        timestamp: new Date().toISOString(),
      };

      setResult(finalResult);
      setPhase('success');
    } catch (error) {
      setErrorMessage(extractInvokeError(error));
      setPhase('error');
    } finally {
      setRunning(null);
    }
  };

  const pct =
    progress.totalPendentes > 0
      ? Math.min(100, Math.round((progress.atualizados / progress.totalPendentes) * 100))
      : phase === 'preparing'
        ? 8
        : 0;

  return (
    <>
      <div className="rounded-2xl bg-muted/50/60 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <BarChart3 className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground/90">Curva ABCD / IEP</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Calcula a classificação com vendas dos últimos 90 dias e grava no cadastro SQL do produto
              (coluna <code className="text-[11px]">abcd</code>). O processamento roda em blocos de {BATCH_SIZE}{' '}
              produtos. Todo sábado à meia-noite (hora de Tabatinga) o job recalcula todos automaticamente;
              catálogo e dashboard leem essa coluna como fonte de verdade.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start dark:bg-card"
            disabled={running != null}
            onClick={() => runJob(true)}
          >
            {running === 'vazios' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Preencher produtos sem ABCD
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start dark:bg-card"
            disabled={running != null}
            onClick={() => runJob(false)}
          >
            {running === 'completo' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4 mr-2" />
            )}
            Recalcular todos os produtos
          </Button>
        </div>

        {result?.status === 'sucesso' && !dialogOpen && (
          <div className="rounded-xl bg-card/80 border border-border/40 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 text-foreground/90 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 p38-text-accent" />
              Última execução
            </div>
            <p>
              Atualizados: {result.atualizados ?? 0}
              {result.total_pendentes != null ? ` de ${result.total_pendentes} produtos` : ''}
            </p>
            {result.timestamp && (
              <p className="tabular-nums">{new Date(result.timestamp).toLocaleString('pt-BR')}</p>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="max-w-md bg-card border-0 shadow-2xl rounded-2xl"
          hideClose={running != null}
          onPointerDownOutside={(e) => {
            if (running) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (running) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {phase === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : phase === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              )}
              Curva ABCD / IEP
            </DialogTitle>
            <DialogDescription>
              {phase === 'preparing' && 'Etapas 1–3: lista, ordenação e classificação A/B/C/D.'}
              {phase === 'writing' && 'Etapa 4: gravando no cadastro de cada produto.'}
              {phase === 'success' && 'Processo concluído com sucesso.'}
              {phase === 'empty' && 'Nenhuma alteração necessária.'}
              {phase === 'error' && 'Não foi possível concluir a atualização.'}
            </DialogDescription>
          </DialogHeader>

          {(phase === 'preparing' || phase === 'writing') && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <p className="text-sm text-foreground/90">{progress.etapa}</p>
              </div>

              {phase === 'writing' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      Bloco {progress.bloco} de {progress.totalBlocos}
                    </span>
                    <span>
                      {progress.atualizados} / {progress.totalPendentes} produtos
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center tabular-nums">{pct}%</p>
                </div>
              )}

              {phase === 'preparing' && (
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-1/3 bg-primary/70 animate-pulse rounded-full" />
                </div>
              )}
            </div>
          )}

          {phase === 'success' && result && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {result.atualizados} produto(s) atualizado(s)
                {result.total_pendentes != null ? ` de ${result.total_pendentes}` : ''}.
              </p>
              <p className="text-xs text-muted-foreground">
                A curva ABCD e os scores IEP já estão gravados. O catálogo e os filtros A/B/C/D passam a
                usar esses valores.
              </p>
              {result.total_blocos != null && (
                <p className="text-xs text-muted-foreground">
                  Processado em {result.total_blocos} bloco(s) · janela de 90 dias
                </p>
              )}
            </div>
          )}

          {phase === 'empty' && (
            <div className="rounded-xl bg-muted/60 px-4 py-3">
              <p className="text-sm text-foreground/90">
                {result?.mensagem || 'Nenhum produto precisava de atualização.'}
              </p>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-foreground">Erro na atualização</p>
              <p className="text-xs text-muted-foreground break-words">{errorMessage}</p>
              <p className="text-[11px] text-muted-foreground">
                Se o erro persistir, confirme que a função <strong>calcularIEP</strong> foi publicada no
                Base44 com a versão mais recente.
              </p>
            </div>
          )}

          <DialogFooter>
            {phase === 'success' || phase === 'empty' || phase === 'error' ? (
              <Button type="button" onClick={closeDialog}>
                {phase === 'success' ? 'Concluir' : 'Fechar'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={!running}
                onClick={() => {
                  abortRef.current = true;
                }}
              >
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
