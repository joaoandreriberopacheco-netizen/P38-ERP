import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExportarPlanilha from '@/components/produtos/massa/ExportarPlanilha.jsx';
import ImportarPlanilha from '@/components/produtos/massa/ImportarPlanilha.jsx';
import ExportarEmbalagensPlanilha from '@/components/produtos/massa/ExportarEmbalagensPlanilha.jsx';
import ImportarEmbalagensPlanilha from '@/components/produtos/massa/ImportarEmbalagensPlanilha.jsx';
import ResumoPrevisualizacao from '@/components/produtos/massa/ResumoPrevisualizacao.jsx';
import ExportarEstoque from '@/components/produtos/massa/ExportarEstoque.jsx';
import ImportarEstoque from '@/components/produtos/massa/ImportarEstoque.jsx';
import DesfazerImportacao from '@/components/produtos/massa/DesfazerImportacao.jsx';
import { buildLegacyUnitBackfillPatch } from '@/lib/productUnits';
import {
  normalizeSigla,
  buildProdutoUnidadesPatchFromVitrine,
} from '@/lib/productUnitsCrud';
import { P38MobileLine, P38MobileLineList } from '@/components/ui/p38-mobile-line';
import { toast } from 'sonner';

export default function EditarProdutosEmMassa() {
  const [parsedData, setParsedData] = useState(null);
  const [parsedEmbalagens, setParsedEmbalagens] = useState(null);
  const [parsedEstoque, setParsedEstoque] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvouOk, setSalvouOk] = useState(false);
  const [salvouOkEmbalagens, setSalvouOkEmbalagens] = useState(false);
  const [salvouOkEstoque, setSalvouOkEstoque] = useState(false);
  const [resultadoSucesso, setResultadoSucesso] = useState(null);
  const [resultadoEmbalagensSucesso, setResultadoEmbalagensSucesso] = useState(null);
  const [resultadoEstoqueSucesso, setResultadoEstoqueSucesso] = useState(null);
  const [processandoBackfillLegado, setProcessandoBackfillLegado] = useState(false);
  const [resumoBackfillLegado, setResumoBackfillLegado] = useState(null);

  const resumirAlterados = (alterados = []) => ({
    total: alterados.length,
    novos: alterados.filter((item) => item.isNew).length,
    atualizados: alterados.filter((item) => !item.isNew).length,
  });

  const mensagemImportacaoConcluida = ({ total, novos, atualizados }) => {
    const partes = [`Processo finalizado: ${total} produto(s) processado(s)`];
    if (novos > 0) partes.push(`${novos} criado(s)`);
    if (atualizados > 0) partes.push(`${atualizados} atualizado(s)`);
    return partes.join(' · ');
  };

  const handleParsed = useCallback((data) => {
    setParsedData(data);
    setSalvouOk(false);
    setResultadoSucesso(null);
  }, []);

  const handleParsedEmbalagens = useCallback((data) => {
    setParsedEmbalagens(data);
    setSalvouOkEmbalagens(false);
    setResultadoEmbalagensSucesso(null);
  }, []);

  const handleParsedEstoque = useCallback((data) => {
    setParsedEstoque(data);
    setSalvouOkEstoque(false);
    setResultadoEstoqueSucesso(null);
  }, []);

  const handleConfirmar = async () => {
    if (!parsedData?.alterados?.length) {
      console.log('❌ Sem dados para sincronizar');
      return;
    }
    setSalvando(true);
    const resumo = resumirAlterados(parsedData.alterados);
    try {
      console.log('🔄 Iniciando sincronização de', parsedData.alterados.length, 'produtos');
      const user = await base44.auth.me();
      
      // Criar snapshot antes de importar (para desfazer depois)
      const idsAfetados = parsedData.alterados.map(a => a.id).filter(Boolean);
      const snapshotDados = [];
      const produtoAntigoPorId = new Map();

      if (idsAfetados.length > 0) {
        const produtosAntigos = await base44.entities.Produto.filter({ id: idsAfetados });
        snapshotDados.push(...produtosAntigos);
        for (const p of produtosAntigos || []) {
          if (p?.id) produtoAntigoPorId.set(p.id, p);
        }
      }

      // Registrar snapshot
      await base44.entities.ImportacaoLog.create({
        usuario_responsavel: user?.full_name || user?.email,
        quantidade_itens: parsedData.alterados.length,
        snapshot_dados: snapshotDados,
        tipo_importacao: 'Detalhes do Produto'
      });

      // Executar importação
      for (const { id, dados, isNew } of parsedData.alterados) {
        if (isNew) {
           // Novo produto: construir com campos obrigatórios garantidos
           const novosProduto = {
             tipo: dados.tipo && String(dados.tipo).trim() ? dados.tipo : 'Produto',
             preco_venda_padrao: Number(dados.preco_venda_padrao) || 0,
             campo_hierarquico_1: dados.campo_hierarquico_1 && String(dados.campo_hierarquico_1).trim() ? dados.campo_hierarquico_1 : 'Sem categoria'
           };

           // Adicionar apenas campos válidos do schema (excluir 'numero' e outros inválidos)
           const validFields = ['codigo_barras', 'marca', 'categoria_nome', 'area_codigo', 'valor_compra', 'custo_frete_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'desconto_compra_padrao', 'preco_venda_percentual', 'preco_custo_calculado', 'unidade_principal', 'unidade_vitrine', 'unidades', 'unidades_alternativas', 'unidades_por_pacote', 'estoque_minimo', 'estoque_ideal', 'estoque_maximo', 'tempo_reposicao_dias', 'peso_kg', 'dimensoes_cm', 'abcd', 'ativo', 'nome', 'campo_hierarquico_2', 'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5'];
           validFields.forEach(field => {
             if (field === 'unidade_vitrine') {
               if (!Object.prototype.hasOwnProperty.call(dados, field)) return;
               novosProduto[field] = dados[field] == null ? '' : String(dados[field]).trim();
               return;
             }
             if ((field === 'unidades_alternativas' || field === 'unidades') && Array.isArray(dados[field])) {
               novosProduto[field] = dados[field];
               return;
             }
             const valor = dados[field];
             if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
               novosProduto[field] = valor;
             }
           });

           console.log('📦 Payload novo:', novosProduto);
           await base44.entities.Produto.create(novosProduto);
        } else {
          // Produto existente: atualizar apenas campos alterados
          const dadosAtualizacao = {};
          const validFields = ['tipo', 'preco_venda_padrao', 'campo_hierarquico_1', 'campo_hierarquico_2', 'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5', 'codigo_barras', 'marca', 'categoria_nome', 'area_codigo', 'valor_compra', 'custo_frete_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'desconto_compra_padrao', 'preco_venda_percentual', 'preco_custo_calculado', 'unidade_principal', 'unidade_vitrine', 'unidades', 'unidades_alternativas', 'unidades_por_pacote', 'estoque_minimo', 'estoque_ideal', 'estoque_maximo', 'tempo_reposicao_dias', 'peso_kg', 'dimensoes_cm', 'abcd', 'ativo', 'nome'];
          validFields.forEach(field => {
            const valor = dados[field];
            if (field === 'unidade_vitrine') {
              if (!Object.prototype.hasOwnProperty.call(dados, field)) return;
              dadosAtualizacao[field] = valor == null ? '' : String(valor).trim();
              return;
            }
            if ((field === 'unidades_alternativas' || field === 'unidades') && Array.isArray(valor)) {
              dadosAtualizacao[field] = valor;
              return;
            }
            if (valor === null || valor === undefined) return;
            if (String(valor).trim() !== '') {
              dadosAtualizacao[field] = valor;
            }
          });

          if (Object.prototype.hasOwnProperty.call(dadosAtualizacao, 'unidade_vitrine')) {
            const anterior = produtoAntigoPorId.get(id);
            if (anterior) {
              const principal =
                normalizeSigla(dadosAtualizacao.unidade_principal || anterior?.unidade_principal) || 'UN';
              Object.assign(
                dadosAtualizacao,
                buildProdutoUnidadesPatchFromVitrine(
                  anterior,
                  dadosAtualizacao.unidade_vitrine,
                  principal,
                ),
              );
            }
          }

          if (Object.keys(dadosAtualizacao).length > 0) {
            console.log('📦 Payload atualização:', dadosAtualizacao);
            await base44.entities.Produto.update(id, dadosAtualizacao);
          }
        }
      }
      console.log('✅ Sincronização concluída com sucesso');
      const mensagem = mensagemImportacaoConcluida(resumo);
      toast.success(mensagem);
      setResultadoSucesso({ ...resumo, mensagem });
      setSalvouOk(true);
      setParsedData(null);
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast.error(`Erro ao sincronizar: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarEmbalagens = async () => {
    if (!parsedEmbalagens?.alterados?.length) return;
    setSalvando(true);
    const resumo = resumirAlterados(parsedEmbalagens.alterados);
    try {
      const user = await base44.auth.me();
      const idsAfetados = parsedEmbalagens.alterados.map((a) => a.id).filter(Boolean);
      const snapshotDados = [];
      if (idsAfetados.length > 0) {
        const produtosAntigos = await base44.entities.Produto.filter({ id: idsAfetados });
        snapshotDados.push(...produtosAntigos);
      }
      await base44.entities.ImportacaoLog.create({
        usuario_responsavel: user?.full_name || user?.email,
        quantidade_itens: parsedEmbalagens.alterados.length,
        snapshot_dados: snapshotDados,
        tipo_importacao: 'Embalagens (planilha)',
      });
      const camposEmb = ['unidade_principal', 'unidade_vitrine', 'unidades_alternativas'];
      for (const { id, dados } of parsedEmbalagens.alterados) {
        const dadosAtualizacao = {};
        camposEmb.forEach((field) => {
          if (!Object.prototype.hasOwnProperty.call(dados, field)) return;
          const valor = dados[field];
          if (field === 'unidades_alternativas') {
            if (Array.isArray(valor)) dadosAtualizacao[field] = valor;
            return;
          }
          if (field === 'unidade_vitrine') {
            dadosAtualizacao[field] = valor == null ? '' : String(valor).trim();
            return;
          }
          if (valor === null || valor === undefined) return;
          if (String(valor).trim() !== '') dadosAtualizacao[field] = valor;
        });
        if (Object.keys(dadosAtualizacao).length > 0) {
          await base44.entities.Produto.update(id, dadosAtualizacao);
        }
      }
      const mensagem = `Processo finalizado: ${resumo.total} produto(s) com embalagens atualizadas.`;
      toast.success(mensagem);
      setResultadoEmbalagensSucesso({ ...resumo, mensagem });
      setSalvouOkEmbalagens(true);
      setParsedEmbalagens(null);
    } catch (error) {
      console.error('❌ Erro na sincronização de embalagens:', error);
      toast.error(`Erro ao gravar embalagens: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarEstoque = async () => {
    if (!parsedEstoque?.alterados?.length) return;
    setSalvando(true);
    const total = parsedEstoque.alterados.length;
    try {
      const user = await base44.auth.me();
      
      for (const { id, estoque_novo, estoque_anterior, produto_nome } of parsedEstoque.alterados) {
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
      
      const mensagem = `Processo finalizado: ${total} produto(s) com estoque atualizado.`;
      toast.success(mensagem);
      setResultadoEstoqueSucesso({ total, mensagem });
      setSalvouOkEstoque(true);
      setParsedEstoque(null);
    } finally {
      setSalvando(false);
    }
  };

  const carregarTodosProdutos = async () => {
    let produtos = [];
    let skip = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const batch = await base44.entities.Produto.list('-updated_date', pageSize, skip);
      if (!batch.length) {
        hasMore = false;
      } else {
        produtos = produtos.concat(batch);
        skip += pageSize;
      }
    }
    return produtos;
  };

  const handleBackfillUnidadesLegadas = async () => {
    if (processandoBackfillLegado) return;
    setProcessandoBackfillLegado(true);
    try {
      const produtos = await carregarTodosProdutos();
      const candidatos = [];
      let ignoradosConsistentes = 0;
      let conflitos = 0;

      for (const produto of produtos) {
        const analise = buildLegacyUnitBackfillPatch(produto);
        if (analise.conflict) {
          conflitos += 1;
          continue;
        }
        if (!analise.hasChanges) {
          ignoradosConsistentes += 1;
          continue;
        }
        candidatos.push({ id: produto.id, nome: produto.nome, patch: analise.patch });
      }

      const resumoPrevio = {
        total: produtos.length,
        candidatos: candidatos.length,
        conflitos,
        ignorados: ignoradosConsistentes,
        atualizados: 0,
        erros: 0,
      };
      setResumoBackfillLegado(resumoPrevio);

      if (!candidatos.length) return;

      const confirmar = window.confirm(
        `Encontrados ${candidatos.length} produto(s) para alinhar ao formato atual de embalagens, ${conflitos} em conflito (não serão alterados) e ${ignoradosConsistentes} já corretos. Aplicar agora?`
      );
      if (!confirmar) return;

      const user = await base44.auth.me();
      const idsAfetados = candidatos.map((item) => item.id);
      const snapshotDados = await base44.entities.Produto.filter({ id: idsAfetados });
      await base44.entities.ImportacaoLog.create({
        usuario_responsavel: user?.full_name || user?.email,
        quantidade_itens: candidatos.length,
        snapshot_dados: snapshotDados || [],
        tipo_importacao: 'Recuperação embalagens (importação antiga)',
      });

      let atualizados = 0;
      let erros = 0;
      for (const item of candidatos) {
        try {
          await base44.entities.Produto.update(item.id, item.patch);
          atualizados += 1;
        } catch (error) {
          console.error(`Erro no backfill do produto ${item.id}:`, error);
          erros += 1;
        }
      }

      setResumoBackfillLegado({
        ...resumoPrevio,
        atualizados,
        erros,
      });
    } catch (error) {
      console.error('❌ Erro no backfill legado de unidades:', error);
      alert(`Erro ao padronizar embalagens: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setProcessandoBackfillLegado(false);
    }
  };

  const podeConfirmar = parsedData && parsedData.alterados?.length > 0 && parsedData.erros?.length === 0;
  const podeConfirmarEmbalagens =
    parsedEmbalagens && parsedEmbalagens.alterados?.length > 0 && parsedEmbalagens.erros?.length === 0;
  const podeConfirmarEstoque = parsedEstoque && parsedEstoque.alterados?.length > 0 && parsedEstoque.erros?.length === 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground font-glacial">
          Edição em Massa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualize detalhes, embalagens (base, alternativas e unidade vitrine) ou estoque em lote via planilha.
        </p>
      </div>

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-muted p-1 rounded-lg gap-1">
          <TabsTrigger value="produtos" className="data-[state=active]:bg-card">
            Detalhes do Produto
          </TabsTrigger>
          <TabsTrigger value="embalagens" className="data-[state=active]:bg-card">
            Embalagens
          </TabsTrigger>
          <TabsTrigger value="estoque" className="data-[state=active]:bg-card">
            Estoque em Massa
          </TabsTrigger>
          <TabsTrigger value="desfazer" className="data-[state=active]:bg-card">
            Desfazer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-8 mt-6">
          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={1} label="Baixar planilha" />
            <p className="text-sm text-muted-foreground mb-4">
              Gera um <strong>.xlsx</strong> com todos os produtos (sem colunas Base / Alt. — use a aba Embalagens). Colunas editáveis ficam desbloqueadas; IDs e campos calculados são somente-leitura.
            </p>
            <ExportarPlanilha />
          </div>

          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={2} label="Subir planilha editada" />
            <p className="text-sm text-muted-foreground mb-4">
              Selecione o arquivo <strong>.xlsx</strong> modificado. Colunas extras ou não reconhecidas serão ignoradas.
            </p>
            <ImportarPlanilha onParsed={handleParsed} />
          </div>

          {parsedData && (
            <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm space-y-4">
              <StepLabel number={3} label="Validar e confirmar" />
              <ResumoPrevisualizacao data={parsedData} />
              <Button
                onClick={handleConfirmar}
                disabled={!podeConfirmar || salvando}
                className="w-full h-11 text-sm font-medium"
              >
                {salvando ? 'Sincronizando...' : `Confirmar Sincronização (${parsedData.alterados?.length ?? 0} registros)`}
              </Button>
            </div>
          )}

          {salvouOk && resultadoSucesso && (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Importação concluída com sucesso
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                {resultadoSucesso.mensagem}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="embalagens" className="space-y-8 mt-6">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-6 shadow-sm border border-amber-100 dark:border-amber-800">
            <StepLabel number={0} label="Correção pontual (cadastros legados)" />
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
              Uso <strong>opcional</strong>: produtos que ainda refletem importações muito antigas. A ferramenta alinha o modelo atual — <strong>unidade principal</strong> (base, fator 1), até <strong>duas alternativas</strong> com <strong>fator de conversão</strong> e <strong>ajuste preço (×)</strong> sobre o preço da embalagem, e <strong>unidade vitrine</strong> (sigla gravada; célula vazia ou igual à base equivale à base). O fluxo normal de planilha nesta aba é independente disto.
            </p>
            <Button
              onClick={handleBackfillUnidadesLegadas}
              disabled={processandoBackfillLegado || salvando}
              className="w-full bg-amber-700 hover:bg-amber-600 text-white h-11 text-sm font-medium"
            >
              {processandoBackfillLegado ? 'Analisando e aplicando…' : 'Analisar e aplicar correção nos elegíveis'}
            </Button>
            {resumoBackfillLegado && (
              <div className="mt-4 rounded-lg bg-card/70 dark:bg-background/30 border border-amber-100 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                <p>Total analisado: {resumoBackfillLegado.total}</p>
                <p>Podem ser corrigidos: {resumoBackfillLegado.candidatos}</p>
                <p>Conflitos (revisão manual): {resumoBackfillLegado.conflitos}</p>
                <p>Já conformes ao formato atual: {resumoBackfillLegado.ignorados}</p>
                {typeof resumoBackfillLegado.atualizados === 'number' && <p>Atualizados: {resumoBackfillLegado.atualizados}</p>}
                {typeof resumoBackfillLegado.erros === 'number' && <p>Erros de update: {resumoBackfillLegado.erros}</p>}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={1} label="Baixar planilha de embalagens" />
            <p className="text-sm text-muted-foreground mb-4">
              Colunas: <strong>ID</strong>, <strong>Cód. Interno</strong>, <strong>Nome (referência)</strong>; para a <strong>base</strong> e até <strong>Alt.1</strong> e <strong>Alt.2</strong> — <strong>sigla</strong>, <strong>fator de conversão</strong> e <strong>ajuste preço (×)</strong> (multiplicador sobre o preço daquela embalagem; em branco conta como 1). Por fim, três colunas numéricas <strong>Base vitrine (0/1)</strong>, <strong>Alt.1 vitrine (0/1)</strong> e <strong>Alt.2 vitrine (0/1)</strong>: em cada linha deve haver exatamente um <strong>1</strong> (vitrine nesse slot) e dois <strong>0</strong>; na exportação, vitrine na base aparece como <code className="text-xs">1</code> só na coluna da base.
            </p>
            <ExportarEmbalagensPlanilha />
          </div>

          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={2} label="Subir planilha editada" />
            <p className="text-sm text-muted-foreground mb-4">
              Prefira o arquivo gerado no passo anterior. Cada linha é reconhecida pelo <strong>ID</strong> ou pelo <strong>Cód. Interno</strong> (colunas bloqueadas). Cabeçalhos antigos de colunas de embalagem ainda podem ser reconhecidos quando o padrão for compatível; o modelo antigo com coluna única «Unidade vitrine» não é mais aceite nesta aba — use as três colunas 0/1 por slot.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
              O envio só <strong>prepara</strong> as alterações (leitura e validação). Nada é gravado no Base44 até você clicar em <strong>Confirmar embalagens</strong>, quando <code className="text-xs">unidade_principal</code>, <code className="text-xs">unidades_alternativas</code> e <code className="text-xs">unidade_vitrine</code> são atualizados no cadastro.
            </p>
            <ImportarEmbalagensPlanilha onParsed={handleParsedEmbalagens} />
          </div>

          {parsedEmbalagens && (
            <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm space-y-4">
              <StepLabel number={3} label="Conferir e gravar no sistema" />
              <ResumoPrevisualizacao data={parsedEmbalagens} />
              <Button
                onClick={handleConfirmarEmbalagens}
                disabled={!podeConfirmarEmbalagens || salvando}
                className="w-full h-11 text-sm font-medium"
              >
                {salvando
                  ? 'Gravando embalagens…'
                  : `Confirmar embalagens (${parsedEmbalagens.alterados?.length ?? 0} produtos)`}
              </Button>
            </div>
          )}

          {salvouOkEmbalagens && resultadoEmbalagensSucesso && (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Embalagens gravadas com sucesso
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                {resultadoEmbalagensSucesso.mensagem}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="estoque" className="space-y-8 mt-6">
          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={1} label="Baixar template de estoque" />
            <p className="text-sm text-muted-foreground mb-4">
              Gera um <strong>.xlsx</strong> com ID, Nome e Estoque Atual de todos os produtos.
            </p>
            <ExportarEstoque />
          </div>

          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
            <StepLabel number={2} label="Subir planilha de inventário" />
            <p className="text-sm text-muted-foreground mb-4">
              Importe o arquivo <strong>.xlsx</strong> com as quantidades atualizadas. Movimentações de estoque serão geradas automaticamente.
            </p>
            <ImportarEstoque onParsed={handleParsedEstoque} />
          </div>

          {parsedEstoque && (
            <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm space-y-4">
              <StepLabel number={3} label="Validar e confirmar ajustes" />
              <div className="space-y-3">
                {parsedEstoque.erros?.length > 0 && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                      Erros encontrados:
                    </p>
                    {parsedEstoque.erros.map((erro, idx) => (
                      <p key={idx} className="text-xs text-red-600 dark:text-red-400">• {erro.mensagem}</p>
                    ))}
                  </div>
                )}
                
                {parsedEstoque.alterados?.length > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3">
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
              
              <Button
                onClick={handleConfirmarEstoque}
                disabled={!podeConfirmarEstoque || salvando}
                className="w-full h-11 text-sm font-medium"
              >
                {salvando ? 'Atualizando estoque...' : `Confirmar Atualização (${parsedEstoque.alterados?.length ?? 0} produtos)`}
              </Button>
            </div>
          )}

          {salvouOkEstoque && resultadoEstoqueSucesso && (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Estoque atualizado com sucesso
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                {resultadoEstoqueSucesso.mensagem}
              </p>
            </div>
          )}
          </TabsContent>

          <TabsContent value="desfazer" className="space-y-6 mt-6">
          <div className="rounded-2xl bg-muted/50/60 p-6 shadow-sm">
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
          );
          }

          function StepLabel({ number, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-6 h-6 rounded-full bg-card text-card-foreground text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <span className="font-semibold text-foreground text-sm font-glacial">{label}</span>
    </div>
  );
}