import { ENTITY_TO_TABLE, resolveEntityMapping } from './entityTableMap.js';

/** Colunas físicas comuns às tabelas managed pelo app. */
const META_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'created_by']);

function parseOrder(order) {
  if (order === undefined || order === null || order === '') {
    return { column: 'created_at', ascending: false };
  }
  const s = String(order);
  const ascending = !s.startsWith('-');
  let field = ascending ? s : s.slice(1);
  if (field === 'created_date') field = 'created_at';
  if (field === 'updated_date') field = 'updated_at';
  return { column: field, ascending };
}

function decorateRow(row, entityName, mapping) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  if ('created_at' in out && out.created_at != null) out.created_date = out.created_at;
  if ('updated_at' in out && out.updated_at != null) out.updated_date = out.updated_at;

  // Sempre que houver coluna `dados` jsonb na resposta, "espalha" no objeto.
  // Vale tanto para mode='jsonb' quanto para mode='columns' com `columns` explícito
  // (entidades estendidas com `dados` para overflow durante a transição).
  if ('dados' in out && out.dados && typeof out.dados === 'object') {
    const dados = out.dados;
    delete out.dados;
    for (const [k, v] of Object.entries(dados)) {
      if (!(k in out)) out[k] = v;
    }
  }

  if ('extras' in out && out.extras && typeof out.extras === 'object') {
    const extras = out.extras;
    delete out.extras;
    for (const [k, v] of Object.entries(extras)) {
      if (!(k in out)) out[k] = v;
    }
  }

  if (entityName === 'TargetFlare') {
    if ('flare_line' in out) out.line = out.flare_line;
    if ('flare_column' in out) out.column = out.flare_column;
  }
  if (entityName === 'PedidoVenda') {
    const totalCol = out.total != null ? Number(out.total) : NaN;
    const totalLegado = out.valor_total != null ? Number(out.valor_total) : NaN;
    if (Number.isFinite(totalCol) && totalCol > 0) {
      out.valor_total = totalCol;
      out.total = totalCol;
    } else if (Number.isFinite(totalLegado) && totalLegado > 0) {
      out.valor_total = totalLegado;
      if (out.total == null) out.total = totalLegado;
    } else if (out.total != null && out.valor_total == null) {
      out.valor_total = out.total;
    }
  }
  return out;
}

export function prepareWritePayload(payload, entityName, mapping) {
  if (!payload || typeof payload !== 'object') return payload;
  const p = { ...payload };
  delete p.created_date;
  delete p.updated_date;

  if (entityName === 'TargetFlare') {
    if ('line' in p) {
      p.flare_line = p.line;
      delete p.line;
    }
    if ('column' in p) {
      p.flare_column = p.column;
      delete p.column;
    }
  }
  if (entityName === 'PedidoVenda' && p.valor_total != null && p.total == null) {
    p.total = p.valor_total;
  }
  if (entityName === 'PedidoVenda') {
    delete p.valor_total;
    const cid = p.cliente_id;
    if (cid && typeof cid === 'object' && !Array.isArray(cid) && !(cid instanceof Date) && cid.id != null) {
      p.cliente_id = String(cid.id);
    }
  }

  // Caso 1: schema 100% modelado (núcleo) — `columns` é null. Grava tudo direto.
  // Caso 2: entidade com dados jsonb de overflow — `columns` é lista explícita.
  //   Campos listados vão para coluna; o resto cai em `dados` (silenciosamente).
  // Caso 3: modo 'jsonb' puro — só META + `columns` viram coluna; resto em dados.
  const hasOverflowJsonb = mapping?.mode === 'jsonb' || Array.isArray(mapping?.columns);
  if (!hasOverflowJsonb) {
    return p;
  }

  const allowedColumns = new Set([...(mapping.columns || []), ...META_COLUMNS]);
  const dadosBase =
    p.dados && typeof p.dados === 'object' && !Array.isArray(p.dados) ? p.dados : {};
  const out = { dados: { ...dadosBase } };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'dados') continue;
    if (allowedColumns.has(k) || k === 'created_at' || k === 'updated_at') {
      out[k] = v;
    } else {
      out.dados[k] = v;
    }
  }
  if (out.id === undefined) delete out.id;
  if (out.created_by === undefined) delete out.created_by;
  // Se nada foi parar em `dados`, remove para não sobrescrever JSONB existente desnecessariamente
  if (Object.keys(out.dados).length === 0) delete out.dados;
  return out;
}

