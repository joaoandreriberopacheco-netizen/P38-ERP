import { base44 } from '@/api/base44Client';
import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { buildLlmTelemetryContext } from '@/lib/p38LlmTelemetry';

/** Extrai número monetário de texto livre (ex.: "150,90", "R$ 1.234,56"). */
export function parseValorMonetarioTexto(raw) {
  const texto = String(raw || '');
  if (!texto.trim()) return null;

  const candidatos = [];
  const padroes = [
    /r\$\s*([\d.]+,\d{2})/gi,
    /valor(?:\s+da\s+transfer[eê]ncia|\s+do\s+pagamento|\s+pago)?[:\s]+r?\$?\s*([\d.]+,\d{2})/gi,
    /valor[:\s]+([\d.]+,\d{2})/gi,
    /([\d]{1,3}(?:\.[\d]{3})+,\d{2})/g,
    /([\d]+,\d{2})/g,
  ];

  for (const re of padroes) {
    let m;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(texto)) !== null) {
      const bruto = m[1] || m[0];
      const n = parseFloat(String(bruto).replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n) && n > 0 && n < 1e9) candidatos.push(n);
    }
  }

  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) => b - a)[0];
}

function extrairDescricaoDeTexto(texto) {
  const linhas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const chave = linhas.find((l) =>
    /favorecido|benefici[aá]rio|destinat[aá]rio|para:|recebedor/i.test(l)
  );
  if (chave) return chave.replace(/^[^:]+:\s*/i, '').slice(0, 120);
  return linhas.find((l) => l.length > 4 && !/^r\$/i.test(l))?.slice(0, 120) || null;
}

export function extrairDadosComprovanteDeTexto(texto) {
  const valor = parseValorMonetarioTexto(texto);
  const descricao = extrairDescricaoDeTexto(texto);
  if (!valor && !descricao) return null;
  return { valor, descricao, data_pagamento: null, origem: 'texto' };
}

async function extrairDadosComprovanteViaLlm(file) {
  const f = await normalizarArquivoParaImportBoleto(file);
  const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
  const raw = await base44.integrations.Core.InvokeLLM({
    file_urls: [file_url],
    telemetry: buildLlmTelemetryContext({ source: 'comprovante_bancario', fileCount: 1 }),
    prompt: `Leia este comprovante bancário brasileiro (PIX, TED, boleto pago, transferência).
Extraia apenas o que estiver visível. Não invente dados.
- valor: número decimal do valor pago/transferido (sem R$)
- descricao: favorecido ou descrição curta do pagamento
- data_pagamento: YYYY-MM-DD se houver data do pagamento
Se não encontrar, use null.`,
    response_json_schema: {
      type: 'object',
      properties: {
        valor: { type: ['number', 'null'] },
        descricao: { type: ['string', 'null'] },
        data_pagamento: { type: ['string', 'null'] },
      },
    },
  });

  const data = raw?.data ?? raw?.response ?? raw ?? {};
  const valor = Number(data.valor);
  return {
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
    descricao: data.descricao ? String(data.descricao).trim().slice(0, 120) : null,
    data_pagamento: data.data_pagamento ? String(data.data_pagamento).slice(0, 10) : null,
    origem: 'llm',
  };
}

/**
 * Tenta extrair valor/descrição de comprovante (texto colado ou arquivo imagem/PDF).
 * @returns {Promise<{ valor: number|null, descricao: string|null, data_pagamento: string|null, origem: string }|null>}
 */
export async function extrairDadosComprovante(arquivoEntry) {
  if (!arquivoEntry) return null;

  if (arquivoEntry.texto) {
    return extrairDadosComprovanteDeTexto(arquivoEntry.texto);
  }

  const file = arquivoEntry.file;
  if (!file) return null;

  try {
    const llm = await extrairDadosComprovanteViaLlm(file);
    if (llm?.valor || llm?.descricao) return llm;
  } catch (e) {
    console.warn('[Torre] leitura do comprovante falhou:', e);
  }

  return null;
}

export function formatarValorBRL(valor) {
  if (valor == null || !Number.isFinite(Number(valor))) return '';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
