import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, RotateCcw, AlertCircle, CheckCircle2, Package, BookOpen } from 'lucide-react';
import ImportarPlanilha from '@/components/produtos/massa/ImportarPlanilha';
import ImportarEmbalagensPlanilha from '@/components/produtos/massa/ImportarEmbalagensPlanilha';
import ImportarEstoque from '@/components/produtos/massa/ImportarEstoque';
import ResumoPrevisualizacao from '@/components/produtos/massa/ResumoPrevisualizacao';
import DesfazerImportacao from '@/components/produtos/massa/DesfazerImportacao';
import ExportarPlanilha from '@/components/produtos/massa/ExportarPlanilha';
import ExportarEmbalagensPlanilha from '@/components/produtos/massa/ExportarEmbalagensPlanilha';
import ExportarEstoque from '@/components/produtos/massa/ExportarEstoque';
import { P38_SECTION_TITLE } from '@/lib/p38FormTypography';

const TAMANHO_LOTE = 25;

function mensagemErroFunctionInvoke(error) {
  const data = error?.response?.data;
  if (data && typeof data === 'object' && typeof data.error === 'string') return data.error;
  return error?.message || 'Erro desconhecido';
}

/** Resposta de functions.invoke pode vir como `{ data: {...} }` ou corpo direto. */
function corpoRespostaInvoke(resp) {
  if (resp && typeof resp === 'object' && 'data' in resp && resp.data !== undefined) {
    return resp.data;
  }
  return resp;
}

