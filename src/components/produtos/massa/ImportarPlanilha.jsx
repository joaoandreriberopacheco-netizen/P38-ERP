import { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import ExcelJS from 'exceljs';
import { COLUNAS_CONFIG } from './colunasConfig';
import { produtoMassaImportLinhaTemAlteracao } from './produtoMassaChecksum';
import { normalizeSigla } from '@/lib/productUnitsCrud';
import {
  mapLegacyVitrineColumn,
  vitrineExibicaoParaArmazenada,
  findColunaByHeader,
  buildVitrineIsComercialPatch,
} from './embalagensPlanilhaUtils';
import { toast } from 'sonner';

function getCellValue(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v !== null && typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return v.result ?? null;
    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => (typeof t === 'string' ? t : t?.text ?? '')).join('');
    }
    if (typeof v.text === 'string' && Object.prototype.hasOwnProperty.call(v, 'hyperlink')) {
      return v.text;
    }
  }
  return v ?? null;
}

function concatHierarquia(h1, h2, h3, h4, h5) {
  return [h1, h2, h3, h4, h5].map(v => (v || '').trim()).filter(Boolean).join(' ').trim();
}

export default function ImportarPlanilha({ onParsed }) {
  const [arquivo, setArquivo] = useState(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef(null);

  const handleArquivo = useCallback(async (file) => {
    if (!file) return;
    setArquivo(file);
    setParsing(true);

    try {
      // 1. Carregar produtos existentes para comparação
      let produtosAtuais = [];
      let skip = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.entities.Produto.list('-updated_date', pageSize, skip);
        if (batch.length === 0) hasMore = false;
        else { 
          produtosAtuais = produtosAtuais.concat(batch); 
          skip += pageSize; 
        }
      }
      const mapaAtual = {};
      produtosAtuais.forEach(p => { mapaAtual[p.id] = p; });

      // 2. Carregar e processar arquivo Excel
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];

      // 3. Mapear colunas do Excel com a configuração
      const headerRow = ws.getRow(1);
      const colIndexMap = {};
      headerRow.eachCell((cell, colNumber) => {
        const label = (getCellValue(cell) || '').toString().trim();
        const colConfig = findColunaByHeader(label, COLUNAS_CONFIG);
        if (colConfig) colIndexMap[colConfig.key] = colNumber;
      });

      if (!colIndexMap.id || !colIndexMap.campo_hierarquico_1) {
        const faltando = [];
        if (!colIndexMap.id) faltando.push('ID (não editar)');
        if (!colIndexMap.campo_hierarquico_1) faltando.push('Nível 1 (*)');
        throw new Error(
          `Cabeçalhos obrigatórios ausentes na linha 1: ${faltando.join(', ')}. Exporte de novo pelo app e não altere os títulos da primeira linha.`,
        );
      }

      const alterados = [];
      const erros = [];
      let linhasIgnoradasSemMudanca = 0;

      // 4. Processar cada linha (ignorar linhas completamente vazias)
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);

        // Verificar se a linha inteira está vazia (nenhuma célula preenchida)
        let linhaVazia = true;
        const totalColunasImportaveis = COLUNAS_CONFIG.filter(
          col => !['_hash_orig', 'alterado', '_canon_snapshot'].includes(col.key),
        ).length;
        for (let j = 1; j <= totalColunasImportaveis; j++) {
          const cellValue = getCellValue(row.getCell(j));
          if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
            linhaVazia = false;
            break;
          }
        }

        if (linhaVazia) continue;

        const idCell = row.getCell(colIndexMap['id']);
        const h1Cell = row.getCell(colIndexMap['campo_hierarquico_1']);

        const id = String(getCellValue(idCell) || '').trim();
        const h1 = String(getCellValue(h1Cell) || '').trim();

        const dadosExtraidos = {};
        let erroNaLinha = false;
        
        // 5. Extrair valores e validar tipos
        for (const col of COLUNAS_CONFIG) {
          if (col.editavel && !col.calculado) {
            const colNum = colIndexMap[col.key];
            if (!colNum) continue;
            const cell = row.getCell(colNum);
            const valorBruto = getCellValue(cell);
            
            if (col.tipo === 'numero') {
              const num = parseFloat(valorBruto);
              if (!isNaN(num)) {
                dadosExtraidos[col.key] = num;
              } else if (valorBruto !== null && valorBruto !== undefined && String(valorBruto).trim() !== '') {
                erros.push({ 
                  linha: i, 
                  mensagem: `Linha ${i}: Campo "${col.label}" deve ser numérico. Valor: "${valorBruto}"` 
                });
                erroNaLinha = true;
              }
            } else if (col.tipo === 'boolean') {
              if (valorBruto !== null && valorBruto !== undefined) {
                const str = String(valorBruto).trim().toLowerCase();
                if (['sim', 'true', '1', 's'].includes(str)) {
                  dadosExtraidos[col.key] = true;
                } else if (['não', 'false', '0', 'n'].includes(str)) {
                  dadosExtraidos[col.key] = false;
                }
              }
            } else {
              if (valorBruto !== null && valorBruto !== undefined) {
                dadosExtraidos[col.key] = String(valorBruto).trim();
              }
            }
          }
        }

        // 6. Validações específicas de campos obrigatórios
        const camposFaltantes = [];
        
        if (!dadosExtraidos.campo_hierarquico_1 || dadosExtraidos.campo_hierarquico_1 === '') {
          camposFaltantes.push('"Nível 1"');
        }

        if (!dadosExtraidos.tipo || dadosExtraidos.tipo === '') {
          camposFaltantes.push('"Tipo"');
        }

        if (dadosExtraidos.preco_venda_padrao === undefined || dadosExtraidos.preco_venda_padrao === null || dadosExtraidos.preco_venda_padrao === '') {
          camposFaltantes.push('"Preço Venda"');
        }
        
        if (camposFaltantes.length > 0) {
          erros.push({ 
            linha: i, 
            mensagem: `Linha ${i}: Campos obrigatórios faltando: ${camposFaltantes.join(', ')}.` 
          });
          erroNaLinha = true;
        }

        // Pular linha se houver erros de validação
        if (erroNaLinha) continue;

        mapLegacyVitrineColumn(dadosExtraidos);

        // 7. Remover campos não mapeados (que não existem na entidade Produto)
        const camposValidos = ['campo_hierarquico_1', 'campo_hierarquico_2', 'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5', 'codigo_barras', 'tipo', 'preco_venda_padrao', 'valor_compra', 'desconto_perc', 'desconto_compra_padrao', 'custo_frete_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'custo_outros_padrao', 'avaria_percentual', 'preco_venda_percentual', 'preco_custo_calculado', 'unidade_principal', 'unidade_vitrine', 'unidades', 'unidades_alternativas', 'unidades_por_pacote', 'casas_decimais', 'estoque_minimo', 'estoque_ideal', 'estoque_maximo', 'tempo_reposicao_dias', 'peso_kg', 'dimensoes_cm', 'abcd', 'preco_livre', 'controla_serial', 'controla_lote', 'controla_validade', 'ativo', 'nome', 'marca', 'categoria_nome', 'area_codigo'];
        Object.keys(dadosExtraidos).forEach(key => {
          if (!camposValidos.includes(key)) {
            delete dadosExtraidos[key];
          }
        });

        // Coluna presente na planilha: célula vazia = vitrine na base (`''` gravado). Sem isto a chave
        // somece, o merge para o hash mantém o valor antigo e a linha é ignorada como inalterada.
        if (colIndexMap.unidade_vitrine) {
          const raw = getCellValue(row.getCell(colIndexMap.unidade_vitrine));
          const rawStr = raw == null || raw === '' ? '' : String(raw).trim();
          const principalBase =
            normalizeSigla(
              dadosExtraidos.unidade_principal
                || (id && mapaAtual[id]?.unidade_principal)
                || 'UN',
            ) || 'UN';
          dadosExtraidos.unidade_vitrine = vitrineExibicaoParaArmazenada(rawStr, principalBase);
        } else if (Object.prototype.hasOwnProperty.call(dadosExtraidos, 'unidade_vitrine')) {
          const principalBase =
            normalizeSigla(
              dadosExtraidos.unidade_principal
                || (id && mapaAtual[id]?.unidade_principal)
                || 'UN',
            ) || 'UN';
          dadosExtraidos.unidade_vitrine = vitrineExibicaoParaArmazenada(
            dadosExtraidos.unidade_vitrine,
            principalBase,
          );
        }

        const dadosPlanilha = { ...dadosExtraidos };

        // Espelha `is_comercial` nas arrays a partir da vitrine (Excel não precisa da coluna).
        if (id && mapaAtual[id] && Object.prototype.hasOwnProperty.call(dadosExtraidos, 'unidade_vitrine')) {
          const principalBaseSync =
            normalizeSigla(
              dadosExtraidos.unidade_principal || mapaAtual[id]?.unidade_principal || 'UN',
            ) || 'UN';
          const vitrineEspelhoPatch = buildVitrineIsComercialPatch(
            mapaAtual[id],
            dadosExtraidos.unidade_vitrine,
            principalBaseSync,
          );
          Object.assign(dadosExtraidos, vitrineEspelhoPatch);
        }

        // 8. Construir nome completo
        const nome = concatHierarquia(
          dadosExtraidos.campo_hierarquico_1,
          dadosExtraidos.campo_hierarquico_2,
          dadosExtraidos.campo_hierarquico_3,
          dadosExtraidos.campo_hierarquico_4,
          dadosExtraidos.campo_hierarquico_5
        );
        dadosExtraidos.nome = nome;

        // 9. Classificar como novo ou existente (ignorar se canónico da planilha = cadastro)
          if (id && mapaAtual[id]) {
            if (!produtoMassaImportLinhaTemAlteracao(mapaAtual[id], dadosPlanilha)) {
              linhasIgnoradasSemMudanca += 1;
              continue;
            }

            alterados.push({ id, dados: dadosExtraidos, nome, isNew: false });
          } else if (!id && h1) {
            // Novo produto (sem ID)
            alterados.push({ id: null, dados: dadosExtraidos, nome, isNew: true });
          } else if (id && !mapaAtual[id]) {
            // ID existe no arquivo mas não no banco — trata como novo
            console.warn(`ID ${id} não encontrado no banco. Criando como novo.`);
            alterados.push({ id: null, dados: dadosExtraidos, nome, isNew: true });
          }
      }

      // 10. Feedback ao usuário
      if (erros.length > 0) {
        toast.error(`Encontrados ${erros.length} erro(s) de validação. Verifique a lista abaixo.`);
      }

      if (alterados.length > 0 || linhasIgnoradasSemMudanca > 0) {
        const partes = [];
        if (alterados.length > 0) partes.push(`${alterados.length} produto(s) com alterações`);
        if (linhasIgnoradasSemMudanca > 0) {
          partes.push(`${linhasIgnoradasSemMudanca} linha(s) inalteradas ignoradas`);
        }
        toast.success(partes.join(' · '));
      }

      // Callback com dados processados
      onParsed({ alterados, erros, linhasIgnoradasSemMudanca });

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
      onParsed({ alterados: [], erros: [{ linha: 0, mensagem: error.message }], linhasIgnoradasSemMudanca: 0 });
    } finally {
      setParsing(false);
    }
  }, [onParsed]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleArquivo(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.xlsx')) {
      handleArquivo(file);
    } else {
      toast.error('Por favor, selecione um arquivo .xlsx válido');
    }
  };

  const handleRemover = () => {
    setArquivo(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {!arquivo || parsing ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="relative rounded-xl border-2 border-dashed border-border/40 dark:border-border/40 bg-muted/50/50 p-8 transition-colors hover:border-border/40 hover:bg-muted"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={parsing}
          />
          
          <div className="flex flex-col items-center justify-center text-center pointer-events-none">
            {parsing ? (
              <>
                <div className="w-12 h-12 rounded-full border-4 border-border/40 border-t-foreground dark:border-t-white animate-spin mb-3" />
                <p className="text-sm font-medium text-foreground">Processando arquivo...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivos .xlsx apenas. Máximo 10 MB.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                {arquivo.name}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                {(arquivo.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={handleRemover}
            className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
            title="Remover arquivo"
          >
            <X className="w-4 h-4 text-green-600 dark:text-green-400" />
          </button>
        </div>
      )}
    </div>
  );
}