function normalizeFilterColumn(field, mapping) {
  if (field === 'created_date') return 'created_at';
  if (field === 'updated_date') return 'updated_at';
  const hasOverflowJsonb = mapping?.mode === 'jsonb' || Array.isArray(mapping?.columns);
  const cols = new Set([...(mapping?.columns || []), ...META_COLUMNS]);
  if (hasOverflowJsonb && !cols.has(field)) {
    return `dados->>${field}`;
  }
  return field;
}

function applyFilters(query, where, mapping) {
  if (!where || typeof where !== 'object') return query;
  let q = query;

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    // Operadores especiais do Base44 (ex: $or) não são suportados aqui — ignorar.
    if (key.startsWith('$')) continue;
    const target = normalizeFilterColumn(key, mapping);

    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const ops = val;
      let applied = false;
      if ('$gte' in ops) {
        q = q.gte(target, ops.$gte);
        applied = true;
      }
      if ('$lte' in ops) {
        q = q.lte(target, ops.$lte);
        applied = true;
      }
      if ('$gt' in ops) {
        q = q.gt(target, ops.$gt);
        applied = true;
      }
      if ('$lt' in ops) {
        q = q.lt(target, ops.$lt);
        applied = true;
      }
      if ('$ne' in ops) {
        q = q.neq(target, ops.$ne);
        applied = true;
      }
      if ('$regex' in ops) {
        const pattern = String(ops.$regex);
        q = ops.$options === 'i' ? q.ilike(target, `%${pattern}%`) : q.like(target, `%${pattern}%`);
        applied = true;
      }
      if ('$in' in ops) {
        const values = Array.isArray(ops.$in) ? ops.$in : [ops.$in];
        if (values.length) q = q.in(target, values);
        applied = true;
      }
      if (applied) continue;
    }

    if (Array.isArray(val)) {
      q = q.in(target, val);
    } else {
      q = q.eq(target, val);
    }
  }
  return q;
}

function throwIfError(result, context) {
  if (result.error) {
    throw new Error(`[P38][supabase][${context}] ${result.error.message || result.error}`);
  }
}

function normalizeOrderColumn(field, mapping) {
  const hasOverflowJsonb = mapping?.mode === 'jsonb' || Array.isArray(mapping?.columns);
  const cols = new Set([...(mapping?.columns || []), ...META_COLUMNS]);
  if (hasOverflowJsonb && !cols.has(field)) {
    return `dados->>${field}`;
  }
  return field;
}

/** PostgREST/Supabase devolve no máximo 1000 linhas por pedido. */
const SUPABASE_PAGE_SIZE = 1000;

/**
 * Executa select com paginação (range). Sem `limit`, busca todas as páginas.
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 * @param {{ limit?: number, skip?: number, context: string }} opts
 */
