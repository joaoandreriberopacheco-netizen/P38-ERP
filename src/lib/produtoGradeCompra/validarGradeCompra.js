import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { fetchLinhasCompra, fetchProdutosCompraByLinha } from './fetchGradeCompra';

/**
 * Valida grelha de compra antes de gravar produto novo.
 * Edições de legado sem linha continuam permitidas; avulso (diversos) ignora a grelha.
 */
export async function validarGradeCompraParaSalvar({
  formData = {},
  isNew = false,
  avulso = false,
} = {}) {
  if (avulso || !isSupabaseBrowserConfigured()) return { ok: true };
  if (!isNew) return { ok: true };

  if (!formData.linha_compra_id) {
    return {
      ok: false,
      message: 'Selecione a linha de compra ou marque o produto como avulso (diversos).',
    };
  }

  const linhas = await fetchLinhasCompra();
  const linha = linhas.find((l) => l.id === formData.linha_compra_id);
  if (!linha) {
    return { ok: false, message: 'Linha de compra inválida ou inactiva.' };
  }

  const produtosCompra = await fetchProdutosCompraByLinha(formData.linha_compra_id);
  if (produtosCompra.length > 0 && !formData.produto_compra_id) {
    return { ok: false, message: 'Selecione o produto de compra desta linha.' };
  }

  if (linha.tipo === 'linha_mix' || linha.tipo === 'portfolio') {
    const hasA = formData.eixo_a_valor_id || String(formData.eixo_a_texto || '').trim();
    const hasB = formData.eixo_b_valor_id || String(formData.eixo_b_texto || '').trim();
    if (!hasA || !hasB) {
      const rotA = linha.eixo_a_rotulo || 'Eixo A';
      const rotB = linha.eixo_b_rotulo || 'Eixo B';
      return {
        ok: false,
        message: `Preencha ${rotA} e ${rotB} para produtos desta linha.`,
      };
    }
  }

  return { ok: true };
}
