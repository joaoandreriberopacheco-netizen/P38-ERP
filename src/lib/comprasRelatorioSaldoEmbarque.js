import { dataHoje } from '@/components/utils/dateUtils';
import { downloadBlob } from '@/lib/mobilePrintAndShare';
import { buildDisplayItensSaldoEmbarque } from '@/lib/pedidoCompraSaldoEmbarque';

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function agruparPorFormato(cards = []) {
  const grupos = new Map();

  (cards || []).forEach((card) => {
    const itens = card._display_itens?.length
      ? card._display_itens
      : buildDisplayItensSaldoEmbarque(card, card._saldo_linhas || [], {});

    itens.forEach((item) => {
      const nome = String(item.produto_nome || '');
      const formatoMatch = nome.match(/(\d+[x×]\d+)/i);
      const formato = formatoMatch ? formatoMatch[1].replace('×', 'x') : 'Outros';
      if (!grupos.has(formato)) grupos.set(formato, []);
      grupos.get(formato).push({
        pedido: card._display_code || card.numero,
        fornecedor: card.fornecedor_nome || card._display_fornecedor,
        modelo: nome.replace(/^[^:]+:\s*/, '').trim() || nome,
        quant: Number(item.quantidade ?? item.quantidade_embarcada) || 0,
        unidade: item.unidade_medida || 'UN',
        total: Number(item.total ?? item.valor_total_item) || 0,
      });
    });
  });

  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([formato, linhas]) => ({
      formato,
      linhas: linhas.sort((a, b) => a.pedido.localeCompare(b.pedido, 'pt-BR')),
      subtotalQuant: linhas.reduce((s, l) => s + l.quant, 0),
      subtotalValor: linhas.reduce((s, l) => s + l.total, 0),
    }));
}

function buildSaldoEmbarqueHtml({ cards = [], filtrosDesc = '', kpis = {} }) {
  const grupos = agruparPorFormato(cards);
  const geralQuant = grupos.reduce((s, g) => s + g.subtotalQuant, 0);
  const geralValor = grupos.reduce((s, g) => s + g.subtotalValor, 0);
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' });

  const blocos = grupos.map((grupo) => {
    const rows = grupo.linhas.map((l) => `
      <tr>
        <td>${escapeHtml(l.pedido)}</td>
        <td>${escapeHtml(l.modelo)}</td>
        <td class="num">${l.quant.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${escapeHtml(l.unidade)}</td>
        <td class="num">${brl(l.total)}</td>
      </tr>`).join('');

    return `
      <section class="grupo">
        <h2>${escapeHtml(grupo.formato)}</h2>
        <table>
          <thead><tr><th>Pedido</th><th>Produto</th><th>Qtd falta</th><th>Valor</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="2">Subtotal</td><td class="num">${grupo.subtotalQuant.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td><td class="num">${brl(grupo.subtotalValor)}</td></tr></tfoot>
        </table>
      </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<style>
  body { font-family: system-ui, sans-serif; font-size: 11px; color: #222; margin: 24px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #666; margin-bottom: 16px; line-height: 1.5; }
  .kpi { display: flex; gap: 16px; margin-bottom: 20px; }
  .kpi div { background: #f5f5f5; padding: 8px 12px; border-radius: 6px; }
  .grupo { margin-bottom: 20px; page-break-inside: avoid; }
  h2 { font-size: 13px; margin: 0 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { font-weight: 600; color: #444; }
  tfoot td { font-weight: 600; border-top: 1px solid #ccc; }
  .num { text-align: right; white-space: nowrap; }
  .total-geral { margin-top: 16px; font-size: 13px; font-weight: 700; text-align: right; }
</style></head><body>
  <h1>Saldo a embarcar</h1>
  <div class="meta">Gerado em ${escapeHtml(geradoEm)} · ${escapeHtml(filtrosDesc)}</div>
  <div class="kpi">
    <div>${cards.length} pedido(s) com falta</div>
    <div>${(kpis.somaFaltaOperacional ?? geralQuant).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un. falta</div>
    <div>${brl(kpis.totalValorSaldo ?? geralValor)}</div>
  </div>
  ${blocos || '<p>Nenhuma linha com falta operacional no filtro.</p>'}
  <div class="total-geral">Total geral: ${geralQuant.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un. · ${brl(geralValor)}</div>
</body></html>`;
}

export async function gerarRelatorioSaldoEmbarquePdf({
  cards = [],
  filtrosDesc = 'Filtro actual',
  kpis = {},
  onProgress,
}) {
  onProgress?.('Montando PDF saldo a embarcar...');
  const html = buildSaldoEmbarqueHtml({ cards, filtrosDesc, kpis });

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.innerHTML = html;
  document.body.appendChild(host);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const canvas = await html2canvas(host, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  document.body.removeChild(host);

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  const filename = `saldo-a-embarcar_${dataHoje()}.pdf`;
  await downloadBlob(blob, filename);
}
