#!/usr/bin/env node
/** Audita valor total pedido vs valor exibido no card de embarque. */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';
import { resolveP38Secrets } from './p38-secrets.mjs';

loadDotEnvFiles();

const numero = (process.argv.find((a) => a.startsWith('--numero='))?.slice('--numero='.length) || 'EXC-FQZ')
  .trim().toUpperCase().replace(/\s+/g, '');

async function main() {
  const dbUrl = resolveP38Secrets('cloud-agent').DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL não configurado');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows: [pc] } = await client.query(
      `select id, numero, valor_total, dados, status
       from public.pedido_compra
       where upper(replace(coalesce(numero,''),' ','')) = $1 limit 1`,
      [numero],
    );
    if (!pc) {
      console.error('Pedido não encontrado:', numero);
      process.exit(1);
    }

    const dados = pc.dados || {};
    const valorFrete = Number(dados.valor_frete ?? dados.frete ?? 0);
    const valorDesconto = Number(dados.valor_desconto ?? dados.desconto ?? 0);

    const { rows: pci } = await client.query(
      `select id, produto_id, produto_nome, quantidade_comercial, quantidade_base, total, dados, custo_unitario_fator1
       from public.pedido_compra_item where pedido_compra_id = $1 order by ordem, created_at`,
      [pc.id],
    );

    const somaLinhas = pci.reduce((acc, r) => acc + Number(r.total || 0), 0);
    const valorTotalCalc = somaLinhas + valorFrete - valorDesconto;

    const { rows: embarques } = await client.query(
      `select e.id, coalesce(e.dados->>'codigo_exibicao', e.numero) codigo,
              e.tipo, e.status, e.status_recebimento, e.dados
       from public.embarque e where e.pedido_compra_id = $1 order by e.created_at`,
      [pc.id],
    );

    console.log('\n== Pedido', pc.numero, '==');
    console.log('id:', pc.id);
    console.log('status:', pc.status);
    console.log('valor_total BD:', pc.valor_total);
    console.log('frete (dados):', valorFrete, '| desconto:', valorDesconto);
    console.log('soma linhas SQL total:', somaLinhas.toFixed(2), '| linhas:', pci.length);
    console.log('valor calc (itens+frete-desconto):', valorTotalCalc.toFixed(2));

    console.log('\nItens pedido:');
    for (const item of pci) {
      const d = item.dados || {};
      console.log(`  ${item.produto_nome?.slice(0, 40)} | qtd=${item.quantidade_comercial} | total=${Number(item.total).toFixed(2)} | custo=${item.custo_unitario_fator1 ?? item.dados?.custo_unitario ?? '?'}`);
    }

    console.log('\nEmbarques:');
    for (const e of embarques) {
      const { rows: ei } = await client.query(
        `select produto_id, produto_nome,
                quantidade_embarcada_comercial,
                quantidade_recebida_comercial,
                quantidade_pedida_comercial,
                dados
         from public.embarque_item where embarque_id = $1`,
        [e.id],
      );
      let valorEmbGross = 0;
      let valorSaldoConsulta = 0;
      console.log(`\n  ${e.codigo} | tipo=${e.tipo} | receb=${e.status_recebimento}`);
      for (const line of ei) {
        const pedItem = pci.find((p) => p.produto_id === line.produto_id);
        const d = line.dados || {};
        const fator = Number(d.fator_aplicado ?? pedItem?.fator_aplicado ?? 1);
        const pedTotal = Number(pedItem?.total ?? 0);
        const pedBase = Number(pedItem?.quantidade_base ?? d.quantidade_base ?? 0);
        const pedCom = Number(pedItem?.quantidade_comercial ?? 0);
        const embBase = Number(d.quantidade_embarcada_base ?? 0) || Number(line.quantidade_embarcada_comercial ?? 0) * fator;
        const recBase = Number(d.quantidade_recebida_base ?? 0) || Number(line.quantidade_recebida_comercial ?? 0) * fator;
        const valorProp = pedBase > 0 ? (embBase / pedBase) * pedTotal : pedTotal;
        const qEmbCom = Number(line.quantidade_embarcada_comercial ?? 0);
        const qRecCom = Number(line.quantidade_recebida_comercial ?? 0);
        const saldoBase = Math.max(embBase - recBase, 0);
        const valorSaldo = pedBase > 0 ? (saldoBase / pedBase) * pedTotal : 0;
        console.log(`    ${line.produto_nome?.slice(0, 35)}`);
        console.log(`      ped: com=${pedCom} base=${pedBase} total=${pedTotal.toFixed(2)} | emb: com=${qEmbCom} base=${embBase} | saldoBase=${saldoBase}`);
        console.log(`      valorProp(embarque)=${valorProp.toFixed(2)} valorSaldo(consulta)=${valorSaldo.toFixed(2)}`);
        valorEmbGross += valorProp;
        valorSaldoConsulta += valorSaldo;
      }
      const proporcao = somaLinhas > 0 ? valorEmbGross / somaLinhas : 0;
      const valorCardEst = valorEmbGross + proporcao * (valorFrete - valorDesconto);
      console.log(`    valor card (embarque completo): ${valorEmbGross.toFixed(2)}`);
      console.log(`    valor consulta (saldo pendente): ${valorSaldoConsulta.toFixed(2)}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
