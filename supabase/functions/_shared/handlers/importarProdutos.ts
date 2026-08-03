// Port automático de base44/functions/importarProdutos/entry.ts
import type { createP38Client } from '../p38Client.ts';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const withRetry = async (fn, retries = 3, baseDelay = 1500) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e.status === 429 && i < retries - 1) {
        await sleep(baseDelay * (i + 1));
      } else {
        throw e;
      }
    }
  }
};

/* ----------------------------------------------------------------------------
 * Validacao de invariantes de unidades (espelho da logica em
 * src/lib/productUnitsCrud.js, inlined porque este runtime e Deno).
 * Linhas com invariantes violados sao rejeitadas e reportadas no log.
 * -------------------------------------------------------------------------- */

const SIGLA_NORMALIZE_MAP: Record<string, string> = {
  CAIXA: 'CX', CAIXAS: 'CX',
  'M²': 'M2', 'METRO QUADRADO': 'M2', 'METROS QUADRADOS': 'M2',
  PEÇA: 'PC', PEÇAS: 'PC', PECA: 'PC', PECAS: 'PC',
  UNIDADE: 'UN', UNIDADES: 'UN',
};

const normalizeSigla = (raw: any): string => {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  const noAccents = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (SIGLA_NORMALIZE_MAP[s]) return SIGLA_NORMALIZE_MAP[s];
  if (SIGLA_NORMALIZE_MAP[noAccents]) return SIGLA_NORMALIZE_MAP[noAccents];
  return s.replace('²', '2');
};

const validateUnidadesPayload = (dados: any): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  const principalSigla = normalizeSigla(dados?.unidade_principal || 'UN');
  if (!principalSigla) errors.push('unidade_principal obrigatoria');

  const alternativas = Array.isArray(dados?.unidades_alternativas) ? dados.unidades_alternativas : [];
  if (alternativas.length > 5) errors.push(`maximo 5 unidades alternativas (atual: ${alternativas.length})`);

  const siglasVistas = new Set<string>();
  if (principalSigla) siglasVistas.add(principalSigla);

  for (const alt of alternativas) {
    if (!alt || typeof alt !== 'object') {
      errors.push('entrada invalida em unidades_alternativas');
      continue;
    }
    const sigla = normalizeSigla(alt.unidade);
    if (!sigla) errors.push('unidade alternativa sem sigla');
    if (sigla && siglasVistas.has(sigla)) errors.push(`sigla duplicada entre unidades: ${sigla}`);
    if (sigla) siglasVistas.add(sigla);

    const fator = Number(alt.fator_conversao);
    if (!Number.isFinite(fator) || fator <= 0) {
      errors.push(`unidade ${sigla || '(?)'}: fator_conversao deve ser > 0`);
    } else if (fator === 1) {
      errors.push(`unidade ${sigla}: fator_conversao=1 e reservado para a unidade principal`);
    }
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
};

/* Pathway inverso vitrine — espelho de src/lib/productUnitsCrud.js (Deno não importa o bundle Vite). */

const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const asNumber = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const makeUnidade = (input: any = {}) => {
  const adj = asNumber(input.ajuste_percentual, 0);
  const pctRaw = input.percentual_preco_vs_principal;
  const hasPct =
    Object.prototype.hasOwnProperty.call(input, 'percentual_preco_vs_principal') &&
    pctRaw !== '' &&
    pctRaw != null;
  return {
    id: String(input.id || '').trim() || newId(),
    nome: typeof input.nome === 'string' ? input.nome.trim() : '',
    sigla: normalizeSigla(input.sigla || input.unidade),
    fator_conversao: asNumber(input.fator_conversao, 1) || 1,
    fator_preco: asNumber(input.fator_preco, 1) || 1,
    ajuste_percentual: adj,
    preco_venda: asNumber(input.preco_venda, 0),
    ...(hasPct ? { percentual_preco_vs_principal: asNumber(pctRaw, 0) } : {}),
    is_principal: input.is_principal === true,
    is_comercial: input.is_comercial === true,
    ativo: input.ativo !== false,
  };
};

