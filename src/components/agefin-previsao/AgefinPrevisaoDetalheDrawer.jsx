import React, { useEffect, useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, FileText, SplitSquareHorizontal, Undo2 } from 'lucide-react';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import {
  formatCurrency,
  formatCicloAgefinCompetencia,
  formatCompetenciaLabel,
  statusCompetenciaEfetivo,
  tagFrequenciaSerie,
  competenciaBloqueadaEdicao,
  isCompetenciaPlanejamento,
  valorEfetivoCompetencia,
  dataVencimentoNaCompetencia,
} from '@/lib/agefinPrevisaoCalculos';
import { labelParcelaCurta } from '@/lib/agefinParcelamentoCalculos';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { lancamentoPago } from '@/lib/agefinConsultaFilters';

function parseValorInput(raw) {
  return roundToTwoDecimals(raw);
}

function LinhaValor({ label, valor }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{formatCurrency(valor)}</span>
    </div>
  );
}

export default function AgefinPrevisaoDetalheDrawer({
  open,
  onClose,
  competencia,
  modelo,
  onSyncFinanceiro,
  syncing,
  onAbrirMes,
  abrindoMes,
  onVincularBoleto,
  onSalvarManual,
  salvandoManual,
  onParcelar,
  onSalvarParcela,
  onRemoverParcelamento,
  removendoParcelamento,
}) {
  const [valorInput, setValorInput] = useState('');
  const [vencimentoInput, setVencimentoInput] = useState('');

  const fantasma = Boolean(competencia?._fantasmaParcelamento);
  const parcela = Boolean(competencia?._modoParcela);

  useEffect(() => {
    if (!competencia) return;
    const valor =
      parcela && competencia.valor_previsto != null
        ? Number(competencia.valor_previsto) || 0
        : valorEfetivoCompetencia(competencia, modelo);
    setValorInput(String(valor || ''));
    const dia = modelo?.dia_vencimento || competencia.dia_vencimento || 10;
    const ven = parcela
      ? (competencia._parcelaDataVencimento ||
          dataVencimentoNaCompetencia(competencia.competencia, dia))
      : competencia.lancamento_id && competencia._lancamento?.data_vencimento
        ? (competencia._lancamento.data_vencimento || '').slice(0, 10)
        : dataVencimentoNaCompetencia(competencia.competencia, dia);
    setVencimentoInput(ven);
  }, [competencia, modelo, parcela]);

  if (!competencia) return null;

  const planejamento = isCompetenciaPlanejamento(competencia);
  const bloqueada = competenciaBloqueadaEdicao(competencia);
  const paga = lancamentoPago(competencia._lancamento);
  const statusEfetivo = statusCompetenciaEfetivo(competencia);
  const valor =
    parcela && competencia.valor_previsto != null
      ? Number(competencia.valor_previsto) || 0
      : valorEfetivoCompetencia(competencia, modelo);
  const dia = modelo?.dia_vencimento || competencia.dia_vencimento || 10;
  const valorNumerico = parseValorInput(valorInput);
  const valorMudou = Math.abs(valorNumerico - valor) > 0.009;
  const venOriginal = parcela
    ? (competencia._parcelaDataVencimento ||
        dataVencimentoNaCompetencia(competencia.competencia, dia))
    : competencia.lancamento_id && competencia._lancamento?.data_vencimento
      ? (competencia._lancamento.data_vencimento || '').slice(0, 10)
      : dataVencimentoNaCompetencia(competencia.competencia, dia);
  const vencimentoMudou = (vencimentoInput || '').slice(0, 10) !== venOriginal;
  const podeEditar = !bloqueada;
  const podeSalvar = podeEditar && valorNumerico >= 0;
  const tagFreq = tagFrequenciaSerie(modelo || competencia);
  const parcelaLabel = labelParcelaCurta(competencia);

  const handleSalvar = () => {
    if (!podeSalvar || salvandoManual) return;
    if (parcela && onSalvarParcela) {
      onSalvarParcela({
        parcelamentoId: competencia._parcelamentoId,
        parcelaNumero: competencia._parcelaNumero,
        valor: valorNumerico,
        dataVencimento: vencimentoInput,
        diaVencimento: Number((vencimentoInput || '').slice(8, 10)) || dia,
      });
      return;
    }
    onSalvarManual?.({
      valor: valorNumerico,
      dataVencimento: vencimentoInput,
      diaVencimento: Number((vencimentoInput || '').slice(8, 10)) || dia,
    });
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="border-b border-border/40 pb-3">
          <DrawerTitle className="flex flex-wrap items-center gap-2">
            <span>{competencia.serie_nome}</span>
            <Badge variant="outline">{formatCompetenciaLabel(competencia.competencia)}</Badge>
            {fantasma && <Badge variant="secondary">Parcelada</Badge>}
            {parcela && parcelaLabel && <Badge variant="secondary">{parcelaLabel}</Badge>}
            {tagFreq && <Badge variant="secondary">{tagFreq}</Badge>}
            {statusEfetivo === 'planejamento' && !fantasma && (
              <span className="inline-flex items-center gap-0.5">
                <Badge variant="secondary">Planejamento</Badge>
                <P38HelpPopover label="Ajuda: modo planejamento" side="bottom" align="start" size="sm">
                  <p className="font-medium text-foreground">Modo planejamento</p>
                  <p className="text-muted-foreground">
                    Valor estimado do cadastro. Abra o mês para gerar a conta; depois edite valor e vencimento à mão.
                  </p>
                </P38HelpPopover>
              </span>
            )}
            {statusEfetivo === 'fechado' && <Badge>{paga ? 'Paga' : 'Fechada'}</Badge>}
            {statusEfetivo === 'rascunho' && !fantasma && <Badge variant="outline">Em aberto</Badge>}
          </DrawerTitle>
          <p className="text-xs text-muted-foreground">
            {parcela
              ? parcelaLabel
              : formatCicloAgefinCompetencia(competencia.competencia, dia)}
            {competencia.terceiro_nome && ` · ${competencia.terceiro_nome}`}
          </p>
          {bloqueada && paga && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Conta já paga pelo financeiro — valor e vencimento não podem mais ser alterados aqui.
            </p>
          )}
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
          {fantasma && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-3 mt-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Conta original (referência)</p>
              <p className="mt-1">
                Esta conta foi parcelada neste mês. O valor abaixo não entra na soma — as parcelas aparecem nas
                linhas seguintes da lista.
              </p>
              <p className="mt-2 text-base font-semibold text-foreground tabular-nums line-through">
                {formatCurrency(valor)}
              </p>
              {onRemoverParcelamento && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={onRemoverParcelamento}
                  disabled={removendoParcelamento}
                >
                  <Undo2 className="h-4 w-4" />
                  {removendoParcelamento ? 'A desfazer...' : 'Desfazer parcelamento'}
                </Button>
              )}
            </div>
          )}

          {!fantasma && (
            <div className="rounded-xl bg-muted/40 p-3 mt-2 space-y-3">
              {podeEditar ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl bg-card px-3 text-base font-semibold text-foreground outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Vencimento</label>
                    <input
                      type="date"
                      value={vencimentoInput}
                      onChange={(e) => setVencimentoInput(e.target.value)}
                      className="mt-1 h-11 w-full rounded-xl bg-card px-3 text-sm text-foreground outline-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {parcela
                      ? 'Ajuste valor e vencimento desta parcela.'
                      : planejamento
                        ? 'Ajuste valor e vencimento antes de abrir o mês. Salvar grava no cadastro; Anexar guarda o PDF como referência.'
                        : 'Edite valor e vencimento e toque em Salvar. Conta zerada no mês também pode ser corrigida aqui.'}
                  </p>
                </>
              ) : (
                <>
                  <LinhaValor label="Valor previsto (cadastro)" valor={modelo?.valor_previsto || 0} />
                  {competencia.valor_real != null && competencia.valor_real !== modelo?.valor_previsto && (
                    <LinhaValor label="Valor do lançamento" valor={competencia.valor_real} />
                  )}
                  <div className="my-1 border-t border-border/40" />
                  <LinhaValor label="Total do mês" valor={valor} />
                </>
              )}
            </div>
          )}

          {modelo?.centro_custo && (
            <p className="mt-3 text-sm text-muted-foreground">
              Centro de custo: <span className="text-foreground font-medium">{modelo.centro_custo}</span>
            </p>
          )}
          {modelo?.categoria_nome && (
            <p className="mt-1 text-sm text-muted-foreground">
              Categoria: <span className="text-foreground">{modelo.categoria_nome}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2">
            {!fantasma && podeEditar && (onSalvarManual || (parcela && onSalvarParcela)) && (
              <Button
                className="w-full"
                variant={valorMudou || vencimentoMudou ? 'default' : 'outline'}
                onClick={handleSalvar}
                disabled={!podeSalvar || salvandoManual}
              >
                {salvandoManual ? 'Salvando…' : 'Salvar'}
              </Button>
            )}
            {!fantasma && !parcela && podeEditar && onParcelar && (
              <Button variant="outline" className="w-full gap-2" onClick={onParcelar}>
                <SplitSquareHorizontal className="h-4 w-4" />
                Parcelar esta conta
              </Button>
            )}
            {(parcela || fantasma) && onRemoverParcelamento && !fantasma && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={onRemoverParcelamento}
                disabled={removendoParcelamento}
              >
                <Undo2 className="h-4 w-4" />
                {removendoParcelamento ? 'A desfazer...' : 'Desfazer parcelamento'}
              </Button>
            )}
            {planejamento && !parcela && onAbrirMes && (
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={onAbrirMes}
                disabled={abrindoMes}
              >
                {abrindoMes ? 'Abrindo…' : 'Abrir esta conta no mês'}
              </Button>
            )}
            {!bloqueada && !parcela && onVincularBoleto && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onVincularBoleto}
                disabled={abrindoMes}
              >
                <FileText className="h-4 w-4" />
                {abrindoMes ? 'A preparar anexo…' : 'Anexar boleto (PDF)'}
              </Button>
            )}
            {!planejamento && !bloqueada && !parcela && onSyncFinanceiro && (
              <Button variant="secondary" className="w-full gap-2" onClick={onSyncFinanceiro} disabled={syncing}>
                <Link2 className="h-4 w-4" />
                Enviar ao financeiro
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
