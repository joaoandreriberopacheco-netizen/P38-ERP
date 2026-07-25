import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { Input } from '@/components/ui/input';
import { CreditCard, ChevronDown } from 'lucide-react';

export default function SimuladorCartaoAvancado() {
  const [valorBruto, setValorBruto] = useState(1870);
  const [parcelas, setParcelas] = useState(3);
  const [taxa, setTaxa] = useState(2.99);

  const calculos = useMemo(() => {
    const vBruto = valorBruto;
    const nParcelas = parcelas;
    const tPerc = taxa;

    // Cálculo da taxa
    const valorTaxa = vBruto * (tPerc / 100);
    const valorLiquido = vBruto - valorTaxa;

    // Valor por parcela (para o cliente)
    const valorPorParcela = vBruto / nParcelas;

    // Valor líquido por parcela (o que efetivamente entra na conta)
    const valorLiquidoPorParcela = valorLiquido / nParcelas;

    // Diferença por parcela (taxa)
    const taxaPorParcela = valorPorParcela - valorLiquidoPorParcela;

    return {
      vBruto,
      nParcelas,
      tPerc,
      valorTaxa: Math.round(valorTaxa * 100) / 100,
      valorLiquido: Math.round(valorLiquido * 100) / 100,
      valorPorParcela: Math.round(valorPorParcela * 100) / 100,
      valorLiquidoPorParcela: Math.round(valorLiquidoPorParcela * 100) / 100,
      taxaPorParcela: Math.round(taxaPorParcela * 100) / 100,
    };
  }, [valorBruto, parcelas, taxa]);

  const formatValor = (v) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* Entrada de dados */}
      <Card className="p-5 bg-card shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4 font-glacial">
          Simulador de Cartão de Crédito
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Valor da Venda (R$)
            </label>
            <Input
              type="number"
              value={valorBruto}
              onChange={(e) => setValorBruto(Number(e.target.value))}
              className="bg-muted/50 border-border/40"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Parcelas
              </label>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full h-10 px-3 bg-muted/50 border border-border/40 rounded-lg text-sm text-foreground"
              >
                {[1, 2, 3, 4, 5, 6, 12].map((p) => (
                  <option key={p} value={p}>
                    {p}x
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Taxa (%)
              </label>
              <Input
                type="number"
                value={taxa}
                onChange={(e) => setTaxa(Number(e.target.value))}
                className="bg-muted/50 border-border/40"
                step="0.01"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Memória de Cálculo */}
      <Card className="p-5 bg-card shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-4 font-glacial">
          Memória de Cálculo
        </h3>

        <div className="space-y-3 text-sm text-foreground/90 font-mono">
          {/* Passo 1 */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs text-muted-foreground uppercase font-semibold">
              Passo 1: Valor Bruto
            </p>
            <p className="text-base font-semibold text-foreground">
              {formatValor(calculos.vBruto)}
            </p>
          </div>

          {/* Passo 2 */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs text-muted-foreground uppercase font-semibold">
              Passo 2: Calcular Taxa da Operadora
            </p>
            <p className="text-muted-foreground">
              {formatValor(calculos.vBruto)} × {calculos.tPerc}% = {formatValor(calculos.valorTaxa)}
            </p>
          </div>

          {/* Passo 3 */}
          <div className={`p-3 rounded-lg space-y-2 border border-primary/20 ${caixaClasses('success').panel}`}>
            <p className={`text-xs uppercase font-semibold ${caixaClasses('success').panelText}`}>
              Passo 3: Valor Líquido (o que entra na conta)
            </p>
            <p className={`text-base font-semibold ${caixaClasses('success').panelText}`}>
              {formatValor(calculos.vBruto)} − {formatValor(calculos.valorTaxa)} = {formatValor(calculos.valorLiquido)}
            </p>
          </div>

          {/* Passo 4 */}
          <div className={`p-3 rounded-lg space-y-2 border border-cyan-500/20 ${caixaClasses('info').panel}`}>
            <p className={`text-xs uppercase font-semibold ${caixaClasses('info').panelText}`}>
              Passo 4: Dividir em Parcelas
            </p>
            <div className={`space-y-1 ${caixaClasses('info').panelText}`}>
              <p>Valor bruto por parcela:</p>
              <p className="ml-2">{formatValor(calculos.vBruto)} ÷ {calculos.nParcelas} = {formatValor(calculos.valorPorParcela)}</p>
              <p className="mt-2">Valor líquido por parcela:</p>
              <p className="ml-2">{formatValor(calculos.valorLiquido)} ÷ {calculos.nParcelas} = {formatValor(calculos.valorLiquidoPorParcela)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Resumo Final */}
      <Card className="p-5 bg-card border border-border shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-4 font-glacial">
          Resumo da Operação
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <span className="text-muted-foreground">Valor Total da Venda</span>
            <span className="text-xl font-bold text-foreground">{formatValor(calculos.vBruto)}</span>
          </div>

          {/* Linha 2 */}
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <span className="text-muted-foreground">Taxa de Operadora ({calculos.tPerc}%)</span>
            <span className={`text-lg font-semibold ${caixaClasses('danger').text}`}>−{formatValor(calculos.valorTaxa)}</span>
          </div>

          {/* Linha 3 */}
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <span className="text-muted-foreground font-semibold">Valor que Entra na Conta</span>
            <span className={`text-2xl font-bold ${caixaClasses('success').text}`}>{formatValor(calculos.valorLiquido)}</span>
          </div>

          {/* Linha 4 */}
          <div className="flex items-center justify-between pt-3">
            <span className="text-muted-foreground text-sm">Por parcela: {formatValor(calculos.valorLiquidoPorParcela)} (+ {formatValor(calculos.taxaPorParcela)} taxa)</span>
          </div>
        </div>
      </Card>

      {/* Cronograma de Parcelas */}
      <Card className="p-5 bg-card shadow-sm">
        <h3 className="text-base font-semibold text-foreground mb-4 font-glacial">
          Cronograma de Recebimento
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 text-muted-foreground font-semibold">Parcela</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Valor Bruto</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Taxa</th>
                <th className="text-right py-2 text-muted-foreground font-semibold">Valor Líquido</th>
                <th className="text-left py-2 text-muted-foreground font-semibold">Previsão</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: calculos.nParcelas }).map((_, i) => {
                const diasAposBandeira = (i + 1) * 30; // Aproximação: 30 dias por parcela
                return (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-2.5 font-semibold text-foreground">{i + 1}/{calculos.nParcelas}</td>
                    <td className="text-right text-muted-foreground">{formatValor(calculos.valorPorParcela)}</td>
                    <td className={`text-right ${caixaClasses('danger').text}`}>−{formatValor(calculos.taxaPorParcela)}</td>
                    <td className={`text-right font-semibold ${caixaClasses('success').text}`}>
                      {formatValor(calculos.valorLiquidoPorParcela)}
                    </td>
                    <td className="text-left text-muted-foreground text-xs">
                      +{diasAposBandeira} dias
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}