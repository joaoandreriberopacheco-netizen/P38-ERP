import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportCupomToPdfAndShareOrDownload, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { toast } from 'sonner';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const LinhaHifens = () => (
  <pre style={{ margin: '2px 0', fontSize: '8px', fontFamily: 'inherit', whiteSpace: 'pre' }}>
------------------------------------------------
  </pre>
);

// ── Cupom 80mm ──────────────────────────────────────────────────────────────
function Cupom80mm({ itens, total, desconto, subtotal, observacoes, nomeTabela, clienteNome, empresa }) {
  return (
    <div
      id="cupom-print"
      style={{
        width: '80mm',
        fontFamily: "'Ubuntu Sans Mono', 'Cousine', monospace",
        fontSize: '12px',
        color: '#111',
        padding: '6mm 1.5mm',
        background: '#fff',
        lineHeight: '1.5',
      }}
    >
      {empresa?.nome && (
         <div style={{ textAlign: 'center', marginBottom: '2mm', paddingBottom: '2mm' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px' }}>{empresa.nome}</div>
          {empresa.cnpj && <div style={{ fontSize: '10px', color: '#555' }}>CNPJ: {empresa.cnpj}</div>}
          {empresa.telefone && <div style={{ fontSize: '10px', color: '#555' }}>{empresa.telefone}</div>}
          {empresa.cidade && <div style={{ fontSize: '10px', color: '#555' }}>{empresa.cidade} - {empresa.estado}</div>}
        </div>
      )}
      <LinhaHifens />
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px', margin: '2mm 0' }}>ORÇAMENTO</div>
      <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginBottom: '2mm' }}>{fmtData()}</div>
      {clienteNome && <div style={{ fontSize: '10px', marginBottom: '2mm' }}>CLIENTE: <strong>{clienteNome.toUpperCase()}</strong></div>}
      <LinhaHifens />
      <div style={{ marginBottom: '2mm' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.5fr 0.7fr 0.8fr', gap: '1mm', fontSize: '10px', color: '#555', marginBottom: '2mm', fontWeight: 'bold', textTransform: 'uppercase' }}>
          <span>DESCRIÇÃO</span>
          <span style={{ textAlign: 'center' }}>QTD</span>
          <span style={{ textAlign: 'right' }}>PREÇO</span>
          <span style={{ textAlign: 'right' }}>TOTAL</span>
        </div>
        {itens.map((item, i) => (
          <div key={i} style={{ marginBottom: '2.5mm', paddingBottom: '1.5mm', borderBottom: '0.5px solid #e0e0e0' }}>
            <div style={{ fontWeight: '500', fontSize: '11px', wordBreak: 'break-word', marginBottom: '0.5mm' }}>{item.nome}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.5fr 0.7fr 0.8fr', gap: '1mm', fontSize: '11px' }}>
              <span style={{ color: '#666' }}>{item.unidade}</span>
              <span style={{ textAlign: 'center', fontWeight: '500' }}>{item.qtd}</span>
              <span style={{ textAlign: 'right' }}>{fmtR(item.preco_unit)}</span>
              <span style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmtR(item.preco_unit * item.qtd)}</span>
            </div>
          </div>
        ))}
      </div>
      <LinhaHifens />
      {subtotal > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '1mm 0' }}>
            <span>Subtotal</span>
            <span>R$ {fmtR(subtotal)}</span>
          </div>
          {desconto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#e74c3c', fontWeight: 'bold', margin: '1mm 0' }}>
              <span>Desconto</span>
              <span>-R$ {fmtR(desconto)}</span>
            </div>
          )}
        </>
      )}
      <LinhaHifens />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', margin: '2mm 0' }}>
        <span>TOTAL</span>
        <span>R$ {fmtR(total)}</span>
      </div>
      <LinhaHifens />
      {observacoes && (
        <>
          <div style={{ fontSize: '9px', color: '#555', margin: '2mm 0 0 0', wordBreak: 'break-word' }}>
            <strong>OBS:</strong> {observacoes}
          </div>
          <LinhaHifens />
        </>
      )}
      <div style={{ textAlign: 'center', fontSize: '9px', color: '#777', marginTop: '2mm' }}>
        Nao possui validade fiscal.
      </div>
    </div>
  );
}

