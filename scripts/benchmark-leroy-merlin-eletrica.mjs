#!/usr/bin/env node
/**
 * Benchmark elétrica P38 vs mix básico Leroy Merlin — hidratar o que já temos.
 *
 *   npm run benchmark:leroy-eletrica
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const DEFAULT_IN = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const DEFAULT_MIX = path.join(process.cwd(), 'src', 'data', 'leroyMerlinMixEletricaBasico.json');
const DEFAULT_OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-eletrica-benchmark-lm.xlsx');
const DEFAULT_NOVOS = path.join(process.cwd(), 'src', 'data', 'eletricaNovosDisjuntores.json');
const DEFAULT_NOVOS_INFRA = path.join(process.cwd(), 'src', 'data', 'eletricaNovosConexoesContatores.json');
const DEFAULT_NOVOS_COMPLETAR = path.join(process.cwd(), 'src', 'data', 'eletricaNovosCompletarBenchmark.json');

function parseArgs(argv) {
  const get = (p) => argv.find((a) => a.startsWith(p))?.slice(p.length);
  return { inPath: get('--in=') ?? DEFAULT_IN, mixPath: get('--mix=') ?? DEFAULT_MIX, outPath: get('--out=') ?? DEFAULT_OUT };
}

function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function polegadaNorm(s) {
  return norm(s).replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
}

function blobRow(row) {
  return norm(`${row.produto_compra} ${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`);
}

function styleHeader(row, color = 'FF4A5240') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

async function loadBEletrica(inPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inPath);
  const ws = wb.getWorksheet('B — Elétrica');
  if (!ws) throw new Error('Folha "B — Elétrica" em falta');
  const headers = ws.getRow(1).values.slice(1);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k) => String(row.getCell(idx[k])?.value ?? '').trim();
    rows.push({ sub_bloco: get('sub_bloco'), produto_compra: get('produto_compra'), eixo_a: get('eixo_a'), eixo_b: get('eixo_b'), codigo_interno: get('codigo_interno'), sku_atual: get('sku_atual') });
  }
  return rows;
}

function rowBase(familia, grupo, lmUrls, fields) {
  return {
    grupo: grupo?.nome ?? '',
    familia: familia.id,
    produto_compra: familia.produto_compra ?? fields.produto_compra ?? '',
    variante: fields.variante ?? '',
    amperagem_ou_eixo: fields.amperagem_ou_eixo ?? fields.variante ?? '',
    status: fields.status,
    qtd_p38: fields.qtd_p38 ?? 0,
    codigos_p38: fields.codigos_p38 ?? '',
    sku_exemplo: fields.sku_exemplo ?? '',
    lm_caminho: familia.lm_caminho ?? '',
    lm_url: fields.lm_url ?? lmUrls.disjuntores ?? '',
    nota: fields.nota ?? '',
    prioridade: fields.prioridade ?? familia.prioridade ?? 'nucleo',
    acao: fields.acao ?? '',
    detalhe: fields.detalhe ?? '',
  };
}

function parseContator(row) {
  if (!norm(row.produto_compra).includes('CONTATOR')) return null;
  const blob = blobRow(row);
  let polos = '';
  if (/TRIF/.test(blob)) polos = 'TRIFÁSICO';
  else if (/1\s*NA|MONOF/.test(blob)) polos = '1NA';
  const amp = blob.match(/(\d+)\s*A\b/);
  return polos && amp ? { polos, amperagem: `${amp[1]}A` } : null;
}

function matchConexao(row, produtoCompra, eixoMatch) {
  if (norm(row.produto_compra) !== norm(produtoCompra)) return false;
  const blob = blobRow(row).replace(/\s/g, '');
  return blob.includes(norm(eixoMatch).replace(/\s/g, ''));
}

function matchDisjuntorAmpComplemento(variante, amp) {
  return (variante.amperagens_complemento ?? []).includes(amp);
}

function markNovoEstudo({ cadastroVazio, novosKeys, key, status, acao, novoItem }) {
  if (cadastroVazio && novosKeys.has(key)) {
    return {
      status: 'novo',
      acao: 'cadastrar (aprovado estudo)',
      prioridade: novoItem?.prioridade ?? 'nucleo',
    };
  }
  return { status, acao, prioridade: undefined };
}

function parseDisjuntor(row) {
  if (norm(row.produto_compra) !== 'DISJUNTOR') return null;
  const blob = blobRow(row);
  let tipo = '';
  if (/MONOF/.test(blob)) tipo = 'MONOFÁSICO';
  else if (/BIF/.test(blob)) tipo = 'BIFÁSICO';
  else if (/TRIF/.test(blob)) tipo = 'TRIFÁSICO';
  const amp = blob.match(/(\d+)\s*A\b/);
  return tipo && amp ? { tipo, amperagem: `${amp[1]}A` } : null;
}

function matchFio(row, eixoMatch) {
  const blob = blobRow(row).replace(/\s/g, '');
  return blob.includes(norm(eixoMatch).replace(/\s/g, ''));
}

function isFioFlexProduto(row) {
  const pc = norm(row.produto_compra);
  return pc.includes('FIO FLEX') || pc.includes('CABO FLEX') || pc === 'FIO ELÉTRICO' || pc === 'FIO ELETRICO';
}

function matchFioFlex(row, eixoMatch) {
  if (!isFioFlexProduto(row)) return false;
  return matchFio(row, eixoMatch);
}

function matchQuadroPlastico(row, eixoA) {
  const blob = blobRow(row);
  if (!blob.includes('QUADRO DE DISTRIBUI')) return false;
  if (/METAL|METÁLIC|METALIC/.test(blob)) return false;
  return norm(row.eixo_a).startsWith(norm(eixoA)) || blob.includes(` ${eixoA} `) || blob.includes(` ${eixoA}/`);
}

function matchQuadroMetalico(row, eixoA) {
  const blob = blobRow(row);
  if (blob.includes('QUADRO MET') || (blob.includes('QUADRO') && /METAL|METÁLIC|METALIC/.test(blob))) {
    return norm(row.eixo_a).startsWith(norm(eixoA)) || new RegExp(`\\b${eixoA}\\b`).test(blob);
  }
  return false;
}

function matchPecaEletrodutoSingle(row, peca, size) {
  return matchPecaEletroduto(row, peca, size);
}

function completarRowKey(row) {
  return `${row.familia}|${row.variante}|${row.amperagem_ou_eixo}`;
}

function completarNovoKey(n) {
  return `${n.familia}|${n.variante}|${n.amperagem_ou_eixo}`;
}

function matchSizeInRow(row, size) {
  const want = polegadaNorm(size);
  const blob = polegadaNorm(`${row.eixo_a} ${row.eixo_b} ${row.sku_atual}`);
  if (want === '1') return /\b1(\s|$)/.test(blob) && !/1\s*1\/4|1\s*1\/2|1\/2|1\/4/.test(blob.replace(/1\s*1\/4/g, 'XX').replace(/1\s*1\/2/g, 'YY'));
  return blob.includes(want.replace(/\s/g, '')) || blob.includes(want);
}

function matchPecaEletroduto(row, peca, size) {
  const pc = norm(row.produto_compra);
  const p = norm(peca);
  if (p === 'LUVA') {
    if (pc !== 'LUVA') return false;
    return /ELETRODUTO/.test(blobRow(row)) && matchSizeInRow(row, size);
  }
  if (!pc.includes(p.replace(' ELETRODUTO', '')) && pc !== p) return false;
  if (p.includes('ELETRODUTO') && !pc.includes('ELETRODUTO') && pc !== 'LUVA') return false;
  return matchSizeInRow(row, size);
}

function buildFamiliaRows(familia, p38Rows, mix, novosEstudo = null) {
  const grupo = mix.grupos?.find((g) => g.codigo === familia.grupo);
  const lmUrls = mix.lm_urls;
  const tipo = familia.tipo_matriz ?? 'legacy';
  const rows = [];

  if (tipo === 'disjuntor') {
    const payload = novosEstudo?.disjuntores;
    const cadastroVazio = payload?.cadastro_actual === 'vazio';
    const novosMap = new Map((payload?.novos ?? []).map((n) => [`${n.tipo}|${n.amperagem}`, n]));
    const novosKeys = new Set(novosMap.keys());
    for (const v of familia.variantes) {
      for (const amp of v.amperagens) {
        const hits = cadastroVazio
          ? []
          : p38Rows.filter((r) => { const d = parseDisjuntor(r); return d && d.tipo === v.tipo && d.amperagem === amp; });
        const key = `${v.tipo}|${amp}`;
        let status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
        let acao = status === 'falta' ? 'cadastrar' : status === 'duplicado' ? 'revisar duplicado' : '';
        let prio = matchDisjuntorAmpComplemento(v, amp) ? 'complemento' : familia.prioridade ?? 'nucleo';
        const marked = markNovoEstudo({ cadastroVazio, novosKeys, key, status, acao, novoItem: novosMap.get(key) });
        status = marked.status;
        acao = marked.acao;
        if (marked.prioridade) prio = marked.prioridade;
        rows.push(rowBase(familia, grupo, lmUrls, {
          variante: v.tipo, amperagem_ou_eixo: amp, status, qtd_p38: hits.length, prioridade: prio,
          codigos_p38: hits.map((h) => h.codigo_interno).join(', '), sku_exemplo: hits[0]?.sku_atual,
          lm_url: lmUrls.disjuntores, acao,
          nota: novosMap.get(key)?.nota ?? (matchDisjuntorAmpComplemento(v, amp) ? 'Infra beyond — poucas unidades' : ''),
        }));
      }
    }
    return rows;
  }

  if (tipo === 'contator') {
    const payload = novosEstudo?.contatores;
    const cadastroVazio = payload?.cadastro_actual === 'vazio';
    const novosMap = new Map((payload?.novos ?? []).map((n) => [`${n.polos}|${n.amperagem}`, n]));
    const novosKeys = new Set(novosMap.keys());
    for (const v of familia.variantes) {
      for (const amp of v.amperagens) {
        const hits = cadastroVazio
          ? []
          : p38Rows.filter((r) => { const c = parseContator(r); return c && c.polos === v.polos && c.amperagem === amp; });
        const key = `${v.polos}|${amp}`;
        let status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
        let acao = status === 'falta' ? 'cadastrar' : status === 'duplicado' ? 'revisar duplicado' : '';
        let prio = v.prioridade ?? familia.prioridade ?? 'nucleo';
        const marked = markNovoEstudo({ cadastroVazio, novosKeys, key, status, acao, novoItem: novosMap.get(key) });
        status = marked.status;
        acao = marked.acao;
        if (marked.prioridade) prio = marked.prioridade;
        rows.push(rowBase(familia, grupo, lmUrls, {
          variante: v.polos, amperagem_ou_eixo: amp, status, qtd_p38: hits.length, prioridade: prio,
          produto_compra: 'CONTATOR',
          codigos_p38: hits.map((h) => h.codigo_interno).join(', '), sku_exemplo: hits[0]?.sku_atual,
          lm_url: lmUrls.contatores, acao,
          nota: novosMap.get(key)?.nota ?? (prio === 'complemento' ? 'Infra beyond — poucas unidades' : ''),
        }));
      }
    }
    return rows;
  }

  if (tipo === 'conexao') {
    const payload = novosEstudo?.conexoes;
    const cadastroVazio = payload?.cadastro_actual === 'vazio';
    const novosMap = new Map((payload?.novos ?? []).map((n) => [`${n.produto_compra}|${n.eixo_a}`, n]));
    const novosKeys = new Set(novosMap.keys());
    for (const v of familia.variantes) {
      const hits = cadastroVazio
        ? []
        : p38Rows.filter((r) => matchConexao(r, v.produto_compra, v.eixo_match));
      const key = `${v.produto_compra}|${v.eixo_a}`;
      const novoItem = novosMap.get(key);
      let status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
      let acao = status === 'falta' ? 'cadastrar' : status === 'duplicado' ? 'revisar duplicado' : '';
      let prio = v.prioridade ?? familia.prioridade ?? 'nucleo';
      const marked = markNovoEstudo({ cadastroVazio, novosKeys, key, status, acao, novoItem });
      status = marked.status;
      acao = marked.acao;
      if (marked.prioridade) prio = marked.prioridade;
      rows.push(rowBase(familia, grupo, lmUrls, {
        variante: v.label, amperagem_ou_eixo: v.eixo_a, status, qtd_p38: hits.length, prioridade: prio,
        produto_compra: v.produto_compra,
        codigos_p38: hits.map((h) => h.codigo_interno).join(', '), sku_exemplo: hits[0]?.sku_atual ?? novoItem?.novo_sku ?? '',
        lm_url: lmUrls.conexoes, acao,
        nota: novoItem?.nota ?? '',
      }));
    }
    return rows;
  }

  if (tipo === 'eletroduto_kit') {
    for (const v of familia.variantes) {
      const pecasOk = [];
      const pecasFalta = [];
      for (const peca of familia.pecas) {
        const hits = p38Rows.filter((r) => matchPecaEletroduto(r, peca, v.size));
        if (hits.length) pecasOk.push(peca);
        else pecasFalta.push(peca);
      }
      const status = pecasFalta.length === 0 ? 'tem' : pecasFalta.length === familia.pecas.length ? 'falta' : 'parcial';
      rows.push(rowBase(familia, grupo, lmUrls, {
        variante: v.label, amperagem_ou_eixo: v.size, status, qtd_p38: pecasOk.length,
        detalhe: pecasFalta.length ? `Falta: ${pecasFalta.join(', ')}` : `Completo: ${pecasOk.join(', ')}`,
        lm_url: lmUrls.eletroduto,
        acao: pecasFalta.length ? `cadastrar ${pecasFalta.join(', ')}` : '',
      }));
    }
    return rows;
  }

  if (tipo === 'eletroduto_peca') {
    const payload = novosEstudo?.completar;
    const cadastroVazio = payload?.cadastro_actual === 'vazio';
    const novosMap = new Map((payload?.novos ?? []).filter((n) => n.familia === familia.id).map((n) => [completarNovoKey(n), n]));
    for (const v of familia.variantes) {
      const hits = p38Rows.filter((r) => matchPecaEletrodutoSingle(r, familia.peca, v.size));
      const variante = v.label;
      const amperagem = v.size;
      const key = `${familia.id}|${variante}|${amperagem}`;
      let status = hits.length ? 'tem' : 'falta';
      let acao = status === 'falta' ? 'cadastrar' : '';
      const novoItem = novosMap.get(key);
      if (cadastroVazio && novoItem) {
        status = 'novo';
        acao = 'cadastrar (aprovado estudo)';
      }
      rows.push(rowBase(familia, grupo, lmUrls, {
        variante, amperagem_ou_eixo: amperagem, status, qtd_p38: hits.length,
        produto_compra: familia.produto_compra,
        codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
        sku_exemplo: hits[0]?.sku_atual ?? novoItem?.novo_sku ?? '',
        lm_url: lmUrls.eletroduto, acao, nota: novoItem?.nota ?? '',
      }));
    }
    return rows;
  }

  if (tipo === 'quadro_material') {
    const payload = novosEstudo?.completar;
    const cadastroVazio = payload?.cadastro_actual === 'vazio';
    const novosMap = new Map((payload?.novos ?? []).filter((n) => n.familia === familia.id).map((n) => [completarNovoKey(n), n]));
    const isMetal = familia.material === 'METÁLICO';
    const marcas = (familia.marcas_ref ?? []).join('/');
    for (const v of familia.variantes) {
      const hits = isMetal
        ? p38Rows.filter((r) => matchQuadroMetalico(r, v.eixo_a))
        : p38Rows.filter((r) => matchQuadroPlastico(r, v.eixo_a));
      const key = `${familia.id}|${v.label}|${v.eixo_a}`;
      let status = hits.length ? (hits.length > 1 ? 'duplicado' : 'tem') : 'falta';
      let acao = status === 'falta' ? 'cadastrar' : '';
      let nota = isMetal ? `Metálico — ref. ${marcas}` : `Plástico — ref. ${marcas}`;
      if (!isMetal && hits.length && hits.some((h) => norm(h.sku_atual).includes('TRIAL'))) {
        nota += ' · revisar marca (Trial no cadastro)';
      }
      const novoItem = novosMap.get(key);
      if (cadastroVazio && novoItem) {
        status = 'novo';
        acao = 'cadastrar (aprovado estudo)';
        nota = novoItem.nota ?? nota;
      }
      rows.push(rowBase(familia, grupo, lmUrls, {
        variante: v.label, amperagem_ou_eixo: v.eixo_a, status, qtd_p38: hits.length,
        produto_compra: familia.produto_compra,
        codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
        sku_exemplo: hits[0]?.sku_atual ?? novoItem?.novo_sku ?? '',
        lm_url: lmUrls.quadros, acao, nota,
      }));
    }
    return rows;
  }

  for (const v of familia.variantes) {
    const prio = v.prioridade ?? familia.prioridade ?? 'nucleo';
    let hits = [];
    let notaExtra = '';

    if (tipo === 'fio_flex') {
      hits = p38Rows.filter((r) => matchFioFlex(r, v.eixo_match));
      if (hits.some((h) => norm(h.produto_compra).includes('FIO ELÉTRICO'))) {
        notaExtra = 'Legado FIO ELÉTRICO — migrar para FIO FLEXÍVEL';
      }
    } else if (tipo === 'eixo_a') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && norm(r.eixo_a) === norm(v.eixo_a));
    } else if (tipo === 'fio') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && matchFio(r, v.eixo_match));
    } else if (tipo === 'caixinha') {
      hits = p38Rows.filter((r) => {
        const b = norm(`${r.eixo_a} ${r.sku_atual}`).replace(/\s/g, '');
        const key = norm(v.eixo_match).replace(/\s/g, '');
        const isCaixa = norm(r.produto_compra).includes('CAIXINHA') || (key === '4X4' && norm(r.produto_compra) === 'CAIXA DE LUZ');
        return isCaixa && b.includes(key);
      });
    } else if (tipo === 'eletroduto_size') {
      hits = p38Rows.filter((r) => norm(r.produto_compra) === norm(familia.produto_compra) && matchSizeInRow(r, v.size));
    } else if (tipo === 'sku_contem') {
      hits = p38Rows.filter((r) => {
        const b = blobRow(r);
        if (familia.id === 'pontalete' && !norm(r.produto_compra).startsWith('PONTALETE')) return false;
        if (familia.id === 'caixa_contador' && !b.includes('CONTADOR')) return false;
        return b.includes(norm(v.sku_contem));
      });
    } else if (tipo === 'produto_compra_contem') {
      hits = p38Rows.filter((r) => norm(r.produto_compra).includes(norm(familia.produto_compra)) || norm(r.produto_compra).includes(norm(v.match)));
    } else if (tipo === 'produto_compra') {
      hits = p38Rows.filter((r) => norm(r.produto_compra).includes(norm(familia.produto_compra)));
    }

    const status = hits.length ? 'tem' : 'falta';
    const ampEixo = tipo === 'eletroduto_size'
      ? (v.size ?? v.label)
      : (v.eixo_match ?? v.eixo_a ?? v.size ?? v.label ?? '');
    rows.push(rowBase(familia, grupo, lmUrls, {
      variante: v.label ?? v.eixo_a ?? v.size ?? familia.produto_compra,
      amperagem_ou_eixo: ampEixo,
      status, qtd_p38: hits.length, prioridade: prio,
      codigos_p38: hits.map((h) => h.codigo_interno).join(', '),
      sku_exemplo: hits[0]?.sku_atual ?? '',
      lm_url: lmUrls[familia.id] ?? lmUrls.eletroduto ?? lmUrls.fios ?? lmUrls.padrao_entrada,
      acao: status === 'falta' ? 'cadastrar' : '',
      nota: notaExtra,
    }));
  }
  return rows;
}

function buildBenchmark(p38Rows, mix, novosEstudo) {
  return mix.familias.flatMap((fam) => buildFamiliaRows(fam, p38Rows, mix, novosEstudo));
}

function loadNovosEstudo() {
  const disjuntores = fs.existsSync(DEFAULT_NOVOS)
    ? JSON.parse(fs.readFileSync(DEFAULT_NOVOS, 'utf8'))
    : { novos: [], cadastro_actual: 'vazio' };
  const infra = fs.existsSync(DEFAULT_NOVOS_INFRA)
    ? JSON.parse(fs.readFileSync(DEFAULT_NOVOS_INFRA, 'utf8'))
    : { conexoes: { novos: [], cadastro_actual: 'vazio' }, contatores: { novos: [], cadastro_actual: 'vazio' } };
  const completar = fs.existsSync(DEFAULT_NOVOS_COMPLETAR)
    ? JSON.parse(fs.readFileSync(DEFAULT_NOVOS_COMPLETAR, 'utf8'))
    : { novos: [], cadastro_actual: 'vazio' };
  return {
    disjuntores,
    conexoes: infra.conexoes ?? { novos: [], cadastro_actual: 'vazio' },
    contatores: infra.contatores ?? { novos: [], cadastro_actual: 'vazio' },
    completar,
    nota_estrategia: [infra.nota_estrategia, completar.nota].filter(Boolean).join(' '),
    fio_flexivel: completar.fio_flexivel ?? {},
  };
}

function applyNovosEstudo(matrix, novosEstudo) {
  const rules = [
    { familia: 'disjuntor', payload: novosEstudo.disjuntores, rowKey: (r) => `${r.variante}|${r.amperagem_ou_eixo}`, novoKey: (n) => `${n.tipo}|${n.amperagem}` },
    { familia: 'contator', payload: novosEstudo.contatores, rowKey: (r) => `${r.variante}|${r.amperagem_ou_eixo}`, novoKey: (n) => `${n.polos}|${n.amperagem}` },
    { familia: 'conexao_sem_fita', payload: novosEstudo.conexoes, rowKey: (r) => `${r.produto_compra}|${r.amperagem_ou_eixo}`, novoKey: (n) => `${n.produto_compra}|${n.eixo_a}` },
  ];
  return matrix.map((row) => {
    const rule = rules.find((x) => x.familia === row.familia);
    if (!rule) return row;
    const cadastroVazio = rule.payload?.cadastro_actual === 'vazio';
    const keys = new Set((rule.payload?.novos ?? []).map(rule.novoKey));
    const key = rule.rowKey(row);
    if (!keys.has(key)) return row;
    if (cadastroVazio || row.status === 'falta') {
      const novoItem = (rule.payload?.novos ?? []).find((n) => rule.novoKey(n) === key);
      return {
        ...row,
        status: 'novo',
        acao: 'cadastrar (aprovado estudo)',
        prioridade: novoItem?.prioridade ?? row.prioridade ?? 'nucleo',
        qtd_p38: 0,
        codigos_p38: '',
        sku_exemplo: novoItem?.novo_sku ?? row.sku_exemplo,
        nota: novoItem?.nota ?? row.nota,
      };
    }
    return row;
  });
}

function applyCompletarBenchmark(matrix, completar) {
  if (!completar?.novos?.length) return matrix;
  const novosMap = new Map(completar.novos.map((n) => [completarNovoKey(n), n]));
  const cadastroVazio = completar.cadastro_actual === 'vazio';
  return matrix.map((row) => {
    const key = completarRowKey(row);
    const novoItem = novosMap.get(key);
    if (!novoItem) return row;
    if (!cadastroVazio && row.status !== 'falta' && row.status !== 'parcial') return row;
    return {
      ...row,
      status: 'novo',
      acao: 'cadastrar (aprovado estudo)',
      prioridade: novoItem.prioridade ?? row.prioridade ?? 'nucleo',
      qtd_p38: row.status === 'tem' ? row.qtd_p38 : 0,
      codigos_p38: row.status === 'tem' ? row.codigos_p38 : '',
      sku_exemplo: novoItem.novo_sku ?? row.sku_exemplo,
      nota: novoItem.nota ?? row.nota,
      produto_compra: novoItem.produto_compra ?? row.produto_compra,
    };
  });
}

function buildNovosCompletarRows(completar) {
  return (completar?.novos ?? []).map((n) => ({
    numero: n.numero,
    bloco: 'B — Instalações',
    sub_bloco: n.sub_bloco ?? '',
    familia: n.familia,
    produto_compra: n.produto_compra ?? '',
    eixo_a: n.eixo_a ?? n.amperagem_ou_eixo ?? '',
    variante: n.variante ?? '',
    codigo_interno: '',
    novo_sku: n.novo_sku,
    status_mix: 'novo',
    prioridade: n.prioridade ?? 'nucleo',
    nota: n.nota ?? '',
  }));
}

function buildNovosCadastroRows(section, payload) {
  const ref = payload.referencia_existente ?? {};
  return (payload.novos ?? []).map((n) => {
    const base = {
      numero: n.numero,
      bloco: 'B — Instalações',
      sub_bloco: ref.sub_bloco ?? '',
      etapa: ref.etapa ?? '',
      core: ref.core ?? '',
      linha: ref.linha ?? '',
      codigo_interno: '',
      novo_sku: n.novo_sku,
      sku_atual: n.novo_sku,
      status_mix: 'novo',
      prioridade: n.prioridade ?? 'nucleo',
      nota: n.nota ?? '',
    };
    if (section === 'disjuntores') {
      return {
        ...base,
        produto_compra: ref.produto_compra ?? 'DISJUNTOR',
        eixo_a: ref.eixo_a ?? 'DIN',
        eixo_b: n.eixo_b ?? n.tipo,
        amperagem: n.amperagem ?? '',
      };
    }
    if (section === 'contatores') {
      return {
        ...base,
        produto_compra: 'CONTATOR',
        eixo_a: n.eixo_a ?? 'MODULAR',
        eixo_b: n.eixo_b ?? n.polos,
        amperagem: n.amperagem ?? '',
      };
    }
    return {
      ...base,
      produto_compra: n.produto_compra ?? '',
      eixo_a: n.eixo_a ?? '',
      eixo_b: n.eixo_b ?? '',
      amperagem: '',
    };
  });
}

function buildMixDisjuntorAlvo(matrix, novosEstudo) {
  const disj = matrix.filter((r) => r.familia === 'disjuntor');
  const revisar = novosEstudo.disjuntores?.revisar ?? [];
  const rows = disj.map((r) => ({
    tipo: r.variante,
    amperagem: r.amperagem_ou_eixo,
    status: r.status,
    codigo_p38: r.codigos_p38,
    sku: r.sku_exemplo || (r.status === 'novo' ? `DISJUNTOR DIN ${r.variante} ${r.amperagem_ou_eixo}` : ''),
    acao: r.acao,
  }));
  for (const rev of revisar) {
    rows.push({
      tipo: rev.item,
      amperagem: '',
      status: 'duplicado',
      codigo_p38: rev.codigos?.join(', ') ?? '',
      sku: rev.item,
      acao: rev.acao,
    });
  }
  return rows.sort((a, b) => `${a.tipo}\x00${a.amperagem}`.localeCompare(`${b.tipo}\x00${b.amperagem}`, 'pt-BR'));
}

function addSheet(wb, name, headers, dataRows, color) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(headers);
  styleHeader(ws.getRow(1), color);
  for (const row of dataRows) ws.addRow(headers.map((h) => row[h] ?? ''));
  const widths = [16, 14, 22, 16, 22, 10, 8, 20, 40, 36, 50, 28, 12, 14, 36];
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths[i] ?? 16; });
  if (dataRows.length) ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}${dataRows.length + 1}` };
}

async function writeXlsx(outPath, matrix, p38Rows, mix, novosEstudo) {
  const wb = new ExcelJS.Workbook();
  const headers = ['grupo', 'familia', 'produto_compra', 'variante', 'amperagem_ou_eixo', 'status', 'qtd_p38', 'codigos_p38', 'sku_exemplo', 'lm_caminho', 'lm_url', 'nota', 'prioridade', 'acao', 'detalhe'];

  const falta = matrix.filter((r) => r.status === 'falta' || r.status === 'parcial');
  const novos = matrix.filter((r) => r.status === 'novo');
  const tem = matrix.filter((r) => r.status === 'tem');
  const revisar = matrix.filter((r) => r.status === 'duplicado');
  const novosNucleo = novos.filter((r) => r.prioridade === 'nucleo');
  const novosComplemento = novos.filter((r) => r.prioridade === 'complemento');

  const resumo = wb.addWorksheet('Resumo');
  resumo.addRow(['métrica', 'valor']);
  styleHeader(resumo.getRow(1), 'FF2D5016');
  resumo.addRow(['Mix LM (posições)', matrix.length]);
  resumo.addRow(['P38 — tem', tem.length]);
  resumo.addRow(['P38 — novo (estudo)', novos.length]);
  resumo.addRow(['  └ núcleo', novosNucleo.length]);
  resumo.addRow(['  └ complemento / beyond', novosComplemento.length]);
  resumo.addRow(['P38 — falta', matrix.filter((r) => r.status === 'falta').length]);
  resumo.addRow(['P38 — parcial (kit incompleto)', matrix.filter((r) => r.status === 'parcial').length]);
  resumo.addRow(['P38 — duplicado', revisar.length]);
  resumo.addRow(['SKUs B Elétrica', p38Rows.length]);
  if (novosEstudo.fio_flexivel?.nota_operacao) resumo.addRow(['Fio flexível', novosEstudo.fio_flexivel.nota_operacao]);
  resumo.addRow([]);
  for (const g of mix.grupos ?? []) {
    const gRows = matrix.filter((r) => r.grupo === g.nome);
    resumo.addRow([g.nome, `${gRows.filter((r) => r.status === 'tem').length}/${gRows.length} OK`]);
  }
  resumo.getColumn(1).width = 40;
  resumo.getColumn(2).width = 16;

  addSheet(wb, 'Matriz completa', headers, matrix, 'FF3A4A5C');
  addSheet(wb, 'Falta ou parcial', headers, falta, 'FFB84A4A');
  addSheet(wb, 'Já temos', headers, tem, 'FF2D6B4A');

  const novosHeaders = ['numero', 'bloco', 'sub_bloco', 'etapa', 'core', 'linha', 'produto_compra', 'eixo_a', 'eixo_b', 'amperagem', 'codigo_interno', 'novo_sku', 'status_mix', 'prioridade', 'nota'];
  addSheet(wb, 'Novos — disjuntores', novosHeaders, buildNovosCadastroRows('disjuntores', novosEstudo.disjuntores), 'FF6B4A8C');
  addSheet(wb, 'Novos — conexões', novosHeaders, buildNovosCadastroRows('conexoes', novosEstudo.conexoes), 'FF4A6B8C');
  addSheet(wb, 'Novos — contatores', novosHeaders, buildNovosCadastroRows('contatores', novosEstudo.contatores), 'FF8C6B4A');

  const completarHeaders = ['numero', 'bloco', 'sub_bloco', 'familia', 'produto_compra', 'eixo_a', 'variante', 'codigo_interno', 'novo_sku', 'status_mix', 'prioridade', 'nota'];
  addSheet(wb, 'Novos — completar 06-08', completarHeaders, buildNovosCompletarRows(novosEstudo.completar), 'FF5A6B4A');

  const mixHeaders = ['tipo', 'amperagem', 'status', 'codigo_p38', 'sku', 'acao'];
  addSheet(wb, 'Mix disjuntores alvo', mixHeaders, buildMixDisjuntorAlvo(matrix, novosEstudo), 'FF4A5C6B');

  const inv = wb.addWorksheet('Inventário P38 B');
  inv.addRow(['sub_bloco', 'produto_compra', 'eixo_a', 'eixo_b', 'codigo_interno', 'sku_atual']);
  styleHeader(inv.getRow(1), 'FF1A4D6B');
  for (const r of p38Rows) inv.addRow([r.sub_bloco, r.produto_compra, r.eixo_a, r.eixo_b, r.codigo_interno, r.sku_atual]);

  const legado = wb.addWorksheet('Legado export zumbi');
  legado.addRow(['codigo_interno', 'sku_estudo', 'nota']);
  styleHeader(legado.getRow(1), 'FF5C4A3A');
  for (const cod of novosEstudo.disjuntores?.legado_export_estudo?.codigos ?? []) {
    const hit = p38Rows.find((r) => r.codigo_interno === cod);
    legado.addRow([cod, hit?.sku_atual ?? '', novosEstudo.disjuntores?.legado_export_estudo?.nota ?? '']);
  }
  legado.getColumn(2).width = 48;
  legado.getColumn(3).width = 56;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
}

async function main() {
  const { inPath, mixPath, outPath } = parseArgs(process.argv.slice(2));
  const mix = JSON.parse(fs.readFileSync(mixPath, 'utf8'));
  const novosEstudo = loadNovosEstudo();
  const p38Rows = await loadBEletrica(inPath);
  let matrix = buildBenchmark(p38Rows, mix, novosEstudo);
  matrix = applyNovosEstudo(matrix, novosEstudo);
  matrix = applyCompletarBenchmark(matrix, novosEstudo.completar);
  matrix = matrix.map((row) => {
    if (row.familia !== 'eletroduto_kit' || row.status !== 'parcial') return row;
    if (!String(row.amperagem_ou_eixo).includes('1 1/4')) return row;
    const buchaNovo = novosEstudo.completar?.novos?.some((n) => n.familia === 'bucha_eletroduto');
    if (!buchaNovo) return row;
    return {
      ...row,
      status: 'novo',
      acao: 'cadastrar bucha 1¼ (fecha kit)',
      detalhe: 'Kit quase completo — falta só bucha 1¼ (proposta estudo)',
    };
  });
  await writeXlsx(outPath, matrix, p38Rows, mix, novosEstudo);

  const novos = matrix.filter((r) => r.status === 'novo');
  console.log('[benchmark-leroy-eletrica] OK');
  console.log(`  saída: ${outPath}`);
  console.log(`  mix: ${matrix.length} · tem: ${matrix.filter((r) => r.status === 'tem').length} · novo: ${novos.length} · falta: ${matrix.filter((r) => r.status === 'falta').length}`);
  const byFam = Object.groupBy(novos, (r) => r.familia);
  for (const [fam, rows] of Object.entries(byFam ?? {})) {
    console.log(`  Novos [${fam}]: ${rows.length}`);
    for (const r of rows) console.log(`    · ${r.sku_exemplo || r.produto_compra} (${r.prioridade})`);
  }
  const parcial = matrix.filter((r) => r.status === 'parcial');
  if (parcial.length) {
    console.log('  Parcial (kits):');
    for (const r of parcial) console.log(`    [${r.familia}] ${r.variante} — ${r.detalhe}`);
  }
}

main().catch((err) => {
  console.error('[benchmark-leroy-eletrica]', err.message);
  process.exit(1);
});