const validateUnidadesCanonical = (unidades: any[]): { ok: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!Array.isArray(unidades)) {
    return { ok: false, errors: ['O campo de unidades deve ser uma lista (array).'] };
  }
  const ativas = unidades.filter((u) => u?.ativo !== false);
  if (ativas.length === 0) {
    return { ok: false, errors: ['É necessário pelo menos uma unidade ativa no produto.'] };
  }
  if (unidades.length > 5) {
    errors.push(`No máximo 5 unidades por produto (atual: ${unidades.length}).`);
  }
  const ids = new Set<string>();
  const siglas = new Set<string>();
  let countPrincipal = 0;
  let countComercial = 0;
  let principalFator1 = false;
  for (const u of unidades) {
    if (!u || typeof u !== 'object') {
      errors.push('Há uma entrada inválida na lista de unidades.');
      continue;
    }
    const id = String(u.id || '').trim();
    if (!id) errors.push('Cada unidade precisa de um id estável.');
    else if (ids.has(id)) errors.push(`Id de unidade duplicado: ${id}.`);
    else ids.add(id);
    const sigla = normalizeSigla(u.sigla);
    if (!sigla) errors.push(`Unidade ${id || '(sem id)'}: informe a sigla.`);
    else if (u.ativo !== false) {
      if (siglas.has(sigla)) errors.push(`Sigla duplicada entre unidades ativas: ${sigla}.`);
      else siglas.add(sigla);
    }
    const fator = asNumber(u.fator_conversao, NaN);
    if (!Number.isFinite(fator) || fator <= 0) {
      errors.push(`Unidade ${sigla || id || '(?)'}: o fator de conversão deve ser maior que zero.`);
    }
    if (u.is_principal === true && u.ativo !== false) {
      countPrincipal++;
      if (fator === 1) principalFator1 = true;
    }
    if (u.is_comercial === true && u.ativo !== false) countComercial++;
  }
  if (countPrincipal !== 1) {
    errors.push(`Deve existir exatamente uma unidade base ativa (encontradas: ${countPrincipal}).`);
  } else if (!principalFator1) {
    errors.push('A unidade base deve ter fator de conversão igual a 1.');
  }
  if (countComercial !== 1) {
    errors.push(
      countComercial === 0
        ? 'Marque uma unidade comercial ativa (a de vitrine não pode estar inativa ou sem correspondência).'
        : `Deve existir exatamente uma unidade comercial ativa (encontradas: ${countComercial}).`,
    );
  }
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
};

const extractFatorFromName = (...nomes: any[]): number | null => {
  for (const raw of nomes) {
    if (!raw) continue;
    const s = String(raw)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace('METRO QUADRADO', 'M2').replace('M²', 'M2')
      .replace(/CAIXAS?/g, 'CX');
    const padroes = [
      /(\d+(?:[.,]\d+)?)\s*M2\s*[\/xX\s]*\s*CX/i,
      /CX\s*(\d+(?:[.,]\d+)?)\s*M2/i,
      /\(\s*(\d+(?:[.,]\d+)?)\s*M2\s*\)/i,
    ];
    for (const re of padroes) {
      const m = re.exec(s);
      if (m) {
        const v = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(v) && v > 1 && v < 100) {
          return Math.round(v * 10000) / 10000;
        }
      }
    }
  }
  return null;
};

