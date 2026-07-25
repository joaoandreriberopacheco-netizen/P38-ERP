import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Printer, Share2, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { printOrShareElementAsPdf, shareOrDownloadBlob } from '@/lib/mobilePrintAndShare';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CONSUMO_FORM_COMPROVANTE_Z } from '@/lib/consumoInternoOverlay';

const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function Cupom80mm({ consumo, dadosEmpresa }) {
  return (
    <div id="consumo-print" style={{ width: '280px', background: '#fff', color: '#111', padding: '10px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '12px', lineHeight: 1.5 }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>{dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'EMPRESA'}</div>
        <div style={{ fontSize: '11px', color: '#666' }}>Minuta de Consumo Interno</div>
      </div>
      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
      <div><strong>Nº:</strong> {consumo.numero}</div>
      <div><strong>Destinação:</strong> {consumo.destinacao}</div>
      <div><strong>Interveniente:</strong> {consumo.responsavel_recebimento}</div>
      <div><strong>Total:</strong> {formatCurrency(consumo.valor_total)}</div>
      <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />
      {(consumo.itens || []).map((item, index) => (
        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
          <span>{item.produto_nome} ({item.quantidade})</span>
          <strong>{formatCurrency(item.subtotal)}</strong>
        </div>
      ))}
    </div>
  );
}

function MinutaA4({ consumo, dadosEmpresa }) {
  return (
    <div id="consumo-print" style={{ width: '210mm', minHeight: '297mm', background: '#fff', color: '#111', padding: '16mm', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: '24px' }}>{dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'EMPRESA'}</h1>
      <p style={{ marginTop: '4px', color: '#666' }}>Minuta de Consumo Interno</p>
      <hr style={{ margin: '16px 0' }} />
      <p><strong>Número:</strong> {consumo.numero}</p>
      <p><strong>Destinação:</strong> {consumo.destinacao}</p>
      <p><strong>Interveniente:</strong> {consumo.responsavel_recebimento}</p>
      <p><strong>Registrado por:</strong> {consumo.usuario_solicitante_nome}</p>
      <p><strong>Total:</strong> {formatCurrency(consumo.valor_total)}</p>
      <h2 style={{ marginTop: '24px', fontSize: '18px' }}>Itens</h2>
      {(consumo.itens || []).map((item, index) => (
        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', padding: '8px 0' }}>
          <span>{item.produto_nome} · {item.quantidade} {item.unidade_medida}</span>
          <strong>{formatCurrency(item.subtotal)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function ComprovanteConsumoInterno({ open, onClose, consumo, autoPrint = true }) {
  const [formato, setFormato] = useState('80mm');
  const [gerando, setGerando] = useState(false);
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const autoPrintDoneRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoPrintDoneRef.current = false;
      return;
    }
    base44.entities.DadosEmpresa.list().then((r) => r?.length && setDadosEmpresa(r[0]));
  }, [open]);

  const handlePrint = async () => {
    const el = document.getElementById('consumo-print');
    if (!el) return;
    try {
      await printOrShareElementAsPdf('consumo-print', {
        formato: formato === 'a4' ? 'a4' : '80mm',
        fileBaseName: `minuta-${consumo?.numero || 'consumo'}`,
        title: `Minuta ${consumo?.numero || ''}`,
        onDesktopPrint: () => {
          const pageSize = formato === 'a4' ? 'A4 portrait' : '80mm auto';
          const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${consumo?.numero || 'Minuta'}</title><style>*{box-sizing:border-box} @page { size:${pageSize}; margin:0; } body{margin:0;background:#fff}</style></head><body>${el.outerHTML}</body></html>`;
          const iframe = document.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
          document.body.appendChild(iframe);
          iframe.contentDocument.open();
          iframe.contentDocument.write(html);
          iframe.contentDocument.close();
          iframe.onload = () => setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 1500); }, 300);
        },
      });
    } catch {
      toast.error('Não foi possível exportar');
    }
  };

  useEffect(() => {
    if (!open || !consumo || !autoPrint || autoPrintDoneRef.current) return;
    const timer = window.setTimeout(() => {
      autoPrintDoneRef.current = true;
      handlePrint();
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autoPrint once per open
  }, [open, consumo?.id, autoPrint]);

  const handleShare = async () => {
    setGerando(true);
    try {
      const el = document.getElementById('consumo-print');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      let pdf;
      if (formato === 'a4') {
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.addImage(imgData, 'PNG', 0, 0, 210, Math.min((canvas.height / canvas.width) * 210, 297));
      } else {
        const widthMm = 80;
        const heightMm = (canvas.height / canvas.width) * widthMm;
        pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [widthMm, heightMm] });
        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
      }
      const fileName = `minuta-${consumo?.numero || 'consumo'}.pdf`;
      const r = await shareOrDownloadBlob(pdf.output('blob'), fileName, 'application/pdf', `Minuta ${consumo?.numero || ''}`);
      if (r === 'downloaded') toast.success('PDF gerado');
    } catch {
      toast.error('Erro ao gerar a minuta');
    } finally {
      setGerando(false);
    }
  };

  if (!open || !consumo) return null;

  const panel = (
    <div className={`fixed inset-0 ${CONSUMO_FORM_COMPROVANTE_Z} flex flex-col bg-muted dark:bg-background`}>
      <div className="flex items-center justify-between border-b border-border/40 bg-card px-4 py-3 dark:border-border/40 dark:bg-background">
        <button type="button" onClick={onClose} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />Voltar
        </button>
        <span className="text-sm font-semibold text-foreground">Minuta</span>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handlePrint} size="sm" className="h-9 gap-1.5 rounded-xl bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90">
            <Printer className="h-3.5 w-3.5" />Imprimir
          </Button>
          <Button type="button" onClick={handleShare} disabled={gerando} size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl px-3 text-xs">
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}Compartilhar
          </Button>
        </div>
      </div>

      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/40">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Consumo registrado com sucesso</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">{consumo.numero} · {formatCurrency(consumo.valor_total)}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border/40 bg-card px-4 py-2 dark:border-border/40 dark:bg-background">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setFormato('80mm')} size="sm" variant={formato === '80mm' ? 'default' : 'outline'} className="h-8 text-xs">80mm</Button>
          <Button type="button" onClick={() => setFormato('a4')} size="sm" variant={formato === 'a4' ? 'default' : 'outline'} className="h-8 text-xs">A4</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-fit shadow-2xl">
          {formato === '80mm' ? <Cupom80mm consumo={consumo} dadosEmpresa={dadosEmpresa} /> : <MinutaA4 consumo={consumo} dadosEmpresa={dadosEmpresa} />}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
}
