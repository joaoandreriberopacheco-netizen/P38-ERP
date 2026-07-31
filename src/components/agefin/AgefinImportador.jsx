import React, { useEffect, useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { dataHoje } from '@/components/utils/dateUtils';
import { Upload, X, FileCheck, AlertCircle, ChevronRight, Sparkles, FileText, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgefinNaturezaSelector from './AgefinNaturezaSelector';
import {
  TAG_LF_BOLETO_PDF,
  criarParcelasIniciaisRecorrenteAposPrimeiro,
  isLancamentoParcelasMensaisRecorrente,
  marcarLancamentosComoImportadosPorBoletoPdf,
  extrairBoletoFingerprintDeObservacoes,
} from '@/lib/agefinLancamentosRecorrencia';
import { uploadAnexoParaContaPrevista, uploadAnexoParaLancamentoFinanceiro } from '@/lib/uploadAnexoReferencia';
import { extrairTextoPdfBrowser, normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { buildLlmTelemetryContext } from '@/lib/p38LlmTelemetry';

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashDjb2(value) {
  let hash = 5381;
  for (const char of String(value || '')) {
    hash = ((hash << 5) + hash) + char.charCodeAt(0);
    hash &= 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

/** Resposta do InvokeLLM pode vir como objeto, string JSON ou aninhada em .data/.response. */
function normalizeInvokeLlmJsonResponse(aiRes) {
  if (aiRes == null) return null;
  if (typeof aiRes === 'string') {
    try {
      return JSON.parse(aiRes);
    } catch {
      return null;
    }
  }
  if (typeof aiRes !== 'object') return null;
  const o = aiRes;
  if (o.response_json && typeof o.response_json === 'object') return o.response_json;
  if (o.response && typeof o.response === 'object') return o.response;
  if (o.data && typeof o.data === 'object') return o.data;
  if (o.result && typeof o.result === 'object') return o.result;
  return o;
}

function possuiLeituraMinima(extracted) {
  if (!extracted || typeof extracted !== 'object') return false;
  const descricao = String(extracted.descricao || '').trim();
  const beneficiario = String(extracted.beneficiario || '').trim();
  const valor = Number(extracted.valor_pagamento);
  const vencimento = String(extracted.data_vencimento || '').trim();
  const linha = String(extracted.linha_digitavel || '').replace(/\D/g, '');
  const pix = String(extracted.codigo_pix_copia_cola || '').trim();
  return Boolean(
    descricao ||
    beneficiario ||
    (Number.isFinite(valor) && valor > 0) ||
    /^\d{4}-\d{2}-\d{2}$/.test(vencimento) ||
    linha.length >= 44 ||
    pix.length >= 20
  );
}

function criarPreenchimentoManualMinimo(fileName = '') {
  const baseNome = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  return {
    descricao: baseNome || 'Conta importada',
    valor: 0,
    data_vencimento: dataHoje(),
    terceiro_nome: '',
    periodo_referencia: `${dataHoje().slice(0, 7)}-01`,
    parcela_numero: '',
    linha_digitavel: '',
    codigo_pix_copia_cola: '',
    observacoes: '',
  };
}

function gerarBoletoFingerprint(dados) {
  const linha = String(dados?.linha_digitavel || '').replace(/\D/g, '');
  const pix = normalizarTexto(dados?.codigo_pix_copia_cola || '');
  const fonte = linha || pix;
  if (!fonte) return null;
  const valorCentavos = Math.round((Number(dados?.valor) || 0) * 100);
  const vencimento = String(dados?.data_vencimento || '').slice(0, 10) || 'sem-data';
  return `${hashDjb2(fonte)}:${valorCentavos}:${vencimento}`;
}

/**
 * Contas avulsas (??nico/Parcelado sem ContaRecorrente): evita criar outra ContaPrevista
 * ao reimportar o mesmo bolete/m?s ??? alinha ao dedup de LF j? feito para recorrente.
 * Parcelado: s? consolida por fingerprint (evita misturar parcelas diferentes).
 */
async function encontrarContaPrevistaAvulsaMesmaImportacao(base44, {
  mesReferencia,
  boletoFingerprint,
  terceiroNome,
  valor,
  selectedNatureza,
}) {
  if (!mesReferencia || !selectedNatureza) return null;
  if (selectedNatureza !== '??nico' && selectedNatureza !== 'Parcelado') return null;
  try {
    const lista = await base44.entities.ContaPrevista.list('-data_vencimento', 500);
    const candidatas = (lista || []).filter((c) => {
      if (c.conta_recorrente_id) return false;
      if ((c.data_vencimento || '').slice(0, 7) !== mesReferencia) return false;
      if (c.natureza && selectedNatureza && c.natureza !== selectedNatureza) return false;
      return true;
    });
    if (!candidatas.length) return null;

    if (boletoFingerprint) {
      for (const c of candidatas) {
        const lfs = await base44.entities.LancamentoFinanceiro.filter({ referencia_id: c.id });
        const matchFp = (lfs || []).some((l) => {
          const fp = extrairBoletoFingerprintDeObservacoes(l.observacoes);
          return fp && fp === boletoFingerprint;
        });
        if (matchFp) return c;
      }
    }

    if (selectedNatureza === 'Parcelado') return null;

    const tAlvo = normalizarTexto(terceiroNome);
    const vAlvo = Number(valor) || 0;
    if (!tAlvo || vAlvo <= 0) return null;

    for (const c of candidatas) {
      const t = normalizarTexto(c.terceiro_nome);
      const vc = Number(c.valor) || 0;
      if (t !== tAlvo) continue;
      if (Math.abs(vc - vAlvo) <= Math.max(0.02, vAlvo * 0.02)) return c;
    }
  } catch (e) {
    console.error('dedup ContaPrevista avulsa AGEFIN:', e);
  }
  return null;
}

export default function AgefinImportador({
  onSuccess,
  contaPrevistaId = null,
  lancamentoFinanceiroId = null,
  modoAtualizacao = false,
  /** Só vincula o PDF — não altera valor nem vencimento (padrão em modoAtualizacao). */
  somenteAnexo = modoAtualizacao,
  /** Ficheiro j? escolhido (ex.: partilha Web) ??? inicia leitura autom?tica */
  initialFile = null,
  /** Tipo escolhido na Torre de controle (ex.: Boleto, Comprovante) */
  tipoDocumentoAnexo = 'Boleto',
  /** Lista recorrentes: descri??o/terceiro da conta j? criada; sucesso volta ao painel */
  fluxoLoopAtualizadorRecorrente = false,
  /** { descricao, terceiro_nome?, conta_financeira_id? } ??? ap?s ler o PDF */
  dadosContaExistente = null,
}) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [selectedNatureza, setSelectedNatureza] = useState('??nico');
  const [selectedRecorrencia, setSelectedRecorrencia] = useState('Mensal');
  const [error, setError] = useState(null);
  const [successState, setSuccessState] = useState(null);
  const [contaFinanceiraId, setContaFinanceiraId] = useState('');
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [descricaoSacralizadaLock, setDescricaoSacralizadaLock] = useState(false);
  const initialFileHandled = useRef(false);
  const sacredDescricaoFetchDone = useRef(false);

  const processSelectedFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return false;
    setLoading(true);
    setError(null);

    if (somenteAnexo && modoAtualizacao) {
      try {
        const f = await normalizarArquivoParaImportBoleto(selectedFile);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setFile({ original: f, url: file_url, name: f.name });
        setExtractedData({ somenteAnexo: true });
        return true;
      } catch (err) {
        const primeiro = String(err?.message || err || '').split('\n')[0].slice(0, 140);
        setError(primeiro ? `Não foi possível enviar o ficheiro: ${primeiro}` : 'Não foi possível enviar o ficheiro.');
        console.error('AgefinImportador vincular anexo:', err);
        return false;
      } finally {
        setLoading(false);
      }
    }

    let arquivoEnviado = null;
    try {
      const f = await normalizarArquivoParaImportBoleto(selectedFile);

      const textoPdfLocal = await extrairTextoPdfBrowser(f);
      const blocoTextoLocal =
        textoPdfLocal.length >= 40
          ? `

--- Texto extra?do localmente do ficheiro (PDF com camada de texto; use como apoio se a p?gina for digital) ---
${textoPdfLocal.slice(0, 14000)}`
          : '';

      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      arquivoEnviado = { file_url, file_name: f.name, file_obj: f };
      setFile({
        original: f,
        url: file_url,
        name: f.name,
      });

      const extractedRaw = await base44.integrations.Core.InvokeLLM({
        file_urls: [file_url],
        telemetry: buildLlmTelemetryContext({ source: 'agefin_importador', fileCount: 1 }),
        prompt: `Leia visualmente este documento brasileiro de cobran?a e extraia dados REAIS do conte?do do documento, nunca do nome do arquivo.

Regras obrigat?rias:
- Ignore completamente o nome do arquivo.
- Leia o PDF/imagem como OCR visual completo.
- Extraia apenas o que estiver claramente vis?vel no documento.
- Se um campo n?o existir, retorne null.
- N?o invente valores.
- Se houver v?rios valores, use o valor final a pagar, valor total do documento ou valor do boleto.
- Se houver v?rias datas, use a data explicitamente associada a vencimento.
- A descri??o deve ser ?til para um lan?amento financeiro humano.
- Preserve acentos e caracteres do portugu?s (ex.: ?, ?, ?, ?, ?, ?, ?) quando estiverem no documento.
- A descri??o deve preferir o conceito do pagamento + benefici?rio, por exemplo: "Energia el?trica - Amazonas Energia", "FGTS Digital - Minist?rio do Trabalho", "DAR IPVA - SEFAZ AM", "Taxa ambiental - IBAMA".
- Identifique tamb?m a natureza sugerida: use "??nico" por padr?o; use "Parcelado" apenas quando houver parcela expl?cita; use "Recorrente" apenas quando o documento indicar cobran?a mensal/compet?ncia recorrente e isso estiver claro.
- Retorne data em YYYY-MM-DD.
- Retorne valor como n?mero decimal sem s?mbolo monet?rio.

Campos a interpretar do documento:
- beneficiario
- data_vencimento
- valor_pagamento
- competencia
- numero_parcela
- descricao
- natureza_sugerida
- confianca_leitura: alta, media ou baixa${blocoTextoLocal}`,
        response_json_schema: {
          type: 'object',
          properties: {
            descricao: { type: ['string', 'null'] },
            valor_pagamento: { type: ['number', 'null'] },
            data_vencimento: { type: ['string', 'null'] },
            beneficiario: { type: ['string', 'null'] },
            competencia: { type: ['string', 'null'] },
            numero_parcela: { type: ['string', 'null'] },
            linha_digitavel: { type: ['string', 'null'] },
            codigo_pix_copia_cola: { type: ['string', 'null'] },
            instrucoes: { type: ['string', 'null'] },
            frequencia_sugerida: { type: ['string', 'null'] },
            natureza_sugerida: { type: ['string', 'null'] },
            confianca_leitura: { type: ['string', 'null'] },
          },
        },
      });

      let extracted = normalizeInvokeLlmJsonResponse(extractedRaw);
      if (!possuiLeituraMinima(extracted)) {
        // Segunda tentativa com prompt enxuto para documentos dif?ceis.
        const retryRaw = await base44.integrations.Core.InvokeLLM({
          file_urls: [file_url],
          telemetry: buildLlmTelemetryContext({ source: 'agefin_importador_retry', fileCount: 1 }),
          prompt: `Extraia APENAS os campos listados (sem texto extra):
- descricao
- valor_pagamento (number)
- data_vencimento (YYYY-MM-DD)
- beneficiario
- linha_digitavel
- codigo_pix_copia_cola
Se n?o encontrar, use null.
${blocoTextoLocal}`,
          response_json_schema: {
            type: 'object',
            properties: {
              descricao: { type: ['string', 'null'] },
              valor_pagamento: { type: ['number', 'null'] },
              data_vencimento: { type: ['string', 'null'] },
              beneficiario: { type: ['string', 'null'] },
              linha_digitavel: { type: ['string', 'null'] },
              codigo_pix_copia_cola: { type: ['string', 'null'] },
            },
          },
        });
        const extractedRetry = normalizeInvokeLlmJsonResponse(retryRaw);
        if (possuiLeituraMinima(extractedRetry)) extracted = extractedRetry;
      }

      if (!possuiLeituraMinima(extracted)) {
        // N?o bloqueia o utilizador: abre formul?rio para preenchimento manual.
        setSelectedNatureza('??nico');
        setSelectedRecorrencia('Mensal');
        setExtractedData(criarPreenchimentoManualMinimo(f.name));
        setError('Leitura autom?tica indispon?vel neste ficheiro. Preencha os campos manualmente e guarde.');
        return true;
      }

      const descricaoFallback = [extracted.descricao, extracted.beneficiario].filter(Boolean).join(' - ');
      const naturezaValida = ['Parcelado', '??nico', 'Recorrente'].includes(extracted.natureza_sugerida)
        ? extracted.natureza_sugerida
        : '??nico';
      const frequenciaValida = ['Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'].includes(extracted.frequencia_sugerida)
        ? extracted.frequencia_sugerida
        : 'Mensal';
      const numeroParcela = extracted.numero_parcela ? parseInt(String(extracted.numero_parcela).replace(/[^0-9]/g, ''), 10) : null;
      const periodoReferenciaExtraido = extracted.competencia && /^\d{4}-\d{2}-\d{2}$/.test(extracted.competencia)
        ? extracted.competencia
        : extracted.competencia && /^\d{2}\/\d{4}$/.test(extracted.competencia)
          ? `${extracted.competencia.split('/')[1]}-${extracted.competencia.split('/')[0]}-01`
          : extracted.competencia && /^\d{2}\/\d{2}\/\d{4}$/.test(extracted.competencia)
            ? `${extracted.competencia.split('/')[2]}-${extracted.competencia.split('/')[1]}-01`
            : null;
      const periodoReferencia = extracted.data_vencimento
        ? `${extracted.data_vencimento.slice(0, 7)}-01`
        : periodoReferenciaExtraido;

      setSelectedNatureza(naturezaValida);
      setSelectedRecorrencia(frequenciaValida);
      const baseExtracted = {
        descricao: descricaoFallback || 'Conta importada',
        valor: extracted.valor_pagamento ?? 0,
        data_vencimento: extracted.data_vencimento || dataHoje(),
        terceiro_nome: extracted.beneficiario || '',
        periodo_referencia: periodoReferencia || `${dataHoje().slice(0, 7)}-01`,
        parcela_numero: Number.isFinite(numeroParcela) ? numeroParcela : '',
        linha_digitavel: extracted.linha_digitavel || '',
        codigo_pix_copia_cola: extracted.codigo_pix_copia_cola || '',
        observacoes: extracted.instrucoes || '',
      };
      if (modoAtualizacao && fluxoLoopAtualizadorRecorrente && dadosContaExistente) {
        if (dadosContaExistente.descricao) baseExtracted.descricao = dadosContaExistente.descricao;
        if (dadosContaExistente.terceiro_nome) baseExtracted.terceiro_nome = dadosContaExistente.terceiro_nome;
      }
      setExtractedData(baseExtracted);
      return true;
    } catch (err) {
      if (arquivoEnviado?.file_url) {
        // Upload funcionou, mas OCR/LLM falhou: permite fluxo manual sem perder o anexo.
        const f = arquivoEnviado.file_obj;
        setFile({
          original: f,
          url: arquivoEnviado.file_url,
          name: arquivoEnviado.file_name || f?.name || 'documento',
        });
        setSelectedNatureza('??nico');
        setSelectedRecorrencia('Mensal');
        setExtractedData(criarPreenchimentoManualMinimo(arquivoEnviado.file_name || f?.name));
        setError('N?o consegui ler automaticamente este documento. Confira/preencha os campos e guarde.');
        console.error('AgefinImportador fallback manual ap?s falha OCR/LLM:', err);
        return true;
      }
      const primeiro = String(err?.message || err || '')
        .split('\n')[0]
        .slice(0, 140);
      setError(
        primeiro
          ? `N?o consegui concluir a leitura: ${primeiro}`
          : 'N?o consegui ler este documento. Verifique a liga??o e tente de novo; PDFs digitais tamb?m s?o lidos por texto local no navegador.'
      );
      console.error('AgefinImportador leitura PDF/OCR:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [modoAtualizacao, fluxoLoopAtualizadorRecorrente, dadosContaExistente, somenteAnexo]);

  useEffect(() => {
    if (fluxoLoopAtualizadorRecorrente && modoAtualizacao) {
      setSelectedNatureza('Recorrente');
    }
  }, [fluxoLoopAtualizadorRecorrente, modoAtualizacao]);

  useEffect(() => {
    if (fluxoLoopAtualizadorRecorrente && dadosContaExistente?.conta_financeira_id) {
      setContaFinanceiraId(String(dadosContaExistente.conta_financeira_id));
    }
  }, [fluxoLoopAtualizadorRecorrente, dadosContaExistente?.conta_financeira_id]);

  useEffect(() => {
    if (!successState || !fluxoLoopAtualizadorRecorrente) return;
    const t = setTimeout(() => {
      onSuccess?.(null, { close: true, voltarAtualizador: true });
    }, 2000);
    return () => clearTimeout(t);
  }, [successState, fluxoLoopAtualizadorRecorrente, onSuccess]);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processSelectedFile(selectedFile);
  };

  useEffect(() => {
    if (!initialFile || initialFileHandled.current) return;
    let cancelled = false;
    (async () => {
      const ok = await processSelectedFile(initialFile);
      if (!cancelled && ok) initialFileHandled.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [initialFile, processSelectedFile]);

  useEffect(() => {
    if (!modoAtualizacao || !contaPrevistaId || !extractedData || fluxoLoopAtualizadorRecorrente || sacredDescricaoFetchDone.current) return;
    sacredDescricaoFetchDone.current = true;
    let cancelled = false;
    base44.entities.ContaPrevista.get(contaPrevistaId).then((cp) => {
      if (cancelled || !cp?.descricao_definida_pelo_usuario || !cp.descricao) return;
      setDescricaoSacralizadaLock(true);
      setExtractedData((prev) => (prev ? { ...prev, descricao: cp.descricao } : prev));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modoAtualizacao, contaPrevistaId, extractedData, fluxoLoopAtualizadorRecorrente]);

  useEffect(() => {
    base44.entities.ContasFinanceiras.filter({ ativo: true }).then((data) => {
      setContasFinanceiras(data || []);
      if (!contaFinanceiraId && data?.length) {
        setContaFinanceiraId(data[0].id);
      }
    });
  }, []);

  const resetState = () => {
    setFile(null);
    setExtractedData(null);
    setSelectedNatureza('??nico');
    setSelectedRecorrencia('Mensal');
    setError(null);
    setSuccessState(null);
    setDescricaoSacralizadaLock(false);
    initialFileHandled.current = false;
    sacredDescricaoFetchDone.current = false;
  };

  const handleConfirm = async () => {
    if (!extractedData) return;

    if (modoAtualizacao && somenteAnexo) {
      if (!lancamentoFinanceiroId && !contaPrevistaId) {
        setError('Conta alvo não encontrada.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await marcarLancamentosComoImportadosPorBoletoPdf(base44, {
          contaPrevistaId,
          lancamentoFinanceiroId,
          atualizarValores: false,
          contextoMatch: 'somente_anexo',
          boletoFingerprint: file?.url ? `anexo:${hashDjb2(file.url)}` : null,
        });
        if (contaPrevistaId && file?.url) {
          await base44.entities.ContaPrevista.update(contaPrevistaId, {
            status: 'Boleto Anexado',
            boleto_url: file.url,
          });
        }
        if (lancamentoFinanceiroId && file?.original) {
          try {
            await uploadAnexoParaLancamentoFinanceiro(base44, {
              file: file.original,
              lancamentoId: lancamentoFinanceiroId,
              descricao: dadosContaExistente?.descricao || file.name || 'Boleto',
              tipoDocumento: tipoDocumentoAnexo,
              origem: 'importador_agefin_pdf',
            });
          } catch (anexoErr) {
            console.error('Anexo PDF (vincular boleto):', anexoErr);
          }
        }
        setSuccessState({
          descricao: dadosContaExistente?.descricao || file?.name || 'Boleto vinculado',
          somenteAnexo: true,
        });
        if (!fluxoLoopAtualizadorRecorrente) {
          onSuccess?.(null, { somenteAnexo: true });
        }
      } catch (err) {
        setError('Erro ao vincular boleto. Tente novamente.');
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!contaFinanceiraId) return;
    if (!fluxoLoopAtualizadorRecorrente && !selectedNatureza) return;

    setLoading(true);
    setError(null);
    try {
      let descricaoReservadaExistente = null;
      if (contaPrevistaId) {
        try {
          const cp = await base44.entities.ContaPrevista.get(contaPrevistaId);
          if (cp?.descricao_definida_pelo_usuario && cp.descricao) {
            descricaoReservadaExistente = cp.descricao;
          }
        } catch (_) {
          /* ignora */
        }
      }

      const mesReferencia = (extractedData.periodo_referencia || extractedData.data_vencimento || '').slice(0, 7);
      const boletoFingerprint = gerarBoletoFingerprint(extractedData);
      let recorrenteVinculado = null;
      // V?nculo somente por IDs expl?citos do contexto; nunca por nome parecido.
      if (contaPrevistaId) {
        const cpAtual = await base44.entities.ContaPrevista.get(contaPrevistaId).catch(() => null);
        if (cpAtual?.conta_recorrente_id) {
          recorrenteVinculado = await base44.entities.ContaRecorrente.get(cpAtual.conta_recorrente_id).catch(() => null);
        }
      } else if (lancamentoFinanceiroId) {
        const lfAtual = await base44.entities.LancamentoFinanceiro.get(lancamentoFinanceiroId).catch(() => null);
        const grupoId = lfAtual?.grupo_lancamento_id || null;
        if (grupoId) {
          recorrenteVinculado = await base44.entities.ContaRecorrente.get(grupoId).catch(() => null);
        }
      }

      const contaExistenteDoMes = recorrenteVinculado
        ? (await base44.entities.ContaPrevista.filter({ conta_recorrente_id: recorrenteVinculado.id }, '-data_vencimento', 50))
            .find((conta) => (conta.data_vencimento || '').slice(0, 7) === mesReferencia)
        : null;

      let recorrenteFinal = recorrenteVinculado;

      if (!recorrenteFinal && selectedNatureza === 'Recorrente') {
        recorrenteFinal = await base44.entities.ContaRecorrente.create({
          nome_despesa: extractedData.descricao,
          terceiro_id: 'importado-manualmente',
          terceiro_nome: extractedData.terceiro_nome || 'Benefici?rio n?o identificado',
          categoria_financeira_id: 'importacao-pendente',
          categoria_nome: 'Importa??o pendente',
          valor_previsto: extractedData.valor,
          frequencia: selectedRecorrencia,
          dia_vencimento: Number((extractedData.data_vencimento || '').slice(8, 10)) || 1,
          observacoes: extractedData.observacoes || '',
          ativa: true,
        });
      }

      let contaDoMesFinal = recorrenteFinal
        ? (await base44.entities.ContaPrevista.filter({ conta_recorrente_id: recorrenteFinal.id }, '-data_vencimento', 50))
            .find((conta) => (conta.data_vencimento || '').slice(0, 7) === mesReferencia)
        : contaExistenteDoMes;

      if (
        !modoAtualizacao &&
        !contaPrevistaId &&
        !recorrenteFinal &&
        !contaDoMesFinal &&
        mesReferencia &&
        (selectedNatureza === '??nico' || selectedNatureza === 'Parcelado')
      ) {
        const dedupAvulsa = await encontrarContaPrevistaAvulsaMesmaImportacao(base44, {
          mesReferencia,
          boletoFingerprint,
          terceiroNome: extractedData.terceiro_nome,
          valor: extractedData.valor,
          selectedNatureza,
        });
        if (dedupAvulsa?.id) contaDoMesFinal = dedupAvulsa;
      }

      let novaSeriePorFingerprint = false;
      if (
        !modoAtualizacao &&
        !contaPrevistaId &&
        contaDoMesFinal &&
        recorrenteFinal &&
        boletoFingerprint &&
        selectedNatureza === 'Recorrente'
      ) {
        const lfsMesmo = await base44.entities.LancamentoFinanceiro.filter({ referencia_id: contaDoMesFinal.id });
        const fpExistente = (lfsMesmo || [])
          .map((l) => extrairBoletoFingerprintDeObservacoes(l.observacoes))
          .find((x) => x != null && x !== '');
        if (fpExistente && fpExistente !== boletoFingerprint) {
          const r0 = recorrenteFinal;
          const nomeBase = (extractedData.descricao || r0.nome_despesa || 'Conta').slice(0, 88);
          recorrenteFinal = await base44.entities.ContaRecorrente.create({
            nome_despesa: `${nomeBase} (${mesReferencia})`,
            terceiro_id: r0.terceiro_id,
            terceiro_nome: r0.terceiro_nome,
            categoria_financeira_id: r0.categoria_financeira_id,
            categoria_nome: r0.categoria_nome,
            valor_previsto: extractedData.valor,
            frequencia: selectedRecorrencia,
            dia_vencimento: Number((extractedData.data_vencimento || '').slice(8, 10)) || 1,
            observacoes: `[agefin_serie_separada:mes=${mesReferencia};motivo=boleto_distinto]`,
            ativa: true,
          });
          contaDoMesFinal = null;
          novaSeriePorFingerprint = true;
        }
      }

      const descricaoFinal =
        fluxoLoopAtualizadorRecorrente && (extractedData.descricao || '').trim()
          ? extractedData.descricao.trim()
          : descricaoReservadaExistente != null
            ? descricaoReservadaExistente
            : recorrenteFinal?.nome_despesa || extractedData.descricao;

      const payload = {
        descricao: descricaoFinal,
        descricao_definida_pelo_usuario: true,
        terceiro_id: recorrenteFinal?.terceiro_id || 'importado-manualmente',
        terceiro_nome: recorrenteFinal?.terceiro_nome || extractedData.terceiro_nome || 'Benefici?rio n?o identificado',
        categoria_financeira_id: recorrenteFinal?.categoria_financeira_id || 'importacao-pendente',
        categoria_nome: recorrenteFinal?.categoria_nome || 'Importa??o pendente',
        valor: extractedData.valor,
        data_vencimento: extractedData.data_vencimento,
        natureza: recorrenteFinal ? 'Recorrente' : selectedNatureza,
        parcela_numero: selectedNatureza === 'Parcelado' && extractedData.parcela_numero ? Number(extractedData.parcela_numero) : null,
        periodo_referencia: extractedData.periodo_referencia || null,
        status: file?.url ? 'Boleto Anexado' : 'Pendente',
        boleto_url: file?.url || null,
        conta_recorrente_id: recorrenteFinal?.id || null,
      };

      const contaCriada = contaPrevistaId
        ? await base44.entities.ContaPrevista.update(contaPrevistaId, {
            ...payload,
            valor_desatualizado: false,
          })
        : contaDoMesFinal
          ? await base44.entities.ContaPrevista.update(contaDoMesFinal.id, payload)
          : await base44.entities.ContaPrevista.create(payload);

      if (contaCriada?.id && file?.original) {
        try {
          await uploadAnexoParaContaPrevista(base44, {
            file: file.original,
            contaPrevistaId: contaCriada.id,
            descricao: descricaoFinal,
            tipoDocumento: tipoDocumentoAnexo,
            origem: 'importador_agefin_pdf',
          });
        } catch (anexoContaErr) {
          console.error('Anexo PDF (conta prevista):', anexoContaErr);
        }
      }

      const contaFinanceira = contasFinanceiras.find((item) => item.id === contaFinanceiraId);
      let lancamentoCriado = null;

      if (modoAtualizacao) {
        const contextoMatch = recorrenteVinculado
          ? `id_explicito;recorrente=${recorrenteVinculado.id}`
          : 'sem_vinculo_por_id';
        await marcarLancamentosComoImportadosPorBoletoPdf(base44, {
          contaPrevistaId: contaCriada?.id,
          lancamentoFinanceiroId,
          grupoLancamentoId: recorrenteFinal?.id,
          dataVencimento: extractedData.data_vencimento,
          valor: extractedData.valor,
          atualizarValores: !somenteAnexo,
          permitirFallbackGrupo: false,
          contextoMatch,
          boletoFingerprint,
        });
        if (lancamentoFinanceiroId && file?.original) {
          try {
            await uploadAnexoParaLancamentoFinanceiro(base44, {
              file: file.original,
              lancamentoId: lancamentoFinanceiroId,
              descricao: descricaoFinal,
              tipoDocumento: tipoDocumentoAnexo,
              origem: 'importador_agefin_pdf',
            });
          } catch (anexoErr) {
            console.error('Anexo PDF (atualiza??o boleto):', anexoErr);
          }
        }
      }

      if (!modoAtualizacao) {
        const observacoesComAuditoria = [
          extractedData.observacoes || '',
          recorrenteVinculado
            ? `[agefin_match:id_explicito;recorrente=${recorrenteVinculado.id}]`
            : '[agefin_match:sem_vinculo_por_id]',
          boletoFingerprint ? `[boleto_fp:${boletoFingerprint}]` : null,
        ].filter(Boolean).join('\n');
        const lancamentoPayload = {
          tipo: 'Despesa',
          descricao: descricaoFinal,
          terceiro_id: payload.terceiro_id,
          terceiro_nome: payload.terceiro_nome,
          valor: payload.valor,
          data_vencimento: payload.data_vencimento,
          status: 'Em Aberto',
          status_conciliacao: 'N/A',
          categoria: payload.categoria_nome,
          categoria_id: payload.categoria_financeira_id,
          conta_financeira_id: contaFinanceiraId,
          conta_financeira_nome: contaFinanceira?.nome || '',
          referencia_tipo: 'Manual',
          referencia_id: contaCriada.id,
          observacoes: observacoesComAuditoria,
          tags: [
            'conta_pagar',
            ...(payload.natureza === 'Recorrente' ? ['recorrente'] : []),
            ...(payload.natureza === 'Parcelado' ? ['parcelado'] : []),
            ...(file?.url ? [TAG_LF_BOLETO_PDF] : []),
          ],
          is_recorrente: payload.natureza === 'Recorrente' || payload.natureza === 'Parcelado',
          frequencia_recorrencia: payload.natureza === 'Recorrente' ? selectedRecorrencia : payload.natureza === 'Parcelado' ? 'Parcelado' : undefined,
          parcela_atual: payload.parcela_numero || undefined,
          grupo_lancamento_id: recorrenteFinal?.id || undefined,
        };

        /** Evita duas contas a pagar ???siamesas??? (mesmo ContaPrevista + mesmo m?s): reimporta??o OCR atualiza o LF existente. */
        let lfMesmoMes = null;
        if (contaCriada?.id && mesReferencia) {
          const existentesRef = await base44.entities.LancamentoFinanceiro.filter({ referencia_id: contaCriada.id });
          lfMesmoMes = (existentesRef || []).find(
            (l) => (l.data_vencimento || '').slice(0, 7) === mesReferencia
          );
        }

        if (lfMesmoMes?.id) {
          const manterPago = lfMesmoMes.status === 'Pago';
          lancamentoCriado = await base44.entities.LancamentoFinanceiro.update(lfMesmoMes.id, {
            ...lancamentoPayload,
            ...(manterPago
              ? {
                  status: lfMesmoMes.status,
                  data_pagamento: lfMesmoMes.data_pagamento,
                  status_conciliacao: lfMesmoMes.status_conciliacao,
                }
              : {}),
          });
        } else {
          lancamentoCriado = await base44.entities.LancamentoFinanceiro.create(lancamentoPayload);
        }
        if (!lancamentoCriado?.id && lfMesmoMes?.id) {
          lancamentoCriado = { ...lfMesmoMes, ...lancamentoPayload, id: lfMesmoMes.id };
        }
        if ((lancamentoCriado?.id || lfMesmoMes?.id) && file?.original) {
          try {
            await uploadAnexoParaLancamentoFinanceiro(base44, {
              file: file.original,
              lancamentoId: lancamentoCriado?.id || lfMesmoMes.id,
              descricao: descricaoFinal,
              tipoDocumento: tipoDocumentoAnexo,
              origem: 'importador_agefin_pdf',
            });
          } catch (anexoErr) {
            console.error('Anexo PDF (nova conta):', anexoErr);
          }
        }
        if (lancamentoCriado && isLancamentoParcelasMensaisRecorrente(lancamentoCriado)) {
          try {
            await criarParcelasIniciaisRecorrenteAposPrimeiro(base44, lancamentoCriado);
          } catch (parcelasErr) {
            console.error('Parcelas iniciais recorrente:', parcelasErr);
          }
        }
      }

      setSuccessState({
        descricao: payload.descricao,
        recorrenteCriada: Boolean(novaSeriePorFingerprint || (!recorrenteVinculado && recorrenteFinal)),
      });
      if (!fluxoLoopAtualizadorRecorrente) {
        onSuccess?.({ contaPrevista: contaCriada, lancamento: lancamentoCriado });
      }
    } catch (err) {
      const raw = String(err?.message || err || '').toLowerCase();
      const rede =
        typeof navigator !== 'undefined' && !navigator.onLine
          ? true
          : raw.includes('fetch') || raw.includes('network') || raw.includes('failed');
      setError(
        rede
          ? 'Sem liga??o ou falha de rede. Verifique a internet e tente novamente.'
          : 'Erro ao salvar conta. Tente novamente.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** Atualizador de boletos (lista): formul?rio sem natureza/recorr?ncia nova */
  const fluxoListaRecorrentes = Boolean(modoAtualizacao && fluxoLoopAtualizadorRecorrente);

  if (successState) {
    return (
      <div
        className={`flex h-full flex-col justify-between px-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-5 md:pb-5 ${fluxoLoopAtualizadorRecorrente ? 'min-h-0' : 'min-h-[32rem]'}`}
      >
        <div className="rounded-[32px] bg-card p-6 shadow-sm dark:bg-muted">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Sucesso</p>
              <h3 className="mt-2 font-glacial text-2xl font-semibold text-foreground">
                {successState.somenteAnexo || somenteAnexo
                  ? 'Boleto vinculado com sucesso'
                  : modoAtualizacao
                    ? 'Boleto atualizado com sucesso'
                    : 'Conta a pagar criada com sucesso'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{successState.descricao}</p>
            </div>
          </div>

          <div className="rounded-[24px] bg-muted/40 p-4 dark:bg-background">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-sm text-foreground/90">
                {successState.somenteAnexo || somenteAnexo
                  ? 'O documento foi anexado à conta. Valor e vencimento continuam como você definiu.'
                  : modoAtualizacao
                    ? 'O novo boleto substituiu o anterior nesta conta.'
                    : 'A conta já foi enviada para o Contas a Pagar.'}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <p className="text-sm text-foreground/90">
                {successState.somenteAnexo || somenteAnexo
                  ? 'Abra a conta para conferir o anexo ou editar valor e vencimento à mão.'
                  : modoAtualizacao
                    ? 'Os dados foram relidos e o status foi atualizado automaticamente.'
                    : 'Ela também já pode aparecer no AGEFIN quando for recorrente.'}
              </p>
            </div>
            {fluxoLoopAtualizadorRecorrente && (
              <p className="mt-4 text-center text-sm text-muted-foreground">A regressar ao atualizador para escolher outra conta???</p>
            )}
          </div>
        </div>

        {fluxoLoopAtualizadorRecorrente ? (
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => onSuccess?.(null, { close: true, voltarAtualizador: true })}
              className="h-12 w-full rounded-2xl border-0 bg-[#2e2629] text-sm font-semibold text-white hover:bg-[#362d31] dark:bg-[#2e2629] dark:text-white"
            >
              Voltar j?
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onSuccess?.(null, { close: true })}
              className="h-14 rounded-2xl border-0 bg-[#2e2629] text-base font-semibold text-white hover:bg-[#362d31] dark:bg-[#2e2629] dark:text-white"
            >
              Fechar
            </Button>
            <Button
              onClick={resetState}
              className="h-14 rounded-2xl bg-emerald-100 text-base font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-200 dark:text-emerald-900 dark:hover:bg-emerald-100"
            >
              Importar outra
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!extractedData) {
    return (
      <div className="h-full overflow-y-auto space-y-5 px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-2">
        <div className="rounded-[28px] bg-card/95 p-5 shadow-sm dark:bg-muted">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {somenteAnexo && modoAtualizacao ? 'Vincular boleto' : 'Importar conta'}
              </p>
              <h2 className="mt-2 font-glacial text-2xl font-semibold text-foreground">
                {somenteAnexo && modoAtualizacao ? 'Anexar PDF' : 'Leitura automática'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {somenteAnexo && modoAtualizacao
                  ? 'O boleto fica só como anexo. Valor e vencimento você edita manualmente na conta.'
                  : 'Envie boleto, guia, DAR, PDF ou imagem para pré-preencher a conta.'}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <label className="block cursor-pointer">
            <div className="rounded-[24px] bg-muted px-5 py-7 text-center shadow-sm transition-all hover:bg-muted dark:bg-background dark:hover:bg-background">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-sm dark:bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">{file ? file.name : 'Selecionar documento'}</p>
              <p className="mt-1 text-sm text-muted-foreground">PDF, boleto escaneado ou imagem n?tida</p>
            </div>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
              accept="image/*,.pdf"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-card p-4 shadow-sm dark:bg-muted">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Formato</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">PDF ou imagem</p>
            </div>
          </div>
          <div className="rounded-3xl bg-card p-4 shadow-sm dark:bg-muted">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Resultado</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Pr?-cadastro</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl bg-card p-5 shadow-sm dark:bg-muted">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border-2 border-border/40 border-t-primary animate-spin dark:border-border/40 dark:border-t-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Lendo documento</p>
                <p className="text-xs text-muted-foreground">Analisando campos principais para contas a pagar.</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-red-50 p-4 shadow-sm dark:bg-red-900/20">
            <div className="flex items-start gap-3 text-left">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                {initialFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      processSelectedFile(initialFile);
                    }}
                    disabled={loading}
                    className="text-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-900 disabled:opacity-50 dark:text-red-100 dark:hover:text-white"
                  >
                    Tentar ler de novo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (extractedData?.somenteAnexo) {
    return (
      <div className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <div className="rounded-[28px] bg-card p-5 shadow-sm dark:bg-muted">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Documento pronto para vincular</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{file?.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  O valor e o vencimento não serão alterados. Edite-os manualmente na ficha da conta, se precisar.
                </p>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-3xl bg-red-50 p-4 shadow-sm dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/5 bg-muted/40/95 px-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:bg-muted/95 md:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={resetState} className="h-14 rounded-2xl border-0 bg-[#2e2629] text-base font-semibold text-white">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !file?.original}
              className="h-14 rounded-2xl bg-muted text-base font-semibold text-foreground"
            >
              {loading ? 'Vinculando...' : 'Vincular boleto'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 pb-4 pt-2 touch-pan-y max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable] [-ms-overflow-style:auto] [-webkit-overflow-scrolling:touch]">
        <div className="space-y-5">
          <div className="rounded-[28px] bg-card p-5 shadow-sm dark:bg-muted">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Documento lido com sucesso</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{file?.name}</p>
              </div>
              <button
                onClick={resetState}
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors hover:bg-muted dark:text-foreground/90 dark:hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-[28px] bg-card p-5 shadow-sm dark:bg-muted">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pr?-preenchimento</p>
                <h3 className="mt-2 font-glacial text-xl font-semibold text-foreground">
                  {fluxoListaRecorrentes ? 'Rever boleto desta conta' : 'Revisar dados'}
                </h3>
                {fluxoListaRecorrentes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A recorr?ncia j? est? definida no cadastro. Confirme valor, vencimento e dados do PDF.
                  </p>
                )}
              </div>
              <span className="rounded-2xl bg-muted px-3 py-1 text-xs font-medium text-muted-foreground dark:bg-muted dark:text-foreground/90">PDV style</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/90">Conta financeira</label>
                <Select value={contaFinanceiraId} onValueChange={setContaFinanceiraId}>
                  <SelectTrigger className="h-14 rounded-2xl border-0 bg-muted px-4 text-base text-foreground shadow-none focus:ring-0 dark:bg-background dark:text-white">
                    <SelectValue placeholder="Escolher conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasFinanceiras.map((conta) => (
                      <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/90">
                  Descri??o
                  {!fluxoListaRecorrentes && descricaoSacralizadaLock && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      <Lock className="h-3 w-3" /> Fixa
                    </span>
                  )}
                </label>
                <input autoComplete="off"
                  type="text"
                  value={extractedData.descricao}
                  onChange={(e) => setExtractedData({ ...extractedData, descricao: e.target.value })}
                  readOnly={!fluxoListaRecorrentes && descricaoSacralizadaLock}
                  title={!fluxoListaRecorrentes && descricaoSacralizadaLock ? 'Esta conta j? tem descri??o confirmada; novos PDFs n?o a alteram.' : undefined}
                  className={`h-14 w-full rounded-2xl bg-muted px-4 text-base text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background ${!fluxoListaRecorrentes && descricaoSacralizadaLock ? 'cursor-not-allowed opacity-90' : ''}`}
                />
                {fluxoListaRecorrentes && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Nome da conta no cadastro (pode editar). O leitor do PDF n?o substitui este t?tulo ??? s? ajuda em valor, vencimento e anexo.
                  </p>
                )}
                {!fluxoListaRecorrentes && !descricaoSacralizadaLock && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Sugest?o do leitor autom?tico ??? pode editar antes de salvar. Depois de salva, a descri??o fica fixa para manter o mesmo nome mental nesta conta e nos meses seguintes.
                  </p>
                )}
                {!fluxoListaRecorrentes && descricaoSacralizadaLock && (
                  <p className="mt-1.5 text-xs text-amber-800/90 dark:text-amber-200/90">
                    Descri??o j? confirmada nesta conta; o PDF s? atualiza valores, vencimento e boleto.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">Benefici?rio</label>
                  <input autoComplete="off"
                    type="text"
                    value={extractedData.terceiro_nome}
                    onChange={(e) => setExtractedData({ ...extractedData, terceiro_nome: e.target.value })}
                    className="h-14 w-full rounded-2xl bg-muted px-4 text-base text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">Compet?ncia</label>
                  <input autoComplete="off"
                    type="date"
                    value={extractedData.periodo_referencia}
                    onChange={(e) => setExtractedData({ ...extractedData, periodo_referencia: e.target.value })}
                    className="h-14 w-full rounded-2xl bg-muted px-4 text-base text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">Valor</label>
                  <input autoComplete="off"
                    type="number"
                    value={extractedData.valor}
                    onChange={(e) => setExtractedData({ ...extractedData, valor: parseFloat(e.target.value) || 0 })}
                    className="h-14 w-full rounded-2xl bg-muted px-4 text-lg font-semibold text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">Vencimento</label>
                  <input autoComplete="off"
                    type="date"
                    value={extractedData.data_vencimento}
                    onChange={(e) => setExtractedData({ ...extractedData, data_vencimento: e.target.value })}
                    className="h-14 w-full rounded-2xl bg-muted px-4 text-base text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                  />
                </div>
              </div>

              {!fluxoListaRecorrentes && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">N? da parcela</label>
                  <input autoComplete="off"
                    type="number"
                    value={extractedData.parcela_numero}
                    onChange={(e) => setExtractedData({ ...extractedData, parcela_numero: e.target.value })}
                    className="h-14 w-full rounded-2xl bg-muted px-4 text-base text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground/90">Frequ?ncia</label>
                  <Select value={selectedRecorrencia} onValueChange={setSelectedRecorrencia}>
                    <SelectTrigger className="h-14 rounded-2xl border-0 bg-muted px-4 text-base text-foreground shadow-none focus:ring-0 dark:bg-background dark:text-white">
                      <SelectValue placeholder="Escolher frequ?ncia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Bimestral">Bimestral</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/90">Linha digit?vel</label>
                <textarea
                  value={extractedData.linha_digitavel}
                  onChange={(e) => setExtractedData({ ...extractedData, linha_digitavel: e.target.value })}
                  className="min-h-[92px] w-full rounded-2xl bg-muted px-4 py-3 text-sm text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/90">PIX copia e cola</label>
                <textarea
                  value={extractedData.codigo_pix_copia_cola}
                  onChange={(e) => setExtractedData({ ...extractedData, codigo_pix_copia_cola: e.target.value })}
                  className="min-h-[92px] w-full rounded-2xl bg-muted px-4 py-3 text-sm text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/90">Instru??es / observa??es</label>
                <textarea
                  value={extractedData.observacoes}
                  onChange={(e) => setExtractedData({ ...extractedData, observacoes: e.target.value })}
                  className="min-h-[110px] w-full rounded-2xl bg-muted px-4 py-3 text-sm text-foreground outline-none ring-0 focus:bg-muted dark:bg-background dark:text-white dark:focus:bg-background"
                />
              </div>
            </div>
          </div>

          {!fluxoListaRecorrentes && (
          <div className="rounded-[28px] bg-card p-5 shadow-sm dark:bg-muted">
            <label className="mb-3 block text-sm font-medium text-foreground/90">Qual ? a natureza desta conta?</label>
            <AgefinNaturezaSelector value={selectedNatureza || '??nico'} onChange={setSelectedNatureza} />
            {selectedNatureza === 'Recorrente' && (
              <p className="mt-3 text-sm text-muted-foreground">
                Sugest?o de recorr?ncia: <span className="font-medium text-foreground">{selectedRecorrencia}</span>
              </p>
            )}
          </div>
          )}

          {error && (
            <div className="rounded-3xl bg-red-50 p-4 shadow-sm dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/5 bg-muted/40/95 px-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:bg-muted/95 md:pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={resetState}
            className="h-14 rounded-2xl border-0 bg-[#2e2629] text-base font-semibold text-white hover:bg-[#362d31] dark:bg-[#2e2629] dark:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (!fluxoListaRecorrentes && !selectedNatureza) || !contaFinanceiraId}
            className="h-14 rounded-2xl bg-muted text-base font-semibold text-foreground hover:bg-muted-foreground/40 dark:bg-muted dark:text-foreground dark:hover:bg-card"
          >
            {loading ? 'Salvando...' : fluxoListaRecorrentes ? 'Guardar boleto' : 'Salvar Conta'}
          </Button>
        </div>
      </div>
    </div>
  );
}