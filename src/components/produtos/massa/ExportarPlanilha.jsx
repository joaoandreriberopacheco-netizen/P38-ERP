import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { COLUNAS_CONFIG } from './colunasConfig';
import { buildExcelCanonConcatExpr, computeProdutoLinhaChecksum, produtoLinhaCanonico } from './produtoMassaChecksum';
import { normalizeUnitCode } from '@/lib/productUnits';
import { vitrineArmazenadaDoProduto } from './embalagensPlanilhaUtils';
import { dataHoje } from '@/components/utils/dateUtils';

// Índice (1-based) de colunas especiais
function getColIndex(key) {
  return COLUNAS_CONFIG.findIndex(c => c.key === key) + 1;
}

function colLetter(index) {
  let result = '';
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

function normalizeBooleanCell(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['sim', 'true', 'verdadeiro', '1'].includes(normalized)) return 'true';
  if (['não', 'nao', 'false', 'falso', '0'].includes(normalized)) return 'false';
  return 'false';
}

export default function ExportarPlanilha() {
  const [loading, setLoading] = useState(false);

  const handleExportar = async () => {
    setLoading(true);
    try {
      // Carregar todos os produtos sem limite
      let produtos = [];
      let skip = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const batch = await base44.entities.Produto.list('-updated_date', pageSize, skip);
        if (batch.length === 0) {
          hasMore = false;
        } else {
          produtos = produtos.concat(batch);
          skip += pageSize;
        }
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'VarejoSync';
      const ws = wb.addWorksheet('Produtos', { views: [{ state: 'frozen', ySplit: 1 }] });

      // Montar colunas (sem preco_venda_percentual — Margem removida)
      ws.columns = COLUNAS_CONFIG.map(col => ({
        header: col.label,
        key: col.key,
        width: col.width || 20,
      }));

      // ── Linha 1: cabeçalhos sempre locked ─────────────────────────────────
      const headerRow = ws.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.protection = { locked: true };
      });
      headerRow.height = 24;

      // Índices relevantes para fórmulas e formatação condicional
      const idxValorCompra       = getColIndex('valor_compra');
      const idxDescontoPerc      = getColIndex('desconto_perc');
      const idxFrete             = getColIndex('custo_frete_padrao');
      const idxImposto1          = getColIndex('custo_imposto1_padrao');
      const idxImposto2          = getColIndex('custo_imposto2_padrao');
      const idxH1                = getColIndex('campo_hierarquico_1');
      const idxCustoCalc         = getColIndex('custo_total_calculado');
      const idxPrecoVenda        = getColIndex('preco_venda_padrao');
      const idxId                = getColIndex('id');

      const letCustoCalc   = colLetter(idxCustoCalc);
      const letPrecoVenda  = colLetter(idxPrecoVenda);
      const letId          = colLetter(idxId);
      const letValorCompra = colLetter(idxValorCompra);
      const letDescontoPerc = colLetter(idxDescontoPerc);
      const letFrete       = colLetter(idxFrete);
      const letImposto1    = colLetter(idxImposto1);
      const letImposto2    = colLetter(idxImposto2);
      const letH1          = colLetter(idxH1);
      const lastCol        = colLetter(COLUNAS_CONFIG.length);

      // ── Data validation por coluna (schema-driven) ─────────────────────────
      const EXTRA_BLANK_ROWS = 1500; // linhas em branco disponíveis para novos produtos
      const maxRows = 1 + produtos.length + EXTRA_BLANK_ROWS;

      COLUNAS_CONFIG.forEach((col, idx) => {
        const letter = colLetter(idx + 1);
        const range = `${letter}2:${letter}${maxRows}`;

        if (col.tipo === 'numero') {
          ws.dataValidations.add(range, {
            type: 'decimal',
            operator: 'greaterThanOrEqual',
            showErrorMessage: true,
            errorTitle: 'Valor inválido',
            error: `"${col.label}" deve ser um número.`,
            formulae: [0],
          });
        } else if (col.tipo === 'boolean') {
          ws.dataValidations.add(range, {
            type: 'list',
            allowBlank: true,
            showDropDown: false,
            formulae: ['"true,false"'],
          });
        } else if (col.enum) {
          ws.dataValidations.add(range, {
            type: 'list',
            allowBlank: true,
            showDropDown: false,
            showErrorMessage: true,
            errorTitle: 'Valor inválido',
            error: `Valores permitidos: ${col.enum.join(', ')}`,
            formulae: [`"${col.enum.join(',')}"`],
          });
        }
      });

      // ── Linhas de dados ────────────────────────────────────────────────────
      produtos.forEach((p, dataRowIdx) => {
        const rowNumber = dataRowIdx + 2; // linha 2 em diante

        const snapLetter = colLetter(getColIndex('_canon_snapshot'));
        const canonExpr = buildExcelCanonConcatExpr(rowNumber, (key) => colLetter(getColIndex(key)));

        // Calcula custoCalc para usar nas fórmulas
        const descontoPerc = p.desconto_perc ?? 0;
        const valorCompraLiquido = (p.valor_compra || 0) * (1 - (descontoPerc / 100));
        const custoCalc =
          valorCompraLiquido
          + (p.custo_frete_padrao || 0)
          + (p.custo_imposto1_padrao || 0)
          + (p.custo_imposto2_padrao || 0)
          + (p.custo_outros_padrao || 0)
          + ((p.valor_compra || 0) * (Number(p.avaria_percentual) || 0) / 100);
        const rowData = {};
        COLUNAS_CONFIG.forEach(col => {
          if (col.key === 'custo_total_calculado') {
            rowData[col.key] = {
              formula: `=${letValorCompra}${rowNumber}*(1-IF(${letDescontoPerc}${rowNumber}="",0,${letDescontoPerc}${rowNumber})/100)+${letFrete}${rowNumber}+${letImposto1}${rowNumber}+${letImposto2}${rowNumber}`,
              result: custoCalc,
            };
          } else if (col.key === '_canon_snapshot') {
            rowData[col.key] = produtoLinhaCanonico(p);
          } else if (col.key === '_hash_orig') {
            rowData[col.key] = computeProdutoLinhaChecksum(p);
          } else if (col.key === 'alterado') {
            rowData[col.key] = {
              formula: `=IF(${snapLetter}${rowNumber}="","SIM",IF(${canonExpr}=${snapLetter}${rowNumber},"NÃO","SIM"))`,
              result: 'NÃO',
            };
          } else if (col.tipo === 'boolean') {
            rowData[col.key] = normalizeBooleanCell(p[col.key]);
          } else if (col.key === 'unidade_vitrine') {
            const principal = normalizeUnitCode(p.unidade_principal) || 'UN';
            rowData[col.key] = vitrineArmazenadaDoProduto(p, principal);
          } else {
            rowData[col.key] = p[col.key] ?? '';
          }
        });

        // Remove redundante: custoCalc, valorCompraLiquido e descontoPerc já calculados acima

        const row = ws.addRow(rowData);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colConfig = COLUNAS_CONFIG[colNumber - 1];
          const isLocked = !colConfig || !colConfig.editavel;
          cell.protection = { locked: isLocked };

          if (colConfig?.editavel) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          } else if (colConfig?.calculado) {
            // colunas calculadas: fundo azul claro
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
            cell.font = { italic: true, color: { argb: 'FF0369A1' } };
          }

          if (colConfig?.tipo === 'numero') {
            cell.numFmt = '#,##0.00';
          }
        });
      });

      ws.getColumn(getColIndex('_canon_snapshot')).hidden = true;

      // ── Formatação Condicional ─────────────────────────────────────────────
      const dataRange = `A2:${lastCol}${maxRows}`;
      const precoRange = `${letPrecoVenda}2:${letPrecoVenda}${maxRows}`;
      const letAlterado = colLetter(getColIndex('alterado'));
      const alteradoRange = `${letAlterado}2:${letAlterado}${maxRows}`;

      // 1. Preço de Venda com fundo vermelho se < Custo Calculado
      ws.addConditionalFormatting({
        ref: precoRange,
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [`${letPrecoVenda}2<${letCustoCalc}2`],
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCA5A5' } },
              font: { color: { argb: 'FF991B1B' }, bold: true },
            },
          },
        ],
      });

      // 2. Linha inteira em verde se ID estiver vazio (novo produto)
      ws.addConditionalFormatting({
        ref: dataRange,
        rules: [
          {
            type: 'expression',
            priority: 2,
            formulae: [`$${letId}2=""`],
            style: {
              font: { color: { argb: 'FF166534' } },
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF0FDF4' } },
            },
          },
        ],
      });

      ws.addConditionalFormatting({
        ref: alteradoRange,
        rules: [
          {
            type: 'expression',
            priority: 3,
            formulae: [`${letAlterado}2="SIM"`],
            style: {
              fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEF9C3' } },
              font: { color: { argb: 'FF92400E' }, bold: true },
            },
          },
        ],
      });

      // ── Sem proteção — total liberdade para usar Excel ──────────────────────
      // Nenhuma proteção de planilha, permitindo remover linhas, filtrar, ordenar, etc.

      ws.autoFilter = { from: 'A1', to: `${lastCol}1` };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `produtos_${dataHoje()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExportar}
      disabled={loading}
      variant="outline"
      className="gap-2 border-border/40"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? 'Gerando planilha...' : 'Exportar Produtos (.xlsx)'}
    </Button>
  );
}