export default function ImportacaoProdutosPage() {
  const [parsedData, setParsedData] = useState(null);
  const [parsedEmbalagens, setParsedEmbalagens] = useState(null);
  const [parsedEstoque, setParsedEstoque] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);
  const [salvouEmbalagensOk, setSalvouEmbalagensOk] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, lote: 0, totalLotes: 0 });

  const handleParsed = useCallback((data) => {
    setParsedData(data);
    setSalvouOk(false);
  }, []);

  const handleParsedEmbalagens = useCallback((data) => {
    setParsedEmbalagens(data);
    setSalvouEmbalagensOk(false);
  }, []);

  const handleParsedEstoque = useCallback((data) => {
    setParsedEstoque(data);
    setSalvouOk(false);
  }, []);

  const handleConfirmar = async () => {
    if (!parsedData?.alterados?.length) {
      toast.error('Sem dados para sincronizar');
      return;
    }

    const total = parsedData.alterados.length;
    const totalLotes = Math.ceil(total / TAMANHO_LOTE);
    const grupoId = `GRP-${Date.now()}`;
    setSalvando(true);
    setProgresso({ atual: 0, total, lote: 0, totalLotes });
    let avisoServidor = null;

    try {
      for (let i = 0; i < totalLotes; i++) {
        const inicio = i * TAMANHO_LOTE;
        const lote = parsedData.alterados.slice(inicio, inicio + TAMANHO_LOTE);

        const resp = await base44.functions.invoke('importarProdutos', {
          alterados: lote,
          tipo_importacao: 'Detalhes do Produto',
          is_ultimo_lote: i === totalLotes - 1,
          lote_numero: i + 1,
          total_lotes: totalLotes,
          grupo_importacao_id: grupoId,
        });

        const body = corpoRespostaInvoke(resp);
        if (body?.warning && !avisoServidor) avisoServidor = body.warning;

        setProgresso({ atual: Math.min(inicio + TAMANHO_LOTE, total), total, lote: i + 1, totalLotes });
      }

      toast.success(`✓ Sincronização concluída! ${total} produto(s) em ${totalLotes} lote(s).`);
      if (avisoServidor) {
        toast.warning(avisoServidor);
      }
      setSalvouOk(true);
      setParsedData(null);
      // Invalidar cache global para que Produtos recarregue ao retornar
      window.dispatchEvent(new Event('produtos:refresh'));
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast.error(`Erro no lote ${progresso.lote + 1}: ${mensagemErroFunctionInvoke(error)}`);
    } finally {
      setSalvando(false);
      setProgresso({ atual: 0, total: 0, lote: 0, totalLotes: 0 });
    }
  };

  const handleConfirmarEmbalagens = async () => {
    if (!parsedEmbalagens?.alterados?.length) {
      toast.error('Sem dados para sincronizar');
      return;
    }

    const total = parsedEmbalagens.alterados.length;
    const totalLotes = Math.ceil(total / TAMANHO_LOTE);
    const grupoId = `GRP-${Date.now()}`;
    setSalvando(true);
    setProgresso({ atual: 0, total, lote: 0, totalLotes });
    let avisoServidorEmb = null;

    try {
      for (let i = 0; i < totalLotes; i++) {
        const inicio = i * TAMANHO_LOTE;
        const lote = parsedEmbalagens.alterados.slice(inicio, inicio + TAMANHO_LOTE);

        const resp = await base44.functions.invoke('importarProdutos', {
          alterados: lote,
          tipo_importacao: 'Embalagens (planilha)',
          is_ultimo_lote: i === totalLotes - 1,
          lote_numero: i + 1,
          total_lotes: totalLotes,
          grupo_importacao_id: grupoId,
        });

        const body = corpoRespostaInvoke(resp);
        if (body?.warning && !avisoServidorEmb) avisoServidorEmb = body.warning;

        setProgresso({ atual: Math.min(inicio + TAMANHO_LOTE, total), total, lote: i + 1, totalLotes });
      }

      toast.success(`Embalagens atualizadas: ${total} produto(s) em ${totalLotes} lote(s).`);
      if (avisoServidorEmb) {
        toast.warning(avisoServidorEmb);
      }
      setSalvouEmbalagensOk(true);
      setParsedEmbalagens(null);
      window.dispatchEvent(new Event('produtos:refresh'));
    } catch (error) {
      console.error('Erro na sincronização de embalagens:', error);
      toast.error(`Erro no lote ${progresso.lote + 1}: ${mensagemErroFunctionInvoke(error)}`);
    } finally {
      setSalvando(false);
      setProgresso({ atual: 0, total: 0, lote: 0, totalLotes: 0 });
    }
  };

  const handleConfirmarEstoque = async () => {
    if (!parsedEstoque?.alterados?.length) {
      toast.error('Sem dados para atualizar');
      return;
    }

    const total = parsedEstoque.alterados.length;
    const totalLotes = Math.ceil(total / TAMANHO_LOTE);
    setSalvando(true);
    setProgresso({ atual: 0, total, lote: 0, totalLotes });

    try {
      const user = await base44.auth.me();

      for (let i = 0; i < totalLotes; i++) {
        const inicio = i * TAMANHO_LOTE;
        const lote = parsedEstoque.alterados.slice(inicio, inicio + TAMANHO_LOTE);

        for (const { id, estoque_novo, estoque_anterior, produto_nome } of lote) {
          const diferenca = estoque_novo - estoque_anterior;
          await base44.entities.Produto.update(id, { estoque_atual: estoque_novo });
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: id,
            produto_nome,
            tipo: diferenca >= 0 ? 'Entrada' : 'Saída',
            motivo: 'Ajuste de Inventário',
            quantidade: Math.abs(diferenca),
            custo_unitario: 0,
            referencia_tipo: 'Importação de Inventário',
            observacoes: `Ajuste em massa: ${estoque_anterior} → ${estoque_novo}`,
            usuario_responsavel: user?.email || 'Sistema',
          });
        }

        setProgresso({ atual: Math.min(inicio + TAMANHO_LOTE, total), total, lote: i + 1, totalLotes });
      }

      toast.success(`✓ Estoque atualizado! ${total} produto(s) em ${totalLotes} lote(s).`);
      setSalvouOk(true);
      setParsedEstoque(null);
      // Invalidar cache global para que Produtos recarregue ao retornar
      window.dispatchEvent(new Event('produtos:refresh'));
    } catch (error) {
      console.error('❌ Erro ao atualizar estoque:', error);
      toast.error(`Erro no lote ${progresso.lote + 1}: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSalvando(false);
      setProgresso({ atual: 0, total: 0, lote: 0, totalLotes: 0 });
    }
  };

  const podeConfirmar = parsedData && parsedData.alterados?.length > 0 && parsedData.erros?.length === 0;
  const podeConfirmarEmbalagens =
    parsedEmbalagens && parsedEmbalagens.alterados?.length > 0 && parsedEmbalagens.erros?.length === 0;
  const podeConfirmarEstoque = parsedEstoque && parsedEstoque.alterados?.length > 0 && parsedEstoque.erros?.length === 0;

  return (
    <div className="min-h-screen bg-card p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground font-glacial mb-2">
            Importação de Produtos
          </h1>
          <p className="text-sm text-muted-foreground">
            Produtos, embalagens/unidades, estoque e histórico de importações.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="produtos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-muted p-1 rounded-xl gap-1">
            <TabsTrigger value="produtos" className="data-[state=active]:bg-card rounded-lg">
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="embalagens" className="data-[state=active]:bg-card rounded-lg">
              <Package className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Embalagens</span>
            </TabsTrigger>
            <TabsTrigger value="estoque" className="data-[state=active]:bg-card rounded-lg">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="desfazer" className="data-[state=active]:bg-card rounded-lg">
              <RotateCcw className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Desfazer</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB: Produtos */}
          <TabsContent value="produtos" className="space-y-6 mt-8">
            {/* Step 1: Download */}
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  1
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Baixar planilha de produtos
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Gera um <strong>.xlsx</strong> com todos os produtos (sem Emb.1–5 — use a aba Embalagens). Colunas editáveis desbloqueadas; IDs e calculados somente leitura.
              </p>
              <ExportarPlanilha />
            </div>

            {/* Step 2: Upload */}
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  2
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Subir planilha editada
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione o arquivo <strong>.xlsx</strong> modificado. Colunas extras ou não reconhecidas serão ignoradas.
              </p>
              <ImportarPlanilha onParsed={handleParsed} />
            </div>

            {/* Step 3: Preview */}
            {parsedData && (
              <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                    3
                  </div>
                  <h2 className={P38_SECTION_TITLE}>
                    Validar e confirmar
                  </h2>
                </div>
                <ResumoPrevisualizacao data={parsedData} />

                {salvando && progresso.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Lote {progresso.lote} de {progresso.totalLotes}</span>
                      <span>{progresso.atual} / {progresso.total} produtos</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-background dark:bg-card h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((progresso.atual / progresso.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {Math.round((progresso.atual / progresso.total) * 100)}% concluído — não feche esta página
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleConfirmar}
                  disabled={!podeConfirmar || salvando}
                  className="w-full bg-background dark:bg-card dark:text-foreground hover:bg-primary/90 dark:hover:bg-muted h-11 text-sm font-medium rounded-xl"
                >
                  {salvando
                    ? `Sincronizando lote ${progresso.lote}/${progresso.totalLotes}...`
                    : `Confirmar Sincronização (${parsedData.alterados?.length ?? 0} registros)`}
                </Button>
              </div>
            )}

            {salvouOk && !parsedEstoque && (
              <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Sincronização concluída com sucesso!
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB: Embalagens */}
          <TabsContent value="embalagens" className="space-y-6 mt-8">
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  1
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Baixar planilha de embalagens
                </h2>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-2 mb-2">
                <BookOpen className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                <span>
                  Documentação da migração (no clone Git):{' '}
                  <code className="text-[11px] rounded bg-muted/80 dark:bg-muted/80 px-1 py-0.5">docs/migration/README.md</code>
                  {' · '}
                  <code className="text-[11px] rounded bg-muted/80 dark:bg-muted/80 px-1 py-0.5">docs/migration/A29_VS_VAREJO_EMBALAGENS_GAP.md</code>
                </span>
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Slots Emb.1–5 e unidade de apresentação PDV em planilha separada da importação geral de produtos.
              </p>
              <ExportarEmbalagensPlanilha />
            </div>

            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  2
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Subir planilha editada
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Identificação por <strong>ID</strong> ou <strong>Cód. Interno</strong>. Cabeçalhos devem coincidir com o export desta aba.
              </p>
              <ImportarEmbalagensPlanilha onParsed={handleParsedEmbalagens} />
            </div>

            {parsedEmbalagens && (
              <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                    3
                  </div>
                  <h2 className={P38_SECTION_TITLE}>
                    Validar e confirmar
                  </h2>
                </div>
                <ResumoPrevisualizacao data={parsedEmbalagens} />

                {salvando && progresso.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Lote {progresso.lote} de {progresso.totalLotes}</span>
                      <span>{progresso.atual} / {progresso.total} produtos</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-background dark:bg-card h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((progresso.atual / progresso.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {Math.round((progresso.atual / progresso.total) * 100)}% concluído — não feche esta página
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleConfirmarEmbalagens}
                  disabled={!podeConfirmarEmbalagens || salvando}
                  className="w-full bg-background dark:bg-card dark:text-foreground hover:bg-primary/90 dark:hover:bg-muted h-11 text-sm font-medium rounded-xl"
                >
                  {salvando
                    ? `Sincronizando lote ${progresso.lote}/${progresso.totalLotes}...`
                    : `Confirmar embalagens (${parsedEmbalagens.alterados?.length ?? 0} produtos)`}
                </Button>
              </div>
            )}

            {salvouEmbalagensOk && (
              <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Embalagens e unidades atualizadas com sucesso!
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB: Estoque */}
          <TabsContent value="estoque" className="space-y-6 mt-8">
            {/* Step 1: Download */}
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  1
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Baixar template de estoque
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Gera um <strong>.xlsx</strong> com ID, Nome e Estoque Atual de todos os produtos.
              </p>
              <ExportarEstoque />
            </div>

            {/* Step 2: Upload */}
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                  2
                </div>
                <h2 className={P38_SECTION_TITLE}>
                  Subir planilha de inventário
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Importe o arquivo <strong>.xlsx</strong> com as quantidades atualizadas. Movimentações de estoque serão geradas automaticamente.
              </p>
              <ImportarEstoque onParsed={handleParsedEstoque} />
            </div>

            {/* Step 3: Preview */}
            {parsedEstoque && (
              <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-card text-card-foreground text-sm font-bold flex items-center justify-center">
                    3
                  </div>
                  <h2 className={P38_SECTION_TITLE}>
                    Validar e confirmar ajustes
                  </h2>
                </div>
                
                <div className="space-y-3">
                  {parsedEstoque.erros?.length > 0 && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <p className="font-medium text-red-700 dark:text-red-400">Erros encontrados:</p>
                      </div>
                      {parsedEstoque.erros.map((erro, idx) => (
                        <p key={idx} className="text-xs text-red-600 dark:text-red-400 ml-7">• {erro.mensagem}</p>
                      ))}
                    </div>
                  )}
                  
                  {parsedEstoque.alterados?.length > 0 && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                        {parsedEstoque.alterados.length} produto(s) serão atualizados
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {parsedEstoque.alterados.slice(0, 10).map((item, idx) => (
                          <p key={idx} className="text-xs text-blue-600 dark:text-blue-400">
                            • {item.produto_nome}: {item.estoque_anterior} → {item.estoque_novo}
                          </p>
                        ))}
                        {parsedEstoque.alterados.length > 10 && (
                          <p className="text-xs text-blue-500 dark:text-blue-400 italic">
                            ... e mais {parsedEstoque.alterados.length - 10} itens
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {salvando && progresso.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Lote {progresso.lote} de {progresso.totalLotes}</span>
                      <span>{progresso.atual} / {progresso.total} produtos</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-background dark:bg-card h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((progresso.atual / progresso.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {Math.round((progresso.atual / progresso.total) * 100)}% concluído — não feche esta página
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleConfirmarEstoque}
                  disabled={!podeConfirmarEstoque || salvando}
                  className="w-full bg-background dark:bg-card dark:text-foreground hover:bg-primary/90 dark:hover:bg-muted h-11 text-sm font-medium rounded-xl"
                >
                  {salvando
                    ? `Atualizando lote ${progresso.lote}/${progresso.totalLotes}...`
                    : `Confirmar Atualização (${parsedEstoque.alterados?.length ?? 0} produtos)`}
                </Button>
              </div>
            )}

            {salvouOk && parsedEstoque === null && (
              <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Estoque atualizado e movimentações registradas com sucesso!
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB: Desfazer */}
          <TabsContent value="desfazer" className="mt-8">
            <div className="rounded-2xl bg-muted/50/50 p-6 shadow-sm space-y-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground font-glacial mb-2">
                  Histórico de Importações
                </h2>
                <p className="text-sm text-muted-foreground">
                  Restaure produtos para o estado anterior a uma importação realizada.
                </p>
              </div>
              <DesfazerImportacao />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}