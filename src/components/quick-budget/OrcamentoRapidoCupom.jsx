import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportCupomToPdfAndShareOrDownload, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { toast } from 'sonner';
import {
  extractObservacoesUsuario,
  fmtCurrency,
  fmtData,
  fmtR,
  normalizeEmpresaCupom,
  ORCAMENTO_RAPIDO_AVISO_PRECO,
} from '@/lib/orcamentoRapidoCupom';
import { CupomItemLinhaPrecos, CupomTotalComDesconto } from '@/components/orcamento/OrcamentoTotalComDesconto';
import DocumentoComercialA4 from '@/components/documento/DocumentoComercialA4';
import {
  isOrcamentoFormatoCupom,
  normalizeOrcamentoFormatoCupom,
  orcamentoCupomContainerStyle,
  orcamentoCupomLarguraPreviewPx,
  orcamentoCupomPageSizeCss,
} from '@/lib/orcamentoCupomFormato';
import {
  DOCUMENTO_COMERCIAL_A4_FONT,
  DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE,
} from '@/lib/documentoComercialA4';

const FONT = "'DIN 1451', DINish, system-ui, -apple-system, sans-serif";

function EmpresaHeader({ empresaNorm, compact = false }) {
  if (!empresaNorm?.nome) return null;
  const nomeSize = compact ? '17px' : '22px';
  const metaSize = compact ? '10px' : '12px';
  return (
    <div style={{ marginBottom: compact ? '10px' : '14px', paddingBottom: compact ? '8px' : '12px', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: nomeSize, fontWeight: 700, lineHeight: 1.2, marginBottom: '4px' }}>{empresaNorm.nome}</div>
      {empresaNorm.razaoSocial && (
        <div style={{ fontSize: metaSize, color: '#4b5563', marginBottom: '2px' }}>{empresaNorm.razaoSocial}</div>
      )}
      <div style={{ fontSize: metaSize, color: '#6b7280', lineHeight: 1.45 }}>
        {empresaNorm.cnpj && <div>CNPJ {empresaNorm.cnpj}</div>}
        {empresaNorm.endereco && <div>{empresaNorm.endereco}</div>}
        {empresaNorm.complemento && <div>{empresaNorm.complemento}</div>}
        {empresaNorm.bairroCidade && <div>{empresaNorm.bairroCidade}</div>}
        {empresaNorm.telefone && <div>{empresaNorm.telefone}</div>}
      </div>
    </div>
  );
}

function AvisoPreco({ compact = false }) {
  return (
    <div
      style={{
        marginTop: compact ? '10px' : '14px',
        padding: compact ? '10px 8px' : '12px 14px',
        background: '#fffbeb',
        borderRadius: compact ? '10px' : '12px',
        fontSize: compact ? '10px' : '12px',
        color: '#92400e',
        lineHeight: 1.45,
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {ORCAMENTO_RAPIDO_AVISO_PRECO}
    </div>
  );
}

function CupomModern72mm({
  itens,
  total,
  desconto,
  subtotal,
  observacoesUsuario,
  nomeTabela,
  clienteNome,
  numero,
  empresaNorm,
}) {
  return (
    <div
      id="cupom-print"
      style={orcamentoCupomContainerStyle({
        fontFamily: FONT,
        fontSize: '12px',
        color: '#111827',
        lineHeight: 1.4,
      })}
    >
      <EmpresaHeader empresaNorm={empresaNorm} compact />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Orçamento</div>
          {numero && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Nº {numero}</div>}
          {clienteNome && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Cliente: {clienteNome}</div>}
          {nomeTabela && <div style={{ fontSize: '10px', color: '#6b7280' }}>Tabela: {nomeTabela}</div>}
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{fmtData()}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'right' }}>Total</div>
          <CupomTotalComDesconto
            subtotal={subtotal}
            total={total}
            valorDesconto={desconto}
            cheioFontSize="11px"
            finalFontSize="22px"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {itens.map((item, i) => (
          <CupomItemLinhaPrecos key={i} item={item} fmtCurrency={fmtCurrency} />
        ))}
      </div>

      <div
        style={{
          marginTop: '12px',
          background: '#f8fafc',
          borderRadius: '14px',
          padding: '10px 12px',
          display: 'grid',
          gap: '6px',
        }}
      >
        {subtotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Subtotal</span>
            <span>R$ {fmtR(subtotal)}</span>
          </div>
        )}
        {desconto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b45309' }}>
            <span>Desconto</span>
            <span>- R$ {fmtR(desconto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '4px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>Total</span>
          <CupomTotalComDesconto
            subtotal={subtotal}
            total={total}
            valorDesconto={desconto}
            cheioFontSize="12px"
            finalFontSize="18px"
          />
        </div>
      </div>

      {observacoesUsuario && (
        <div style={{ marginTop: '10px', padding: '10px', background: '#f1f5f9', borderRadius: '10px', fontSize: '10px', color: '#334155', lineHeight: 1.45 }}>
          <strong>Obs:</strong> {observacoesUsuario}
        </div>
      )}

      <AvisoPreco compact />

      <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '9px', color: '#9ca3af' }}>
        Documento sem validade fiscal
      </div>
    </div>
  );
}

