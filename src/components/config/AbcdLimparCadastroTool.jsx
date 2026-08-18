import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Eraser, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  executarLimparAbcdJobCadastro,
  previewLimparAbcdJobCadastro,
} from '@/lib/limparAbcdJobCadastro';

/**
 * Remove abcd gravado pelo job (produto.abcd no SQL).
 * Admin only. Corre lotes automaticamente (sem console).
 */
export default function AbcdLimparCadastroTool() {
  const [somenteD, setSomenteD] = useState(true);
  const [preview, setPreview] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const carregarPreview = async () => {
    setError(null);
    setDone(null);
    try {
      const data = await previewLimparAbcdJobCadastro(somenteD);
      setPreview(data);
    } catch (err) {
      setError(err?.message || 'Não foi possível consultar a base.');
      setPreview(null);
    }
  };

  const executar = async () => {
    setError(null);
    setDone(null);
    setRunning(true);
    setProgress({ passo: 0, totalLimpos: 0, restantes: preview?.elegiveis_limpeza });

    try {
      const result = await executarLimparAbcdJobCadastro({
        somenteD,
        onProgress: (p) => setProgress(p),
      });
      setDone(result);
      setPreview(null);
    } catch (err) {
      setError(err?.message || 'Falha ao limpar cadastro ABCD.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const elegiveis = preview?.elegiveis_limpeza ?? 0;

  return (
    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Eraser className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Limpar ABCD gravado pelo job</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Apaga a coluna <strong>abcd</strong> (e scores IEP) que o job noturno gravou no cadastro.
            Depois disso, o catálogo classifica <strong>ao vivo</strong> pelas vendas dos últimos 90 dias.
            Produtos com trava manual não são alterados.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={somenteD} onCheckedChange={(v) => setSomenteD(Boolean(v))} />
        <span>Só produtos com letra <strong>D</strong> (recomendado)</span>
      </label>

      {preview && !running && !done && (
        <div className="text-xs text-muted-foreground rounded-lg bg-card/60 px-3 py-2 space-y-1">
          <p>
            <strong>{elegiveis}</strong> produto(s) serão limpos
            {preview.com_trava_manual_preservados
              ? ` · ${preview.com_trava_manual_preservados} com trava manual preservados`
              : ''}
          </p>
          {preview.abcd_por_letra && (
            <p>
              No cadastro hoje: A {preview.abcd_por_letra.A} · B {preview.abcd_por_letra.B} · C{' '}
              {preview.abcd_por_letra.C} · D {preview.abcd_por_letra.D} · E {preview.abcd_por_letra.E}
            </p>
          )}
        </div>
      )}

      {running && progress && (
        <div className="text-xs text-muted-foreground rounded-lg bg-card/60 px-3 py-2 space-y-1">
          <p className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Lote {progress.passo} — {progress.totalLimpos} limpos
            {progress.restantes != null ? ` · faltam ~${progress.restantes}` : ''}
          </p>
        </div>
      )}

      {done && (
        <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-400 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Concluído — <strong>{done.totalLimpos}</strong> produto(s) limpos em {done.passos} lote(s).
            Recarregue o catálogo para ver a classificação ao vivo.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running}
          onClick={carregarPreview}
        >
          Ver quantos serão limpos
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={running || (preview != null && elegiveis === 0)}
          onClick={executar}
        >
          {running ? 'Limpando…' : 'Limpar automaticamente'}
        </Button>
      </div>
    </div>
  );
}
