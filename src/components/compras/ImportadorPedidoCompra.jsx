import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, Check, X, ArrowLeft, Package, FileText, Camera, Sparkles } from 'lucide-react';
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import {
  findLocalBestFornecedorMatch,
  findLocalBestProductMatch,
} from '@/components/compras/productMatchingUtils';
import {
  buildPurchaseUnitOptions,
  pickDefaultPurchaseUnit,
  calculateBaseQuantity,
  custoApresentacaoParaFator1,
  normalizePurchaseItemToCommercial,
} from '@/lib/productUnits';
import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { consumirArquivoPedidoImportDoBridge } from '@/lib/torrePedidoImportBridge';
import { buildLlmTelemetryContext } from '@/lib/p38LlmTelemetry';

export default function ImportadorPedidoCompra({
  isOpen,
  onClose,
  onImportComplete,
  launchPdfFilePickerOnce = false,
  onLaunchPdfFilePickerConsumed,
}) {
  const [mode, setMode] = useState('pdf');
  const [step, setStep] = useState('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [items, setItems] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorInfo, setFornecedorInfo] = useState({ id: '', nome: '', cnpj: '' });
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingStep, setProcessingStep] = useState(1);
  const [productSearch, setProductSearch] = useState({});
  const [adjustMode, setAdjustMode] = useState('desconto'); // 'desconto' | 'acrescimo'
  const [discountType, setDiscountType] = useState('percentual');
  const [discountValue, setDiscountValue] = useState('0');
  const [selectedFile, setSelectedFile] = useState(null);
  /** Espelho estável — evita perder o PDF se o estado for limpo entre passos (Strict Mode / re-execução de efeitos). */
  const selectedFileRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfAutoPickConsumedRef = useRef(false);
  /** PDF trazido pela Torre via sessionStorage — não abrir o seletor de ficheiros em duplicado. */
  const arquivoDaTorreRef = useRef(false);
  const tipoDocumentoTorreRef = useRef('Comprovante');
  /** Só repor estado ao passar de fechado → aberto; enquanto o modal fica aberto não limpar (senão some o PDF a meio do fluxo). */
  const modalEstavaAbertoRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      modalEstavaAbertoRef.current = false;
      pdfAutoPickConsumedRef.current = false;
      arquivoDaTorreRef.current = false;
      tipoDocumentoTorreRef.current = 'Comprovante';
      return;
    }
    if (modalEstavaAbertoRef.current) {
      return;
    }
    modalEstavaAbertoRef.current = true;

    setMode('pdf');
    setStep('upload');
    setItems([]);
    setSelectedFile(null);
    selectedFileRef.current = null;
    setAdjustMode('desconto');
    setDiscountValue('0');
    setFornecedorInfo({ id: '', nome: '', cnpj: '' });
    Promise.all([
      base44.entities.Produto.filter({ tipo: 'Produto', ativo: true }),
      base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] })
    ]).then(([prods, fns]) => {
      setProdutos(prods);
      setFornecedores(fns);
    });
  }, [isOpen]);

  const formatCurrency = (value) => (parseFloat(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const normalizarSiglaUnidade = (s) => {
    if (s == null || s === '') return '';
    return String(s)
      .trim()
      .toUpperCase()
      .replace(/\s/g, '')
      .replace('M²', 'M2')
      .replace('²', '2');
  };

  const resolverUnidadeCompra = (produto, unidadeDocRaw) => {
    const opcoes = buildPurchaseUnitOptions(produto);
    const padrao = pickDefaultPurchaseUnit(produto);
    const u = normalizarSiglaUnidade(unidadeDocRaw);
    if (!u) return padrao || opcoes[0];
    const match = opcoes.find((o) => normalizarSiglaUnidade(o.unidade) === u);
    return match || padrao || opcoes[0];
  };

  const textoEquivEstoque = (produto, quantidade, opt) => {
    if (!produto || !opt) return null;
    const up = (produto.unidade_principal || 'UN').toUpperCase();
    const fator = opt.fator_conversao || 1;
    if (fator === 1 && (opt.unidade || '').toUpperCase() === up) return null;
    const qb = calculateBaseQuantity(quantidade, fator);
    return `Equiv. ${qb.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${up} (estoque)`;
  };

  const getSuggestedProduct = (item) => {
    if (!item.produto_id_match) return null;
    return produtos.find((produto) => produto.id === item.produto_id_match) || null;
  };

  const handleProdutoCriadoNoImportador = (novoProduto, itemIndex) => {
    if (!novoProduto?.id) return;
    setProdutos((prev) => {
      if (prev.some((produto) => produto.id === novoProduto.id)) return prev;
      return [...prev, novoProduto];
    });
    if (typeof itemIndex === 'number') {
      setItems((prev) => prev.map((item, currentIndex) => (
        currentIndex === itemIndex
          ? {
              ...item,
              produto_id_match: novoProduto.id,
              selected_product_id: novoProduto.id,
              ignored: false,
            }
          : item
      )));
    }
  };

  const getFilteredProducts = (index) => {
    const query = (productSearch[index] || '').trim().toLowerCase();
    if (!query) {
      return [...produtos].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }

    return [...produtos]
      .filter((produto) => (produto.nome || '').toLowerCase().includes(query))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  };

  const progressWidth = useMemo(() => `${(processingStep / 5) * 100}%`, [processingStep]);

  const discountNumber = parseFloat(discountValue) || 0;

  const isAcrescimo = adjustMode === 'acrescimo';
  // Sync adjustMode → discountType (always percentage for now)
  const effectiveDiscountType = isAcrescimo ? 'acrescimo_percentual' : 'percentual';

  const getDiscountedUnitPrice = (item) => {
    const original = parseFloat(item.preco_unitario) || 0;
    if (!discountNumber) return original;
    if (effectiveDiscountType === 'percentual') return Math.max(0, original - (original * discountNumber / 100));
    if (effectiveDiscountType === 'acrescimo_percentual') return original + (original * discountNumber / 100);
    return original;
  };

  const processSelectedFile = async () => {
    const arquivo =
      selectedFileRef.current ??
      selectedFile;
    if (!arquivo) {
      toast({
        title: 'Arquivo em falta',
        description: 'Volte e selecione o PDF ou imagem novamente.',
        variant: 'destructive',
      });
      setStep('upload');
      return;
    }

    setIsUploading(true);
    setStep('processing');
    setProcessingStep(1);
    setProcessingStatus('Carregando arquivo');

    try {
      const fileUpload =
        mode === 'pdf' ? await normalizarArquivoParaImportBoleto(arquivo) : arquivo;
      const uploadRes = await base44.integrations.Core.UploadFile({ file: fileUpload });
      const fileUrl = uploadRes.file_url;

      setProcessingStep(2);
      setProcessingStatus('Lendo documento');

      const extractionSchema = {
        type: 'object',
        properties: {
          fornecedor: {
            type: 'object',
            properties: {
              nome_identificado: { type: 'string' },
              cnpj_identificado: { type: 'string' },
            },
          },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao: { type: 'string' },
                codigo: { type: 'string' },
                marca: { type: 'string' },
                quantidade: { type: 'number' },
                preco_unitario: { type: 'number' },
                unidade_medida_documento: { type: 'string' },
              },
            },
          },
        },
      };

      const promptBase = `Extraia do documento o fornecedor e a lista de itens.
Preserve acentos e caracteres do português nos campos textuais.
NÃO invente dados — transcreva apenas o que estiver visível no documento.
NÃO tente adivinhar produtos do nosso catálogo interno.

Retorne JSON:
{
  "fornecedor": {"nome_identificado": "string", "cnpj_identificado": "string"},
  "itens": [{
    "descricao": "descrição original",
    "codigo": "código no documento",
    "marca": "marca se visível",
    "quantidade": number,
    "preco_unitario": number,
    "unidade_medida_documento": "sigla opcional ex.: M2, M², CX, PAC, UN — como no documento"
  }]
}`;

      const prompt = mode === 'pdf'
        ? `Analise este PDF de orçamento/pedido de fornecedor.\n${promptBase}`
        : `Analise esta imagem de lista de compra.\n${promptBase}`;

      setProcessingStep(3);
      setProcessingStatus('Identificando itens');

      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [fileUrl],
        telemetry: buildLlmTelemetryContext({
          source: 'import_pedido_compra',
          catalogProductCount: 0,
          fileCount: 1,
        }),
        response_json_schema: extractionSchema,
      });

      setProcessingStep(4);
      setProcessingStatus('Identificando fornecedor');

      let catalogoProdutos = produtos;
      if (!catalogoProdutos.length) {
        catalogoProdutos = await base44.entities.Produto.filter({ tipo: 'Produto', ativo: true });
        setProdutos(catalogoProdutos);
      }

      const result = typeof aiRes === 'string' ? JSON.parse(aiRes) : aiRes;
      const fornecedorMatch = findLocalBestFornecedorMatch(
        {
          nome: result.fornecedor?.nome_identificado,
          cnpj: result.fornecedor?.cnpj_identificado,
        },
        fornecedores,
      );
      setFornecedorInfo({
        id: fornecedorMatch?.id || 'new',
        nome: result.fornecedor?.nome_identificado || '',
        cnpj: result.fornecedor?.cnpj_identificado || '',
      });
      setProcessingStep(5);
      setProcessingStatus('Buscando correspondências no catálogo');

      setItems((result.itens || []).map((item) => {
        const match = findLocalBestProductMatch(null, catalogoProdutos, item);
        const produtoId = match?.produto?.id || '';
        return {
          ...item,
          produto_id_match: produtoId,
          selected_product_id: produtoId,
          confianca: match?.confianca || '',
          ignored: false,
        };
      }));
      setProductSearch({});
      setStep('review');
    } catch (error) {
      toast({ title: 'Erro na análise', description: error.message, variant: 'destructive' });
      setStep(selectedFileRef.current || selectedFile ? 'discount' : 'upload');
    } finally {
      setIsUploading(false);
    }
  };

  const aplicarArquivoSelecionado = async (rawFile, opts = {}) => {
    if (!rawFile) return;
    const usarPdf =
      opts.assumePdf === true || mode === 'pdf';
    try {
      const file =
        usarPdf ? await normalizarArquivoParaImportBoleto(rawFile) : rawFile;
      selectedFileRef.current = file;
      setSelectedFile(file);
      if (opts.assumePdf) setMode('pdf');
      setStep('discount');
    } catch (err) {
      toast({
        title: 'Não foi possível usar o arquivo',
        description: err?.message || 'Tente outra origem ou renomeie para .pdf',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await aplicarArquivoSelecionado(file);
    if (e?.target) e.target.value = '';
  };

  /** PDF guardado na Torre (sessionStorage) + cópia opcional para clipboard ao navegar */
  useEffect(() => {
    if (!isOpen) return;
    const fromTorre = consumirArquivoPedidoImportDoBridge();
    if (!fromTorre?.file) return;
    arquivoDaTorreRef.current = true;
    tipoDocumentoTorreRef.current = fromTorre.tipoDocumento || 'Comprovante';
    void aplicarArquivoSelecionado(fromTorre.file, { assumePdf: true }).finally(() => {
      onLaunchPdfFilePickerConsumed?.();
    });
  }, [isOpen]);

  /** Novo pedido via ?autoImportador=1 sem ficheiro da Torre: abre o seletor de PDF */
  useEffect(() => {
    if (!isOpen || !launchPdfFilePickerOnce) return;
    if (arquivoDaTorreRef.current) return;
    if (step !== 'upload' || mode !== 'pdf') return;
    if (pdfAutoPickConsumedRef.current) return;
    pdfAutoPickConsumedRef.current = true;

    const id = window.setTimeout(() => {
      try {
        fileInputRef.current?.click();
      } finally {
        onLaunchPdfFilePickerConsumed?.();
      }
    }, 120);

    return () => {
      window.clearTimeout(id);
    };
  }, [isOpen, launchPdfFilePickerOnce, step, mode, onLaunchPdfFilePickerConsumed]);

  useEffect(() => {
    if (!isOpen || step !== 'upload') return;
    const onPaste = async (event) => {
      const file = event.clipboardData?.files?.[0];
      if (!file) return;
      event.preventDefault();
      await aplicarArquivoSelecionado(file);
      toast({ title: 'Arquivo colado com sucesso' });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isOpen, step, toast, mode]);

  const handleConfirm = async () => {
    try {
      let fornecedorId = fornecedorInfo.id;
      if (fornecedorId === 'new' && fornecedorInfo.nome.trim()) {
        const novoFornecedor = await base44.entities.Terceiro.create({
          nome: fornecedorInfo.nome,
          cpf_cnpj: fornecedorInfo.cnpj,
          tipo: 'Fornecedor',
          ativo: true
        });
        fornecedorId = novoFornecedor.id;
      }

      const validItems = items.filter(item => !item.ignored && item.selected_product_id);
      const importedItems = [];

      for (const item of validItems) {
        let produtoId = item.selected_product_id;

        if (produtoId === 'create_new') {
          const novoProduto = await base44.entities.Produto.create({
            campo_hierarquico_1: item.descricao,
            nome: item.descricao,
            marca: item.marca || '',
            tipo: 'Produto',
            preco_venda_padrao: (item.preco_unitario || 0) * 1.4,
            valor_compra: item.preco_unitario || 0,
            unidade_principal: 'UN',
            ativo: true
          });
          produtoId = novoProduto.id;
        }

        const produto = produtos.find(p => p.id === produtoId) || { id: produtoId, nome: item.descricao, unidade_principal: 'UN' };
        const optCompra = resolverUnidadeCompra(produto, item.unidade_medida_documento);
        const qtd = Number(item.quantidade) || 1;
        const precoAjustado = getDiscountedUnitPrice(item);
        const totalEconomico = qtd * precoAjustado;
        const fator = optCompra?.fator_conversao ?? 1;
        const custoFator1 = custoApresentacaoParaFator1(precoAjustado, fator);
        // Desconto/acréscimo global já está em precoAjustado; não gravar valor_desconto_item (evita dupla dedução no total).
        const itemImportado = normalizePurchaseItemToCommercial(produto, {
          produto_id: produtoId,
          produto_nome: produto.nome,
          quantidade: qtd,
          unidade_medida: optCompra?.unidade || produto.unidade_principal || 'UN',
          fator_conversao: fator,
          quantidade_base: calculateBaseQuantity(qtd, fator),
          custo_unitario: custoFator1,
          total: totalEconomico,
          valor_desconto_item: 0,
          observacao_item: `${mode === 'pdf' ? 'Importado via PDF' : 'Importado via foto'}${discountNumber ? ` • ${isAcrescimo ? 'acréscimo' : 'desconto'} ${discountNumber}%` : ''}`
        });
        importedItems.push(itemImportado);
      }

      onImportComplete({
        fornecedorId,
        fornecedorNome: fornecedorInfo.nome,
        items: importedItems,
        anexoFonte: selectedFileRef.current,
        tipoDocumentoAnexo: tipoDocumentoTorreRef.current || 'Comprovante',
      });
      onClose();
      toast({ title: 'Itens importados com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-card overflow-y-auto">
      <div className="sticky top-0 z-10 bg-card/95 dark:bg-background/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full">
              <X className="w-4 h-4" />
            </Button>
            <div>
              <p className="font-glacial text-lg text-foreground">Importar novo pedido</p>
              <p className="text-xs text-muted-foreground">Lê PDF e boas imagens para preencher os itens</p>
            </div>
          </div>
          {step === 'review' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  selectedFileRef.current = null;
                  setSelectedFile(null);
                  setStep('upload');
                }}
                className="border-0 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button onClick={handleConfirm} className="shadow-sm">
                <Check className="w-4 h-4 mr-2" />Confirmar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={mode === 'pdf' ? 'default' : 'outline'} onClick={() => setMode('pdf')} className="flex-1 border-0 shadow-sm">
                <FileText className="w-4 h-4 mr-2" />PDF
              </Button>
                <Button variant={mode === 'foto' ? 'default' : 'outline'} onClick={() => setMode('foto')} className="flex-1 border-0 shadow-sm">
                  <Camera className="w-4 h-4 mr-2" />Imagem
              </Button>
            </div>
            <div
              className="rounded-3xl border-2 border-dashed border-border/40 bg-muted/40 p-8 text-center shadow-sm transition-colors hover:bg-muted dark:border-border/40 dark:bg-muted/60 dark:hover:bg-muted md:p-14"
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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm">
                {mode === 'pdf' ? <FileText className="w-8 h-8 text-muted-foreground" /> : <Sparkles className="w-8 h-8 text-muted-foreground" />}
              </div>
              <p className="font-glacial text-xl text-foreground mb-2">
                {mode === 'pdf' ? 'Enviar PDF do fornecedor' : 'Enviar imagem da lista'}
              </p>
              <p className="text-sm text-muted-foreground mb-6">A importação vai preencher os itens do pedido.</p>
              <div className="relative inline-block">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    mode === 'pdf'
                      ? '.pdf,application/pdf,application/octet-stream,*/*'
                      : 'image/*,.pdf,application/pdf,*/*'
                  }
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button size="lg" className="rounded-full px-8 shadow-sm">
                  <Upload className="w-4 h-4 mr-2" />Selecionar arquivo
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Dica: também pode usar Ctrl+V para colar um PDF/imagem.</p>
            </div>
          </div>
        )}

        {step === 'discount' && (
          <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Tab switcher */}
            <div className="rounded-2xl bg-muted p-1 flex gap-1 mb-6">
              <button
                onClick={() => setAdjustMode('desconto')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                  adjustMode === 'desconto'
                    ? 'bg-card shadow-sm text-emerald-700 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12 L14 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Desconto
              </button>
              <button
                onClick={() => setAdjustMode('acrescimo')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                  adjustMode === 'acrescimo'
                    ? 'bg-card shadow-sm text-amber-700 dark:text-amber-400'
                    : 'text-muted-foreground'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12 L14 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="rotate(180 8 8)"/></svg>
                Acréscimo
              </button>
            </div>

            {/* Spinner central */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="rounded-2xl bg-muted/50/60 shadow-sm w-full max-w-xl py-10 flex flex-col items-center gap-2">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-4">
                  {adjustMode === 'desconto' ? 'Desconto sobre todos os itens' : 'Acréscimo sobre todos os itens'}
                </p>
                <div className="flex items-center gap-6">
                  {/* Botão menos */}
                  <button
                    onClick={() => setDiscountValue(v => String(Math.max(0, (parseFloat(v) || 0) - 1)))}
                    className="w-10 h-1 rounded-full flex items-center justify-center"
                    style={{ background: adjustMode === 'desconto' ? '#16a34a' : '#d97706', minHeight: 4 }}
                  />
                  {/* Número grande + setas */}
                  <div className="flex items-center gap-3">
                    <input autoComplete="off"
                      type="number"
                      min="0"
                      max="100"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      className="w-28 text-center text-6xl font-light bg-transparent border-none outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setDiscountValue(v => String((parseFloat(v) || 0) + 1))}
                        className="text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground transition-colors p-1"
                      >
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 7L6 2L11 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button
                        onClick={() => setDiscountValue(v => String(Math.max(0, (parseFloat(v) || 0) - 1)))}
                        className="text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground transition-colors p-1"
                      >
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                    <span className="text-3xl text-muted-foreground font-light">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de ação */}
            <div className="flex items-center justify-between gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                {discountNumber === 0
                  ? 'Sem desc./acrés.'
                  : isAcrescimo
                  ? `+${discountNumber}% nos preços`
                  : `-${discountNumber}% nos preços`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { selectedFileRef.current = null; setSelectedFile(null); setStep('upload'); }} className="h-12 px-5 rounded-2xl border-0 shadow-sm">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button onClick={processSelectedFile} className="h-12 px-8 rounded-2xl shadow-sm bg-background dark:bg-card dark:text-foreground text-white gap-2">
                  Buscar Itens
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <Loader2 className="w-12 h-12 animate-spin text-foreground/90 mb-4" />
            <p className="font-glacial text-xl text-foreground">{processingStatus}</p>
            <p className="text-sm text-muted-foreground mb-4">Passo {processingStep} de 5</p>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden shadow-sm">
              <div className="h-full bg-muted dark:bg-muted transition-all duration-300" style={{ width: progressWidth }} />
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-muted/50/60 p-5 shadow-sm md:col-span-2">
                <Label className="text-xs text-muted-foreground mb-2 block">Fornecedor</Label>
                <Select value={fornecedorInfo.id || 'new'} onValueChange={(value) => setFornecedorInfo(prev => ({ ...prev, id: value }))}>
                  <SelectTrigger className="h-14 border-0 rounded-2xl bg-card shadow-sm text-base text-foreground dark:text-white">
                    <SelectValue placeholder="Selecionar fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Criar novo fornecedor</SelectItem>
                    {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {fornecedorInfo.id === 'new' && (
                <>
                  <div className="rounded-2xl bg-muted/50/60 p-4 shadow-sm">
                    <Label className="text-xs text-muted-foreground mb-2 block">Nome</Label>
                    <Input value={fornecedorInfo.nome} onChange={(e) => setFornecedorInfo(prev => ({ ...prev, nome: e.target.value }))} className="border-0 bg-card shadow-sm" />
                  </div>
                  <div className="rounded-2xl bg-muted/50/60 p-4 shadow-sm">
                    <Label className="text-xs text-muted-foreground mb-2 block">CNPJ</Label>
                    <Input value={fornecedorInfo.cnpj} onChange={(e) => setFornecedorInfo(prev => ({ ...prev, cnpj: e.target.value }))} className="border-0 bg-card shadow-sm" />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <Package className="w-4 h-4" />
                <span>{items.length} itens identificados</span>
              </div>
              {items.map((item, index) => (
                <div key={index} className={`rounded-2xl transition-all ${
                  item.ignored ? 'opacity-40' : ''
                } ${
                  index % 2 === 0 ? 'bg-card/60' : 'bg-muted/40/80 dark:bg-background/60'
                } shadow-sm`}>
                  {/* Card inner padding */}
                  <div className="p-4">
                    {/* Linha superior: checkbox + descrição do doc + preço */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="pt-0.5 flex-none">
                        <Checkbox checked={!item.ignored} onCheckedChange={(checked) => setItems(prev => prev.map((current, currentIndex) => currentIndex === index ? { ...current, ignored: !checked } : current))} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{item.descricao}</p>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {item.codigo ? <span>Cód: {item.codigo}</span> : null}
                          {item.marca ? <span>{item.marca}</span> : null}
                          {item.confianca ? <span className="text-emerald-600 dark:text-emerald-400">{item.confianca}</span> : null}
                        </div>
                      </div>
                      <div className="text-right flex-none">
                        {discountNumber > 0 && (
                          <p className="text-xs text-muted-foreground line-through">{item.quantidade || 1}× R$ {formatCurrency(item.preco_unitario)}</p>
                        )}
                        {discountNumber > 0 && isAcrescimo && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">+{discountNumber}%</span>
                        )}
                        <p className={`text-sm font-semibold ${isAcrescimo ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>{item.quantidade || 1}× R$ {formatCurrency(getDiscountedUnitPrice(item))}</p>
                        <p className="text-xs text-muted-foreground">= R$ {formatCurrency((item.quantidade || 1) * getDiscountedUnitPrice(item))}</p>
                      </div>
                    </div>
                    {/* Linha inferior: busca no catálogo (desktop: alinhada; mobile: full width) */}
                    <div className="pl-7 space-y-1">
                      <ProductSearchInputPDV
                        item={item}
                        index={index}
                        produtos={produtos}
                        getSuggestedProduct={getSuggestedProduct}
                        setItems={setItems}
                        setProductSearch={setProductSearch}
                        productSearch={productSearch}
                        onProductCreated={(novoProduto) => handleProdutoCriadoNoImportador(novoProduto, index)}
                      />
                      {item.selected_product_id && item.selected_product_id !== 'create_new' && (() => {
                        const p = produtos.find((x) => x.id === item.selected_product_id);
                        if (!p) return null;
                        const opt = resolverUnidadeCompra(p, item.unidade_medida_documento);
                        const eq = textoEquivEstoque(p, item.quantidade || 1, opt);
                        return (
                          <p className="text-[11px] text-muted-foreground">
                            Comprar em: <span className="font-medium text-foreground/90">{opt?.unidade || p.unidade_principal || 'UN'}</span>
                            {eq ? <span className="block mt-0.5">{eq}</span> : null}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}