// ── Cupom A4 ────────────────────────────────────────────────────────────────
function CupomA4({ itens, total, desconto, subtotal, observacoes, nomeTabela, clienteNome, empresa }) {
  return (
    <div
      id="cupom-print"
      style={{
        width: '210mm',
        minHeight: '297mm',
        fontFamily: "'Ubuntu Sans Mono', 'Cousine', monospace",
        fontSize: '12px',
        color: '#111',
        padding: '20mm 18mm',
        background: '#fff',
        lineHeight: '1.6',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10mm', borderBottom: '2px solid #111', paddingBottom: '6mm' }}>
        <div>
          {empresa?.nome && <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>{empresa.nome}</div>}
          {empresa?.cnpj && <div style={{ fontSize: '11px', color: '#555', marginTop: '1mm' }}>CNPJ: {empresa.cnpj}</div>}
          {empresa?.telefone && <div style={{ fontSize: '11px', color: '#555' }}>{empresa.telefone}</div>}
          {empresa?.cidade && <div style={{ fontSize: '11px', color: '#555' }}>{empresa.cidade} - {empresa.estado}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '1px', color: '#333' }}>ORÇAMENTO</div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '1mm' }}>{fmtData()}</div>
          {nomeTabela && <div style={{ fontSize: '11px', color: '#555' }}>Tabela: {nomeTabela}</div>}
        </div>
      </div>
      {clienteNome && (
        <div style={{ marginBottom: '8mm', padding: '4mm 6mm', background: '#f5f5f5', borderRadius: '4px' }}>
          <div style={{ fontSize: '10px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente</div>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>{clienteNome}</div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: '3mm 2mm', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produto</th>
            <th style={{ textAlign: 'center', padding: '3mm 2mm', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15mm' }}>Qtd</th>
            <th style={{ textAlign: 'center', padding: '3mm 2mm', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', width: '15mm' }}>Un</th>
            <th style={{ textAlign: 'right', padding: '3mm 2mm', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', width: '28mm' }}>Unit. (R$)</th>
            <th style={{ textAlign: 'right', padding: '3mm 2mm', fontSize: '11px', color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', width: '30mm' }}>Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, i) => (
            <tr key={i} style={{ borderBottom: '0.5px solid #eee' }}>
              <td style={{ padding: '3mm 2mm', fontSize: '12px' }}>{item.nome}</td>
              <td style={{ padding: '3mm 2mm', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>{item.qtd}</td>
              <td style={{ padding: '3mm 2mm', textAlign: 'center', fontSize: '12px', color: '#555' }}>{item.unidade}</td>
              <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12px' }}>{fmtR(item.preco_unit)}</td>
              <td style={{ padding: '3mm 2mm', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>{fmtR(item.preco_unit * item.qtd)}</td>
            </tr>
          ))}
        </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
          <div style={{ minWidth: '100mm', textAlign: 'right' }}>
            {subtotal > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2mm' }}>
                  <span>Subtotal</span>
                  <span>R$ {fmtR(subtotal)}</span>
                </div>
                {desconto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#e74c3c', fontWeight: '600', marginBottom: '2mm' }}>
                    <span>Desconto</span>
                    <span>-R$ {fmtR(desconto)}</span>
                  </div>
                )}
              </>
            )}
            <div style={{ borderTop: '2px solid #111', paddingTop: '4mm' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Geral</div>
              <div style={{ fontSize: '22px', fontWeight: '700' }}>R$ {fmtR(total)}</div>
              <div style={{ fontSize: '10px', color: '#999', marginTop: '1mm' }}>{itens.reduce((s, i) => s + i.qtd, 0)} itens</div>
            </div>
          </div>
        </div>
        {observacoes && (
          <div style={{ background: '#f5f5f5', padding: '4mm 6mm', borderRadius: '4px', marginBottom: '6mm', fontSize: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '2mm' }}>Observações:</div>
            <div style={{ color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{observacoes}</div>
          </div>
        )}
        <div style={{ borderTop: '0.5px solid #ddd', paddingTop: '5mm', textAlign: 'center', fontSize: '10px', color: '#999' }}>
          Este documento não tem validade fiscal. Orçamento gerado em {fmtData()}.
        </div>
    </div>
  );
}

// ── Wrapper com scale para preview mobile ────────────────────────────────────
function PreviewScaled({ formato, children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Largura real do documento em px (96dpi: 1mm = 3.7795px)
  const docWidthPx = formato === 'a4' ? Math.round(210 * 3.7795) : Math.round(80 * 3.7795);

  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 32; // 16px padding each side
      const s = Math.min(1, available / docWidthPx);
      setScale(s);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [docWidthPx]);

  // Altura visual do container (para não deixar espaço vazio)
  const docHeightPx = formato === 'a4' ? Math.round(297 * 3.7795) : 'auto';

  return (
    <div ref={containerRef} className="w-full flex justify-center py-4 px-4">
      <div
        style={{
          width: docWidthPx,
          height: formato === 'a4' ? docHeightPx : undefined,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
          // Collapse the extra space caused by scale shrink
          marginBottom: formato === 'a4' ? `${(docHeightPx * scale) - docHeightPx}px` : undefined,
        }}
      >
        <div className="shadow-2xl rounded-sm overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
export default function OrcamentoCupom({ itens, total, desconto, subtotal, observacoes, formato, nomeTabela, clienteNome, empresa, onVoltar, onClose }) {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handlePrint = async () => {
    const el = document.getElementById('cupom-print');
    if (!el) return;

    if (shouldUseMobileDocumentExport()) {
      setExportingPdf(true);
      try {
        await exportCupomToPdfAndShareOrDownload('cupom-print', {
          formato: formato === 'a4' ? 'a4' : '80mm',
          fileBaseName: `orcamento-${new Date().toISOString().slice(0, 10)}`,
          title: 'Orçamento',
        });
      } catch (e) {
        if (e?.name !== 'AbortError') toast.error('Não foi possível gerar o PDF');
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    // HTML genérico para print em qualquer dispositivo (desktop)
    const html = `<!DOCTYPE html><html><head>
      <title>Orçamento</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Ubuntu+Sans+Mono:wght@400;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; }
        @media print {
          * { margin: 0; padding: 0; }
          body { margin: 0; padding: 0; }
          @page {
            size: ${formato === 'a4' ? 'A4 portrait' : '80mm 210mm'};
            margin: 0;
          }
        }
      </style>
    </head><body>${el.outerHTML}</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-muted dark:bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/40 flex-shrink-0">
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold text-foreground font-glacial">Prévia</span>
        <Button
          onClick={handlePrint}
          disabled={exportingPdf}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:hover:bg-muted dark:text-foreground h-9 text-xs gap-1.5 rounded-xl px-4"
        >
          {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
          {exportingPdf ? 'Gerando…' : 'Imprimir'}
        </Button>
      </div>

      {/* Preview com scale automático */}
      <div className="flex-1 overflow-y-auto">
        <PreviewScaled formato={formato}>
          {formato === '80mm'
            ? <Cupom80mm itens={itens} total={total} desconto={desconto} subtotal={subtotal} observacoes={observacoes} nomeTabela={nomeTabela} clienteNome={clienteNome} empresa={empresa} />
            : <CupomA4 itens={itens} total={total} desconto={desconto} subtotal={subtotal} observacoes={observacoes} nomeTabela={nomeTabela} clienteNome={clienteNome} empresa={empresa} />
          }
        </PreviewScaled>
      </div>
    </div>
  );
}