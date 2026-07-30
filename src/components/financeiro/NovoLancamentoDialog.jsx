import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { addWeeks, addMonths, addYears, format } from 'date-fns';
import { dataHoje, datetimeLocalParaISO, codigoOrdenacaoDesdeInstante } from '@/components/utils/dateUtils';
import { formatarCodigoLancamentoLegivel } from '@/lib/financialUtils';
import { sincronizarSaldosAposAlteracao } from '@/lib/sincronizarSaldoContasFinanceiras';
import { useCategorias } from './fluxo/DialogCategoria';
import LancamentoConfirmacaoDialog from './LancamentoConfirmacaoDialog';
import LancamentoFormUnico, { formatarDataFormulario } from './fluxo/LancamentoFormUnico';
import { LancamentoFormSheet } from './fluxo/LancamentoPickerDialog';
import { normalizeDataText } from '@/lib/normalizeDataText';
import { gravarPreferenciasLancamento, resolverPreferenciasLancamento } from '@/lib/lancamentoPreferencias';
import { resolverDataLancamentoInput } from '@/lib/lancamentoOrdemMeta';
import { isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import RecorrenciaEscopoDialog from './RecorrenciaEscopoDialog';
import {
  descricaoPadraoVale,
  listarPessoasFolhaParaVale,
  montarTagsValeFolha,
  registrarValeNoFolhaAposLancamento,
} from '@/lib/folhaValeFluxo';
import {
  precisaEscopoRecorrenciaCadastro,
  precisaEscopoRecorrenciaPagamento,
  salvarEdicaoLancamentoFinanceiro,
} from '@/lib/editarLancamentoFinanceiro';

const FREQS_MAP = {
  Semanal: (d, i) => addWeeks(d, i),
  Mensal: (d, i) => addMonths(d, i),
  Bimestral: (d, i) => addMonths(d, i * 2),
  Trimestral: (d, i) => addMonths(d, i * 3),
  Semestral: (d, i) => addMonths(d, i * 6),
  Anual: (d, i) => addYears(d, i),
};

function agoraDatetimeLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {'center' | 'bottomSheet'} [presentation] — Se omitido: `bottomSheet` quando `origemContaPagar`, senão `center`.
 */
export default function NovoLancamentoDialog({
  open,
  onClose,
  onSaved,
  contaDefaultId,
  tipoInicial,
  descricaoInicial,
  valorInicial,
  referenciaId,
  referenciaTipo,
  origemContaPagar,
  presentation,
  lancamentoExistente = null,
  modoPlanejamento = false,
  centroCusto = '',
  onCentroCustoChange,
  centrosCustoRegistros = [],
  onCentrosCustoChange,
  categoriasDespesa = [],
  onCategoriasDespesaChange,
}) {
  const [tipo, setTipo] = useState(tipoInicial || 'Despesa');
  const [contas, setContas] = useState([]);
  const [valorCents, setValorCents] = useState('0');
  const [descricao, setDescricao] = useState('');
  const [dataCustomizada, setDataCustomizada] = useState(null);
  const [dataHoraCustomizada, setDataHoraCustomizada] = useState(null);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [dataTemp, setDataTemp] = useState('');
  const [dataLancamento, setDataLancamento] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [contaId, setContaId] = useState('');
  const [contaDestinoId, setContaDestinoId] = useState('');
  const [status, setStatus] = useState('Em Aberto');
  const [tags, setTags] = useState([]);
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState('');
  const [parcelas, setParcelas] = useState(2);
  const [dataFim, setDataFim] = useState('');
  const [isCustoMercadoria, setIsCustoMercadoria] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialogMode, setConfirmDialogMode] = useState('processing');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pedidoCompraId, setPedidoCompraId] = useState('');
  const [pedidosCompra, setPedidosCompra] = useState([]);
  const [observacoes, setObservacoes] = useState('');
  const [showEscopoPagamento, setShowEscopoPagamento] = useState(false);
  const [showEscopoCadastro, setShowEscopoCadastro] = useState(false);
  const [pendingEscopoPagamento, setPendingEscopoPagamento] = useState('apenas_esta');
  const [isValeFolha, setIsValeFolha] = useState(false);
  const [valeFolhaModeloId, setValeFolhaModeloId] = useState('');
  const [pessoasFolha, setPessoasFolha] = useState([]);
  const [loadingPessoasFolha, setLoadingPessoasFolha] = useState(false);
  const { toast } = useToast();
  const { categorias, reload: reloadCats } = useCategorias();

  const modoEdicao = !!lancamentoExistente;

  const resetForm = () => {
    setTipo(tipoInicial || 'Despesa');
    setValorCents(valorInicial ? Math.round(parseFloat(valorInicial) * 100).toString() : '0');
    setDescricao(descricaoInicial || '');
    setDataCustomizada(null);
    setDataHoraCustomizada(null);
    setDataLancamento('');
    setCategoria('');
    setCategoriaId('');
    setContaId(contaDefaultId || '');
    setContaDestinoId('');
    setStatus('Em Aberto');
    setTags(origemContaPagar ? ['conta_pagar'] : []);
    setIsRecorrente(false);
    setFrequencia('');
    setParcelas(2);
    setDataFim('');
    setIsCustoMercadoria(false);
    setPedidoCompraId('');
    setObservacoes('');
    setSaving(false);
    setConfirmDialogMode('processing');
    setShowConfirmDialog(false);
    setShowEscopoPagamento(false);
    setShowEscopoCadastro(false);
    setPendingEscopoPagamento('apenas_esta');
    setIsValeFolha(false);
    setValeFolhaModeloId('');
  };

  const popularDeLancamento = (l) => {
    if (!l) return;
    setTipo(l.tipo || 'Despesa');
    setValorCents(Math.round((parseFloat(l.valor) || 0) * 100).toString());
    setDescricao(l.descricao || '');
    const venc = (l.data_vencimento || '').slice(0, 10);
    const pag = (l.data_pagamento || '').slice(0, 10);
    if (pag) {
      setDataCustomizada(pag);
      setDataHoraCustomizada(null);
    } else if (venc) {
      setDataCustomizada(venc);
      setDataHoraCustomizada(null);
    } else {
      setDataCustomizada(null);
      setDataHoraCustomizada(null);
    }
    setDataLancamento(resolverDataLancamentoInput(l));
    setCategoria(l.categoria || '');
    setCategoriaId(l.categoria_id || '');
    setContaId(l.conta_financeira_id || '');
    setContaDestinoId('');
    setStatus(isLancamentoPago(l) ? 'Pago' : 'Em Aberto');
    setTags(l.tags || []);
    setIsRecorrente(!!l.is_recorrente);
    setFrequencia(l.frequencia_recorrencia || '');
    setParcelas(l.numero_parcelas_total || 2);
    setDataFim((l.data_fim_recorrencia || '').slice(0, 10));
    setIsCustoMercadoria(!!l.is_custo_mercadoria);
    setPedidoCompraId(l.pedido_compra_vinculado_id || '');
    setObservacoes((l.observacoes || '').replace(/\[CANCELADO.*?\]/gs, '').trim());
  };

  useEffect(() => {
    if (!open) return;
    base44.entities.ContasFinanceiras.filter({ ativo: true }).then(setContas);
    base44.entities.PedidoCompra.list('-created_date', 50).then(setPedidosCompra);
    if (lancamentoExistente) {
      popularDeLancamento(lancamentoExistente);
      return;
    }
    resetForm();
  }, [open, tipoInicial, contaDefaultId, descricaoInicial, valorInicial, origemContaPagar, lancamentoExistente?.id]);

  useEffect(() => {
    if (!open || modoEdicao || tipo === 'Transferência') return;
    const prefs = resolverPreferenciasLancamento(tipo, { contas, categorias });
    if (!contaDefaultId && prefs.contaId) setContaId(prefs.contaId);
    if (!origemContaPagar) {
      setCategoria(prefs.categoria || '');
      setCategoriaId(prefs.categoriaId || '');
    }
  }, [open, tipo, contas, categorias, contaDefaultId, origemContaPagar]);

  useEffect(() => {
    if (!open || modoEdicao) return;
    setLoadingPessoasFolha(true);
    listarPessoasFolhaParaVale()
      .then(setPessoasFolha)
      .catch(() => setPessoasFolha([]))
      .finally(() => setLoadingPessoasFolha(false));
  }, [open, modoEdicao]);

  useEffect(() => {
    if (!open || modoEdicao || lancamentoExistente || !modoPlanejamento) return;
    setIsRecorrente(true);
    setFrequencia((prev) => prev || 'Mensal');
  }, [open, modoEdicao, lancamentoExistente, modoPlanejamento]);

  const handleValeFolhaToggle = (ativo) => {
    setIsValeFolha(ativo);
    if (ativo) {
      setTipo('Despesa');
      setIsRecorrente(false);
      if (!valeFolhaModeloId && pessoasFolha.length === 1) {
        setValeFolhaModeloId(pessoasFolha[0].id);
        setDescricao(descricaoPadraoVale(pessoasFolha[0].nome));
      }
    } else {
      setValeFolhaModeloId('');
    }
  };

  const handleValeFolhaPessoa = (modeloId) => {
    setValeFolhaModeloId(modeloId);
    const pessoa = pessoasFolha.find((p) => p.id === modeloId);
    if (pessoa) setDescricao(descricaoPadraoVale(pessoa.nome));
  };

  const previewOrdemLancamento = useMemo(() => {
    if (!dataLancamento) return null;
    const iso = datetimeLocalParaISO(dataLancamento);
    if (!iso) return null;
    return formatarCodigoLancamentoLegivel(codigoOrdenacaoDesdeInstante(iso));
  }, [dataLancamento]);

  const valorNumerico = parseInt(valorCents || '0', 10) / 100;
  const realizado = status === 'Pago';

  const resolverDatasSalvamento = (pagoOuRealizado) => {
    const agora = new Date();
    if (dataHoraCustomizada) {
      const iso = datetimeLocalParaISO(dataHoraCustomizada);
      const dia = (dataHoraCustomizada || '').slice(0, 10);
      return {
        dataVenc: dia || dataHoje(),
        dataPag: pagoOuRealizado ? (dia || dataHoje()) : null,
        metaLanc: iso ? { data_lancamento: iso } : {},
      };
    }
    if (dataCustomizada) {
      return {
        dataVenc: dataCustomizada,
        dataPag: pagoOuRealizado ? dataCustomizada : null,
        metaLanc: {},
      };
    }
    const hoje = format(agora, 'yyyy-MM-dd');
    return {
      dataVenc: hoje,
      dataPag: pagoOuRealizado ? hoje : null,
      metaLanc: {},
    };
  };

  const dataExibicao = formatarDataFormulario(dataCustomizada, dataHoraCustomizada);

  const abrirEditorData = () => {
    setDataTemp(dataHoraCustomizada || dataCustomizada || agoraDatetimeLocal());
    setShowDataDialog(true);
  };

  const confirmarData = () => {
    if (!dataTemp) {
      setShowDataDialog(false);
      return;
    }
    if (dataTemp.includes('T')) {
      setDataHoraCustomizada(dataTemp);
      setDataCustomizada(dataTemp.slice(0, 10));
    } else {
      setDataCustomizada(dataTemp);
      setDataHoraCustomizada(null);
    }
    setShowDataDialog(false);
  };

  const cancelarData = () => {
    setDataTemp('');
    setShowDataDialog(false);
  };

  const gerarGrupoId = () => `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const metaDataLancamento = () => {
    if (!dataLancamento) return {};
    const iso = datetimeLocalParaISO(dataLancamento);
    return iso ? { data_lancamento: iso } : {};
  };

  const resolverDataVencimentoEdicao = () => {
    if (dataHoraCustomizada) return (dataHoraCustomizada || '').slice(0, 10);
    if (dataCustomizada) return dataCustomizada;
    return (lancamentoExistente?.data_vencimento || '').slice(0, 10) || dataHoje();
  };

  const resolverDataPagamentoEdicao = () => {
    if (!realizado) return null;
    if (dataHoraCustomizada) return (dataHoraCustomizada || '').slice(0, 10);
    if (dataCustomizada) return dataCustomizada;
    return lancamentoExistente?.data_pagamento || dataHoje();
  };

  const aplicarEdicao = async (escopoCadastro = 'apenas_esta', escopoPagamento = 'apenas_esta') => {
    setSaving(true);
    setConfirmDialogMode('processing');
    setShowConfirmDialog(true);
    try {
      const result = await salvarEdicaoLancamentoFinanceiro({
        lancamento: lancamentoExistente,
        contas,
        descricao,
        valorNumerico,
        dataVencimento: resolverDataVencimentoEdicao(),
        observacoes,
        categoria,
        categoriaId,
        tags,
        contaId,
        realizado,
        dataPagamento: resolverDataPagamentoEdicao(),
        dataLancamentoInput: dataLancamento,
        escopoCadastro,
        escopoPagamento,
      });
      if (!result.changed) {
        toast({ title: 'Nada foi alterado', className: 'bg-muted text-foreground' });
        setShowConfirmDialog(false);
        return;
      }
      const batchMsg = result.batchCount ? ` (${result.batchCount} lançamentos)` : '';
      toast({ title: `Lançamento atualizado${batchMsg}!`, className: 'bg-muted text-foreground' });
      if (tipo !== 'Transferência') {
        gravarPreferenciasLancamento(tipo, { contaId, categoria: normalizeDataText(categoria), categoriaId });
      }
      onSaved?.(result.updated);
      setSaving(false);
      setConfirmDialogMode('success');
    } catch (error) {
      toast({
        title: 'Não foi possível guardar',
        description: error?.message,
        variant: 'destructive',
      });
      setShowConfirmDialog(false);
      setSaving(false);
    }
  };

  const handleSaveEdicao = async () => {
    if (saving) return;
    if (!valorNumerico || valorNumerico <= 0) {
      toast({ title: 'Informe o valor', variant: 'destructive' });
      return;
    }
    if (tipo !== 'Transferência' && !descricao.trim()) {
      toast({ title: 'Informe a descrição', variant: 'destructive' });
      return;
    }
    if (realizado && tipo !== 'Transferência' && !contaId) {
      toast({ title: 'Selecione a conta', variant: 'destructive' });
      return;
    }

    const cadastroMudou =
      (lancamentoExistente.descricao || '').trim() !== descricao.trim() ||
      Math.abs((parseFloat(lancamentoExistente.valor) || 0) - valorNumerico) > 0.009 ||
      (lancamentoExistente.data_vencimento || '').slice(0, 10) !== resolverDataVencimentoEdicao() ||
      (lancamentoExistente.categoria || '') !== categoria ||
      JSON.stringify(lancamentoExistente.tags || []) !== JSON.stringify(tags || []);

    const pagamentoMudou = realizado !== isLancamentoPago(lancamentoExistente);

    if (pagamentoMudou && precisaEscopoRecorrenciaPagamento(lancamentoExistente, realizado)) {
      setShowEscopoPagamento(true);
      return;
    }
    if (cadastroMudou && precisaEscopoRecorrenciaCadastro(lancamentoExistente)) {
      setPendingEscopoPagamento('apenas_esta');
      setShowEscopoCadastro(true);
      return;
    }
    await aplicarEdicao('apenas_esta', 'apenas_esta');
  };

  const handleSave = async () => {
    if (modoEdicao) {
      await handleSaveEdicao();
      return;
    }
    if (saving) return;
    if (!valorNumerico || valorNumerico <= 0) {
      toast({ title: 'Informe o valor', variant: 'destructive' });
      return;
    }
    if (tipo !== 'Transferência' && !descricao.trim()) {
      toast({ title: 'Informe a descrição', variant: 'destructive' });
      return;
    }
    if (tipo === 'Transferência' && !contaId) {
      toast({ title: 'Selecione a conta de origem', variant: 'destructive' });
      return;
    }
    if (realizado && tipo !== 'Transferência' && !contaId) {
      toast({ title: 'Selecione a conta para registrar o pagamento', variant: 'destructive' });
      return;
    }
    if (isValeFolha) {
      if (!valeFolhaModeloId) {
        toast({ title: 'Selecione quem vai receber o vale', variant: 'destructive' });
        return;
      }
      if (isRecorrente) {
        toast({ title: 'Vale não pode ser lançamento recorrente', variant: 'destructive' });
        return;
      }
    }
    if (isRecorrente && !frequencia) {
      toast({
        title: 'Escolha a frequência',
        description: modoPlanejamento
          ? 'Ex.: Anual para IPTU em março, Mensal para aluguel.'
          : 'Abra Mais opções e selecione Mensal, Anual, etc.',
        variant: 'destructive',
      });
      return;
    }

    const descricaoNorm = normalizeDataText(descricao.trim());
    const categoriaNorm = normalizeDataText(categoria);
    const { dataVenc, dataPag, metaLanc } = resolverDatasSalvamento(realizado);

    setSaving(true);
    setConfirmDialogMode('processing');
    setShowConfirmDialog(true);

    let lancamentoParaCallback = null;
    let metaRecorrente = null;
    const conta = contas.find((c) => c.id === contaId);
    const pedidoCompra = pedidoCompraId ? pedidosCompra.find((p) => p.id === pedidoCompraId) : null;
    const pessoaVale = isValeFolha ? pessoasFolha.find((p) => p.id === valeFolhaModeloId) : null;
    const tagsBase = isValeFolha && pessoaVale ? montarTagsValeFolha(tags, pessoaVale) : tags;
    const tagsSalvar = (() => {
      const base = [...(tagsBase || [])];
      if (modoPlanejamento && tipo !== 'Transferência') {
        base.push('conta_pagar', 'agefin_previsao');
        if (isRecorrente) base.push('recorrente');
      }
      return [...new Set(base)];
    })();

    if (tipo === 'Transferência') {
      if (!contaDestinoId) {
        setSaving(false);
        setShowConfirmDialog(false);
        toast({ title: 'Selecione a conta destino', variant: 'destructive' });
        return;
      }
      const contaDest = contas.find((c) => c.id === contaDestinoId);
      const st = realizado ? 'Pago' : 'Em Aberto';
      const base = {
        ...metaLanc,
        valor: valorNumerico,
        data_vencimento: dataVenc,
        data_pagamento: realizado ? dataPag : null,
        status: st,
        status_conciliacao: realizado ? 'N/A' : 'N/A',
        categoria: 'Transferência entre Contas',
        referencia_tipo: 'Manual',
      };
      await base44.entities.LancamentoFinanceiro.create({
        ...base,
        tipo: 'Despesa',
        descricao: `Transferência para ${contaDest?.nome}`,
        conta_financeira_id: contaId,
        conta_financeira_nome: conta?.nome,
      });
      await base44.entities.LancamentoFinanceiro.create({
        ...base,
        tipo: 'Receita',
        descricao: `Transferência de ${conta?.nome}`,
        conta_financeira_id: contaDestinoId,
        conta_financeira_nome: contaDest?.nome,
      });
      if (realizado) {
        await sincronizarSaldosAposAlteracao(base44, [contaId, contaDestinoId]);
      }
    } else if (isRecorrente && frequencia) {
      const freqSalvar = frequencia;
      const grupoId = gerarGrupoId();
      const baseDate = new Date(`${dataVenc}T12:00:00Z`);
      const lotes = [];

      if (freqSalvar === 'Parcelado') {
        for (let i = 0; i < parcelas; i++) {
          const dtVenc = addMonths(baseDate, i);
          lotes.push({
            ...metaDataLancamento(),
            tipo,
            descricao: `${descricaoNorm} (${i + 1}/${parcelas})`,
            valor: valorNumerico,
            data_vencimento: format(dtVenc, 'yyyy-MM-dd'),
            data_pagamento: i === 0 && realizado ? dataPag : null,
            status: i === 0 && realizado ? 'Pago' : 'Em Aberto',
            status_conciliacao: i === 0 && realizado ? 'Pendente' : 'N/A',
            categoria: categoriaNorm,
            categoria_id: categoriaId,
            tags: tagsSalvar,
            conta_financeira_id: contaId,
            conta_financeira_nome: conta?.nome,
            referencia_tipo: 'Manual',
            is_recorrente: true,
            frequencia_recorrencia: freqSalvar,
            numero_parcelas_total: parcelas,
            parcela_atual: i + 1,
            grupo_lancamento_id: grupoId,
            is_custo_mercadoria: isCustoMercadoria,
            pedido_compra_vinculado_id: pedidoCompra?.id,
            pedido_compra_vinculado_numero: pedidoCompra?.numero,
          });
        }
      } else {
        const addFn = FREQS_MAP[freqSalvar] || FREQS_MAP.Mensal;
        const limiteDate = dataFim
          ? new Date(dataFim)
          : freqSalvar === 'Anual'
            ? addYears(new Date(), 3)
            : freqSalvar === 'Semestral'
              ? addYears(new Date(), 2)
              : addMonths(baseDate, 11);
        let i = 0;
        let dtAtual = baseDate;
        while (dtAtual <= limiteDate && i < 60) {
          lotes.push({
            ...metaDataLancamento(),
            tipo,
            descricao: descricaoNorm,
            valor: valorNumerico,
            data_vencimento: format(dtAtual, 'yyyy-MM-dd'),
            data_pagamento: i === 0 && realizado ? dataPag : null,
            status: i === 0 && realizado ? 'Pago' : 'Em Aberto',
            status_conciliacao: i === 0 && realizado ? 'Pendente' : 'N/A',
            categoria: categoriaNorm,
            categoria_id: categoriaId,
            tags: tagsSalvar,
            conta_financeira_id: contaId,
            conta_financeira_nome: conta?.nome,
            referencia_tipo: 'Manual',
            is_recorrente: true,
            frequencia_recorrencia: freqSalvar,
            parcela_atual: i + 1,
            grupo_lancamento_id: grupoId,
            data_fim_recorrencia: dataFim || null,
            is_custo_mercadoria: isCustoMercadoria,
            pedido_compra_vinculado_id: pedidoCompra?.id,
            pedido_compra_vinculado_numero: pedidoCompra?.numero,
          });
          i += 1;
          dtAtual = addFn(baseDate, i);
        }
      }

      await base44.entities.LancamentoFinanceiro.bulkCreate(lotes);
      if (realizado && conta) {
        await sincronizarSaldosAposAlteracao(base44, [conta.id]);
      }
      const primeiro = lotes[0];
      metaRecorrente = {
        is_recorrente: true,
        grupo_lancamento_id: grupoId,
        descricao: descricaoNorm,
        valor: valorNumerico,
        categoria: categoriaNorm,
        categoria_id: categoriaId,
        frequencia: freqSalvar,
        data_vencimento: primeiro?.data_vencimento || dataVenc,
      };
    } else {
      const novoLancamento = await base44.entities.LancamentoFinanceiro.create({
        ...metaDataLancamento(),
        ...metaLanc,
        tipo,
        descricao: descricaoNorm,
        valor: valorNumerico,
        data_vencimento: dataVenc,
        data_pagamento: realizado ? dataPag : null,
        status,
        status_conciliacao: realizado ? 'Pendente' : 'N/A',
        categoria: categoriaNorm,
        categoria_id: categoriaId,
        tags: tagsSalvar,
        conta_financeira_id: contaId,
        conta_financeira_nome: conta?.nome,
        referencia_tipo: referenciaTipo || 'Manual',
        referencia_id: referenciaId || '',
        is_custo_mercadoria: isCustoMercadoria,
        pedido_compra_vinculado_id: pedidoCompra?.id,
        pedido_compra_vinculado_numero: pedidoCompra?.numero,
      });
      if (realizado && conta) {
        await sincronizarSaldosAposAlteracao(base44, [conta.id]);
      }
      lancamentoParaCallback = novoLancamento;

      if (isValeFolha && valeFolhaModeloId && novoLancamento?.id) {
        try {
          await registrarValeNoFolhaAposLancamento({
            modeloId: valeFolhaModeloId,
            valor: valorNumerico,
            data: dataVenc,
            lancamentoId: novoLancamento.id,
            descricao: descricaoNorm,
            lancamentoPago: realizado,
          });
        } catch (err) {
          toast({
            title: 'Lançamento salvo, mas vale não entrou na folha',
            description: err?.message || 'Abra a Folha e registre o vale manualmente.',
            variant: 'destructive',
          });
        }
      }
    }

    toast({
      title: isValeFolha
        ? (realizado ? 'Vale registrado no fluxo e na folha' : 'Vale em aberto — já aparece na folha como pendente')
        : 'Lançamento salvo!',
    });
    if (tipo !== 'Transferência') {
      gravarPreferenciasLancamento(tipo, {
        contaId,
        categoria: categoriaNorm,
        categoriaId,
      });
    }
    onSaved?.(lancamentoParaCallback || metaRecorrente);
    setSaving(false);
    setConfirmDialogMode('success');
  };

  if (!open) return null;

  const layout = presentation ?? (origemContaPagar ? 'bottomSheet' : 'center');
  const rootClassName =
    layout === 'bottomSheet'
      ? 'relative flex h-[min(92dvh,720px)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-background shadow-2xl'
      : 'relative flex h-[min(100dvh,820px)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-background shadow-2xl md:max-h-[calc(100vh-3rem)]';

  const panel = (
    <div className={rootClassName} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-muted dark:bg-muted active:scale-95"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {modoEdicao ? 'Editar lançamento' : 'Novo lançamento'}
        </p>
        <div className="w-9" />
      </div>

      <LancamentoFormUnico
        tipo={tipo}
        onTipoChange={setTipo}
        bloquearTipo={modoEdicao}
        valorNumerico={valorNumerico}
        onValorChange={(v) => setValorCents(Math.round(parseFloat(v || '0') * 100).toString() || '0')}
        descricao={descricao}
        onDescricaoChange={setDescricao}
        realizado={realizado}
        onRealizadoChange={(v) => setStatus(v ? 'Pago' : 'Em Aberto')}
        dataExibicao={dataExibicao}
        onEditarData={abrirEditorData}
        contaId={contaId}
        contaDestinoId={contaDestinoId}
        contas={contas}
        onContaChange={setContaId}
        onContaDestinoChange={setContaDestinoId}
        categoria={categoria}
        categoriaId={categoriaId}
        onCategoriaChange={(nome, id) => { setCategoria(nome); setCategoriaId(id || ''); }}
        categorias={categorias}
        onCategoriaCriada={reloadCats}
        tags={tags}
        onTagsChange={setTags}
        isRecorrente={isRecorrente}
        onRecorrenteToggle={(v) => {
          setIsRecorrente(v);
          if (v) setIsValeFolha(false);
        }}
        frequencia={frequencia}
        onFrequencia={setFrequencia}
        parcelas={parcelas}
        onParcelas={setParcelas}
        dataFim={dataFim}
        onDataFim={setDataFim}
        isCustoMercadoria={isCustoMercadoria}
        onCustoMercadoriaChange={setIsCustoMercadoria}
        isValeFolha={isValeFolha}
        onValeFolhaToggle={handleValeFolhaToggle}
        valeFolhaModeloId={valeFolhaModeloId}
        onValeFolhaPessoaChange={handleValeFolhaPessoa}
        pessoasFolha={pessoasFolha}
        loadingPessoasFolha={loadingPessoasFolha}
        bloquearValeFolha={modoEdicao || tipo === 'Transferência'}
        pedidoCompraId={pedidoCompraId}
        onPedidoCompraIdChange={setPedidoCompraId}
        pedidosCompra={pedidosCompra}
        dataLancamento={dataLancamento}
        onDataLancamentoChange={(e) => setDataLancamento(e.target.value)}
        previewOrdemLancamento={previewOrdemLancamento}
        saving={saving}
        onSalvar={handleSave}
        onCancelar={onClose}
        salvarLabel={modoEdicao ? 'Salvar alterações' : 'Salvar'}
        bloquearRecorrencia={modoEdicao}
        modoPlanejamento={modoPlanejamento}
        centroCusto={centroCusto}
        onCentroCustoChange={onCentroCustoChange}
        centrosCustoRegistros={centrosCustoRegistros}
        onCentrosCustoChange={onCentrosCustoChange}
        categoriasDespesa={categoriasDespesa}
        onCategoriasDespesaChange={onCategoriasDespesaChange}
      />

      <LancamentoFormSheet
        open={showDataDialog}
        onOpenChange={setShowDataDialog}
        title="Data e hora"
      >
        <input
          autoComplete="off"
          type="datetime-local"
          value={dataTemp}
          onChange={(e) => setDataTemp(e.target.value)}
          className="h-12 w-full rounded-xl border-0 bg-muted px-3 text-sm outline-none"
        />
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={cancelarData}
            className="h-11 flex-1 rounded-xl bg-muted text-sm font-medium text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmarData}
            className="h-11 flex-1 rounded-xl bg-[#4a5240] text-sm font-semibold text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]"
          >
            Confirmar
          </button>
        </div>
      </LancamentoFormSheet>

      <LancamentoConfirmacaoDialog
        open={showConfirmDialog}
        mode={confirmDialogMode}
        stackElevated
        successTitle={modoEdicao ? 'Alterações guardadas' : undefined}
        successMessage={modoEdicao ? undefined : undefined}
        onCreateAnother={() => {
          setShowConfirmDialog(false);
          setConfirmDialogMode('processing');
          if (modoEdicao) {
            onClose();
            return;
          }
          resetForm();
        }}
        onFinish={() => {
          setShowConfirmDialog(false);
          onClose();
        }}
      />

      <RecorrenciaEscopoDialog
        open={showEscopoPagamento}
        onClose={() => setShowEscopoPagamento(false)}
        onConfirm={(escopo) => {
          setShowEscopoPagamento(false);
          setPendingEscopoPagamento(escopo);
          const cadastroMudou =
            (lancamentoExistente?.descricao || '').trim() !== descricao.trim() ||
            Math.abs((parseFloat(lancamentoExistente?.valor) || 0) - valorNumerico) > 0.009;
          if (cadastroMudou && precisaEscopoRecorrenciaCadastro(lancamentoExistente)) {
            setShowEscopoCadastro(true);
            return;
          }
          aplicarEdicao('apenas_esta', escopo);
        }}
      />
      <RecorrenciaEscopoDialog
        mode="cadastro"
        open={showEscopoCadastro}
        onClose={() => setShowEscopoCadastro(false)}
        onConfirm={(escopo) => {
          setShowEscopoCadastro(false);
          aplicarEdicao(escopo, pendingEscopoPagamento);
        }}
      />
    </div>
  );

  if (layout === 'bottomSheet') {
    return createPortal(
      <>
        <button
          type="button"
          aria-label="Fechar"
          className="fixed inset-0 z-[59] cursor-default bg-muted/25 dark:bg-muted/40"
          onClick={onClose}
        />
        <div
          className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pointer-events-auto w-full max-w-2xl" role="dialog" aria-modal="true">
            {panel}
          </div>
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fechar"
        className="fixed inset-0 z-[59] cursor-default bg-muted/55 backdrop-blur-[2px] dark:bg-muted/40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 pointer-events-none md:p-4">
        <div className="pointer-events-auto w-full max-w-2xl" role="dialog" aria-modal="true">
          {panel}
        </div>
      </div>
    </>,
    document.body,
  );
}
