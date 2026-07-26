import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { buildNomeFromGradePatch, norm, slug } from './catalogoGradeIA';

async function upsertLinha(supabase, { codigo, nome, tipo, eixoARotulo, eixoBRotulo, ordem = 500 }) {
  const cod = slug(codigo);
  const { data: existing } = await supabase
    .from('linha_compra')
    .select('*')
    .eq('codigo', cod)
    .maybeSingle();

  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('linha_compra')
    .insert({
      codigo: cod,
      nome: norm(nome) || cod,
      tipo: tipo || 'solo',
      eixo_a_rotulo: eixoARotulo || null,
      eixo_b_rotulo: eixoBRotulo || null,
      ordem,
      ativo: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function upsertProdutoCompra(supabase, linhaId, codigo, nome) {
  const cod = slug(codigo);
  const { data: existing } = await supabase
    .from('produto_compra')
    .select('*')
    .eq('linha_id', linhaId)
    .eq('codigo', cod)
    .maybeSingle();

  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('produto_compra')
    .insert({
      linha_id: linhaId,
      codigo: cod,
      nome: norm(nome) || cod,
      ativo: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreateEixoValor(supabase, { linhaId, produtoCompraId, eixo, nome }) {
  const txt = String(nome || '').trim();
  if (!txt) return null;
  const cod = slug(txt).slice(0, 80);

  let q = supabase
    .from('eixo_valor')
    .select('*')
    .eq('eixo', eixo)
    .eq('codigo', cod);

  if (produtoCompraId) q = q.eq('produto_compra_id', produtoCompraId);
  else q = q.eq('linha_id', linhaId).is('produto_compra_id', null);

  const { data: existing } = await q.maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('eixo_valor')
    .insert({
      linha_id: linhaId,
      produto_compra_id: produtoCompraId || null,
      eixo,
      codigo: cod,
      nome: txt,
      ativo: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Aplica atribuição de grelha (linha + produto_compra + eixos) vindos da IA.
 */
export async function applyGradeIAAssignment(produto = {}, patch = {}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Supabase não configurado');

  const linha = await upsertLinha(supabase, {
    codigo: patch.linha_codigo,
    nome: patch.linha_nome,
    tipo: patch.linha_tipo,
    eixoARotulo: patch.eixo_a_rotulo,
    eixoBRotulo: patch.eixo_b_rotulo,
  });

  const pc = await upsertProdutoCompra(
    supabase,
    linha.id,
    patch.produto_compra_codigo,
    patch.produto_compra_nome,
  );

  const usaGrelha = linha.tipo === 'linha_mix' || linha.tipo === 'portfolio';
  let eixoA = null;
  let eixoB = null;

  if (usaGrelha && patch.eixo_a) {
    eixoA = await getOrCreateEixoValor(supabase, {
      linhaId: linha.id,
      produtoCompraId: pc.id,
      eixo: 'A',
      nome: patch.eixo_a,
    });
  }
  if (usaGrelha && patch.eixo_b) {
    eixoB = await getOrCreateEixoValor(supabase, {
      linhaId: linha.id,
      produtoCompraId: pc.id,
      eixo: 'B',
      nome: patch.eixo_b,
    });
  }

  const nome = buildNomeFromGradePatch(patch, produto.marca);

  const produtoPatch = {
    linha_compra_id: linha.id,
    produto_compra_id: pc.id,
    eixo_a_valor_id: eixoA?.id || '',
    eixo_b_valor_id: eixoB?.id || '',
    eixo_a_texto: patch.eixo_a || '',
    eixo_b_texto: patch.eixo_b || '',
    ...(linha.tipo === 'portfolio' ? { no_mix_ativo: false } : {}),
    ...(linha.tipo === 'linha_mix' ? { celula_obrigatoria: true } : {}),
    ...(nome ? { nome: nome.toUpperCase() } : {}),
  };

  return { linha, produtoCompra: pc, produtoPatch };
}
