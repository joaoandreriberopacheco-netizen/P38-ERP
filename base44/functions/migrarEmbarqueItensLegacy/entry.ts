import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/* ============================================================================
 * migrarEmbarqueItensLegacy — v3
 *
 * Idempotência: verifica se já existem EmbarqueItem para o embarque.
 * Se existirem, pula. Só cria se não houver nada.
 *
 * Body params:
 *   dry_run: boolean (default true)
 *   limit: number   (embarques por chamada, default 10, max 30)
 *   skip: number
 *   embarque_ids: string[]
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
  const s=normalizeSigla(item?.unidade_medida);
  if(s){const u=us.find(u=>normalizeSigla(u.sigla)===s);if(u)return u;}
  return us.find(u=>u.is_comercial)||us.find(u=>u.is_principal)||us[0];
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(()=>({}));
    const dryRun = body?.dry_run !== false;
    const batchSize = Math.min(Number(body?.limit)||10, 30);
    const skipCount = Number(body?.skip)||0;
    const forceReprocess = body?.force === true;
    const embarqueIds = Array.isArray(body?.embarque_ids)&&body.embarque_ids.length>0 ? body.embarque_ids.map(String) : null;

    // Busca IDs de embarques já migrados
    await sleep(200);
    const jaMigradosRaw = await base44.asServiceRole.entities.EmbarqueItem.list('-created_date', 2000);
    const jaMigradosIds = new Set((jaMigradosRaw||[]).map(i=>i.embarque_id).filter(Boolean));

    await sleep(200);
    let candidatos;
    if(embarqueIds){
      const fetches = await Promise.all(embarqueIds.map(id=>base44.asServiceRole.entities.Embarque.filter({id},null,1).then(r=>r?.[0]).catch(()=>null)));
      candidatos = fetches.filter(Boolean);
    } else {
      const todos = await base44.asServiceRole.entities.Embarque.list('created_date', batchSize*6+skipCount);
      candidatos = (todos||[])
        .filter(e => forceReprocess || !jaMigradosIds.has(e.id))
        .slice(skipCount, skipCount+batchSize);
    }

    const stats = { total_embarques: candidatos.length, processados: 0, itens_criados: 0, itens_apagados: 0, sem_itens: 0, com_erro: 0, ja_migrados_total: jaMigradosIds.size };
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

    const pciCache = new Map();
    const fetchPCI = async (pedidoId) => {
      if(!pedidoId) return [];
      if(pciCache.has(pedidoId)) return pciCache.get(pedidoId);
      await sleep(150);
      const linhas = await base44.asServiceRole.entities.PedidoCompraItem.filter({pedido_compra_id:pedidoId});
      const arr = Array.isArray(linhas)?linhas:[];
      pciCache.set(pedidoId,arr);
      return arr;
    };

    for(const embarque of candidatos){
      try{
        const itensLeg = Array.isArray(embarque?.itens)&&embarque.itens.length>0
          ? embarque.itens
          : (Array.isArray(embarque?.itens_embarcados)?embarque.itens_embarcados:[]);
        if(!itensLeg.length){stats.sem_itens++;continue;}

        const linhas = [];
        for(let i=0;i<itensLeg.length;i++){
          const leg=itensLeg[i];
          const produto=await fetchProduto(String(leg?.produto_id||''));
          if(!produto){erros.push({embarque_id:embarque.id,numero:embarque.numero||'',mensagem:`produto_id ${leg?.produto_id} nao encontrado (linha ${i})`});continue;}
          const u=resolveUnidade(produto,leg);
          const fator=asNumber(u?.fator_conversao,1)||1;
          const qP=asNumber(leg?.quantidade_pedida,0),qE=asNumber(leg?.quantidade_embarcada,0),qR=asNumber(leg?.quantidade_recebida,0);
          let pciId=leg?.pedido_compra_item_id||'';
          if(!pciId&&embarque.pedido_compra_id){const pl=await fetchPCI(String(embarque.pedido_compra_id));const m=pl.find(p=>p.produto_id===produto.id);if(m)pciId=m.id;}
          linhas.push({ embarque_id:embarque.id, embarque_numero:embarque.numero||'', pedido_compra_id:embarque.pedido_compra_id||'', pedido_compra_item_id:pciId, produto_id:produto.id, produto_nome:produto.nome||leg?.produto_nome||'', produto_unidade_id:u?.id||'', unidade_sigla:normalizeSigla(u?.sigla)||'UN', fator_aplicado:fator, quantidade_pedida_comercial:round6(qP), quantidade_pedida_base:round6(qP*fator), quantidade_embarcada_comercial:round6(qE), quantidade_embarcada_base:round6(qE*fator), quantidade_recebida_comercial:round6(qR), quantidade_recebida_base:round6(qR*fator), divergencia_tipo:leg?.divergencia_tipo||'Nenhuma', produto_id_recebido_diferente:leg?.produto_id_recebido_diferente||'', produto_nome_recebido_diferente:leg?.produto_nome_recebido_diferente||'', acordo_financeiro_lancamento_id:leg?.acordo_financeiro_lancamento_id||'', ordem:i, observacoes:typeof leg?.observacoes==='string'?leg.observacoes:'' });
        }

        if(dryRun){stats.processados++;stats.itens_criados+=linhas.length;continue;}

        if(forceReprocess){
          const antigas=await base44.asServiceRole.entities.EmbarqueItem.filter({embarque_id:embarque.id});
          for(const l of (antigas||[])){try{await base44.asServiceRole.entities.EmbarqueItem.delete(l.id);stats.itens_apagados++;}catch(e){}await sleep(100);}
        }

        const criadas = [];
        for(const item of linhas){
          await sleep(150);
          const novo=await base44.asServiceRole.entities.EmbarqueItem.create(item);
          criadas.push(novo);
          stats.itens_criados++;
        }

        stats.processados++;
        await sleep(300);
      } catch(e){
        stats.com_erro++;
        erros.push({embarque_id:embarque.id,numero:embarque.numero||'',mensagem:e.message});
      }
    }

    return Response.json({ success:true, dry_run:dryRun, stats, erros:erros.slice(0,50) });
  } catch(error){
    return Response.json({ error: error.message||String(error) }, { status:500 });
  }
});