const migrateLegacyToUnidades = (produto: any = {}) => {
  if (Array.isArray(produto?.unidades) && produto.unidades.length > 0) {
    return { unidades: produto.unidades };
  }
  const principalSigla = normalizeSigla(produto?.unidade_principal || 'UN') || 'UN';
  const fatorNome = extractFatorFromName(
    produto?.nome,
    produto?.descricao,
    produto?.campo_hierarquico_1,
    produto?.campo_hierarquico_2,
    produto?.campo_hierarquico_3,
  );
  const principal = makeUnidade({
    id: 'principal',
    nome: 'Unidade base',
    sigla: principalSigla,
    fator_conversao: 1,
    fator_preco: 1,
    is_principal: true,
    is_comercial: false,
    ativo: true,
  });
  const alternativasInput = Array.isArray(produto?.unidades_alternativas) ? produto.unidades_alternativas : [];
  const alternativas = alternativasInput
    .filter((a: any) => a?.unidade)
    .map((a: any) => {
      const sigla = normalizeSigla(a.unidade);
      let fator = asNumber(a.fator_conversao, 1) || 1;
      if (fatorNome && sigla === 'CX' && Math.abs(fator - fatorNome) > 0.01) fator = fatorNome;
      const mu: any = {
        id: a.id || newId(),
        nome: a.nome || a.rotulo || sigla,
        sigla,
        fator_conversao: fator,
        fator_preco: asNumber(a.fator_preco, 1) || 1,
        ajuste_percentual: asNumber(a.ajuste_percentual, 0),
        preco_venda: asNumber(a.preco_venda, 0),
        is_principal: a.is_principal === true,
        is_comercial: a.is_comercial === true,
        ativo: a.ativo !== false,
      };
      if (
        Object.prototype.hasOwnProperty.call(a, 'percentual_preco_vs_principal') &&
        a.percentual_preco_vs_principal != null &&
        a.percentual_preco_vs_principal !== ''
      ) {
        mu.percentual_preco_vs_principal = asNumber(a.percentual_preco_vs_principal, 0);
      }
      return makeUnidade(mu);
    });
  const unidades = [principal, ...alternativas];
  const comercialIdLegacy = String(produto?.unidade_comercial_id || '').trim();
  const comercialSiglaLegacy = normalizeSigla(
    produto?.unidade_vitrine ||
    produto?.unidade_apresentacao_default ||
    produto?.unidade_show_comercial ||
    principalSigla,
  );
  const markComercial = (target: any) => {
    if (!target) return false;
    unidades.forEach((u) => { u.is_comercial = u.id === target.id; });
    return true;
  };
  let comercialAplicado = false;
  if (comercialIdLegacy === 'primary' || comercialIdLegacy === 'principal') {
    comercialAplicado = markComercial(unidades[0]);
  } else if (comercialIdLegacy) {
    comercialAplicado = markComercial(unidades.find((u) => u.id === comercialIdLegacy));
  }
  if (!comercialAplicado && comercialSiglaLegacy) {
    comercialAplicado = markComercial(unidades.find((u) => normalizeSigla(u.sigla) === comercialSiglaLegacy));
  }
  if (!comercialAplicado) {
    const comercialFromJsonAlt = alternativas.find((u: any) => u?.is_comercial === true);
    if (comercialFromJsonAlt) comercialAplicado = markComercial(comercialFromJsonAlt);
  }
  if (!comercialAplicado) markComercial(unidades[0]);
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const u of unidades) {
    const key = normalizeSigla(u.sigla);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(u);
  }
  return { unidades: deduped };
};

const unidadesToLegacyMirror = (unidades: any[]) => {
  if (!Array.isArray(unidades) || unidades.length === 0) {
    return {
      unidade_principal: 'UN',
      unidades_alternativas: [],
      unidade_apresentacao_default: '',
      unidade_show_comercial: '',
      unidade_comercial_id: '',
    };
  }
  const principal = unidades.find((u) => u?.is_principal && u?.ativo !== false) || unidades[0];
  const comercial = unidades.find((u) => u?.is_comercial && u?.ativo !== false) || principal;
  const alternativasLegacy = unidades
    .filter((u) => u && u.id !== principal.id)
    .map((u) => {
      const row: any = {
        id: u.id,
        nome: u.nome || '',
        unidade: normalizeSigla(u.sigla),
        fator_conversao: asNumber(u.fator_conversao, 1) || 1,
        fator_preco: asNumber(u.fator_preco, 1) || 1,
        ajuste_percentual: asNumber(u.ajuste_percentual, 0),
        preco_venda: asNumber(u.preco_venda, 0),
        rotulo: typeof u.nome === 'string' && u.nome.trim() ? u.nome.trim() : normalizeSigla(u.sigla) || '',
        ativo: u.ativo !== false,
        is_principal: false,
        is_comercial: u.id === comercial.id,
      };
      if (
        Object.prototype.hasOwnProperty.call(u, 'percentual_preco_vs_principal') &&
        u.percentual_preco_vs_principal != null &&
        u.percentual_preco_vs_principal !== ''
      ) {
        row.percentual_preco_vs_principal = asNumber(u.percentual_preco_vs_principal, 0);
      }
      return row;
    });
  const principalSigla = normalizeSigla(principal?.sigla) || 'UN';
  const comercialSigla = normalizeSigla(comercial?.sigla) || principalSigla;
  const comercialId = comercial && comercial.id !== principal.id ? comercial.id : 'primary';
  return {
    unidade_principal: principalSigla,
    unidades_alternativas: alternativasLegacy,
    unidade_apresentacao_default: comercialSigla,
    unidade_show_comercial: comercialSigla,
    unidade_comercial_id: comercialId,
  };
};

