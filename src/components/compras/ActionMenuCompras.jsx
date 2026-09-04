import React, { useState } from 'react';
import { Plus, FileText, X, Download, FileBarChart2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { dataHoje } from '@/components/utils/dateUtils';

// FAB radial — igual ao PedidoCompraFAB: arco acima-esquerda com backdrop blur
const RADIUS = 72;

export default function ActionMenuCompras({ onNovopedido, onImportarNF, onDownloadTemplate, grupos = [], kpis = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [gerando, setGerando] = useState(false);

  const handleGerarRelatorio = async () => {
    setGerando(true);
    try {
      const resposta = await base44.functions.invoke('gerarRelatorioPedidosCompra', {
        grupos,
        filtros_desc: 'Todos os pedidos',
        kpis
      });
      
      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RelatorioCompras_${dataHoje()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Relatório gerado com sucesso');
      setIsOpen(false);
    } catch (error) {
      toast.error('Erro ao gerar relatório');
      console.error(error);
    } finally {
      setGerando(false);
    }
  };

  const actions = [
    {
      icon: <Plus className="w-5 h-5" />,
      label: 'Novo Pedido',
      onClick: () => { onNovopedido(); setIsOpen(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: 'Importar NF',
      onClick: () => { onImportarNF(); setIsOpen(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <Download className="w-5 h-5" />,
      label: 'Template Excel',
      onClick: () => { onDownloadTemplate(); setIsOpen(false); },
      color: 'bg-card dark:bg-muted text-foreground/90',
    },
    {
      icon: <FileBarChart2 className="w-5 h-5" />,
      label: 'Relatório PDF',
      onClick: handleGerarRelatorio,
      color: 'bg-card dark:bg-muted text-foreground/90',
      disabled: gerando,
    },
  ];

  const n = actions.length;
  const arcStart = 90;
  const arcEnd = 195;
  const step = n > 1 ? (arcEnd - arcStart) / (n - 1) : 0;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-[2px] bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className="fixed z-50"
        style={{ bottom: 80, right: 24 }}
      >
        {/* Botões radiais */}
        {isOpen && actions.map((action, idx) => {
          const angleDeg = arcStart + idx * step;
          const rad = (angleDeg * Math.PI) / 180;
          const dx = -Math.round(Math.cos(rad) * RADIUS);
          const dy = -Math.round(Math.sin(rad) * RADIUS);

          return (
            <div
              key={idx}
              className="absolute flex flex-col items-center gap-1"
              style={{
                left: 28 + dx - 22,
                top: 28 + dy - 22,
                transition: `all 0.22s cubic-bezier(0.34,1.56,0.64,1)`,
                transitionDelay: `${idx * 35}ms`,
                whiteSpace: 'nowrap',
              }}
            >
              <span className="text-[10px] font-semibold text-white drop-shadow-sm mb-0.5">
                {action.label}
              </span>
              <button
                onClick={action.onClick}
                disabled={action.disabled}
                className={`h-11 w-11 rounded-full shadow-lg flex items-center justify-center transition-all ${action.color} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {action.icon}
              </button>
            </div>
          );
        })}

        {/* FAB principal */}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={`h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
            isOpen
              ? 'bg-muted text-foreground dark:bg-muted/400 dark:text-foreground rotate-45'
              : 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]'
          }`}
          style={{ position: 'absolute', left: 3, top: 3 }}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>
    </>
  );
}