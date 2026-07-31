/**
 * Transportadora = tabela canónica de embarcações (barcos fluviais).
 *
 * Histórico legado:
 * - `embarcacao_template_id` em EventoLogisticoSandbox guarda o mesmo ID que `transportadora_id`
 * - `embarcacao_nome` / `transportadora_nome` são caches de exibição
 * - `EmbarcacaoTemplate` (schema Base44) não é usado em runtime
 */

export function normalizeTransportadoraNome(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Extrai o primeiro segmento antes de " · " (padrão dos nomes de viagem). */
export function extractEmbarcacaoNomeFromTitulo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const idx = raw.indexOf(' · ');
  return idx > 0 ? raw.slice(0, idx).trim() : raw;
}

/**
 * Resolve ID e nomes a partir de um evento ou embarque (sem consultar catálogo).
 */
export function resolveTransportadoraFromRecord(record) {
  if (!record) {
    return {
      transportadora_id: '',
      transportadora_nome: '',
      embarcacao_nome: '',
      match_source: 'empty',
    };
  }

  const transportadora_id = record.transportadora_id || record.embarcacao_template_id || '';
  const transportadora_nome = record.transportadora_nome || record.transportadora || '';
  const embarcacao_nome =
    record.embarcacao_nome ||
    extractEmbarcacaoNomeFromTitulo(record.nome) ||
    transportadora_nome ||
    '';

  const nome_exibicao = transportadora_nome || embarcacao_nome || '';

  let match_source = 'none';
  if (record.transportadora_id) match_source = 'transportadora_id';
  else if (record.embarcacao_template_id) match_source = 'embarcacao_template_id';
  else if (nome_exibicao) match_source = 'nome_cache';

  return {
    transportadora_id,
    transportadora_nome: nome_exibicao,
    embarcacao_nome: embarcacao_nome || nome_exibicao,
    match_source,
  };
}

/** Alias semântico para eventos logísticos. */
export const resolveTransportadoraFromEvento = resolveTransportadoraFromRecord;

export function buildTransportadoraCatalogIndex(transportadoras = []) {
  const byId = new Map();
  const byNome = new Map();

  for (const item of transportadoras) {
    if (!item?.id) continue;
    byId.set(item.id, item);
    const norm = normalizeTransportadoraNome(item.nome);
    if (norm && !byNome.has(norm)) {
      byNome.set(norm, item);
    }
  }

  return { byId, byNome };
}

/**
 * Cruza um registo resolvido com o catálogo de Transportadora (match por ID ou nome).
 */
export function matchTransportadoraFromCatalog(resolved, catalog) {
  const { byId, byNome } = catalog || { byId: new Map(), byNome: new Map() };
  const base = resolved || resolveTransportadoraFromRecord(null);

  if (base.transportadora_id && byId.has(base.transportadora_id)) {
    const found = byId.get(base.transportadora_id);
    return {
      transportadora_id: found.id,
      transportadora_nome: found.nome,
      embarcacao_nome: base.embarcacao_nome || found.nome,
      match_source: 'catalog_id',
    };
  }

  for (const candidate of [base.transportadora_nome, base.embarcacao_nome]) {
    const norm = normalizeTransportadoraNome(candidate);
    if (!norm) continue;
    const found = byNome.get(norm);
    if (found) {
      return {
        transportadora_id: found.id,
        transportadora_nome: found.nome,
        embarcacao_nome: found.nome,
        match_source: 'catalog_nome',
      };
    }
  }

  return {
    ...base,
    match_source: base.match_source === 'empty' ? 'empty' : 'unmatched',
  };
}

export function resolveAndMatchTransportadora(record, transportadoras = []) {
  const catalog = buildTransportadoraCatalogIndex(transportadoras);
  const resolved = resolveTransportadoraFromRecord(record);
  return matchTransportadoraFromCatalog(resolved, catalog);
}

/** Normaliza campos de transportadora/embarcação num evento logístico. */
export function normalizeEventoTransportadoraFields(evento) {
  if (!evento) return evento;
  const resolved = resolveTransportadoraFromRecord(evento);
  const transportadoraId = resolved.transportadora_id;

  return {
    ...evento,
    transportadora_id: transportadoraId,
    transportadora_nome: resolved.transportadora_nome,
    embarcacao_nome: resolved.embarcacao_nome || evento.embarcacao_nome || resolved.transportadora_nome,
    embarcacao_template_id: transportadoraId || evento.embarcacao_template_id || '',
  };
}

/** Payload canónico para gravar em EventoLogisticoSandbox ou Embarque. */
export function buildTransportadoraPersistPayload(record, transportadoras = []) {
  const matched = resolveAndMatchTransportadora(record, transportadoras);
  return {
    transportadora_id: matched.transportadora_id || '',
    transportadora_nome: matched.transportadora_nome || '',
    embarcacao_nome: matched.embarcacao_nome || matched.transportadora_nome || '',
    embarcacao_template_id: matched.transportadora_id || '',
  };
}

/**
 * Procura transportadora no catálogo pelo nome; opcionalmente cria registo novo.
 */
export async function findOrCreateTransportadora(base44, nome, { createIfMissing = true } = {}) {
  const trimmed = String(nome || '').trim();
  if (!trimmed || !base44?.entities?.Transportadora) return null;

  const all = await base44.entities.Transportadora.list();
  const catalog = buildTransportadoraCatalogIndex(all);
  const norm = normalizeTransportadoraNome(trimmed);
  const existing = catalog.byNome.get(norm);
  if (existing) return existing;

  if (!createIfMissing) return null;

  return base44.entities.Transportadora.create({
    nome: trimmed.toUpperCase(),
    ativo: true,
  });
}
