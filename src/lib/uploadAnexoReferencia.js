/**
 * Upload de ficheiro para o pipeline de anexos numa referência.
 */
import { uploadAnexoDrive } from '@/functions/uploadAnexoDrive';

export function fileBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
  });
}

/** Copia bytes para um File estável (sobrevive a fechar modal / input file). */
export async function stabilizeUploadFile(file, fallbackName = 'documento.pdf') {
  if (!(file instanceof Blob)) return file;
  const buffer = await file.arrayBuffer();
  const name = file.name || fallbackName;
  const type = file.type || 'application/octet-stream';
  return new File([buffer], name, { type });
}

function buildUploadPayload({ file, referencia_tipo, referencia_id, referencia_numero, descricao, tipoDocumento, origem }) {
  return {
    file,
    file_name: file.name || 'documento.pdf',
    file_type: file.type || 'application/pdf',
    file_size: file.size,
    referencia_tipo,
    referencia_id,
    referencia_numero: referencia_numero || '',
    descricao,
    tipo_documento: tipoDocumento,
    origem,
  };
}

export async function uploadAnexoParaLancamentoFinanceiro(
  base44Client,
  { file, lancamentoId, descricao = '', tipoDocumento = 'Boleto', origem = 'varejosync' }
) {
  if (!file || !lancamentoId) return;
  await uploadAnexoDrive(
    buildUploadPayload({
      file,
      referencia_tipo: 'LancamentoFinanceiro',
      referencia_id: lancamentoId,
      referencia_numero: descricao || '',
      descricao,
      tipoDocumento,
      origem,
    })
  );
}

export async function uploadAnexoParaPedidoCompra(
  base44Client,
  { file, pedidoId, pedidoNumero = '', tipoDocumento = 'Comprovante', origem = 'varejosync' }
) {
  if (!file || !pedidoId) return;
  await uploadAnexoDrive(
    buildUploadPayload({
      file,
      referencia_tipo: 'PedidoCompra',
      referencia_id: pedidoId,
      referencia_numero: pedidoNumero || '',
      tipoDocumento,
      origem,
    })
  );
}

export async function uploadAnexoParaContaPrevista(
  base44Client,
  { file, contaPrevistaId, descricao = '', tipoDocumento = 'Boleto', origem = 'varejosync' }
) {
  if (!file || !contaPrevistaId) return;
  await uploadAnexoDrive(
    buildUploadPayload({
      file,
      referencia_tipo: 'ContaPrevista',
      referencia_id: contaPrevistaId,
      referencia_numero: descricao || '',
      descricao,
      tipoDocumento,
      origem,
    })
  );
}
