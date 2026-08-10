// Port automático de base44/functions/migrarPedidoVendaItensLegacy/entry.ts
import type { createP38Client } from '../p38Client.ts';

/* ============================================================================
 * migrarPedidoVendaItensLegacy — v3
 *
 * Idempotência: verifica se já existem PedidoVendaItem para o pedido.
 * Se existirem, pula. Só cria se não houver nada.
 *
 * Body params:
 *   dry_run: boolean (default true)
 *   limit: number   (pedidos por chamada, default 10, max 30)
 *   skip: number    (offset para paginação externa)
 *   pedido_ids: string[]
 *   force: boolean  (se true, reprocessa mesmo já migrados)
 * ============================================================================ */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const round6 = (n) => Math.round((Number(n)||0)*1_000_000)/1_000_000;
const asNumber = (v, fb=0) => { const n=Number(v); return Number.isFinite(n)?n:fb; };

const SIGLA_MAP = { CAIXA:'CX',CAIXAS:'CX','M²':'M2','METRO QUADRADO':'M2','METROS QUADRADOS':'M2',PEÇA:'PC',PEÇAS:'PC',PECA:'PC',PECAS:'PC',UNIDADE:'UN',UNIDADES:'UN' };
const normalizeSigla = (raw) => { const s=String(raw||'').trim().toUpperCase(); if(!s) return ''; const na=s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); return SIGLA_MAP[s]||SIGLA_MAP[na]||s.replace('²','2'); };

const getUnidades = (produto) => {
  if(Array.isArray(produto?.unidades)&&produto.unidades.length>0) return produto.unidades;
  const p={id:'principal',sigla:normalizeSigla(produto?.unidade_principal||'UN')||'UN',fator_conversao:1,fator_preco:1,is_principal:true,ativo:true};
  const alts=(Array.isArray(produto?.unidades_alternativas)?produto.unidades_alternativas:[]).filter(a=>a?.unidade).map(a=>({id:a?.id||`alt_${normalizeSigla(a?.unidade)}`,sigla:normalizeSigla(a?.unidade),fator_conversao:asNumber(a?.fator_conversao,1)||1,fator_preco:asNumber(a?.fator_preco,1)||1,is_principal:false,ativo:a?.ativo!==false}));
  return [p,...alts];
};

const resolveUnidade = (produto, item) => {
  const us=getUnidades(produto);
  if(item?.produto_unidade_id){const u=us.find(u=>u.id===item.produto_unidade_id);if(u)return u;}
  const s=normalizeSigla(item?.unidade_medida||item?.unidade_apresentacao);
  if(s){const u=us.find(u=>normalizeSigla(u.sigla)===s);if(u)return u;}
  return us.find(u=>u.is_comercial)||us.find(u=>u.is_principal)||us[0];
};

const deriveItem = (pedido, produto, leg, ordem) => {
  const u=resolveUnidade(produto,leg);
  const fator=asNumber(u?.fator_conversao,1)||1;
  const fatorPreco=asNumber(u?.fator_preco,1)||1;
  const qC=asNumber(leg?.quantidade,0);
  const qB=round6(qC*fator);
  const preco1=asNumber(leg?.preco_unitario_praticado,0);
  const desc=asNumber(leg?.desconto_unitario,0);
  const precoFinal=round6(preco1-desc);
  return { pedido_venda_id:pedido.id, pedido_venda_numero:pedido.numero||'', produto_id:produto.id, produto_nome:produto.nome||leg?.produto_nome||'', produto_unidade_id:u?.id||'', unidade_sigla:normalizeSigla(u?.sigla)||'UN', fator_aplicado:fator, fator_preco_aplicado:fatorPreco, quantidade_comercial:round6(qC), quantidade_base:qB, preco_unitario_fator1:round6(preco1), preco_unitario_comercial:round6(preco1*fator), desconto_unitario_fator1:round6(desc), preco_final_unitario_fator1:precoFinal, tabela_preco_id:pedido?.tabela_preco_id||'', tabela_preco_multiplicador:1, total:round6(qB*precoFinal), ordem, observacoes:typeof leg?.observacoes==='string'?leg.observacoes:'' };
};

const toMirror = (item) => {
  const f=asNumber(item?.fator_aplicado,1)||1;
  return { produto_id:item.produto_id||'', produto_nome:item.produto_nome||'', produto_unidade_id:item.produto_unidade_id||'', quantidade:asNumber(item.quantidade_comercial,0), unidade_medida:item.unidade_sigla||'UN', fator_conversao:f, quantidade_base:asNumber(item.quantidade_base,0), preco_unitario_praticado:asNumber(item.preco_unitario_fator1,0), preco_unitario_apresentacao:asNumber(item.preco_unitario_comercial,0), desconto_unitario:asNumber(item.desconto_unitario_fator1,0), total:asNumber(item.total,0), preco_eixo:'FATOR_1', unidade_apresentacao:item.unidade_sigla||'UN', pedido_venda_item_id:item.id||undefined };
};

