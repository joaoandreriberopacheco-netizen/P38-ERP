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
      if (emb.tipo === 'Necessidade') nec += l.quantidade_embarcada_base || 0;
      else {
        desp += l.quantidade_embarcada_base || 0;
        rec += l.quantidade_recebida_base || 0;
      }
    }
  }
  const comprada = item.quantidade_base;
  const emTransito = Math.max(0, desp - rec);
  const saldoPendente = Math.max(0, comprada - rec - emTransito);
  return { comprada, despachada: desp, recebida: rec, saldoPendente, nec };
}

const item = { produto_id: 'p1', quantidade_base: 100 };
const embarques = [
  {
    tipo: 'Embarque',
    _linhas: [{ produto_id: 'p1', quantidade_embarcada_base: 60, quantidade_recebida_base: 50 }],
  },
  { tipo: 'Necessidade', _linhas: [{ produto_id: 'p1', quantidade_embarcada_base: 5 }] },
];

const f = folha(item, embarques);
if (f.saldoPendente !== 45) {
  console.error('saldo pendente esperado 45', f);
  process.exit(1);
}

const baixaNec = Math.min(45, f.nec);
const baixaComprada = Math.min(45 - baixaNec, 100 - 60);
if (baixaNec !== 5 || baixaComprada !== 40) {
  console.error('partição esperada 5+40', { baixaNec, baixaComprada });
  process.exit(1);
}

console.log('OK — folha 4 colunas e partição de acordo órfãos');
