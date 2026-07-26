import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Check, AlertTriangle, Loader2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from "@/components/ui/use-toast";
import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { syncPedidoCompraItensReplaceAll } from '@/lib/pedidoCompraCanonicoSync';

export default function ImportadorNotaFiscal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('upload'); // upload, review
  const [fileUrl, setFileUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [items, setItems] = useState([]);
  const [produtosSistema, setProdutosSistema] = useState([]);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadProdutos();
      setStep('upload');
      setFileUrl(null);
      setExtractedData(null);
      setItems([]);
    }
  }, [isOpen]);

  const loadProdutos = async () => {
    const prods = await base44.entities.Produto.list();
    setProdutosSistema(prods);
  };

  const processarArquivo = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const normalized = await normalizarArquivoParaImportBoleto(file);
      // 1. Upload
      const uploadRes = await base44.integrations.Core.UploadFile({ file: normalized });
      setFileUrl(uploadRes.file_url);

      // 2. Extract
      const schema = {
        type: "object",
        properties: {
          numero_nota: { type: "string" },
          data_emissao: { type: "string", description: "YYYY-MM-DD" },
          fornecedor_nome: { type: "string" },
          cnpj_fornecedor: { type: "string" },
          valor_total_nota: { type: "number" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                codigo_produto: { type: "string" },
                descricao: { type: "string" },
                quantidade: { type: "number" },
                valor_unitario: { type: "number" },
                valor_total_item: { type: "number" },
                unidade: { type: "string" }
              }
            }
          }
        }
      };

      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadRes.file_url,
        json_schema: schema
      });

      if (extractRes.status === 'success' && extractRes.output) {
        processExtractedData(extractRes.output);
      } else {
        throw new Error("Falha na extração de dados");
      }

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao processar arquivo", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (e?.target) e.target.value = '';
    await processarArquivo(file);
  };

  useEffect(() => {
    if (!isOpen || step !== 'upload') return;
    const onPaste = (event) => {
      const file = event.clipboardData?.files?.[0];
      if (!file) return;
      event.preventDefault();
      processarArquivo(file);
      toast({ title: "Arquivo colado com sucesso" });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, step, toast]);

  const processExtractedData = (data) => {
    setExtractedData(data);
    
    // Match logic
    const processedItems = (data.itens || []).map(item => {
      // Tenta encontrar produto por código ou nome similar
      const match = produtosSistema.find(p => 
        p.codigo_barras === item.codigo_produto || 
        p.nome.toLowerCase() === item.descricao.toLowerCase() ||
        (p.codigo_interno && p.codigo_interno === item.codigo_produto)
      );

      return {
        ...item,
        sistema_produto_id: match ? match.id : null,
        sistema_produto_nome: match ? match.nome : null,
        novo_cadastro: !match
      };
    });

    // Apply calculations
    const sumItens = processedItems.reduce((acc, i) => acc + (i.valor_total_item || 0), 0);
    const totalNota = data.valor_total_nota || sumItens;
    
    const ratio = totalNota / (sumItens || 1);

    const finalItems = processedItems.map(item => ({
      ...item,
      custo_ajustado: (item.valor_unitario || 0) * ratio
    }));

    setItems(finalItems);
    setStep('review');
  };

  const handleCreateProduct = async (index) => {
    const item = items[index];
    try {
      const newProd = await base44.entities.Produto.create({
        nome: item.descricao,
        codigo_barras: item.codigo_produto,
        valor_compra: item.custo_ajustado,
        preco_venda_padrao: item.custo_ajustado * 1.5, // Markup padrão 50%
        tipo: 'Produto',
        ativo: true
      });
      
      // Update items list with new product match
      const newItems = [...items];
      newItems[index] = {
        ...item,
        sistema_produto_id: newProd.id,
        sistema_produto_nome: newProd.nome,
        novo_cadastro: false
      };
      setItems(newItems);
      
      // Update system products cache
      setProdutosSistema([...produtosSistema, newProd]);
      
      toast({ title: "Produto cadastrado!", className: "bg-green-100 text-green-800" });
    } catch (err) {
      toast({ title: "Erro ao cadastrar", variant: "destructive" });
    }
  };

  const handleFinish = async () => {
    setIsProcessing(true);
    try {
      // Find or Create Supplier (Simplified)
      let fornecedorId = null;
      if (extractedData.fornecedor_nome) {
        const existingForn = await base44.entities.Terceiro.filter({ nome: extractedData.fornecedor_nome }); // Basic filter, ideally check CNPJ
        if (existingForn.length > 0) {
          fornecedorId = existingForn[0].id;
        } else {
          const newForn = await base44.entities.Terceiro.create({
            nome: extractedData.fornecedor_nome,
            documento: extractedData.cnpj_fornecedor,
            tipo: 'Fornecedor'
          });
          fornecedorId = newForn.id;
        }
      }

      // Create PedidoCompra
      const pedidoItens = items.map(item => ({
        produto_id: item.sistema_produto_id,
        produto_nome: item.sistema_produto_nome || item.descricao,
        quantidade: item.quantidade,
        custo_unitario: item.custo_ajustado,
        total: item.quantidade * item.custo_ajustado
      }));

      const created = await base44.entities.PedidoCompra.create({
        numero: extractedData.numero_nota || `AUT-${Date.now()}`,
        fornecedor_id: fornecedorId,
        fornecedor_nome: extractedData.fornecedor_nome,
        status: 'Rascunho',
        itens: pedidoItens,
        valor_total: extractedData.valor_total_nota,
        observacoes: `Importado via Nota Fiscal em ${new Date().toLocaleDateString()}`
      });

      if (created?.id && pedidoItens.length > 0) {
        const sync = await syncPedidoCompraItensReplaceAll(created.id, pedidoItens, {
          valorTotal: extractedData.valor_total_nota,
        });
        if (!sync.ok && !sync.skipped) {
          console.warn('[ImportadorNotaFiscal] sync SQL linhas:', sync.error);
        }
      }

      toast({ title: "Pedido Criado com Sucesso!", className: "bg-emerald-100 text-emerald-800" });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao criar pedido", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Nota Fiscal (IA)</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className="py-10 text-center border-2 border-dashed border-border/40 rounded-xl bg-muted/40 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                <p className="text-muted-foreground">Processando arquivo e extraindo dados...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Upload className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">Arraste seu arquivo PDF ou Imagem aqui</p>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".pdf,.jpg,.png,.jpeg,application/pdf,image/*,application/octet-stream,*/*"
                  onChange={handleFileUpload}
                  className="hidden" 
                  id="file-upload"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  Selecionar Arquivo
                </Button>
                <p className="text-xs text-muted-foreground">Dica: também pode colar arquivo com Ctrl+V.</p>
              </div>
            )}
          </div>
        )}

        {step === 'review' && extractedData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 bg-muted/40 p-4 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Fornecedor</p>
                <p className="font-medium">{extractedData.fornecedor_nome}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Nota Fiscal</p>
                <p className="font-medium">{extractedData.numero_nota}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Valor Total</p>
                <p className="font-medium text-emerald-600">R$ {extractedData.valor_total_nota?.toFixed(2)}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto (Nota)</TableHead>
                    <TableHead>Produto (Sistema)</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Custo Nota</TableHead>
                    <TableHead>Custo Ajustado</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx} className={item.novo_cadastro ? "bg-yellow-50" : ""}>
                      <TableCell>
                        <div className="text-sm font-medium">{item.descricao}</div>
                        <div className="text-xs text-muted-foreground">{item.codigo_produto}</div>
                      </TableCell>
                      <TableCell>
                        {item.sistema_produto_nome ? (
                          <span className="flex items-center gap-2 text-green-700">
                            <Check className="w-4 h-4" /> {item.sistema_produto_nome}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-yellow-700">
                            <AlertTriangle className="w-4 h-4" /> Não encontrado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>R$ {item.valor_unitario?.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-indigo-600">R$ {item.custo_ajustado?.toFixed(2)}</TableCell>
                      <TableCell>
                        {item.novo_cadastro && (
                          <Button size="sm" variant="outline" onClick={() => handleCreateProduct(idx)}>
                            <Plus className="w-4 h-4 mr-1" /> Cadastrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleFinish} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Gerar Pedido de Compra
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}