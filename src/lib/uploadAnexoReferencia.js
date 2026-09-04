/**
 * Upload de ficheiro para o pipeline de anexos numa referência.
 */
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { uploadAnexoDriveSupabase } from '@/lib/anexosSupabase';

export function fileBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
  });
}

async function invokeUploadAnexoDrive(base44Client, payload) {
  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await uploadAnexoDriveSupabase({ supabase, body: payload });
      return;
    }
  }
  await base44Client.functions.invoke('uploadAnexoDrive', payload);
}

export async function uploadAnexoParaLancamentoFinanceiro(base44Client, { file, lancamentoId, descricao = '', tipoDocumento = 'Boleto', origem = 'varejosync' }) {
  if (!file || !lancamentoId) return;
  const base64 = await fileBlobToBase64(file);
  await invokeUploadAnexoDrive(base44Client, {
    file_base64: base64,
    file_name: file.name || 'documento.pdf',
    file_type: file.type || 'application/pdf',
    file_size: file.size,
    referencia_tipo: 'LancamentoFinanceiro',
    referencia_id: lancamentoId,
    referencia_numero: descricao || '',
    tipo_documento: tipoDocumento,
    origem,
  });
}

export async function uploadAnexoParaPedidoCompra(
  base44Client,
  { file, pedidoId, pedidoNumero = '', tipoDocumento = 'Comprovante', origem = 'varejosync' }
) {
  if (!file || !pedidoId) return;
  const base64 = await fileBlobToBase64(file);
  await invokeUploadAnexoDrive(base44Client, {
    file_base64: base64,
    file_name: file.name || 'documento.pdf',
    file_type: file.type || 'application/pdf',
    file_size: file.size,
    referencia_tipo: 'PedidoCompra',
    referencia_id: pedidoId,
    referencia_numero: pedidoNumero || '',
    tipo_documento: tipoDocumento,
    origem,
  });
}

export async function uploadAnexoParaContaPrevista(base44Client, { file, contaPrevistaId, descricao = '', tipoDocumento = 'Boleto', origem = 'varejosync' }) {
  if (!file || !contaPrevistaId) return;
  const base64 = await fileBlobToBase64(file);
  await invokeUploadAnexoDrive(base44Client, {
    file_base64: base64,
    file_name: file.name || 'documento.pdf',
    file_type: file.type || 'application/pdf',
    file_size: file.size,
    referencia_tipo: 'ContaPrevista',
    referencia_id: contaPrevistaId,
    referencia_numero: descricao || '',
    tipo_documento: tipoDocumento,
    origem,
  });
}
