#!/usr/bin/env node
/**
 * Simula o fluxo de importação de pedido (parser local + heurística + Groq opcional).
 * Uso: node scripts/simular-import-pedido-pdf.mjs [caminho.pdf]
 */
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePedidoCompraDocumento } from '../src/lib/ocrDocumentParser.js';
import {
  pedidoExtracaoPareceIncompleta,
  precisaFallbackNuvem,
  precisaFallbackNuvemIa,
  OCR_IMPORT_TIPOS,
} from '../src/lib/ocrImportPipeline.js';
import { normalizarRespostaGroq } from '../src/lib/ocrGroqNormalize.js';

const pdfPath =
  process.argv[2] ||
  '/home/ubuntu/.cursor/projects/workspace/uploads/Cota__o__30-09-2026_11h56_4407.pdf';

async function extrairTextoPdf(path) {
  const data = new Uint8Array(fs.readFileSync(path));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const partes = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const linha = content.items.map((it) => String(it.str || '').trim()).filter(Boolean).join(' ');
    if (linha) partes.push(linha);
  }
  return { texto: partes.join('\n').trim(), paginas: pdf.numPages };
}

async function tentarGroq(texto, tipo) {
  const key = process.env.GROQ_API_KEY || '';
  if (!key) return { skip: 'GROQ_API_KEY não definido no ambiente' };

  const model = process.env.GROQ_OCR_MODEL || 'llama-3.3-70b-versatile';
  const trim = texto.length > 28000 ? `${texto.slice(0, 28000)}\n[truncado]` : texto;
  const schema = `{"fornecedor":{"nome_identificado":"","cnpj_identificado":""},"itens":[{"descricao":"","codigo":"","quantidade":0,"preco_unitario":0,"unidade_medida_documento":"UN"}]}`;

  const prompt = `Você estrutura documentos comerciais brasileiros. Responda APENAS JSON válido.
Tipo: ${tipo}
Extraia TODOS os itens (descrição, quantidade, preco_unitario). Números com ponto decimal.
Schema: ${schema}
Texto:
---
${trim}
---`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { erro: `Groq HTTP ${res.status}: ${errText.slice(0, 200)}` };
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';
  let raw;
  try {
    raw = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    raw = m ? JSON.parse(m[0]) : null;
  }
  const dados = normalizarRespostaGroq(tipo, raw);
  return { dados, model };
}

function resumir(dados, label) {
  const itens = dados?.itens || [];
  console.log(`\n── ${label} ──`);
  console.log('Fornecedor:', dados?.fornecedor || '(vazio)');
  console.log(`Itens: ${itens.length}`);
  itens.slice(0, 30).forEach((it, i) => {
    const desc = (it.descricao || it.descricao_pdf || '').slice(0, 70);
    const q = it.quantidade ?? it.quantidade_pdf;
    const p = it.preco_unitario ?? it.preco_unitario_pdf;
    const cod = it.codigo || it.codigo_pdf || '';
    console.log(`  ${i + 1}. [${cod}] ${desc} | qtd=${q} | unit=R$ ${p}`);
  });
  if (itens.length > 30) console.log(`  … +${itens.length - 30} itens`);
}

console.log('PDF:', pdfPath);
const { texto, paginas } = await extrairTextoPdf(pdfPath);
console.log(`Páginas: ${paginas} | Caracteres de texto: ${texto.length}`);
if (!texto) {
  console.error('PDF sem camada de texto (scan) — no browser usaria OCR Paddle.');
  process.exit(1);
}

const tipo = OCR_IMPORT_TIPOS.PEDIDO_COMPRA;

// ① Parser local (mesmo do app após OCR de texto)
const local = parsePedidoCompraDocumento(texto);
resumir(local, 'Parser local (regras)');

const incompleto = pedidoExtracaoPareceIncompleta(texto, local);
const precisaNuvem = precisaFallbackNuvem(local, tipo, texto);
console.log('\nHeurística pós-local:');
console.log('  pedidoExtracaoPareceIncompleta:', incompleto);
console.log('  precisaFallbackNuvem:', precisaNuvem);

// ② Groq primário (como no app quando VITE_P38_OCR_GROQ_PRIMARY=true)
const groqPrim = await tentarGroq(texto, tipo);
if (groqPrim.skip) {
  console.log('\nGroq:', groqPrim.skip);
} else if (groqPrim.erro) {
  console.log('\nGroq erro:', groqPrim.erro);
} else if (groqPrim.dados && !precisaFallbackNuvemIa(groqPrim.dados, tipo)) {
  resumir(groqPrim.dados, `IA flexível (Groq / ${groqPrim.model}) — caminho primário no app`);
} else if (groqPrim.dados?.itens?.length) {
  resumir(groqPrim.dados, 'Groq devolveu itens (mas normalização ainda incompleta)');
} else {
  console.log('\nGroq: sem itens suficientes → app tentaria parser local');
  if (incompleto || precisaNuvem) {
    const groqRef = await tentarGroq(texto, tipo);
    if (groqRef.dados?.itens?.length) {
      resumir(groqRef.dados, 'IA reforço (simula ocr_local+groq_reforco)');
    }
  }
}

// Decisão final simplificada
let escolhido = local;
let modo = 'ocr_local+parser_fallback';
if (groqPrim.dados?.itens?.length && !precisaFallbackNuvemIa(groqPrim.dados, tipo)) {
  escolhido = groqPrim.dados;
  modo = 'ocr_local+groq_primario';
} else if (local.itens?.length && !incompleto) {
  modo = 'ocr_local+parser_fallback';
} else if (groqPrim.dados?.itens?.length) {
  escolhido = groqPrim.dados;
  modo = 'ocr_local+groq_reforco (simulado)';
}

console.log('\n══ Resultado que o importador usaria na revisão ══');
console.log('modo:', modo);
resumir(escolhido, 'Itens para vincular ao catálogo');