function PreviewScaled({ formato, children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const docWidthPx = formato === 'a4' ? Math.round(210 * 3.7795) : orcamentoCupomLarguraPreviewPx();

  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 32;
      const s = Math.min(1, available / docWidthPx);
      setScale(s);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [docWidthPx]);

  const docHeightPx = formato === 'a4' ? Math.round(297 * 3.7795) : 'auto';

  return (
    <div ref={containerRef} className="w-full flex justify-center py-4 px-4">
      <div
        style={{
          width: docWidthPx,
          height: formato === 'a4' ? docHeightPx : undefined,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
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

export default function OrcamentoRapidoCupom({
  itens,
  total,
  desconto,
  subtotal,
  observacoes,
  formato,
  nomeTabela,
  clienteNome,
  numero = '',
  empresa,
  onVoltar,
}) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const empresaNorm = normalizeEmpresaCupom(empresa);
  const observacoesUsuario = extractObservacoesUsuario(observacoes);

  const cupomProps = {
    itens,
    total,
    desconto,
    subtotal,
    observacoesUsuario,
    nomeTabela,
    clienteNome,
    numero,
    empresaNorm,
  };

  const handlePrint = async () => {
    const el = document.getElementById('cupom-print');
    if (!el) return;

    if (shouldUseMobileDocumentExport()) {
      setExportingPdf(true);
      try {
        await exportCupomToPdfAndShareOrDownload('cupom-print', {
          formato: normalizeOrcamentoFormatoCupom(formato),
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

    const isA4 = formato === 'a4';
    const html = `<!DOCTYPE html><html><head>
      <title>Orçamento</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${isA4 ? `<link href="${DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE}" rel="stylesheet">` : ''}
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; font-family: ${isA4 ? DOCUMENTO_COMERCIAL_A4_FONT : FONT}; font-weight: 400; -webkit-font-smoothing: antialiased; }
        @media print {
          * { margin: 0; padding: 0; }
          body { margin: 0; padding: 0; }
          @page {
            size: ${formato === 'a4' ? 'A4 portrait' : orcamentoCupomPageSizeCss()};
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
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border/40 flex-shrink-0">
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="text-sm font-semibold text-foreground font-glacial">Prévia do orçamento</span>
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

      <div className="flex-1 overflow-y-auto">
        <PreviewScaled formato={formato}>
          {isOrcamentoFormatoCupom(formato)
            ? <CupomModern72mm {...cupomProps} />
            : (
              <DocumentoComercialA4
                tipo="orcamento"
                empresa={empresa}
                clienteNome={clienteNome}
                numero={numero}
                subtitulo={nomeTabela ? `Tabela: ${nomeTabela}` : ''}
                itens={itens}
                subtotal={subtotal}
                desconto={desconto}
                total={total}
                observacoes={observacoes}
                avisoPreco={ORCAMENTO_RAPIDO_AVISO_PRECO}
                rodapeLegal="Documento sem validade fiscal · Orçamento para consulta de preços"
              />
            )}
        </PreviewScaled>
      </div>
    </div>
  );
}
