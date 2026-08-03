import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Loader2, AlertCircle, Check, FileText, X, ArrowLeft, Package } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import { buildProdutoMatchingPromptBase, getProdutoLabel, matchesProductQuery, findLocalBestProductMatch } from '@/components/compras/productMatchingUtils';
import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { buildLlmTelemetryContext } from '@/lib/p38LlmTelemetry';
import {
    calcularRatioDescontoCotacaoPdf,
    normalizarFinanceiroCotacaoPdf,
} from '@/lib/cotacaoExpressUtils';

export default function ImportadorCotacaoPDF({ isOpen, onClose, cotacao, onImportComplete }) {
    const [step, setStep] = useState('upload');
    const [isUploading, setIsUploading] = useState(false);
    const [aiData, setAiData] = useState(null);
    const [mappings, setMappings] = useState([]);
    const [fornecedorInfo, setFornecedorInfo] = useState({ nome: '', cnpj: '', id: 'new' });
    const [produtosSistema, setProdutosSistema] = useState([]);
    const [fornecedoresSistema, setFornecedoresSistema] = useState([]);
    const [productSearch, setProductSearch] = useState({});
    const fileInputRef = useRef(null);
    const { toast } = useToast();

    const formatCurrency = (value) => {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getSuggestedProduct = (item) => {
        const suggestedId = item.produto_sistema_match_id || item.produto_id_match;
        if (!suggestedId) return null;
        return produtosSistema.find((produto) => produto.id === suggestedId) || null;
    };

    const updateMappings = (updater) => {
        setMappings((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    };

    const handleArquivoSelecionado = async (file) => {
        if (!file) return;

        setIsUploading(true);
        setStep('processing');

        try {
            const normalized = await normalizarArquivoParaImportBoleto(file);
            const uploadRes = await base44.integrations.Core.UploadFile({ file: normalized });
            const fileUrl = uploadRes.file_url;

            const [produtos, fornecedores] = await Promise.all([
                base44.entities.Produto.filter({ tipo: 'Produto', ativo: true }),
                base44.entities.Terceiro.filter({ tipo: ['Fornecedor', 'Ambos'] })
            ]);
            setProdutosSistema(produtos);
            setFornecedoresSistema(fornecedores);

            const prompt = `Analise este PDF de cotação/orçamento de fornecedor.
Extraia os dados do fornecedor e a lista de itens.
Preserve acentos e caracteres do português nos campos textuais.

IMPORTANTE: Para cada item, identifique a MARCA do produto quando estiver visível. A marca é um critério qualitativo fundamental para comparação de cotações.

${buildProdutoMatchingPromptBase({
    produtos,
    fornecedores,
    contextLabel: 'CATALOGO GERAL DE PRODUTOS'
})}

PRIORIDADE DE MATCH:
1. Tente primeiro identificar correspondência com os itens já existentes desta cotação:
${JSON.stringify(cotacao.itens.map((item) => ({ id: item.produto_id, nome: item.produto_nome, qtd: item.quantidade })))}
2. Se não encontrar na cotação atual, use o catálogo geral acima.

FINANCEIRO — REGRAS CRÍTICAS:
- "subtotal": soma bruta dos itens ANTES de qualquer desconto (ex.: TOTAL BRUTO).
- "total_final": valor ABSOLUTO que o cliente pagará — o ÚLTIMO total do documento, após TODOS os descontos.
  * Procure rótulos como "TOTAL DA NF", "TOTAL FINAL", "VALOR TOTAL A PAGAR", "TOTAL NOTA FISCAL".
  * Se houver benefício SUFRAMA / desconto ICMS (ex.: "ICMS (DEVE TER SUFRAMA)", "DESCONTO SUFRAMA"), aplique sobre o total líquido anterior.
  * NÃO pare no "TOTAL LÍQUIDO" se existir um total menor depois (ex.: com SUFRAMA).
  * Exemplo: subtotal R$ 8.993,75 → desconto comercial → R$ 5.576,13 → ICMS SUFRAMA 20% → total_final R$ 4.460,90.
- "desconto_global": diferença entre subtotal e total_final (soma de TODOS os descontos).
- Quando identificável, preencha também "desconto_comercial" e "desconto_suframa" (ou "desconto_icms_suframa").

Retorne um JSON com:
{
    "fornecedor": { 
        "nome_identificado": "string", 
        "cnpj_identificado": "string",
        "id_match": "string (id do sistema ou null se novo)"
    },
    "financeiro": {
        "subtotal": number,
        "desconto_global": number,
        "total_final": number,
        "desconto_comercial": number,
        "desconto_suframa": number
    },
    "itens": [
        {
            "descricao_pdf": "string",
            "codigo_pdf": "string",
            "marca_pdf": "string (marca do produto identificada no PDF)",
            "quantidade_pdf": number,
            "preco_unitario_pdf": number,
            "produto_sistema_match_id": "string (id do produto ou null)",
            "confianca_match": "alta|media|baixa"
        }
    ]
}`;

            const aiRes = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                file_urls: [fileUrl],
                telemetry: buildLlmTelemetryContext({
                  source: 'import_cotacao_pdf',
                  catalogProductCount: produtos.length,
                  fileCount: 1,
                }),
                response_json_schema: {
                    type: "object",
                    properties: {
                        fornecedor: {
                            type: "object",
                            properties: {
                                nome_identificado: { type: "string" },
                                cnpj_identificado: { type: "string" },
                                id_match: { type: ["string", "null"] }
                            }
                        },
                        financeiro: {
                            type: "object",
                            properties: {
                                subtotal: { type: "number" },
                                desconto_global: { type: "number" },
                                total_final: { type: "number" },
                                desconto_comercial: { type: "number" },
                                desconto_suframa: { type: "number" },
                                desconto_icms_suframa: { type: "number" }
                            }
                        },
                        itens: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    descricao_pdf: { type: "string" },
                                    codigo_pdf: { type: "string" },
                                    marca_pdf: { type: "string" },
                                    quantidade_pdf: { type: "number" },
                                    preco_unitario_pdf: { type: "number" },
                                    produto_sistema_match_id: { type: ["string", "null"] },
                                    confianca_match: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            const result = typeof aiRes === 'string' ? JSON.parse(aiRes) : aiRes;
            const financeiroNormalizado = normalizarFinanceiroCotacaoPdf(result.financeiro);
            const resultNormalizado = {
                ...result,
                financeiro: financeiroNormalizado,
            };
            setAiData(resultNormalizado);
            
            // Defensive check for itens array
            const itens = Array.isArray(result.itens) ? result.itens : [];
            setMappings(itens.map(item => {
                const fallback = !item.produto_sistema_match_id
                    ? findLocalBestProductMatch(null, produtos, item)?.produto
                    : null;
                const selectedId = item.produto_sistema_match_id || fallback?.id || '';
                return {
                    ...item,
                    produto_sistema_match_id: selectedId || null,
                    selected_product_id: selectedId,
                    confianca_match: item.confianca_match || (fallback ? 'baixa' : 'baixa'),
                    ignored: !selectedId
                };
            }));
            setProductSearch({});

            setFornecedorInfo({
                id: result.fornecedor.id_match || 'new',
                nome: result.fornecedor.nome_identificado,
                cnpj: result.fornecedor.cnpj_identificado
            });

            setStep('review');

        } catch (error) {
            console.error(error);
            toast({ title: "Erro na análise", description: error.message, variant: "destructive" });
            setStep('upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (e?.target) e.target.value = '';
        await handleArquivoSelecionado(file);
    };

    useEffect(() => {
        if (!isOpen || step !== 'upload') return;
        const onPaste = (event) => {
            const file = event.clipboardData?.files?.[0];
            if (!file) return;
            event.preventDefault();
            handleArquivoSelecionado(file);
            toast({ title: "Arquivo colado com sucesso" });
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [isOpen, step, toast]);

    const handleConfirmImport = async () => {
        try {
            let finalFornecedorId = fornecedorInfo.id;

            if (finalFornecedorId === 'new') {
                const novoFornecedor = await base44.entities.Terceiro.create({
                    nome: fornecedorInfo.nome,
                    cpf_cnpj: fornecedorInfo.cnpj,
                    tipo: 'Fornecedor',
                    ativo: true
                });
                finalFornecedorId = novoFornecedor.id;
            }

            const validItems = mappings.filter(m => !m.ignored && m.selected_product_id);
            
            const processedItems = [];
            const novosItensCotacao = [];

            for (const m of validItems) {
                let produtoId = m.selected_product_id;

                if (produtoId === 'create_new') {
                    try {
                        const novoProduto = await base44.entities.Produto.create({
                            nome: m.descricao_pdf,
                            marca: m.marca_pdf || '',
                            codigo_interno: 'IMP-' + Math.floor(Math.random() * 10000),
                            tipo: 'Produto',
                            preco_venda_padrao: m.preco_unitario_pdf * 1.5,
                            valor_compra: m.preco_unitario_pdf,
                            unidade_principal: 'UN',
                            ativo: true
                        });
                        produtoId = novoProduto.id;
                        
                        novosItensCotacao.push({
                            produto_id: novoProduto.id,
                            produto_nome: novoProduto.nome,
                            quantidade: m.quantidade_pdf,
                            unidade: 'UN'
                        });
                    } catch (err) {
                        console.error("Erro ao criar produto", err);
                        toast({ title: "Erro ao criar produto", description: m.descricao_pdf, variant: "destructive" });
                        continue; 
                    }
                }

                processedItems.push({ ...m, final_product_id: produtoId });
            }

            const subtotalItens = processedItems.reduce((sum, m) => sum + (m.quantidade_pdf * m.preco_unitario_pdf), 0);
            const financeiro = normalizarFinanceiroCotacaoPdf(aiData.financeiro);
            const descontoGlobal = financeiro.desconto_global || 0;
            const discountRatio = calcularRatioDescontoCotacaoPdf(subtotalItens, financeiro);

            const respostas = processedItems.map(m => ({
                fornecedor_id: finalFornecedorId,
                produto_id: m.final_product_id,
                preco_unitario: m.preco_unitario_pdf * discountRatio,
                quantidade_ofertada: m.quantidade_pdf,
                marca: m.marca_pdf || m.descricao_pdf,
                observacao: `Importado via PDF. Preço original: R$ ${m.preco_unitario_pdf.toFixed(2)}${m.marca_pdf ? '. Marca: ' + m.marca_pdf : ''}`,
                vencedor: false
            }));

            if (novosItensCotacao.length > 0) {
                const cotacaoAtualizada = await base44.entities.Cotacao.get(cotacao.id);
                const itensAtualizados = [...cotacaoAtualizada.itens, ...novosItensCotacao];
                await base44.entities.Cotacao.update(cotacao.id, { itens: itensAtualizados });
            }

            onImportComplete(finalFornecedorId, respostas, descontoGlobal);
            onClose();
            toast({ title: "Importação concluída com sucesso!", className: "bg-green-100 text-green-800" });

        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-card z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border/40 z-10">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3 md:items-center md:gap-4">
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg">
                                <X className="w-5 h-5" />
                            </Button>
                            <div>
                                <h2 className="text-lg md:text-xl font-medium text-foreground">Importar Cotação via PDF</h2>
                                <p className="text-xs md:text-sm text-muted-foreground">A IA irá extrair itens, preços e marcas automaticamente</p>
                            </div>
                        </div>
                        {step === 'review' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={() => setStep('upload')} className="gap-2 w-full">
                                    <ArrowLeft className="w-4 h-4" />
                                    Reenviar
                                </Button>
                                <Button onClick={handleConfirmImport} className="bg-teal-600 hover:bg-teal-700 gap-2 w-full">
                                    <Check className="w-4 h-4" />
                                    Confirmar Importação
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
                {step === 'upload' && (
                    <div className="max-w-2xl mx-auto">
                        <div
                            className="py-20 flex flex-col items-center justify-center bg-muted/50/50 rounded-2xl border-2 border-dashed border-border/40 dark:border-border/40 cursor-pointer hover:bg-muted transition-colors"
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
                            <Upload className="w-16 h-16 text-muted-foreground dark:text-muted-foreground mb-6" />
                            <h3 className="text-2xl font-light text-foreground mb-2">Upload do PDF da Cotação</h3>
                            <p className="text-muted-foreground mb-8 text-center max-w-md">
                                A IA irá ler os itens, identificar marcas, preços e fornecedor
                            </p>
                            <div className="relative">
                                <input
                                    ref={fileInputRef}
                                    type="file" 
                                    accept=".pdf,application/pdf,application/octet-stream,*/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                                <Button disabled={isUploading} size="lg" className="bg-teal-600 hover:bg-teal-700">
                                    {isUploading ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analisando...</>
                                    ) : (
                                        "Selecionar Arquivo PDF"
                                    )}
                                </Button>
                            </div>
                            {isUploading && <p className="text-sm text-muted-foreground mt-6">Isso pode levar alguns segundos...</p>}
                            {!isUploading && <p className="text-xs text-muted-foreground mt-6">Dica: também pode colar o PDF com Ctrl+V.</p>}
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="max-w-2xl mx-auto py-20 flex flex-col items-center justify-center">
                        <Loader2 className="w-20 h-20 text-teal-600 animate-spin mb-6" />
                        <h3 className="text-2xl font-light text-foreground mb-2">Processando com IA...</h3>
                        <p className="text-muted-foreground">Extraindo dados, marcas e buscando correspondências</p>
                    </div>
                )}

                {step === 'review' && aiData && (
                    <div className="space-y-8">
                        {/* Supplier Info */}
                        <div className="bg-muted/50/50 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <h4 className="font-medium text-foreground">Dados do Fornecedor Identificado</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-2">Fornecedor no Sistema</Label>
                                    <Select 
                                        value={fornecedorInfo.id} 
                                        onValueChange={(v) => setFornecedorInfo({...fornecedorInfo, id: v})}
                                    >
                                        <SelectTrigger className="bg-card">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">+ Criar Novo Fornecedor</SelectItem>
                                            {fornecedoresSistema.map(f => (
                                                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {fornecedorInfo.id === 'new' && (
                                    <>
                                        <div>
                                            <Label className="text-sm text-muted-foreground mb-2">Nome Identificado</Label>
                                            <Input 
                                                value={fornecedorInfo.nome} 
                                                onChange={e => setFornecedorInfo({...fornecedorInfo, nome: e.target.value})} 
                                                className="bg-card"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm text-muted-foreground mb-2">CNPJ Identificado</Label>
                                            <Input 
                                                value={fornecedorInfo.cnpj} 
                                                onChange={e => setFornecedorInfo({...fornecedorInfo, cnpj: e.target.value})} 
                                                className="bg-card"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Financial Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-6 bg-muted/50/50 rounded-2xl">
                                <p className="text-sm text-muted-foreground mb-2">Subtotal (Itens)</p>
                                <p className="text-2xl font-light text-foreground">
                                    R$ {formatCurrency(aiData.financeiro?.subtotal || 0)}
                                </p>
                            </div>
                            <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
                                <p className="text-sm text-orange-700 dark:text-orange-400 mb-2">Desconto Global Detectado</p>
                                <p className="text-2xl font-light text-orange-700 dark:text-orange-400">
                                    R$ {formatCurrency(aiData.financeiro?.desconto_global || 0)}
                                </p>
                            </div>
                            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                                <p className="text-sm text-green-700 dark:text-green-400 mb-2">Total Final</p>
                                <p className="text-2xl font-light text-green-700 dark:text-green-400">
                                    R$ {formatCurrency(aiData.financeiro?.total_final || 0)}
                                </p>
                            </div>
                        </div>
                        {(aiData.financeiro?.desconto_suframa || 0) > 0 && (
                            <p className="text-sm text-teal-700 dark:text-teal-400 -mt-4">
                                Benefício SUFRAMA/ICMS detectado: R$ {formatCurrency(aiData.financeiro.desconto_suframa)} incluído no total final.
                            </p>
                        )}
                        {(aiData.financeiro?.desconto_global || 0) > 0 && (
                            <p className="text-sm text-muted-foreground italic -mt-4">
                                * O desconto global (comercial + SUFRAMA, quando houver) será rateado proporcionalmente no preço unitário de cada item importado.
                            </p>
                        )}

                        {/* Items Table */}
                        <div className="bg-card rounded-xl overflow-hidden border border-border">
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <Package className="w-5 h-5 text-muted-foreground" />
                                    <h4 className="font-medium text-foreground">Itens para Importação</h4>
                                </div>
                            </div>
                            <P38TableShell className="hidden desktop-layout:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-background/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">Imp.</th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item / Código / Marca</th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd / Preço</th>
                                            <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Correspondência</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 dark:divide-border/40">
                                        {mappings.map((m, idx) => (
                                            <tr key={idx} className={`${m.ignored ? 'opacity-40 bg-background/20' : 'hover:bg-muted/40/50 dark:hover:bg-muted/50'} transition-colors`}>
                                                <td className="px-6 py-4">
                                                    <Checkbox 
                                                        checked={!m.ignored} 
                                                        onCheckedChange={(checked) => {
                                                            const newMappings = [...mappings];
                                                            newMappings[idx].ignored = !checked;
                                                            setMappings(newMappings);
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-foreground mb-1">{m.descricao_pdf}</div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        {m.codigo_pdf && (
                                                            <span className="text-muted-foreground">Cód: {m.codigo_pdf}</span>
                                                        )}
                                                        {m.marca_pdf && (
                                                            <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-md font-medium">
                                                                {m.marca_pdf}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-foreground/90 mb-1">
                                                        {m.quantidade_pdf} × R$ {formatCurrency(m.preco_unitario_pdf)}
                                                    </div>
                                                    <div className="font-medium text-foreground">
                                                        Total: R$ {formatCurrency(m.quantidade_pdf * m.preco_unitario_pdf)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <ProductSearchInputPDV
                                                        item={m}
                                                        index={idx}
                                                        produtos={produtosSistema}
                                                        getSuggestedProduct={getSuggestedProduct}
                                                        setItems={updateMappings}
                                                        setProductSearch={setProductSearch}
                                                        productSearch={productSearch}
                                                        onProductCreated={(novoProduto) => setProdutosSistema((prev) => [...prev, novoProduto])}
                                                    />
                                                    {!m.ignored && m.selected_product_id && (
                                                        <div className="mt-2 text-xs text-muted-foreground">
                                                            {getProdutoLabel(produtosSistema.find((produto) => produto.id === m.selected_product_id))}
                                                        </div>
                                                    )}
                                                    {m.confianca_match && !m.ignored && (
                                                        <div className={`flex items-center gap-1.5 mt-2 text-xs ${
                                                            m.confianca_match === 'alta' ? 'text-[#4A5D23] dark:text-[#a4ce33]' : 'text-amber-600 dark:text-amber-400'
                                                        }`}>
                                                            {m.confianca_match === 'alta' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                            Confiança IA: {m.confianca_match}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </P38TableShell>
                            <P38MobileLineList className="desktop-layout:hidden">
                                {mappings.map((m, idx) => (
                                    <P38MobileLine
                                        key={idx}
                                        striped={idx % 2 === 1}
                                        accent={m.ignored ? 'muted' : p38AccentKeyFromTone(m.confianca_match === 'alta' ? 'success' : 'warning')}
                                        className={`flex-col items-stretch gap-3 p-4 ${m.ignored ? 'opacity-40' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3 w-full">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm">{m.descricao_pdf}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                    {m.codigo_pdf && <span>Cód: {m.codigo_pdf}</span>}
                                                    {m.marca_pdf && <span>{m.marca_pdf}</span>}
                                                </div>
                                            </div>
                                            <Checkbox
                                                checked={!m.ignored}
                                                onCheckedChange={(checked) => {
                                                    const newMappings = [...mappings];
                                                    newMappings[idx].ignored = !checked;
                                                    setMappings(newMappings);
                                                }}
                                            />
                                        </div>
                                        <div className="text-xs text-muted-foreground w-full">
                                            {m.quantidade_pdf} × R$ {formatCurrency(m.preco_unitario_pdf)}
                                            <span className="ml-2 font-semibold text-foreground">
                                                Total: R$ {formatCurrency(m.quantidade_pdf * m.preco_unitario_pdf)}
                                            </span>
                                        </div>
                                        <ProductSearchInputPDV
                                            item={m}
                                            index={idx}
                                            produtos={produtosSistema}
                                            getSuggestedProduct={getSuggestedProduct}
                                            setItems={updateMappings}
                                            setProductSearch={setProductSearch}
                                            productSearch={productSearch}
                                            onProductCreated={(novoProduto) => setProdutosSistema((prev) => [...prev, novoProduto])}
                                        />
                                        {m.confianca_match && !m.ignored && (
                                            <P38StatusLabel tone={m.confianca_match === 'alta' ? 'success' : 'warning'}>
                                                Confiança IA: {m.confianca_match}
                                            </P38StatusLabel>
                                        )}
                                    </P38MobileLine>
                                ))}
                            </P38MobileLineList>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}