const applyUnidadesToProduto = (produto: any, unidades: any[]) => {
  const validation = validateUnidadesCanonical(unidades);
  if (!validation.ok) return { ok: false, produto, errors: validation.errors };
  const legacyMirror = unidadesToLegacyMirror(unidades);
  const principalSigla = normalizeSigla(legacyMirror.unidade_principal) || 'UN';
  const comercialSigla =
    normalizeSigla(legacyMirror.unidade_apresentacao_default) ||
    normalizeSigla(legacyMirror.unidade_show_comercial) ||
    principalSigla;
  const unidadeVitrine = comercialSigla === principalSigla ? '' : comercialSigla;
  return {
    ok: true,
    errors: [] as string[],
    produto: {
      ...produto,
      unidades,
      unidade_principal: legacyMirror.unidade_principal,
      unidades_alternativas: legacyMirror.unidades_alternativas,
      unidade_vitrine: unidadeVitrine,
    },
  };
};

/** Espelho de buildProdutoUnidadesPatchFromVitrine (productUnitsCrud.js). */
const buildProdutoUnidadesPatchFromVitrine = (
  produto: any = {},
  vitrineStored: any,
  principalSiglaOverride?: string,
) => {
  const principalSigla =
    normalizeSigla(principalSiglaOverride || produto?.unidade_principal) || 'UN';
  const storedCanon = normalizeSigla(vitrineStored == null ? '' : String(vitrineStored).trim());
  const comercialSigla = storedCanon || principalSigla;
  const { unidades: base } = migrateLegacyToUnidades(produto);
  if (!Array.isArray(base) || base.length === 0) {
    return {
      unidade_vitrine: storedCanon && storedCanon !== principalSigla ? storedCanon : '',
    };
  }
  let unidades = base.map((u: any) => ({ ...u, is_comercial: false }));
  const principal =
    unidades.find((u: any) => u?.is_principal && u?.ativo !== false) || unidades[0];
  const principalSiglaNorm = normalizeSigla(principal?.sigla) || principalSigla;
  let target = principal;
  if (comercialSigla !== principalSiglaNorm) {
    const bySigla = unidades.find((u: any) => normalizeSigla(u.sigla) === comercialSigla);
    if (bySigla) target = bySigla;
  }
  unidades = unidades.map((u: any) => ({
    ...u,
    is_comercial: u.id === target.id,
  }));
  const applied = applyUnidadesToProduto({}, unidades);
  if (!applied.ok) {
    return {
      unidade_vitrine: storedCanon && storedCanon !== principalSigla ? storedCanon : '',
    };
  }
  return {
    unidade_vitrine: applied.produto.unidade_vitrine,
    unidade_principal: applied.produto.unidade_principal,
    unidades_alternativas: applied.produto.unidades_alternativas,
    unidades: applied.produto.unidades,
  };
};

const applyVitrineToPayload = (
  dadosAtualizacao: Record<string, unknown>,
  dadosLinha: Record<string, unknown>,
  anterior: Record<string, unknown> | undefined,
) => {
  if (!Object.prototype.hasOwnProperty.call(dadosAtualizacao, 'unidade_vitrine')) return;
  if (!anterior) return;
  const principal =
    normalizeSigla(
      dadosAtualizacao.unidade_principal || dadosLinha?.unidade_principal || anterior?.unidade_principal,
    ) || 'UN';
  const produtoBase: Record<string, unknown> = { ...anterior };
  if (dadosAtualizacao.unidade_principal) {
    produtoBase.unidade_principal = dadosAtualizacao.unidade_principal;
  }
  if (Array.isArray(dadosAtualizacao.unidades_alternativas)) {
    produtoBase.unidades_alternativas = dadosAtualizacao.unidades_alternativas;
  }
  if (Array.isArray(dadosAtualizacao.unidades)) {
    produtoBase.unidades = dadosAtualizacao.unidades;
  }
  const patch = buildProdutoUnidadesPatchFromVitrine(
    produtoBase,
    dadosAtualizacao.unidade_vitrine,
    principal,
  );
  Object.assign(dadosAtualizacao, patch);
};

