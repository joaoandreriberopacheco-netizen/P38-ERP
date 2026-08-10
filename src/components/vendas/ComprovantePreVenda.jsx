import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { exportCupomToPdfAndShareOrDownload, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { getUnidadeMedidaItemPedidoVenda } from '@/lib/productUnits';

const fmtV = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Cupom Senha de Atendimento (Generic Text Only) ────────────────────────────
function CupomSenha({ preVenda }) {
  const senha4 = (preVenda.senha_atendimento || '').slice(-4);
  const totalItens = preVenda.itens?.reduce((acc, i) => acc + i.quantidade, 0) || 0;
  const totalProdutos = preVenda.itens?.length || 0;

  return (
    <div
      id="cupom-print"
      style={{
        width: '275px',
        background: '#fff',
        color: '#000',
        fontFamily: "'Ubuntu Sans Mono', 'Cousine', monospace",
        fontSize: '11px',
        padding: '8px',
        margin: '0 auto',
        lineHeight: '1.4',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', paddingBottom: '4px', marginBottom: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px' }}>SENHA DE ATENDIMENTO</div>
        <div style={{ fontSize: '9px', marginTop: '2px' }}>
          {format(new Date(preVenda.created_date || new Date()), 'dd/MM/yyyy HH:mm')}
        </div>
      </div>

      {/* Senha em destaque — ASCII box */}
      <div style={{ textAlign: 'center', margin: '6px 0', border: '1px solid #000', padding: '8px 4px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '4px' }}>SENHA</div>
        <div style={{ fontSize: '48px', fontWeight: 'bold', fontFamily: 'monospace', lineHeight: '1', letterSpacing: '4px' }}>
          {senha4}
        </div>
        {preVenda.senha_atendimento && (
          <div style={{ fontSize: '8px', color: '#555', marginTop: '4px' }}>
            {preVenda.senha_atendimento}
          </div>
        )}
      </div>

      {/* Dados */}
      <pre style={{ margin: '3px 0', fontSize: '8px', fontFamily: 'inherit' }}>------------------------------------------------</pre>
      <div style={{ padding: '3px 0', margin: '3px 0', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>CLIENTE:</span>
          <span style={{ fontWeight: 'bold', maxWidth: '160px', textAlign: 'right', wordBreak: 'break-word' }}>
            {(preVenda.cliente_nome || '').toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span>VENDEDOR:</span>
          <span style={{ fontWeight: 'bold' }}>{(preVenda.vendedor_nome || '').toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span>ENTREGA:</span>
          <span style={{ fontWeight: 'bold' }}>{(preVenda.metodo_entrega || 'RETIRADA').toUpperCase()}</span>
        </div>
      </div>

      {/* Itens com colunas */}
      <pre style={{ margin: '3px 0', fontSize: '8px', fontFamily: 'inherit' }}>------------------------------------------------</pre>
      <div style={{ fontSize: '9px', padding: '3px 0', margin: '3px 0' }}>
        {/* Header das colunas */}
        <div style={{ display: 'flex', paddingBottom: '2px', borderBottom: '1px solid #000', marginBottom: '2px', fontSize: '7px', fontWeight: 'bold' }}>
          <div style={{ flex: '1', minWidth: '0' }}>DESC</div>
          <div style={{ width: '28px', textAlign: 'right' }}>QTD</div>
          <div style={{ width: '38px', textAlign: 'right' }}>UND</div>
          <div style={{ width: '38px', textAlign: 'right' }}>PREÇO</div>
          <div style={{ width: '38px', textAlign: 'right' }}>TOTAL</div>
        </div>
        
        {/* Linhas de produtos */}
        {preVenda.itens?.map((item, i) => (
          <div key={i} style={{ display: 'flex', marginBottom: '1px', alignItems: 'start', fontSize: '8px' }}>
            <div style={{ flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '2px' }}>
              {(item.produto_nome || '').substring(0, 22)}
            </div>
            <div style={{ width: '28px', textAlign: 'right' }}>{item.quantidade}</div>
            <div style={{ width: '38px', textAlign: 'right', fontSize: '7px' }}>{getUnidadeMedidaItemPedidoVenda(item).substring(0, 4)}</div>
            <div style={{ width: '38px', textAlign: 'right', fontSize: '7px' }}>R${fmtV(item.preco_unitario_praticado || 0)}</div>
            <div style={{ width: '38px', textAlign: 'right', fontWeight: 'bold', fontSize: '7px' }}>R${fmtV(item.total || 0)}</div>
          </div>
        ))}
      </div>

      {/* Resumo */}
      <div style={{ fontSize: '10px', padding: '5px 0', marginTop: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '18px', fontWeight: 'bold' }}>
          <span>SUBTOTAL:</span>
          <span>R$ {fmtV(preVenda.subtotal)}</span>
        </div>
        {preVenda.valor_desconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '18px', fontWeight: 'bold' }}>
            <span>DESCONTO:</span>
            <span>- R$ {fmtV(preVenda.valor_desconto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '20px', fontWeight: 'bold' }}>
          <span>TOTAL:</span>
          <span>R$ {fmtV(preVenda.valor_total)}</span>
        </div>
      </div>

      {/* Formas de Pagamento */}
      <pre style={{ margin: '3px 0', fontSize: '8px', fontFamily: 'inherit' }}>------------------------------------------------</pre>
      <div style={{ padding: '3px 0', margin: '3px 0', fontSize: '9px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>FORMAS DE PAGAMENTO:</div>
        {preVenda.pagamentos?.map((pag, i) => (
          <div key={i} style={{ fontSize: '9px', marginBottom: '1px' }}>
            {pag.forma_pagamento} {pag.parcelas > 1 ? `(${pag.parcelas}x)` : ''}: R$ {fmtV(pag.valor)}
          </div>
        ))}
      </div>

      {/* Usuários */}
      <div style={{ fontSize: '9px', padding: '3px 0', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
          <span>VENDEDOR:</span>
          <span style={{ fontWeight: 'bold' }}>{(preVenda.vendedor_nome || '').toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>PROCESSADO POR:</span>
          <span style={{ fontWeight: 'bold' }}>{(preVenda.created_by || '').toUpperCase()}</span>
        </div>
      </div>

      {/* Aviso */}
      <div style={{ textAlign: 'center', border: '1px solid #000', padding: '5px 4px', margin: '4px 0', fontSize: '9px', fontWeight: 'bold' }}>
        AGUARDANDO ATENDIMENTO NO CAIXA
        <div style={{ fontWeight: 'normal', marginTop: '2px' }}>
          Apresente esta senha para pagamento
        </div>
      </div>

      {/* Rodapé */}
      <pre style={{ margin: '3px 0', fontSize: '8px', fontFamily: 'inherit' }}>------------------------------------------------</pre>
      <div style={{ textAlign: 'center', paddingTop: '4px', fontSize: '8px', color: '#555' }}>
        Este documento nao possui validade fiscal
      </div>
    </div>
  );
}

// ── Preview com scale automático ──────────────────────────────────────────────
function PreviewScaled({ children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const docWidthPx = 275;

  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 32;
      setScale(Math.min(1, available / docWidthPx));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  return (
    <div ref={containerRef} className="w-full flex justify-center py-4 px-4">
      <div
        style={{
          width: docWidthPx,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
        }}
      >
        <div className="shadow-2xl rounded-sm overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ComprovantePreVenda({ preVenda, open, onClose }) {
  const [exportingPdf, setExportingPdf] = useState(false);

  if (!open || !preVenda) return null;

  const handlePrint = async () => {
    const el = document.getElementById('cupom-print');
    if (!el) return;

    if (shouldUseMobileDocumentExport()) {
      setExportingPdf(true);
      try {
        await exportCupomToPdfAndShareOrDownload('cupom-print', {
          formato: '80mm',
          fileBaseName: `senha-${(preVenda.senha_atendimento || '').slice(-4) || 'atendimento'}`,
          title: `Senha ${(preVenda.senha_atendimento || '').slice(-4)}`,
        });
      } catch (e) {
        if (e?.name !== 'AbortError') toast.error('Não foi possível gerar o PDF');
      } finally {
        setExportingPdf(false);
      }
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <title>Senha ${(preVenda.senha_atendimento || '').slice(-4)}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #fff; }
        @media print {
          body { margin: 0; }
          @page { size: 80mm auto; margin: 0; }
        }
      </style>
    </head><body>${el.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-muted dark:bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/40 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold text-foreground font-glacial">
          Senha {(preVenda.senha_atendimento || '').slice(-4)}
        </span>
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

      {/* Preview com scale */}
      <div className="flex-1 overflow-y-auto">
        <PreviewScaled>
          <CupomSenha preVenda={preVenda} />
        </PreviewScaled>
      </div>
    </div>
  );
}