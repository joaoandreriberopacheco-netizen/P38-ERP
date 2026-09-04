#!/usr/bin/env node
/**
 * Corrige embarques E62-67G-02 (CX→M²) e sincroniza espelho JSON do E62-67G-E.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY;

async function getAnonKey() {
  if (SUPABASE_ANON) return SUPABASE_ANON;
  const html = await fetch('https://p-38erp.vercel.app/').then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).slice(0, 15);
  for (const src of scripts) {
    const js = await fetch(`https://p-38erp.vercel.app${src}`).then((r) => r.text());
    const m = js.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (m) return m[0];
  }
  throw new Error('anon key not found');
}

function mirrorFromSqlRow(row) {
  const d = row.dados || {};
  const fator = Number(d.fator_aplicado) || 1;
  const unidade = row.unidade_sigla || 'UN';
  const qEmbCom = Number(row.quantidade_embarcada_comercial) || 0;
  const qRecCom = Number(row.quantidade_recebida_comercial) || 0;
  const qPedCom = Number(row.quantidade_pedida_comercial) || 0;
  const qEmbBase = Number(d.quantidade_embarcada_base) || qEmbCom * fator;
  const qRecBase = Number(d.quantidade_recebida_base) || qRecCom * fator;
  const qPedBase = Number(d.quantidade_pedida_base) || qPedCom * fator;

  return {
    produto_id: row.produto_id,
    produto_nome: row.produto_nome,
    produto_unidade_id: d.produto_unidade_id || '',
    pedido_compra_item_id: row.pedido_compra_item_id || '',
    fator_aplicado: fator,
    fator_apresentacao: fator,
    fator_conversao: 1,
    quantidade_pedida: qPedBase,
    quantidade_embarcada: qEmbBase,
    quantidade_recebida: qRecBase,
    quantidade_base: qEmbBase,
    quantidade_pedida_apresentacao: qPedCom,
    quantidade_embarcada_apresentacao: qEmbCom,
    quantidade_recebida_apresentacao: qRecCom,
    unidade_medida: 'M2',
    unidade_apresentacao: unidade,
    unidade_sigla: unidade,
    divergencia_tipo: row.divergencia_tipo || 'Nenhuma',
    embarque_item_id: row.id,
  };
}

const FIX_02 = [
  {
    id: '8cc1c96b-da36-4e00-a0d6-dc73fd80c727',
    produto_nome: 'APULIA',
    patch: {
      unidade_sigla: 'CX',
      quantidade_embarcada_comercial: 15,
      quantidade_recebida_comercial: 0,
      dados: {
        fator_aplicado: 2.16,
        produto_unidade_id: 'alt-1vx8vgq',
        quantidade_pedida_base: 43.2,
        quantidade_embarcada_base: 32.4,
        quantidade_recebida_base: 0,
      },
    },
    mirror: {
      produto_id: '69bd5ca4bfe862a830383c0b',
      produto_nome: 'PISO 60x120 APULIA POLIDO (2,16M²/ CX)',
      quantidade_pedida_apresentacao: 20,
      quantidade_embarcada_apresentacao: 15,
      quantidade_recebida_apresentacao: 0,
      fator_apresentacao: 2.16,
    },
  },
  {
    id: '7eb457b0-02e5-4482-b9ff-c4b8c863aa61',
    produto_nome: 'PERSA',
    patch: {
      unidade_sigla: 'CX',
      quantidade_embarcada_comercial: 13,
      quantidade_recebida_comercial: 0,
      dados: {
        fator_aplicado: 2.16,
        produto_unidade_id: 'alt-1vx8vgq',
        quantidade_pedida_base: 43.2,
        quantidade_embarcada_base: 28.08,
        quantidade_recebida_base: 0,
      },
    },
    mirror: {
      produto_id: '6a5504c1d7d6fedda15dda1b',
      produto_nome: 'PISO 60X120 PERSA BEGE POL (2,16M²/ CX)',
      quantidade_pedida_apresentacao: 20,
      quantidade_embarcada_apresentacao: 13,
      quantidade_recebida_apresentacao: 0,
      fator_apresentacao: 2.16,
    },
  },
  {
    id: '928a84e0-8bda-4756-a8e2-842e67f4bcc2',
    produto_nome: 'POMPEI',
    patch: {
      unidade_sigla: 'CX',
      quantidade_embarcada_comercial: 13,
      quantidade_recebida_comercial: 0,
      dados: {
        fator_aplicado: 2.16,
        produto_unidade_id: '3006748e-6610-4f25-90fc-2d16c02e3324',
        quantidade_pedida_base: 43.2,
        quantidade_embarcada_base: 28.08,
        quantidade_recebida_base: 0,
      },
    },
    mirror: {
      produto_id: '6a5504e375823119ca051f19',
      produto_nome: 'PISO 60X120 POMPEI POL (2,16M²/ CX)',
      quantidade_pedida_apresentacao: 20,
      quantidade_embarcada_apresentacao: 13,
      quantidade_recebida_apresentacao: 0,
      fator_apresentacao: 2.16,
    },
  },
];

function buildMirrorItem(m) {
  const fator = m.fator_apresentacao;
  const qEmbApres = m.quantidade_embarcada_apresentacao;
  const qRecApres = m.quantidade_recebida_apresentacao;
  const qPedApres = m.quantidade_pedida_apresentacao;
  return {
    produto_id: m.produto_id,
    produto_nome: m.produto_nome,
    unidade_medida: 'M2',
    fator_conversao: 1,
    quantidade_base: qEmbApres * fator,
    quantidade_pedida: 43.2,
    fator_apresentacao: fator,
    produto_unidade_id: 'alt-1vx8vgq',
    quantidade_recebida: qRecApres * fator,
    quantidade_embarcada: qEmbApres * fator,
    unidade_apresentacao: 'CX',
    pedido_compra_item_id: '',
    quantidade_pedida_apresentacao: qPedApres,
    quantidade_recebida_apresentacao: qRecApres,
    quantidade_embarcada_apresentacao: qEmbApres,
  };
}

async function main() {
  const anon = await getAnonKey();
  const supabase = createClient(SUPABASE_URL, anon);

  console.log('\n=== Corrigindo E62-67G-02 (embarque_item) ===');
  for (const row of FIX_02) {
    const { data, error } = await supabase
      .from('embarque_item')
      .update({ ...row.patch, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id, unidade_sigla, quantidade_embarcada_comercial, quantidade_recebida_comercial, dados')
      .single();
    if (error) throw new Error(`${row.produto_nome}: ${error.message}`);
    console.log(JSON.stringify(data));
  }

  const itensEmbarcados02 = FIX_02.map((r) => buildMirrorItem(r.mirror));
  const { error: emb02Err } = await supabase
    .from('embarque')
    .update({
      status_recebimento: 'Pendente',
      itens: itensEmbarcados02,
      dados: {
        codigo_exibicao: 'E62-67G-B',
        itens_embarcados: itensEmbarcados02,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', '936ef1af-54e8-4fb9-896a-8758a9cc7796');
  if (emb02Err) throw new Error(`embarque -02: ${emb02Err.message}`);
  console.log('E62-67G-02 cabeçalho: status_recebimento=Pendente, espelho JSON atualizado');

  console.log('\n=== Sincronizando E62-67G-E (espelho JSON) ===');
  const { data: rowsE, error: fetchEErr } = await supabase
    .from('embarque_item')
    .select('*')
    .eq('embarque_id', '33d56886-eb3d-4202-8b31-b369371e13ea')
    .order('ordem');
  if (fetchEErr) throw fetchEErr;
  const itensE = (rowsE || []).map(mirrorFromSqlRow);
  const { error: embEErr } = await supabase
    .from('embarque')
    .update({
      itens: itensE,
      dados: { codigo_exibicao: 'E62-67G-E', itens_embarcados: itensE },
      updated_at: new Date().toISOString(),
    })
    .eq('id', '33d56886-eb3d-4202-8b31-b369371e13ea');
  if (embEErr) throw new Error(`embarque -E: ${embEErr.message}`);
  console.log(`E62-67G-E: ${itensE.length} linhas no espelho JSON`);

  console.log('\nOK — correções aplicadas.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