const copyValidField = (
  target: Record<string, unknown>,
  dados: Record<string, unknown>,
  field: string,
) => {
  if (field === 'unidade_vitrine') {
    if (!Object.prototype.hasOwnProperty.call(dados, field)) return;
    const v = dados[field];
    target[field] = v == null ? '' : String(v).trim();
    return;
  }
  if ((field === 'unidades_alternativas' || field === 'unidades') && Array.isArray(dados[field])) {
    target[field] = dados[field];
    return;
  }
  const valor = dados[field];
  if (valor === null || valor === undefined) return;
  if (String(valor).trim() !== '') {
    target[field] = valor;
  }
};

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      alterados,
      is_ultimo_lote = true,
      lote_numero = 1,
      total_lotes = 1,
      grupo_importacao_id,
      tipo_importacao,
    } = await req.json();

    if (!alterados || !Array.isArray(alterados) || alterados.length === 0) {
      return Response.json({ error: 'Nenhum produto para importar' }, { status: 400 });
    }

    const novos = alterados.filter(a => a.isNew);
    const atualizados = alterados.filter(a => !a.isNew);

    // Tirar snapshot dos produtos que serão atualizados (busca individual com delay)
    const produtosAtualizadosSnapshot = [];
    const produtoAntigoPorId = new Map<string, Record<string, unknown>>();
    for (const item of atualizados) {
      if (!item.id) continue;
      try {
        const prods = await withRetry(() => base44.asServiceRole.entities.Produto.filter({ id: item.id }, null, 1));
        if (prods && prods.length > 0) {
          produtosAtualizadosSnapshot.push({ id: prods[0].id, dados_anteriores: prods[0] });
          produtoAntigoPorId.set(String(prods[0].id), prods[0]);
        }
        await sleep(150);
      } catch (e) {
        console.warn(`Snapshot falhou para id ${item.id}:`, e.message);
      }
    }

    // Log de importação (opcional): se a entidade ImportacaoLog não existir no app, seguimos só com Produto.
    let importacaoLogAviso: string | null = null;
    try {
      const logsExistentes = await base44.asServiceRole.entities.ImportacaoLog.list('-created_date', 1);
      let ultimoNumero = 1;
      if (logsExistentes.length > 0) {
        const bruto = logsExistentes[0]?.numero;
        const semPrefixo = String(bruto ?? 'IMP-00000').replace(/^IMP-/i, '').trim();
        const parsed = parseInt(semPrefixo, 10);
        ultimoNumero = Number.isFinite(parsed) && parsed >= 0 ? parsed + 1 : 1;
      }
      const numeroLog = `IMP-${String(ultimoNumero).padStart(5, '0')}`;

      const rotuloTipo =
        typeof tipo_importacao === 'string' && tipo_importacao.trim() ? tipo_importacao.trim() : 'Produtos';

      await base44.asServiceRole.entities.ImportacaoLog.create({
        numero: numeroLog,
        tipo: rotuloTipo,
        status: 'Concluída',
        grupo_importacao_id: grupo_importacao_id || `GRP-${Date.now()}`,
        lote_numero,
        total_lotes,
        is_ultimo_lote,
        total_novos: novos.length,
        total_atualizados: atualizados.length,
        produtos_atualizados: produtosAtualizadosSnapshot,
      });

      await sleep(100);
    } catch (logErr: unknown) {
      const msg = logErr instanceof Error ? logErr.message : String(logErr);
      console.warn('ImportacaoLog indisponível (importação continua sem audit trail / desfazer por lote):', msg);
      importacaoLogAviso = msg.includes('not found') || msg.includes('ImportacaoLog')
        ? 'Registo de importação (ImportacaoLog) não configurado no app — produtos foram atualizados, mas o separador Desfazer pode ficar vazio para esta operação.'
        : `Log de importação omitido: ${msg}`;
    }

    const validFields = [
      'tipo', 'preco_venda_padrao', 'campo_hierarquico_1', 'campo_hierarquico_2',
      'campo_hierarquico_3', 'campo_hierarquico_4', 'campo_hierarquico_5',
      'codigo_barras', 'marca', 'categoria_nome', 'area_codigo',
      'valor_compra', 'desconto_perc', 'custo_frete_padrao', 'custo_imposto1_padrao',
      'custo_imposto2_padrao', 'custo_outros_padrao', 'avaria_percentual', 'preco_venda_percentual',
      'preco_custo_calculado', 'unidade_principal', 'unidade_vitrine', 'unidades', 'unidades_alternativas', 'unidades_por_pacote',
      'casas_decimais', 'estoque_minimo', 'estoque_ideal', 'estoque_maximo', 'tempo_reposicao_dias',
      'peso_kg', 'dimensoes_cm', 'abcd', 'preco_livre', 'controla_serial', 'controla_lote', 'controla_validade', 'ativo', 'nome',
    ];

    // Processar cada produto com pequeno delay para evitar rate limit.
    // Antes de gravar, valida invariantes de unidades — linhas invalidas sao
    // rejeitadas e reportadas (porta dos fundos historicamente aberta para typos).
    let processados = 0;
    const linhasRejeitadas: Array<{ id: any; isNew: boolean; nome?: string; erros: string[] }> = [];
    for (const { id, dados, isNew } of alterados) {
      try {
        const tocaUnidades =
          Object.prototype.hasOwnProperty.call(dados || {}, 'unidade_principal') ||
          Object.prototype.hasOwnProperty.call(dados || {}, 'unidades_alternativas');
        if (tocaUnidades) {
          const validation = validateUnidadesPayload(dados);
          if (!validation.ok) {
            linhasRejeitadas.push({ id, isNew, nome: dados?.nome, erros: validation.errors });
            console.warn(`✗ Produto ${id || '(novo)'} rejeitado pela validacao de unidades: ${validation.errors.join('; ')}`);
            continue;
          }
        }

        if (isNew) {
          const novoProduto = {
            tipo: dados.tipo && String(dados.tipo).trim() ? dados.tipo : 'Produto',
            preco_venda_padrao: Number(dados.preco_venda_padrao) || 0,
            campo_hierarquico_1: dados.campo_hierarquico_1 && String(dados.campo_hierarquico_1).trim()
              ? dados.campo_hierarquico_1
              : 'Sem categoria',
          };
          validFields.forEach((field) => copyValidField(novoProduto, dados || {}, field));
          await withRetry(() => base44.asServiceRole.entities.Produto.create(novoProduto));
        } else {
           const dadosAtualizacao: Record<string, unknown> = {};
           validFields.forEach((field) => copyValidField(dadosAtualizacao, dados || {}, field));
           const anterior = produtoAntigoPorId.get(String(id));
           applyVitrineToPayload(dadosAtualizacao, dados || {}, anterior);
           if (Object.keys(dadosAtualizacao).length > 0) {
             await withRetry(() => base44.asServiceRole.entities.Produto.update(id, dadosAtualizacao));
             console.log(`✓ Produto ${id} atualizado:`, Object.keys(dadosAtualizacao).join(', '));
           } else {
             console.warn(`⚠ Nenhum campo para atualizar no produto ${id}`);
           }
         }
        processados++;
        await sleep(200);
      } catch (e) {
        console.warn(`Erro ao processar produto ${id}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      message: `Lote ${lote_numero}/${total_lotes} concluído. ${processados}/${alterados.length} produto(s) processado(s).${linhasRejeitadas.length > 0 ? ` ${linhasRejeitadas.length} rejeitado(s) por validacao de unidades.` : ''}`,
      count: processados,
      rejeitados: linhasRejeitadas,
      ...(importacaoLogAviso ? { warning: importacaoLogAviso } : {}),
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
