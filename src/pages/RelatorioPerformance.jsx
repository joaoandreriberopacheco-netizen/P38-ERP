import React, { useState } from 'react';
import { Download, Target, BrainCircuit, AlertTriangle, Building2, Mail, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DecomposicaoIEP from '@/components/relatorios/DecomposicaoIEP';
import { printOrShareElementAsPdf } from '@/lib/mobilePrintAndShare';

const RelatorioPerformance = ({ dados, onClose }) => {
  // Mock de dados com contexto de negócio (categoria, lucro 90d, médias categoria)
  const {
    nome = 'Produto Exemplo',
    tipo = 'SKU',
    classeABCD = 'A',
    scoreIEP = 85,
    categoria = 'Cimento Portland',
    lucro90dias = 45200.00,
    pilares = {
      margem: { valorReal: '45.2%', score: 85, mediaCat: '38.5%' },
      giro: { valorReal: '24 dias', score: 72, mediaCat: '32 dias' },
      anexacao: { valorReal: '68%', score: 68, mediaCat: '55%' }
    },
    insight = null,
    outliers = [],
    empresa = {
      departamento: 'Inteligência & Compras',
      nome: 'VarejoSync',
      email: 'inteligencia@varejosy nc.com.br'
    }
  } = dados || {};

  // Gera diagnóstico inteligente baseado na matriz ABCD vs IEP
  const gerarDiagnostico = () => {
    const classe = classeABCD;
    const iep = scoreIEP;

    if (classe === 'A' && iep >= 70) {
      return {
        titulo: 'DESTAQUE ESTRATÉGICO',
        texto: 'Item de topo que sustenta a lucratividade. Alto faturamento aliado à margem eficiente. Aproveite este volume para renegociar prazos e condições com fornecedores. Proteja o estoque e invista em visibilidade.'
      };
    }
    if (classe === 'A' && iep < 50) {
      return {
        titulo: 'VOLUME COM MARGEM CRÍTICA',
        texto: 'Alto volume, mas margem comprimida. Ação urgente: renegociar desconto com fornecedor ou revisar mix de compra. Risco de impacto no caixa. Priorize renegociação comercial.'
      };
    }
    if ((classe === 'C' || classe === 'D') && iep >= 70) {
      return {
        titulo: 'OPORTUNIDADE EM CRESCIMENTO',
        texto: 'Baixo volume, mas métricas operacionais excelentes. Recomendação: aumentar exposição, investir em marketing e PDV. Grande potencial de escalabilidade. Garanta disponibilidade em estoque.'
      };
    }
    if ((classe === 'C' || classe === 'D') && iep < 50) {
      return {
        titulo: 'REVISÃO URGENTE NECESSÁRIA',
        texto: 'Volume baixo e eficiência insuficiente. Recomendação: analisar descontinuação. Libera espaço e capital de giro para itens com melhor retorno operacional.'
      };
    }
    if (classe === 'B') {
      return {
        titulo: 'EIXO OPERACIONAL',
        texto: iep >= 70 
          ? 'Item intermediário com bom equilíbrio volume-eficiência. Manter disciplina em estoque e precificação. Potencial para promoção para Classe A com ações pontuais.'
          : 'Volume intermediário com eficiência comprometida. Revisar precificação e competitividade. Candidato a otimização ou descontinuação conforme resultado.'
      };
    }

    return insight || { titulo: 'ANÁLISE PENDENTE', texto: 'Verifique dados de entrada.' };
  };

  const diagnostico = gerarDiagnostico();

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const handleImprimir = () => {
    void printOrShareElementAsPdf('dossie-performance-print', {
      formato: 'a4',
      fileBaseName: `dossie-${String(nome || 'produto').replace(/[^\w.-]+/g, '-')}`,
      title: `Dossiê ${nome}`,
      onDesktopPrint: () => window.print(),
    });
  };

  const handleWhatsApp = () => {
    const texto = encodeURIComponent(
      `📊 *Dossiê - ${nome}*\n\n` +
      `📍 Classe: ${classeABCD}\n` +
      `💪 Saúde (IEP): ${scoreIEP}\n\n` +
      `🎯 Potencial: ${pilares.margem.score}\n` +
      `⚡ Cinética: ${pilares.giro.score}\n` +
      `🧲 Magnética: ${pilares.anexacao.score}\n\n` +
      `💭 ${insight.titulo}: ${insight.texto}`
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:fixed print:inset-0 print:bg-card print:z-auto">
      
      {/* Modal Container */}
      <div className="w-full max-w-lg bg-card rounded-lg shadow-2xl flex flex-col max-h-[90vh] print:fixed print:inset-0 print:rounded-none print:shadow-none print:max-h-full print:bg-card print:dark:bg-card">
        
        {/* Header com Botão Fechar - Oculto na Impressão */}
        <div className="flex justify-between items-center p-4 border-b border-border/40 print:hidden">
          <h1 className="text-lg font-bold text-foreground font-glacial">Dossiê de Performance</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded transition"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Corpo Scrollável */}
        <div className="flex-1 overflow-y-auto print:overflow-visible">
          <div id="dossie-performance-print" className="p-6 sm:p-8 print:p-0 print:min-h-screen print:flex print:flex-col print:justify-between">
            
            {/* Cabeçalho do Relatório */}
            <div className="border-b border-border/40 pb-6 mb-6 print:pb-4 print:mb-4">
              <div className="flex justify-between items-start mb-4 print:mb-3">
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none w-2/3">
                  {nome}
                </h2>
                <span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-1 uppercase tracking-widest border border-border/40 rounded">
                  {tipo === 'SKU' ? 'Unidade' : 'Nível'}
                </span>
              </div>

              {/* Contexto de Negócio: Categoria + Lucro 90d */}
              <div className="bg-muted/50/50 border border-border/40 rounded p-3 mb-4 print:bg-card print:border-border/40">
                <div className="flex justify-between items-baseline text-xs print:text-foreground/90">
                  <span>
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Categoria:</span>
                    <span className="text-foreground font-bold ml-2">{categoria}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Lucro 90d:</span>
                    <span className="text-foreground font-bold ml-2 font-mono">
                      R$ {lucro90dias.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                </div>
              </div>

              {/* Classe + IEP */}
              <div className="flex gap-3 bg-muted/50/50 p-4 rounded border border-border/40">
                <div className="flex-1 text-center border-r border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Classe</p>
                  <p className="text-4xl font-black text-foreground mt-1">{classeABCD}</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">IEP Score</p>
                  <p className={`text-4xl font-black mt-1 ${getScoreColor(scoreIEP)}`}>{scoreIEP}</p>
                </div>
              </div>
            </div>

            {/* Decomposição do IEP */}
            <div className="mb-6 print:hidden">
              <DecomposicaoIEP 
                produto={{
                  margem: parseFloat(pilares.margem.valorReal),
                  giro: parseInt(pilares.giro.valorReal),
                  anexacao: parseInt(pilares.anexacao.valorReal)
                }}
                janelaGiro={dados?.janelaGiro || '90d'}
              />
            </div>

            {/* Pilares Técnicos */}
            <div className="mb-6 print:mb-4">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3 print:mb-2">
                <Target className="w-4 h-4" /> Raio-X Operacional
              </h3>
              <div className="space-y-3 print:space-y-2">
                {/* Rentabilidade */}
                  <div className="flex justify-between items-center text-sm border-b border-dashed border-border/40 pb-2">
                    <div className="flex-1">
                      <span className="font-bold text-foreground/90">Rentabilidade (Margem %)</span>
                      <span className="text-[10px] text-muted-foreground ml-2">categoria: {pilares.margem.mediaCat}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{pilares.margem.valorReal}</span>
                      <span className={`font-black ${getScoreColor(pilares.margem.score)}`}>{pilares.margem.score}</span>
                    </div>
                  </div>
                  {/* Mobilidade */}
                  <div className="flex justify-between items-center text-sm border-b border-dashed border-border/40 pb-2">
                    <div className="flex-1">
                      <span className="font-bold text-foreground/90">Mobilidade (Dias de Giro)</span>
                      <span className="text-[10px] text-muted-foreground ml-2">categoria: {pilares.giro.mediaCat}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{pilares.giro.valorReal}</span>
                      <span className={`font-black ${getScoreColor(pilares.giro.score)}`}>{pilares.giro.score}</span>
                    </div>
                  </div>
                  {/* Adesão */}
                  <div className="flex justify-between items-center text-sm border-b border-dashed border-border/40 pb-2">
                    <div className="flex-1">
                      <span className="font-bold text-foreground/90">Adesão (Taxa de Anexação)</span>
                      <span className="text-[10px] text-muted-foreground ml-2">categoria: {pilares.anexacao.mediaCat}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{pilares.anexacao.valorReal}</span>
                      <span className={`font-black ${getScoreColor(pilares.anexacao.score)}`}>{pilares.anexacao.score}</span>
                    </div>
                  </div>
              </div>
            </div>

            {/* Diagnóstico IA */}
            <div className="bg-background dark:bg-muted text-foreground dark:text-foreground p-5 rounded mb-6 print:bg-card print:text-foreground print:border-2 print:border-border/40 print:mb-4">
              <h3 className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 mb-2 text-muted-foreground print:text-muted-foreground">
                <BrainCircuit className="w-4 h-4" /> Diagnóstico do Sistema
              </h3>
              <p className="font-bold text-sm mb-1 uppercase print:text-foreground">{diagnostico.titulo}</p>
              <p className="text-xs leading-relaxed opacity-90 print:text-foreground/90">{diagnostico.texto}</p>
            </div>

            {/* Análise de Outliers */}
             {outliers && outliers.length > 0 && (
               <div className="mb-6 print:mb-4">
                 <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3 print:mb-2">
                   <AlertTriangle className="w-4 h-4" /> Itens Excluídos da Análise
                 </h3>
                 <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded p-3 text-xs print:bg-card print:border-rose-200">
                   <p className="text-rose-800 dark:text-rose-200 font-bold mb-2 flex items-center gap-1 print:text-rose-900">
                     <Info className="w-3 h-3" /> Itens removidos para cálculo de médias (variações extremas):
                   </p>
                  <ul className="list-disc pl-4 space-y-1 text-rose-700 dark:text-rose-300 print:text-rose-800">
                    {outliers.map((out, idx) => (
                      <li key={idx}>
                        <span className="font-mono font-bold">{out.sku}</span> - {out.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Rodapé */}
            <div className="mt-8 pt-6 border-t border-border/40 text-center print:mt-4 print:pt-4 print:border-t print:border-border/40">
              <Building2 className="w-6 h-6 mx-auto text-muted-foreground dark:text-muted-foreground mb-2 print:text-muted-foreground" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest print:text-muted-foreground">
                {empresa.departamento}
              </p>
              <p className="text-xs font-bold text-foreground dark:text-foreground uppercase mt-1 print:text-foreground">
                {empresa.nome}
              </p>
              <div className="flex justify-center items-center gap-2 mt-2 text-[10px] text-muted-foreground font-mono print:text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {empresa.email}
                </span>
                <span>|</span>
                <span>{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Botões de Ação - Ocultos na Impressão */}
        <div className="flex gap-3 p-4 border-t border-border/40 print:hidden bg-muted/50/50">
          <Button
            variant="outline"
            onClick={handleWhatsApp}
            className="flex-1 text-sm dark:bg-muted dark:text-foreground dark:border-border/40 dark:hover:bg-primary/90"
          >
            💬 WhatsApp
          </Button>
          <Button
            data-pulse-sensor="relatorio-performance.pdf"
            onClick={handleImprimir}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm flex items-center justify-center gap-2 dark:bg-muted dark:hover:bg-muted"
          >
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Estilos de Impressão Globais */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};

export default RelatorioPerformance;