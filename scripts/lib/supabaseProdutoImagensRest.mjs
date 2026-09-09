/**
 * Grava produto_imagem + produto.imagem_url via Supabase REST (sem DATABASE_URL).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function headers(prefer = 'return=representation') {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

export async function sbFetch(pathSuffix, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
    method,
    headers: headers(prefer),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  return data;
}

export async function fetchAllProdutosAtivos(select = 'id,codigo_interno,nome,imagem_url,categoria_nome,campo_hierarquico_1,campo_hierarquico_4,marca,codigo_barras') {
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await sbFetch(
      `produto?select=${select}&ativo=eq.true&order=codigo_interno&limit=500&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }
  return all;
}

/**
 * @param {string} produtoId
 * @param {Array<{ url: string, tipo?: string, ordem?: number, principal?: boolean }>} imagens
 * @param {{ fonte: string, fonte_ref?: string, forceImagemUrl?: boolean }} opts
 */
export async function upsertProdutoImagens(produtoId, imagens, { fonte, fonte_ref, forceImagemUrl = false } = {}) {
  if (!imagens?.length) return { count: 0, principalUrl: null };

  const principal = imagens.find((i) => i.principal) || imagens[0];
  const existing = await sbFetch(
    `produto_imagem?select=id,url,fonte&produto_id=eq.${produtoId}&ativo=eq.true&limit=50`,
  );

  for (const row of existing || []) {
    if (row.fonte === fonte) {
      await sbFetch(`produto_imagem?id=eq.${row.id}`, {
        method: 'PATCH',
        body: { ativo: false, principal: false },
        prefer: 'return=minimal',
      });
    }
  }

  let count = 0;
  for (const img of imagens) {
    const same = (existing || []).find((row) => row.url === img.url);
    if (same) {
      await sbFetch(`produto_imagem?id=eq.${same.id}`, {
        method: 'PATCH',
        body: {
          tipo: img.tipo || 'principal',
          ordem: img.ordem ?? 0,
          principal: Boolean(img.principal),
          fonte,
          fonte_ref: fonte_ref || null,
          ativo: true,
        },
        prefer: 'return=minimal',
      });
    } else {
      await sbFetch('produto_imagem', {
        method: 'POST',
        body: {
          produto_id: produtoId,
          url: img.url,
          tipo: img.tipo || 'principal',
          ordem: img.ordem ?? 0,
          principal: Boolean(img.principal),
          fonte,
          fonte_ref: fonte_ref || null,
          ativo: true,
        },
        prefer: 'return=minimal',
      });
    }
    count += 1;
  }

  if (principal?.url) {
    const prod = await sbFetch(`produto?select=imagem_url&id=eq.${produtoId}&limit=1`);
    const current = prod?.[0]?.imagem_url;
    const canPatch = forceImagemUrl || !current || !String(current).trim();
    if (canPatch) {
      await sbFetch(`produto?id=eq.${produtoId}`, {
        method: 'PATCH',
        body: { imagem_url: principal.url },
        prefer: 'return=minimal',
      });
    }
  }

  return { count, principalUrl: principal?.url || null };
}

/** Cria produto_imagem a partir de imagem_url existente. */
export async function syncImagemUrlToGaleria(produto) {
  const url = String(produto?.imagem_url || '').trim();
  if (!url) return null;
  return upsertProdutoImagens(produto.id, [{
    url,
    tipo: 'principal',
    ordem: 0,
    principal: true,
  }], { fonte: 'import', fonte_ref: 'imagem_url-sync' });
}
