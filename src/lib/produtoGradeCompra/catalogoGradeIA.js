import { montarDescricaoSku } from './montarDescricaoSku';

export const GRADE_IA_MODES = {
  ONLY_WITHOUT_LINHA: 'only_without_linha',
};

function norm(s) {
  return String(s || '').trim().toUpperCase();
}

function slug(s) {
  return norm(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

export function produtoSemLinhaCompra(produto = {}) {
  return Boolean(produto?.id) && !produto.linha_compra_id;
}

export function buildGradeMigrationPrompt(produtos = [], catalogo = {}) {
  const { linhas = [], produtosCompra = [] } = catalogo;

  const linhasTxt = linhas.map((l) => (
    `- ${l.codigo}: "${l.nome}" (tipo=${l.tipo}, eixo_a=${l.eixo_a_rotulo || '-'}, eixo_b=${l.eixo_b_rotulo || '-'})`
  )).join('\n');

  const pcTxt = produtosCompra.map((pc) => {
    const linha = linhas.find((l) => l.id === pc.linha_id);
    return `- [${linha?.codigo || '?'}] ${pc.codigo}: "${pc.nome}"`;
  }).join('\n');

  const produtosTxt = produtos.map((p) => (
    JSON.stringify({
      id: p.id,
      nome: p.nome,
      marca: p.marca || '',
      h1: p.campo_hierarquico_1 || '',
      h2: p.campo_hierarquico_2 || '',
      h3: p.campo_hierarquico_3 || '',
      h4: p.campo_hierarquico_4 || '',
      h5: p.campo_hierarquico_5 || '',
    })
  )).join('\n');

  return `És um especialista em cadastro de materiais de construção (loja de varejo).

Tarefa: mapear cada SKU para o modelo de COMPRA por LINHA + PRODUTO_COMPRA + até 2 eixos (A e B).

Regras:
1. Máximo 2 eixos. Se precisar de 3ª dimensão, usa novo produto_compra_nome (não inventes eixo C).
2. tipo "solo": sem eixos (ex.: cimento, pregos simples) — detalhe em marca ou no produto_compra_nome.
3. tipo "linha_mix": eixos obrigatórios quando fizer sentido (ex.: argamassa classe × embalagem).
4. tipo "portfolio": modelos complementares (ex.: piso formato × modelo, tinta embalagem × cor).
5. LINHA = frente de compra/análise. Pode ser igual ao h1 quando fizer sentido (ex.: VERNIZ, TORNEIRA).
6. Se não houver confiança razoável: acao="ignorar" ou acao="avulso" (produto fora da grelha).
7. Preferir linhas já existentes. Só cria linha_codigo novo se h1/hierarquia for claramente uma família distinta.
8. Para TINTA com h3 de subtipo, produto_compra_nome como "TINTA ESMALTE SINTÉTICO" (agrupamento alfabético).
9. Para SOLDÁVEL (h2 soldável): linha CONEXAO_SOLDAVEL, produto_compra por peça.
10. confianca: "alta" só com cadastro claro; "media" com inferência provável; "baixa" se duvidoso → preferir ignorar.

LINHAS EXISTENTES:
${linhasTxt || '(nenhuma)'}

PRODUTOS DE COMPRA EXISTENTES:
${pcTxt || '(nenhum)'}

PRODUTOS A MAPEAR (JSON por linha):
${produtosTxt}

Responde JSON com updates[] — um item por produto de entrada. Campos:
- id (obrigatório)
- acao: "atribuir" | "avulso" | "ignorar"
- linha_codigo, linha_nome, linha_tipo (solo|linha_mix|portfolio) — se atribuir
- produto_compra_nome — nome canónico do produto de compra
- eixo_a, eixo_b — textos dos eixos (vazio se solo)
- eixo_a_rotulo, eixo_b_rotulo — rótulos se criar linha nova
- confianca: alta|media|baixa
- motivo_curto`;
}

export function resolveGradeIAUpdate(update = {}, linhas = []) {
  const acao = String(update.acao || 'ignorar').toLowerCase();
  if (acao === 'ignorar' || acao === 'avulso') {
    return { ok: true, skip: true, acao };
  }
  if (acao !== 'atribuir') return { ok: false, reason: 'acao_invalida' };

  const conf = String(update.confianca || 'baixa').toLowerCase();
  if (conf === 'baixa') return { ok: false, reason: 'confianca_baixa' };

  const linhaCodigo = slug(update.linha_codigo || update.linha_nome || '');
  const pcNome = String(update.produto_compra_nome || '').trim().toUpperCase();
  if (!linhaCodigo || !pcNome) return { ok: false, reason: 'linha_ou_pc_vazio' };

  const tipo = ['solo', 'linha_mix', 'portfolio'].includes(update.linha_tipo)
    ? update.linha_tipo
    : 'solo';

  const linhaExistente = linhas.find((l) => norm(l.codigo) === linhaCodigo);

  return {
    ok: true,
    skip: false,
    patch: {
      linha_codigo: linhaCodigo,
      linha_nome: String(update.linha_nome || linhaExistente?.nome || linhaCodigo).trim().toUpperCase(),
      linha_tipo: linhaExistente?.tipo || tipo,
      eixo_a_rotulo: update.eixo_a_rotulo || linhaExistente?.eixo_a_rotulo || null,
      eixo_b_rotulo: update.eixo_b_rotulo || linhaExistente?.eixo_b_rotulo || null,
      produto_compra_codigo: slug(pcNome),
      produto_compra_nome: pcNome,
      eixo_a: String(update.eixo_a || '').trim(),
      eixo_b: String(update.eixo_b || '').trim(),
      confianca: conf,
      motivo_curto: String(update.motivo_curto || '').trim(),
    },
  };
}

export function buildNomeFromGradePatch(patch = {}, marca = '') {
  return montarDescricaoSku({
    produtoCompraNome: patch.produto_compra_nome || '',
    eixoANome: patch.eixo_a || '',
    eixoBNome: patch.eixo_b || '',
    marca,
  });
}

export { slug, norm };
