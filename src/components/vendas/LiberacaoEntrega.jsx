import React, { useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { format } from 'date-fns';
import { printOrShareElementAsPdf, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { createPedidoFormularioTextPdf } from '@/lib/pedidoFormularioTextPdf';

export default function LiberacaoEntrega({ open, onClose, pedido }) {
  
  // Impressão automática só no desktop (mobile usa PDF/partilha)
  useEffect(() => {
    if (open && !shouldUseMobileDocumentExport()) {
      setTimeout(() => window.print(), 500);
    }
  }, [open]);

  if (!pedido) return null;

  // Formatação de Valores
  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Ordenação Alfabética dos Itens
  const itensOrdenados = pedido.itens ? [...pedido.itens].sort((a, b) => {
    const nomeA = a.produto_nome || '';
    const nomeB = b.produto_nome || '';
    return nomeA.localeCompare(nomeB);
  }) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 bg-muted flex justify-center">
        
        {/* CSS ESTRITO PARA IMPRESSÃO TÉRMICA (80mm) */}
        <style type="text/css">
          {`
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; background: transparent; }
              body * { visibility: hidden; }
              #area-liberacao, #area-liberacao * { visibility: visible; }
              #area-liberacao { position: absolute; left: 0; top: 0; width: 300px; padding: 0; box-shadow: none !important; }
              .no-print { display: none !important; }
            }

            /* Estilos Globais do Cupom */
            .cupom-termico {
              width: 300px;
              background: #fff;
              color: #000;
              font-family: Arial, sans-serif;
              font-size: 12px;
              padding: 10px;
              margin: 20px auto;
              line-height: 1.2;
            }

            .t-center { text-align: center; }
            .t-right { text-align: right; }
            .t-left { text-align: left; }
            .bold { font-weight: bold; }
            
            .linha-separadora {
              border-bottom: 1px solid #000;
              margin: 5px 0;
            }

            /* Tabela de Produtos */
            .tabela-itens {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
            }
            .tabela-itens th {
              font-weight: normal;
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 3px 0;
              text-align: right;
            }
            .tabela-itens td {
              text-align: right;
              vertical-align: top;
              padding: 3px 0;
            }
            .tabela-itens th:first-child, .tabela-itens td:first-child {
              text-align: left;
              width: 50%;
            }

            /* Grid de Totais */
            .grid-totais {
              display: grid;
              grid-template-columns: 1fr 70px;
              row-gap: 3px;
            }
            .grid-totais > div:nth-child(odd) {
              text-align: right;
              padding-right: 15px;
            }
            .grid-totais > div:nth-child(even) {
              text-align: right;
            }
          `}
        </style>

        <div className="w-full flex flex-col items-center max-h-[90vh] overflow-y-auto pb-8">
          
          {/* Botões de Ação (Apenas na Tela) */}
          <div className="flex gap-2 my-4 no-print w-[300px] justify-end">
            <Button
              onClick={() => {
                void printOrShareElementAsPdf('area-liberacao', {
                  fileBaseName: `liberacao-${pedido?.numero || 'pedido'}`,
                  title: 'Liberação de entrega',
                  createPdfDocument: () => {
                    const el = document.getElementById('area-liberacao');
                    return createPedidoFormularioTextPdf(el?.innerText || '', {
                      titulo: `Liberação pedido ${pedido?.numero || ''}`,
                    });
                  },
                  onDesktopPrint: () => window.print(),
                });
              }}
              size="sm"
              className="h-8 bg-black text-white hover:bg-primary"
            >
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
            <Button variant="outline" onClick={onClose} size="sm" className="h-8 border-black text-black">
              <X className="w-4 h-4 mr-1" /> Fechar
            </Button>
          </div>

          {/* ÁREA DE IMPRESSÃO - O LAYOUT ALVO */}
          <div id="area-liberacao" className="cupom-termico shadow-lg">
            
            <div className="t-right bold" style={{ fontSize: '11px', minHeight: '14px' }}>
              {/* Espaço reservado para 'DUPLICADO' */}
            </div>
            
            {/* Cabeçalho da Empresa */}
            <div className="t-center">
              <h2 className="bold" style={{ fontSize: '16px', margin: '2px 0' }}>CASA ISRAEL</h2>
              <div style={{ fontSize: '12px' }}>
                <p>CARLOS FREDERICO FARIAS PACHECO</p>
                <p>CN:84501063/0001_11</p>
                <p>AV. AMIZADE # 2293</p>
                <p>Teléfono: (97)3412-2845</p>
              </div>
            </div>

            <div className="linha-separadora"></div>

            {/* Título do Documento */}
            <div className="t-center bold" style={{ fontSize: '14px', margin: '6px 0' }}>
              Liberação de Entrega Nº {pedido.numero?.replace(/\D/g, '').slice(-5) || '36884'}
            </div>

            {/* Dados do Pedido */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <div style={{ width: '45%' }}>
                <div>Fecha:</div>
                <div className="t-center">{format(new Date(pedido.created_date || new Date()), 'dd/MM/yyyy')}</div>
              </div>
              <div style={{ width: '55%', paddingLeft: '10px' }}>
                <div>Caja:</div>
                <div className="t-center uppercase" style={{ fontSize: '11px' }}>
                  {pedido.cliente_nome?.substring(0, 15) || 'CAIXA CENTRAL'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '45%' }}>
                <div>Hora:</div>
                <div className="t-center">{format(new Date(pedido.created_date || new Date()), 'HH:mm')}</div>
              </div>
              <div style={{ width: '55%', paddingLeft: '10px' }}>
                <div>Vend.:</div>
                <div className="t-center uppercase">{pedido.vendedor_nome?.substring(0, 15) || 'VENDEDOR'}</div>
              </div>
            </div>

            {/* Tabela de Produtos */}
            <table className="tabela-itens" style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  <th></th>
                  <th>Cant.</th>
                  <th>Val. U.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {itensOrdenados.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {item.produto_nome?.substring(0, 22)}
                    </td>
                    <td>{formatValor(item.quantidade)}</td>
                    <td>{formatValor(item.preco_unitario_praticado)}</td>
                    <td>{formatValor(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="linha-separadora"></div>

            {/* Totais */}
            <div className="grid-totais">
              <div>Subtotal</div>
              <div>{formatValor(pedido.subtotal)}</div>
              
              <div>Descuento</div>
              <div>{formatValor(pedido.valor_desconto || 0)}</div>
            </div>

            <div className="linha-separadora"></div>
            
            <div className="grid-totais bold" style={{ fontSize: '13px' }}>
              <div>Total</div>
              <div>${formatValor(pedido.valor_total)}</div>
            </div>

            <div className="linha-separadora"></div>

            <div className="grid-totais bold">
              <div>Troco</div>
              <div>$0.00</div>
            </div>

            {/* Formas de Pagamento */}
            <div className="bold" style={{ marginTop: '8px' }}>Formas de Pago :</div>
            {pedido.pagamentos && pedido.pagamentos.length > 0 ? (
              pedido.pagamentos.map((pag, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                  <div className="uppercase">{pag.forma_pagamento}</div>
                  <div>{formatValor(pag.valor)}</div>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                <div>Efectivo</div>
                <div>{formatValor(pedido.valor_total)}</div>
              </div>
            )}

            {/* Mensagem Padronizada de Rodapé */}
            <div style={{ marginTop: '15px', fontSize: '12px' }}>
              <p>PREZADO CLIENTE, ATENÇÃO!</p>
              <br />
              <p>* Entregas apenas com a apresentação</p>
              <p>&nbsp;&nbsp;deste comprovante de compra.</p>
              <p>* Não se faz devolução de dinheiro.</p>
              <br />
              <p>Muito obrigagado pela sua preferência!</p>
              <br />
              <p>Jesus te ama!</p>
            </div>

            {/* Linha de Assinatura Simples para Logística */}
            <div className="t-center" style={{ marginTop: '25px' }}>
              <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
              <p style={{ fontSize: '10px', marginTop: '2px' }}>Assinatura Recebedor</p>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
