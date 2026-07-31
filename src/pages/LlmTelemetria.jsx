import { useEffect, useState } from 'react';
import { fetchLlmTelemetryResumo } from '@/lib/llmTelemetryApi';
import { Button } from '@/components/ui/button';
import { Loader2, Activity, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

function formatUsd(value) {
  const n = Number(value) || 0;
  if (n < 0.01) return `US$ ${n.toFixed(4)}`;
  return `US$ ${n.toFixed(2)}`;
}

function formatTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

export default function LlmTelemetria() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const resumo = await fetchLlmTelemetryResumo(dias);
      setData(resumo);
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar telemetria.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dias]);

  const alertaTokens = Boolean(data?.alerta_tokens_altos);
  const alertaCatalogo = Boolean(data?.alerta_catalogo_no_prompt);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Telemetria de IA (OCR)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe tokens e custo estimado das leituras com Gemini. Meta saudável: abaixo de{' '}
            {formatTokens(data?.meta_saudavel_tokens || 12000)} tokens por chamada, sem catálogo no prompt.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              variant={dias === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDias(d)}
            >
              {d}d
            </Button>
          ))}
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <p className="mt-2 text-xs opacity-80">
            Se a migração 046 ainda não foi aplicada, corra npm run supabase:deploy.
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Chamadas" value={data.total_chamadas ?? 0} />
            <StatCard label="Tokens totais" value={formatTokens(data.total_tokens)} />
            <StatCard label="Média / chamada" value={formatTokens(data.media_tokens_por_chamada)} />
            <StatCard label="Custo estimado" value={formatUsd(data.custo_estimado_usd)} />
          </div>

          <div className="space-y-2">
            {alertaTokens && (
              <AlertRow
                variant="warn"
                text={`Média de tokens alta (${formatTokens(data.media_tokens_por_chamada)}). Próximo passo: tirar o catálogo do prompt e fazer matching local.`}
              />
            )}
            {alertaCatalogo && (
              <AlertRow
                variant="warn"
                text={`Ainda há chamadas com catálogo no prompt (média ${data.media_produtos_catalogo_no_prompt} produtos). Isso aumenta muito o custo.`}
              />
            )}
            {!alertaTokens && !alertaCatalogo && Number(data.total_chamadas) > 0 && (
              <AlertRow variant="ok" text="Uso dentro da meta saudável — poucos centavos por leitura." />
            )}
            {Number(data.total_chamadas) === 0 && (
              <AlertRow variant="ok" text="Ainda sem registos neste período. Use Importar pedido para gerar a primeira leitura." />
            )}
          </div>

          {Array.isArray(data.por_fonte) && data.por_fonte.length > 0 && (
            <section className="rounded-2xl bg-muted/40 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Por origem</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground text-xs">
                      <th className="pb-2 pr-4">Origem</th>
                      <th className="pb-2 pr-4">Chamadas</th>
                      <th className="pb-2 pr-4">Tokens</th>
                      <th className="pb-2 pr-4">Média</th>
                      <th className="pb-2">Catálogo no prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_fonte.map((row) => (
                      <tr key={row.source} className="border-t border-border/30">
                        <td className="py-2 pr-4 font-mono text-xs">{row.source}</td>
                        <td className="py-2 pr-4">{row.chamadas}</td>
                        <td className="py-2 pr-4">{formatTokens(row.tokens)}</td>
                        <td className="py-2 pr-4">{formatTokens(row.media_tokens)}</td>
                        <td className="py-2">{row.media_catalogo > 0 ? `${row.media_catalogo} prod.` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {Array.isArray(data.ultimas) && data.ultimas.length > 0 && (
            <section className="rounded-2xl bg-muted/40 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Últimas chamadas</h2>
              <div className="space-y-2">
                {data.ultimas.map((row, idx) => (
                  <div
                    key={`${row.created_at}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card/80 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">{formatDate(row.created_at)}</span>
                      <span className="font-mono">{row.source}</span>
                      <span>{row.provider || '—'} / {row.model || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{formatTokens(row.total_tokens)} tok.</span>
                      {row.catalog_product_count > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">cat. {row.catalog_product_count}</span>
                      )}
                      <span>{formatUsd(row.cost_estimate_usd)}</span>
                      {row.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4 shadow-sm">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

function AlertRow({ variant, text }) {
  const isOk = variant === 'ok';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
        isOk
          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
      }`}
    >
      {isOk ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}