async function fetchPagedRows(buildQuery, { limit, skip = 0, context }) {
  const all = [];
  let offset = Number(skip) || 0;
  const maxRows =
    limit != null && limit !== '' && Number.isFinite(Number(limit)) ? Number(limit) : Infinity;

  while (all.length < maxRows) {
    const remaining = maxRows === Infinity ? SUPABASE_PAGE_SIZE : maxRows - all.length;
    const pageSize = Math.min(SUPABASE_PAGE_SIZE, remaining);
    const from = offset;
    const to = offset + pageSize - 1;

    const res = await buildQuery().range(from, to);
    throwIfError(res, context);
    const rows = res.data || [];
    all.push(...rows);

    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return all;
}

function createEntityApi(supabase, entityName, mapping) {
  const { table } = mapping;

  async function list(order, limit, skip) {
    const { column, ascending } = parseOrder(order);
    const orderCol = normalizeOrderColumn(column, mapping);
    const rows = await fetchPagedRows(
      () => supabase.from(table).select('*').order(orderCol, { ascending, nullsFirst: false }),
      { limit, skip, context: `${entityName}.list` }
    );
    return rows.map((row) => decorateRow(row, entityName, mapping));
  }

  async function filter(where, order, limit, skip) {
    const rows = await fetchPagedRows(
      () => {
        let q = supabase.from(table).select('*');
        q = applyFilters(q, where, mapping);
        if (order !== undefined && order !== null && order !== '') {
          const { column, ascending } = parseOrder(order);
          q = q.order(normalizeOrderColumn(column, mapping), { ascending, nullsFirst: false });
        }
        return q;
      },
      { limit, skip, context: `${entityName}.filter` }
    );
    return rows.map((row) => decorateRow(row, entityName, mapping));
  }

  async function get(id) {
    const res = await supabase.from(table).select('*').eq('id', id).maybeSingle();
    throwIfError(res, `${entityName}.get`);
    return decorateRow(res.data, entityName, mapping);
  }

  async function create(payload) {
    const row = prepareWritePayload(payload, entityName, mapping);
    if (!row.id) {
      row.id = crypto.randomUUID();
    }
    const res = await supabase.from(table).insert(row).select('*').single();
    throwIfError(res, `${entityName}.create`);
    return decorateRow(res.data, entityName, mapping);
  }

  async function update(id, payload) {
    const row = prepareWritePayload(payload, entityName, mapping);
    delete row.id;
    const res = await supabase.from(table).update(row).eq('id', id).select('*').single();
    throwIfError(res, `${entityName}.update`);
    return decorateRow(res.data, entityName, mapping);
  }

  async function remove(id) {
    const res = await supabase.from(table).delete().eq('id', id);
    throwIfError(res, `${entityName}.delete`);
    return res.data;
  }

  async function bulkCreate(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const prepared = rows.map((r) => {
      const row = prepareWritePayload(r, entityName, mapping);
      if (!row.id) row.id = crypto.randomUUID();
      return row;
    });
    const res = await supabase.from(table).insert(prepared).select('*');
    throwIfError(res, `${entityName}.bulkCreate`);
    return (res.data || []).map((row) => decorateRow(row, entityName, mapping));
  }

  function subscribe(_callback) {
    if (import.meta.env.DEV) {
      console.debug(`[P38][supabase] ${entityName}.subscribe — realtime não ligado (usar Base44 ou canal postgres depois)`);
    }
    return () => {};
  }

  return {
    list,
    filter,
    get,
    create,
    update,
    delete: remove,
    bulkCreate,
    subscribe
  };
}

function createStubEntityApi(entityName) {
  const warn = (op) => {
    if (typeof console !== 'undefined') {
      console.warn(
        `[P38][supabase-stub] ${entityName}.${op} — entidade não mapeada em entityTableMap.js; ` +
          'devolvendo valor neutro. Adicione a tabela e migre para retirar este stub.'
      );
    }
  };

  return {
    list: async () => {
      warn('list');
      return [];
    },
    filter: async () => {
      warn('filter');
      return [];
    },
    get: async () => {
      warn('get');
      return null;
    },
    create: async (payload) => {
      warn('create');
      return { ...(payload || {}), id: payload?.id || crypto.randomUUID() };
    },
    update: async (id, payload) => {
      warn('update');
      return { ...(payload || {}), id };
    },
    delete: async () => {
      warn('delete');
      return null;
    },
    bulkCreate: async (rows) => {
      warn('bulkCreate');
      return Array.isArray(rows) ? rows.map((r) => ({ ...r, id: r?.id || crypto.randomUUID() })) : [];
    },
    subscribe: () => () => {}
  };
}

/**
 * Proxy em cima de base44.entities: rotas listadas em ENTITY_TO_TABLE vão para Supabase.
 *
 * @param {object|null} base44Entities - quando definido, entidades não mapeadas caem nele
 *   (modo híbrido). Passe `null` para usar stub silencioso (modo bypass total Base44).
 * @param {object} supabase - cliente Supabase já inicializado.
 */
export function createSupabaseEntityLayer(base44Entities, supabase) {
  const fallbackTarget = base44Entities || {};
  return new Proxy(fallbackTarget, {
    get(target, prop) {
      const name = String(prop);
      if (!supabase) {
        return createStubEntityApi(name);
      }
      const mapping = resolveEntityMapping(name);
      if (mapping) {
        return createEntityApi(supabase, name, mapping);
      }
      if (base44Entities) {
        return target[prop];
      }
      return createStubEntityApi(name);
    }
  });
}

// Reexporta pra compatibilidade com imports antigos (se houver).
export { ENTITY_TO_TABLE };