export async function handle(req: Request, base44: Awaited<ReturnType<typeof createP38Client>>): Promise<Response> {
  try {
    // base44 injetado por servePorted
    const me = await base44.auth.me();
    if(!me) return Response.json({ error:'Unauthorized' }, { status:401 });

    const body = await req.json().catch(()=>({}));
    const dryRun = body?.dry_run !== false;
    const batchSize = Math.min(Number(body?.limit)||10, 30);
    const skipCount = Number(body?.skip)||0;
    const forceReprocess = body?.force === true;
    const pedidoIds = Array.isArray(body?.pedido_ids)&&body.pedido_ids.length>0 ? body.pedido_ids.map(String) : null;

    // Busca IDs já migrados (têm PedidoVendaItem)
    await sleep(200);
    const jaMigradosRaw = await base44.asServiceRole.entities.PedidoVendaItem.list('-created_date', 5000);
    const jaMigradosIds = new Set((jaMigradosRaw||[]).map(i=>i.pedido_venda_id).filter(Boolean));

    await sleep(200);
    let candidatos;
    if(pedidoIds){
      const fetches = await Promise.all(pedidoIds.map(id=>base44.asServiceRole.entities.PedidoVenda.filter({id},null,1).then(r=>r?.[0]).catch(()=>null)));
      candidatos = fetches.filter(Boolean);
    } else {
      const todos = await base44.asServiceRole.entities.PedidoVenda.list('created_date', batchSize*8+skipCount);
      candidatos = (todos||[])
        .filter(p => forceReprocess || !jaMigradosIds.has(p.id))
        .slice(skipCount, skipCount+batchSize);
    }

    const stats = { total_pedidos: candidatos.length, pedidos_processados: 0, itens_criados: 0, itens_apagados: 0, pedidos_sem_itens: 0, pedidos_com_erro: 0, ja_migrados_total: jaMigradosIds.size };
    const erros = [];

    const produtoCache = new Map();
    const fetchProduto = async (id) => {
      if(!id) return null;
      if(produtoCache.has(id)) return produtoCache.get(id);
      await sleep(150);
      const list = await base44.asServiceRole.entities.Produto.filter({id},null,1);
      const p = Array.isArray(list)&&list.length>0?list[0]:null;
      produtoCache.set(id,p);
      return p;
    };

    for(const pedido of candidatos){
      try{
        const itensLeg = Array.isArray(pedido?.itens)?pedido.itens:[];
        if(!itensLeg.length){stats.pedidos_sem_itens++;continue;}

        const linhas = [];
        for(let i=0;i<itensLeg.length;i++){
          const leg=itensLeg[i];
          const produto=await fetchProduto(String(leg?.produto_id||''));
          if(!produto){erros.push({pedido_id:pedido.id,numero:pedido.numero||'',mensagem:`produto_id ${leg?.produto_id} nao encontrado (linha ${i})`});continue;}
          linhas.push(deriveItem(pedido,produto,leg,i));
        }

        if(dryRun){stats.pedidos_processados++;stats.itens_criados+=linhas.length;continue;}

        if(forceReprocess){
          const antigas=await base44.asServiceRole.entities.PedidoVendaItem.filter({pedido_venda_id:pedido.id});
          for(const l of (antigas||[])){try{await base44.asServiceRole.entities.PedidoVendaItem.delete(l.id);stats.itens_apagados++;}catch(e){}await sleep(100);}
        }

        const criadas = [];
        for(const item of linhas){
          await sleep(150);
          const novo=await base44.asServiceRole.entities.PedidoVendaItem.create(item);
          criadas.push(novo);
          stats.itens_criados++;
        }

        const subtotal = round6(criadas.reduce((a, it) => a + asNumber(it.total, 0), 0));
        const desc = asNumber(pedido?.valor_desconto, 0);
        const frete = asNumber(pedido?.valor_frete, 0);
        const valorTotal = round6(subtotal - desc + frete);
        await sleep(200);
        await base44.asServiceRole.entities.PedidoVenda.update(pedido.id, { subtotal, valor_total: valorTotal });

        stats.pedidos_processados++;
        await sleep(300);
      } catch(e){
        stats.pedidos_com_erro++;
        erros.push({pedido_id:pedido.id,numero:pedido.numero||'',mensagem:e.message});
      }
    }

    return Response.json({ success:true, dry_run:dryRun, stats, erros:erros.slice(0,50) });
  } catch(error){
    return Response.json({ error: error.message||String(error) }, { status:500 });
  }
}
