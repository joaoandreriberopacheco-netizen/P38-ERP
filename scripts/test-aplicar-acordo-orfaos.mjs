/**
 * Teste rápido da matemática folha 4 colunas / partição de baixa (sem imports @/).
 */
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

function folha(item, embarques) {
  const pid = item.produto_id;
  let desp = 0;
  let rec = 0;
  let nec = 0;
  for (const emb of embarques) {
    for (const l of emb._linhas || []) {
      if (l.produto_id !== pid) continue;
      if (emb.tipo === 'Pendente' || emb.tipo === 'Necessidade') nec += l.quantidade_embarcada_base || 0;
      else {
        desp += l.quantidade_embarcada_base || 0;
        rec += l.quantidade_recebida_base || 0;
      }
    }
  }
  const comprada = item.quantidade_base;
  const emTransito = Math.max(0, desp - rec);
  const saldoPendente = Math.max(0, comprada - rec - emTransito);
  return { comprada, despachada: desp, recebida: rec, emTransito, saldoPendente, nec };
}

const item = { produto_id: 'p1', quantidade_base: 100 };
const embarques = [
  {
    tipo: 'Embarque',
    _linhas: [{ produto_id: 'p1', quantidade_embarcada_base: 60, quantidade_recebida_base: 50 }],
  },
  { tipo: 'Pendente', _linhas: [{ produto_id: 'p1', quantidade_embarcada_base: 5 }] },
];

const f = folha(item, embarques);
const emTransito = Math.max(0, 60 - 50);
// Órfão = comprada − recebida (folha única), sem somar Pendente + trânsito + falta despacho
const orfaoTotal = round(f.comprada - f.recebida);
if (f.saldoPendente !== 40 || orfaoTotal !== 50) {
  console.error('folha/órfão esperados saldo col4 40 / não recebido 50', { f, orfaoTotal });
  process.exit(1);
}

const baixaNec = Math.min(orfaoTotal, f.nec);
let rest = orfaoTotal - baixaNec;
const baixaTransito = Math.min(rest, emTransito);
rest -= baixaTransito;
const baixaComprada = Math.min(rest, 100 - 60);
if (baixaNec !== 5 || baixaTransito !== 10 || baixaComprada !== 35) {
  console.error('partição interna esperada 5+10+35', { baixaNec, baixaTransito, baixaComprada });
  process.exit(1);
}

const item2 = { produto_id: 'p2', quantidade_base: 50 };
const emb2 = [
  {
    tipo: 'Embarque',
    _linhas: [{ produto_id: 'p2', quantidade_embarcada_base: 50, quantidade_recebida_base: 0 }],
  },
];
const f2 = folha(item2, emb2);
const orfao2 = round(f2.comprada - f2.recebida);
if (orfao2 !== 50 || f2.saldoPendente !== 0) {
  console.error('não recebido em trânsito esperado 50', { f2, orfao2 });
  process.exit(1);
}

console.log('OK — folha 4 colunas e acordo órfãos (saldo único comprada − recebida)');
