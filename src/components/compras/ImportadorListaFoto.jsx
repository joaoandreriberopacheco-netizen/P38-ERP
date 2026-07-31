import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Image as ImageIcon, Sparkles, Calculator, X } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import { buildProdutoMatchingPromptBase, matchesProductQuery, findLocalBestProductMatch } from '@/components/compras/productMatchingUtils';
import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { buildLlmTelemetryContext } from '@/lib/p38LlmTelemetry';

export default function ImportadorListaFoto({ isOpen, onClose, onImportComplete, mode = 'create' }) {
    const [step, setStep] = useState('upload');
    const [isUploading, setIsUploading] = useState(false);
    const [analyzedItems, setAnalyzedItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [productSearch, setProductSearch] = useState({});

    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadProducts();
            setStep('upload');
            setAnalyzedItems([]);
            setProductSearch({});
        }
    }, [isOpen]);

    const loadProducts = async () => {
        try {
            const prods = await base44.entities.Produto.filter({ tipo: 'Produto', ativo: true });
            setProducts(prods);
        } catch (error) {
            console.error("Erro ao carregar produtos:", error);
        }
    };

    const calculateSuggestion = (product) => {
        if (!product) return 1;

        let estoqueAlvo = product.estoque_ideal || product.estoque_maximo || 0;
        if (estoqueAlvo === 0 && (product.estoque_minimo || 0) > 0) {
            estoqueAlvo = (product.estoque_minimo * 2);
        }

        let necessidade = estoqueAlvo - (product.estoque_atual || 0);

        if (necessidade <= 0 && (product.estoque_atual || 0) <= (product.estoque_minimo || 0)) {
            necessidade = Math.max(1, ((product.estoque_minimo || 0) - (product.estoque_atual || 0)) + (product.unidades_por_pacote || 1));
        }

        if (necessidade <= 0) return 1;

        const fator = product.unidades_por_pacote || 1;
        if (fator > 1) {
            return Math.ceil(necessidade / fator) * fator;
        }

        return necessidade;
    };

    const getSuggestedProduct = (item) => {
        if (!item.produto_id_match) return null;
        return products.find((product) => product.id === item.produto_id_match) || null;
    };

    const updateAnalyzedItems = (updater) => {
        setAnalyzedItems((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return next.map((item, index) => {
                const previousItem = prev[index];
                if (!item?.selected_product_id || item.selected_product_id === previousItem?.selected_product_id) {
                    return item;
                }

                const selectedProduct = products.find((product) => product.id === item.selected_product_id);
                return {
                    ...item,
                    quantity: calculateSuggestion(selectedProduct),
                    ignored: false,
                };
            });
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setStep('processing');

        try {
            const normalized = await normalizarArquivoParaImportBoleto(file);
            const uploadRes = await base44.integrations.Core.UploadFile({ file: normalized });
            const fileUrl = uploadRes.file_url;

            const prompt = `ATENÇÃO: Analise esta imagem de lista manuscrita detalhadamente.
Sua prioridade ABSOLUTA é transcrever TODOS os itens visíveis na imagem, linha por linha.
Não ignore nenhum item. Se houver 20 itens escritos, retorne 20 itens.
Se houver qualquer dúvida, ainda assim retorne o item transcrito com confianca "baixa" e um possível match.

${buildProdutoMatchingPromptBase({
    produtos: products.slice(0, 400),
    fornecedores: [],
    contextLabel: 'CATALOGO DE PRODUTOS PARA REPOSICAO'
})}

Retorne JSON:
{
    "itens": [
        {
            "texto_identificado": "string (Transcreva exatamente o que está escrito)",
            "produto_id_match": "string (id do produto correspondente ou null se não encontrar)",
            "quantidade_escrita": "string (ex: 2cx, 10m, ou null)",
            "confianca": "alta|media|baixa"
        }
    ]
}`;

            const aiRes = await base44.integrations.Core.InvokeLLM({
                prompt: prompt,
                file_urls: [fileUrl],
                telemetry: buildLlmTelemetryContext({
                  source: 'import_lista_foto',
                  catalogProductCount: products.length,
                  fileCount: 1,
                }),
                response_json_schema: {
                    type: "object",
                    properties: {
                        itens: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    texto_identificado: { type: "string" },
                                    produto_id_match: { type: ["string", "null"] },
                                    quantidade_escrita: { type: ["string", "null"] },
                                    confianca: { type: "string" }
                                }
                            }
                        }
                    }
                }
            });

            const result = typeof aiRes === 'string' ? JSON.parse(aiRes) : aiRes;

            const itens = Array.isArray(result.itens) ? result.itens : [];
            const processedItems = itens.map(item => {
                const fallbackProduct = !item.produto_id_match
                    ? findLocalBestProductMatch(item.texto_identificado, products)?.produto
                    : null;
                const selectedProductId = item.produto_id_match || fallbackProduct?.id || null;
                const matchedProduct = products.find(p => p.id === selectedProductId);
                const suggestedQty = calculateSuggestion(matchedProduct);

                return {
                    ...item,
                    produto_id_match: selectedProductId,
                    confianca: item.confianca || (fallbackProduct ? 'baixa' : 'baixa'),
                    selected_product_id: selectedProductId,
                    quantity: suggestedQty,
                    ignored: false
                };
            });

            setAnalyzedItems(processedItems);
            setProductSearch({});
            setStep('review');

        } catch (error) {
            console.error(error);
            toast({ title: "Erro na análise", description: error.message, variant: "destructive" });
            setStep('upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateQuotation = async () => {
        const itemsToImport = analyzedItems.filter(i => !i.ignored && i.selected_product_id);

        if (itemsToImport.length === 0) {
            toast({ title: "Nenhum item válido", description: "Vincule pelo menos um produto.", variant: "destructive" });
            return;
        }

        const novosItens = itemsToImport.map(i => {
            const prod = products.find(p => p.id === i.selected_product_id);
            return {
                produto_id: prod.id,
                produto_nome: prod.nome,
                quantidade: parseFloat(i.quantity) || 1,
                unidade: prod.unidade_principal || 'UN'
            };
        });

        onImportComplete(novosItens, { mode });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-card z-50 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border/40 z-10">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3 md:gap-4">
                                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg">
                                    <X className="w-5 h-5" />
                                </Button>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-medium text-foreground">
                                          {mode === 'merge' ? 'Importar Lista na Cotação' : 'Importação Inteligente'}
                                        </h2>
                                        <p className="text-xs md:text-sm text-muted-foreground">
                                          {mode === 'merge' ? 'A IA identifica itens e mescla na cotação em montagem' : 'IA identifica produtos e sugere quantidades'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {step === 'review' && (
                                <div className="flex items-center justify-between md:justify-end gap-3">
                                    <div className="hidden md:flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-full">
                                        <Calculator className="w-3.5 h-3.5" />
                                        <span>Sugestão Automática Ativa</span>
                                    </div>
                                    <Button onClick={handleCreateQuotation} className="bg-background hover:bg-black text-white rounded-lg shadow-lg w-full md:w-auto">
                                        {mode === 'merge' ? 'Aplicar Itens na Cotação' : 'Gerar Cotação'}
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
                            <div className="py-20 flex flex-col items-center justify-center">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-muted/60 flex items-center justify-center mb-8">
                                    <Camera className="w-12 h-12 text-purple-500 dark:text-purple-400" />
                                </div>
                                <h3 className="text-2xl font-light text-foreground mb-2">
                                  {mode === 'merge' ? 'Importar Itens para Cotação' : 'Nova Cotação via Foto'}
                                </h3>
                                <p className="text-muted-foreground mb-8 text-center max-w-md">
                                    Tire uma foto da sua lista de compras manual ou envie um arquivo. 
                                    Nossa IA identificará os produtos e sugerirá as quantidades.
                                </p>
                                
                                <div className="relative">
                                    <Button size="lg" className="h-14 px-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-xl">
                                        <ImageIcon className="w-5 h-5 mr-2.5" /> 
                                        Selecionar Imagem
                                    </Button>
                                    <input 
                                        type="file" 
                                        accept="image/*,.pdf,application/pdf,application/octet-stream,*/*"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="max-w-2xl mx-auto py-20 flex flex-col items-center justify-center">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-purple-100 dark:bg-purple-900/20 rounded-full animate-ping opacity-50"></div>
                                <div className="relative bg-card p-6 rounded-full shadow-xl">
                                    <Sparkles className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-light text-foreground mb-2">Analisando Imagem...</h3>
                            <p className="text-muted-foreground">Identificando produtos e calculando reposição</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6">
                            <div className="bg-card rounded-xl overflow-hidden border border-border">
                                <P38TableShell className="hidden desktop-layout:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-background/50">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12"></th>
                                                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Item Identificado</th>
                                                <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[40%]">Produto no Sistema</th>
                                                <th className="px-6 py-4 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Estoque</th>
                                                <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Sugerido</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40 dark:divide-border/40">
                                            {analyzedItems.map((item, idx) => {
                                                const product = products.find(p => p.id === item.selected_product_id);
                                                
                                                return (
                                                    <tr key={idx} className={`${item.ignored ? 'opacity-40 bg-background/20' : 'hover:bg-muted/40/50 dark:hover:bg-muted/50'} transition-colors`}>
                                                        <td className="px-6 py-4">
                                                            <Checkbox 
                                                                checked={!item.ignored} 
                                                                onCheckedChange={(checked) => {
                                                                    const newItems = [...analyzedItems];
                                                                    newItems[idx].ignored = !checked;
                                                                    setAnalyzedItems(newItems);
                                                                }}
                                                                className="rounded-md w-5 h-5"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-foreground">{item.texto_identificado}</div>
                                                            {item.quantidade_escrita && (
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                    Escrito: {item.quantidade_escrita}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 overflow-visible relative">
                                                            <ProductSearchInputPDV
                                                                item={item}
                                                                index={idx}
                                                                produtos={products}
                                                                getSuggestedProduct={getSuggestedProduct}
                                                                setItems={updateAnalyzedItems}
                                                                setProductSearch={setProductSearch}
                                                                productSearch={productSearch}
                                                                onProductCreated={(novoProduto) => setProducts((prev) => [...prev, novoProduto])}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {product ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-semibold text-foreground/90 bg-muted px-2 py-0.5 rounded text-xs">
                                                                        {product.estoque_atual || 0}
                                                                    </span>
                                                                    <span className="text-muted-foreground text-[10px] mt-1">Min: {product.estoque_minimo || 0}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xl">−</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-end items-center gap-2">
                                                                <Input 
                                                                    type="number" 
                                                                    className="h-10 w-20 text-right font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-0 rounded-lg"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const newItems = [...analyzedItems];
                                                                        newItems[idx].quantity = e.target.value;
                                                                        setAnalyzedItems(newItems);
                                                                    }}
                                                                    disabled={item.ignored}
                                                                />
                                                                <span className="text-xs text-muted-foreground w-8 font-medium">
                                                                    {product?.unidade_principal || 'UN'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </P38TableShell>
                                <P38MobileLineList className="desktop-layout:hidden">
                                    {analyzedItems.map((item, idx) => {
                                        const product = products.find(p => p.id === item.selected_product_id);
                                        return (
                                            <P38MobileLine
                                                key={idx}
                                                striped={idx % 2 === 1}
                                                accent={item.ignored ? 'muted' : p38AccentKeyFromTone(product ? 'success' : 'warning')}
                                                className={`flex-col items-stretch gap-3 p-4 ${item.ignored ? 'opacity-40' : ''}`}
                                            >
                                                <div className="flex items-start justify-between gap-3 w-full">
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm">{item.texto_identificado}</p>
                                                        {item.quantidade_escrita && (
                                                            <p className="text-xs text-muted-foreground mt-1">Escrito: {item.quantidade_escrita}</p>
                                                        )}
                                                    </div>
                                                    <Checkbox
                                                        checked={!item.ignored}
                                                        onCheckedChange={(checked) => {
                                                            const newItems = [...analyzedItems];
                                                            newItems[idx].ignored = !checked;
                                                            setAnalyzedItems(newItems);
                                                        }}
                                                        className="rounded-md w-5 h-5"
                                                    />
                                                </div>
                                                <ProductSearchInputPDV
                                                    item={item}
                                                    index={idx}
                                                    produtos={products}
                                                    getSuggestedProduct={getSuggestedProduct}
                                                    setItems={updateAnalyzedItems}
                                                    setProductSearch={setProductSearch}
                                                    productSearch={productSearch}
                                                    onProductCreated={(novoProduto) => setProducts((prev) => [...prev, novoProduto])}
                                                />
                                                <div className="flex items-center justify-between gap-3 text-xs w-full">
                                                    <div className="text-muted-foreground">
                                                        Estoque: <span className="font-semibold text-foreground">{product?.estoque_atual || 0}</span>
                                                        <span className="ml-2">Min: {product?.estoque_minimo || 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            className="h-9 w-20 text-right font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-0 rounded-lg"
                                                            value={item.quantity}
                                                            onChange={(e) => {
                                                                const newItems = [...analyzedItems];
                                                                newItems[idx].quantity = e.target.value;
                                                                setAnalyzedItems(newItems);
                                                            }}
                                                            disabled={item.ignored}
                                                        />
                                                        <span className="text-xs text-muted-foreground font-medium">
                                                            {product?.unidade_principal || 'UN'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </P38MobileLine>
                                        );
                                    })}
                                </P38MobileLineList>
                            </div>

                            <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center text-sm text-muted-foreground">
                                <span>{analyzedItems.filter(i => !i.ignored).length} itens selecionados</span>
                                <Button variant="ghost" onClick={() => setStep('upload')} className="text-muted-foreground w-full md:w-auto">
                                    Voltar e Reenviar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}