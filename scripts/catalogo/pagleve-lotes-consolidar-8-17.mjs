#!/usr/bin/env node
/** Consolida pagleve-lote{8..17}-cascata.json em relatório mestre + resumo JSON */
import fs from 'node:fs';
import path from 'node:path';

const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const EXCEL = 'docs/ESTOQUE PARA CASA ISRAEL ATE 19112026.XLSX';
const LOTE_INICIO = 8;
const LOTE_FIM = 17;

const lotes = [];
const semMatch = [];
let totais = { processados: 0, confirmados_site: 0, sem_match: 0, com_foto: 0, sem_foto_confirmados: 0 };

for (let n = LOTE_INICIO; n <= LOTE_FIM; n++) {
  const p = path.join(ART, `pagleve-lote${n}-cascata.json`);
  if (!fs.existsSync(p)) {
    console.warn('Ausente:', p);
    continue;
  }
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const items = d.itens || [];
  const conf = d.confirmados_site ?? items.filter((i) => i.status === 'confirmado_site').length;
  const comFoto = d.com_foto ?? items.filter((i) => i.status === 'confirmado_site' && (i.imagens_count || 0) > 0).length;
  const total = d.total ?? items.length;
  const sem = total - conf;

  lotes.push({
    lote: n,
    total,
    confirmados_site: conf,
    sem_match: sem,
    com_foto: comFoto,
    cascata_json: p,
    relatorio_md: path.join(ART, `pagleve-lote${n}-referencia-cascata.md`),
  });

  totais.processados += total;
  totais.confirmados_site += conf;
  totais.sem_match += sem;
  totais.com_foto += comFoto;

  for (const item of items) {
    if (item.status !== 'confirmado_site') {
      semMatch.push({
        lote: n,
        codigo: item.codigo,
        formato: item.formato,
        descricao_erp: item.descricao_erp,
        status: item.status,
        match_metodo: item.match_metodo || '',
        produto_url: item.produto_url || '',
        sem_foto_motivo: item.sem_foto_motivo || '',
      });
    } else if (!(item.imagens_count > 0)) {
      totais.sem_foto_confirmados += 1;
    }
  }
}

let md = `# PagLeve — consolidado lotes 8–17 (208 códigos Casa Israel)

Mesmo roteiro Ardósia: Excel verbatim → cascata oficial (\`pagleve-official-sweep-report.mjs\` pipeline v3).

**Excel:** \`${EXCEL}\`  
**Runner:** \`scripts/catalogo/pagleve-lotes-sequenciais-runner.mjs\`  
**Divisão:** 8×21 + 2×20 códigos (excluídos os 20 piloto/lotes 5–7).

---

## Totais gerais

| Métrica | Valor |
|--------|-------|
| Códigos processados | **${totais.processados}** |
| Confirmados no site | **${totais.confirmados_site}** |
| Sem match | **${totais.sem_match}** |
| Com foto (entre confirmados) | **${totais.com_foto}** |
| Confirmados sem foto | **${totais.sem_foto_confirmados}** |

---

## Resumo por lote

| Lote | Códigos | Confirmados | Sem match | Com foto | Cascata | Relatório |
|------|---------|-------------|-----------|----------|---------|-----------|
`;

for (const L of lotes) {
  md += `| **${L.lote}** | ${L.total} | ${L.confirmados_site} | ${L.sem_match} | ${L.com_foto} | \`pagleve-lote${L.lote}-cascata.json\` | \`pagleve-lote${L.lote}-referencia-cascata.md\` |\n`;
}

md += `\n---\n\n## Códigos sem match (revisão manual)\n\n`;

if (semMatch.length === 0) {
  md += `_Nenhum — todos fecharam com \`confirmado_site\`._\n`;
} else {
  md += `| Lote | Código | Formato | Status | Método / motivo | URL |\n`;
  md += `|------|--------|---------|--------|-----------------|-----|\n`;
  for (const r of semMatch) {
    const motivo = r.match_metodo || r.status;
    const url = r.produto_url || '—';
    const desc = (r.descricao_erp || '').slice(0, 55).replace(/\|/g, ' ');
    md += `| ${r.lote} | **${r.codigo}** | ${r.formato} | ${r.status} | ${motivo} | ${url} |\n`;
    md += `| | | | | _${desc}_ | |\n`;
  }
}

md += `\n---\n\n## Detalhe por lote\n\n`;
for (const L of lotes) {
  md += `### Lote ${L.lote}\n\n`;
  md += `Ver relatório Ardósia completo: \`/opt/cursor/artifacts/pagleve-lote${L.lote}-referencia-cascata.md\` (${L.confirmados_site}/${L.total} confirmados).\n\n`;
}

const resumoPath = path.join(ART, 'pagleve-lotes-8-17-resumo.json');
const payload = {
  geradoEm: new Date().toISOString(),
  totais,
  lotes,
  sem_match: semMatch,
  consolidado_md: path.join(ART, 'pagleve-lotes-8-17-consolidado.md'),
};
fs.writeFileSync(resumoPath, JSON.stringify(payload, null, 2));

const out = path.join(ART, 'pagleve-lotes-8-17-consolidado.md');
fs.writeFileSync(out, md);

console.log(JSON.stringify({ totais, sem_match_count: semMatch.length, out, resumoPath }, null, 2));