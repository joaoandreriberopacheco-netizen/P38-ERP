import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

function sb() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Supabase não configurado');
  return client;
}

export async function fetchCadastroV2Grade({ linhaId, produtoCompraId, solo }) {
  let q = sb()
    .from('cadastro_v2_grade_sku')
    .select('*')
    .eq('linha_id', linhaId)
    .eq('ativo', true)
    .order('novo_sku');

  if (solo) {
    q = q.is('produto_compra_id', null);
  } else if (produtoCompraId) {
    q = q.eq('produto_compra_id', produtoCompraId);
  } else {
    return [];
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveCadastroV2GradeRow(row) {
  const { id, ...rest } = row;
  const payload = {
    ...rest,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { data, error } = await sb()
      .from('cadastro_v2_grade_sku')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await sb()
    .from('cadastro_v2_grade_sku')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function inactivateCadastroV2GradeRows(keepIds, { linhaId, produtoCompraId, solo }) {
  const existing = await fetchCadastroV2Grade({ linhaId, produtoCompraId, solo });
  const keep = new Set(keepIds || []);
  const toOff = existing.filter((r) => !keep.has(r.id));
  for (const r of toOff) {
    const { error } = await sb()
      .from('cadastro_v2_grade_sku')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) throw error;
  }
}

export async function upsertCadastroV2GradeBatch(rows, context) {
  const saved = [];
  for (const row of rows) {
    saved.push(await saveCadastroV2GradeRow(row));
  }
  await inactivateCadastroV2GradeRows(saved.map((r) => r.id), context);
  return saved;
}
