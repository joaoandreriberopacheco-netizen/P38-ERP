/** Estilo alinhado ao exportador em massa (`ExportarPlanilha.jsx`). */

export const HEADER_FILL = 'FF1F2937';
export const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

export const FILL_EDITAVEL = 'FFF9FAFB';
export const FILL_CALCULADO = 'FFE0F2FE';
export const FONT_CALCULADO = { italic: true, color: { argb: 'FF0369A1' } };

export const FILL_DIM = 'FFF0FDF4'; // verde suave — abas de dimensão

export function styleHeaderRow(row, { height = 24 } = {}) {
  row.height = height;
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

export function styleDataCell(cell, { editavel = true, calculado = false, numero = false } = {}) {
  if (calculado) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_CALCULADO } };
    cell.font = FONT_CALCULADO;
  } else if (editavel) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_EDITAVEL } };
  }
  if (numero) cell.numFmt = '#,##0.00';
}

export function colLetter(index) {
  let n = index;
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function addListValidation(ws, range, listFormula) {
  ws.dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    showDropDown: true,
    showErrorMessage: true,
    errorTitle: 'Valor inválido',
    error: 'Escolha um valor da lista.',
    formulae: [listFormula],
  });
}
