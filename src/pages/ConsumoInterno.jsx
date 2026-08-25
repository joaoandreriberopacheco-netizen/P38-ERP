import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfMonth, isWithinInterval } from 'date-fns';
import AssinaturaConsumoDialog from '@/components/consumo-interno/AssinaturaConsumoDialog';
import ConsumoResumoDialog from '@/components/consumo-interno/ConsumoResumoDialog';
import ConsumoProdutoSelectorPDV from '@/components/consumo-interno/ConsumoProdutoSelectorPDV';
import ConsumoInternoFormPage from '@/components/consumo-interno/ConsumoInternoFormPage';
import ComprovanteConsumoInterno from '@/components/consumo-interno/ComprovanteConsumoInterno';
import ConsumoInternoPainelInicial from '@/components/consumo-interno/ConsumoInternoPainelInicial';
import ConsumoAnexosDialog from '@/components/consumo-interno/ConsumoAnexosDialog';
import ConsumoSubmittingOverlay from '@/components/consumo-interno/ConsumoSubmittingOverlay';
import { CONSUMO_FORM_OVERLAY_Z, CONSUMO_FORM_DIALOG_CONTENT_Z, dismissConsumoOverlayHistory } from '@/lib/consumoInternoOverlay';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import { buildAnexoMovimentoTag } from '@/components/anexos/buildAnexoMovimentoTag';
import { renderTaggedImage } from '@/components/anexos/renderTaggedImage';
import { usePermissoesUsuario } from '@/hooks/usePermissoesUsuario';

const formatCurrency = (value) => `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function ConsumoInternoPage() {
  const { tem: podePerm } = usePermissoesUsuario();
  const podeRegistrar = podePerm('consumo_interno.registrar', 'consumo_interno.acesso');
  const podeVerHistorico = podePerm('consumo_interno.visualizar_historico', 'consumo_interno.acesso');
  const podeAnexos = podePerm('consumo_interno.anexos_assinatura', 'consumo_interno.acesso');

  const [currentUser, setCurrentUser] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [destinacoes, setDestinacoes] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [search, setSearch] = useState('');
  const [filtroTemporal, setFiltroTemporal] = useState('hoje');
  const [showAssinatura, setShowAssinatura] = useState(false);
  const [showResumo, setShowResumo] = useState(false);
  const [showProdutoSelector, setShowProdutoSelector] = useState(false);
  const [showComprovante, setShowComprovante] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [consumoSelecionado, setConsumoSelecionado] = useState(null);
  const [formData, setFormData] = useState({
    turno_caixa_id: '',
    destinacao: '',
    responsavel_recebimento: '',
    tags: [],
    observacoes: '',
    itens: [],
    assinatura_recolhedor_url: '',
    assinatura_recolhedor_nome: '',
    anexos_temporarios: [],
    fotos_temporarias: [],
  });
  const [novoCadastro, setNovoCadastro] = useState({ tipo: '', valor: '' });
  const [editandoConsumo, setEditandoConsumo] = useState(null);
  const anexoInputRef = useRef(null);
  const [consumoAnexoAlvo, setConsumoAnexoAlvo] = useState(null);
  const [showAnexosDialog, setShowAnexosDialog] = useState(false);
  const [anexosResumo, setAnexosResumo] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [user, turnosData, produtosData, destinacoesData, responsaveisData, consumosData] = await Promise.all([
      base44.auth.me(),
      base44.entities.TurnoCaixa.filter({ status: 'Aberto' }),
      base44.entities.Produto.list(),
      base44.entities.DestinacaoConsumoInterno.list(),
      base44.entities.ResponsavelConsumoInterno.list(),
      base44.entities.ConsumoInterno.list('-created_date'),
    ]);
    setCurrentUser(user);
    setTurnos(turnosData);
    setProdutos(produtosData.filter((item) => item.ativo !== false));
    // Não filtrar inativos — permitir escolher qualquer destinação/responsável
    setDestinacoes(destinacoesData);
    setResponsaveis(responsaveisData);
    setConsumos(consumosData);
    setFormData((prev) => ({ ...prev, turno_caixa_id: turnosData[0]?.id || '' }));
  };

  const rangeAtual = useMemo(() => {
    const agora = new Date();
    if (filtroTemporal === 'hoje') return { start: startOfDay(agora), end: endOfDay(agora) };
    if (filtroTemporal === '7d') return { start: startOfDay(subDays(agora, 6)), end: endOfDay(agora) };
    if (filtroTemporal === '30d') return { start: startOfDay(subDays(agora, 29)), end: endOfDay(agora) };
    if (filtroTemporal === 'mes') return { start: startOfMonth(agora), end: endOfDay(agora) };
    return { start: new Date(0), end: endOfDay(agora) };
  }, [filtroTemporal]);

  const consumosFiltrados = useMemo(() => {
    const term = search.toLowerCase();
    return consumos.filter((item) => {
      const dentroRange = isWithinInterval(new Date(item.created_date), rangeAtual);
      const matchSearch = !term ||
        item.numero?.toLowerCase().includes(term) ||
        item.destinacao?.toLowerCase().includes(term) ||
        item.responsavel_recebimento?.toLowerCase().includes(term);
      return dentroRange && matchSearch;
    });
  }, [consumos, search, rangeAtual]);

  const consumosAgrupadosPorDia = useMemo(() => {
    const groups = {};
    consumosFiltrados.forEach(item => {
      const dia = format(new Date(item.created_date), 'yyyy-MM-dd');
      if (!groups[dia]) groups[dia] = [];
      groups[dia].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [consumosFiltrados]);

  const totalAtual = useMemo(() => formData.itens.reduce((sum, item) => sum + (item.subtotal || 0), 0), [formData.itens]);

  const labelFiltro = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', mes: 'Este mês', tudo: 'Tudo' };

  const addItem = (novoItem) => {
    if (!novoItem?.produto_id) return;
    setFormData((prev) => ({ ...prev, itens: [...prev.itens, novoItem] }));
    setShowProdutoSelector(false);
    toast.success('Item adicionado');
  };

  const uploadAttachment = async (file, tipoDocumento, referenciaId, referenciaNumero, metadata = {}) => {
    const tag = buildAnexoMovimentoTag({
      referenciaNumero,
      interveniente: metadata.interveniente,
      destinacao: metadata.destinacao,
      observacoes: metadata.observacoes,
      usuarioNome: metadata.usuarioNome,
      createdAt: metadata.createdAt,
    });

    const arquivoFinal = file.type?.startsWith('image/') ? await renderTaggedImage(file, tag.linhas) : file;
    const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivoFinal });

    await base44.entities.AnexoDocumento.create({
      referencia_tipo: 'Outro', referencia_id: referenciaId, referencia_numero: referenciaNumero,
      tipo_documento: tipoDocumento, nome_arquivo: arquivoFinal.name, url_drive: file_url,
      mime_type: arquivoFinal.type, tamanho_bytes: arquivoFinal.size, origem: 'upload_manual', descricao: tag.texto,
    });
  };

  const handleAssinaturaConfirm = async ({ nome, file }) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData((prev) => ({ ...prev, assinatura_recolhedor_nome: nome, assinatura_recolhedor_url: file_url }));
    toast.success('Assinatura adicionada');
  };

  const handleSalvarCadastro = async () => {
    const valorNormalizado = (novoCadastro.valor || '').trim();
    if (!novoCadastro.tipo || !valorNormalizado) return;

    try {
      if (novoCadastro.tipo === 'destinacao') {
        const existente = (destinacoes || []).find(
          (item) => (item?.nome || '').trim().toLowerCase() === valorNormalizado.toLowerCase()
        );

        if (!existente) {
          await base44.entities.DestinacaoConsumoInterno.create({ nome: valorNormalizado, ativo: true });
          toast.success('Destinação cadastrada');
        } else {
          toast.info('Destinação já existente, seleção aplicada');
        }

        setFormData((prev) => ({ ...prev, destinacao: valorNormalizado }));
      }

      if (novoCadastro.tipo === 'responsavel') {
        const existente = (responsaveis || []).find(
          (item) => (item?.nome || '').trim().toLowerCase() === valorNormalizado.toLowerCase()
        );

        if (!existente) {
          await base44.entities.ResponsavelConsumoInterno.create({ nome: valorNormalizado, ativo: true });
          toast.success('Responsável cadastrado');
        } else {
          toast.info('Responsável já existente, seleção aplicada');
        }

        setFormData((prev) => ({ ...prev, responsavel_recebimento: valorNormalizado }));
      }

      setNovoCadastro({ tipo: '', valor: '' });
      await loadData();
    } catch (error) {
      toast.error('Não foi possível salvar o novo cadastro');
    }
  };

  const carregarAnexosConsumo = async (consumo) => {
    if (!consumo?.id) {
      setAnexosResumo([]);
      return;
    }

    const anexos = await base44.entities.AnexoDocumento.filter({ referencia_id: consumo.id });
    setAnexosResumo(anexos);
  };

  const handleDelete = async (consumo) => {
    if (!window.confirm(`Excluir ${consumo.numero}? Esta ação não pode ser desfeita.`)) return;
    await base44.entities.ConsumoInterno.delete(consumo.id);
    toast.success('Consumo excluído');
    loadData();
  };

  const handleAnexarDocumento = (consumo) => {
    setConsumoAnexoAlvo(consumo);
    anexoInputRef.current?.click();
  };

  const handleAnexoFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !consumoAnexoAlvo) return;
    await Promise.all(files.map(file => uploadAttachment(file, 'Comprovante', consumoAnexoAlvo.id, consumoAnexoAlvo.numero, {
      interveniente: consumoAnexoAlvo.responsavel_recebimento,
      destinacao: consumoAnexoAlvo.destinacao,
      observacoes: consumoAnexoAlvo.observacoes,
      usuarioNome: consumoAnexoAlvo.usuario_solicitante_nome,
      createdAt: consumoAnexoAlvo.created_date,
    })));
    toast.success(`${files.length} arquivo(s) anexado(s)`);
    e.target.value = '';
    setConsumoAnexoAlvo(null);
  };

  const handleEditar = (consumo) => {
    setEditandoConsumo(consumo);
    setFormData({
      turno_caixa_id: consumo.turno_caixa_id || '',
      destinacao: consumo.destinacao || '',
      responsavel_recebimento: consumo.responsavel_recebimento || '',
      tags: consumo.tags || [],
      observacoes: consumo.observacoes || '',
      itens: consumo.itens || [],
      assinatura_recolhedor_url: consumo.assinatura_recolhedor_url || '',
      assinatura_recolhedor_nome: consumo.assinatura_recolhedor_nome || '',
      anexos_temporarios: [],
      fotos_temporarias: [],
    });
    setShowForm(true);
  };

  const handleVerAnexos = async (consumo) => {
    const anexos = await base44.entities.AnexoDocumento.filter({ referencia_id: consumo.id });
    setConsumoSelecionado(consumo);
    setAnexosResumo(anexos || []);
    setShowAnexosDialog(true);
  };

  const processarAnexosEmSegundoPlano = async ({ consumoId, numero, assinaturaUrl, assinaturaNome, responsavel, destinacao, observacoes, anexos = [], fotos = [] }) => {
    if (!anexos.length && !fotos.length && !assinaturaUrl) return;

    Promise.all([
      ...anexos.map((file) => uploadAttachment(file, 'Comprovante', consumoId, numero, {
        interveniente: responsavel,
        destinacao,
        observacoes,
        usuarioNome: currentUser?.full_name || currentUser?.email,
        createdAt: new Date().toISOString(),
      })),
      ...fotos.map((file) => uploadAttachment(file, 'Outro', consumoId, numero, {
        interveniente: responsavel,
        destinacao,
        observacoes,
        usuarioNome: currentUser?.full_name || currentUser?.email,
        createdAt: new Date().toISOString(),
      })),
      ...(assinaturaUrl ? [base44.entities.AnexoDocumento.create({
        referencia_tipo: 'Outro', referencia_id: consumoId, referencia_numero: numero,
        tipo_documento: 'Contrato', nome_arquivo: `assinatura-${numero}.png`,
        url_drive: assinaturaUrl, mime_type: 'image/png',
        origem: 'upload_manual', descricao: `Assinatura do recolhedor: ${assinaturaNome}`,
      })] : []),
    ]).then(() => {
      toast.success('Anexos enviados em segundo plano');
    }).catch(() => {
      toast.error('O consumo foi salvo, mas alguns anexos não terminaram de subir');
    });
  };

  const resetFormData = () => ({
    turno_caixa_id: turnos[0]?.id || '',
    destinacao: '',
    responsavel_recebimento: '',
    tags: [],
    observacoes: '',
    itens: [],
    assinatura_recolhedor_url: '',
    assinatura_recolhedor_nome: '',
    anexos_temporarios: [],
    fotos_temporarias: [],
  });

  const fecharFormulario = () => {
    dismissConsumoOverlayHistory();
    setShowForm(false);
    setEditandoConsumo(null);
    setFormData(resetFormData());
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!podeRegistrar) {
      toast.error('Sem permissão para registrar consumo interno');
      return;
    }
    if (!formData.destinacao || !formData.responsavel_recebimento || !formData.itens.length) {
      toast.error('Preencha destinação, responsável e itens');
      return;
    }

    setIsSubmitting(true);
    try {
      const turno = turnos.find((item) => item.id === formData.turno_caixa_id);
      const payload = {
        ...formData,
        status: 'Confirmado',
        turno_caixa_numero: turno?.numero || '',
        usuario_solicitante_id: currentUser?.id,
        usuario_solicitante_nome: currentUser?.full_name || currentUser?.email,
        quantidade_total_itens: formData.itens.reduce((sum, item) => sum + (item.quantidade || 0), 0),
        valor_total: totalAtual,
        data_confirmacao: new Date().toISOString(),
      };
      let created;
      let abrirComprovante = false;

      if (editandoConsumo) {
        created = await base44.entities.ConsumoInterno.update(editandoConsumo.id, payload);
        toast.success('Consumo atualizado com sucesso');
      } else {
        const numero = await gerarNumeroSequencial('CI');
        created = await base44.entities.ConsumoInterno.create({ ...payload, numero });

        await Promise.all(formData.itens.map(async (item) => {
          await base44.entities.MovimentacaoEstoque.create({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo: 'Saída',
            motivo: 'Consumo Interno',
            quantidade: item.quantidade,
            custo_unitario: item.custo_unitario,
            referencia_tipo: 'ConsumoInterno',
            referencia_id: created.id,
            referencia_numero: numero,
            observacoes: `Consumo interno: ${formData.destinacao} — ${formData.responsavel_recebimento}`,
            usuario_responsavel: currentUser?.full_name || currentUser?.email,
          });
          const produtoAtual = produtos.find((p) => p.id === item.produto_id);
          if (produtoAtual) {
            const novoEstoque = (produtoAtual.estoque_atual || 0) - item.quantidade;
            await base44.entities.Produto.update(item.produto_id, { estoque_atual: novoEstoque });
          }
        }));

        processarAnexosEmSegundoPlano({
          consumoId: created.id,
          numero,
          assinaturaUrl: formData.assinatura_recolhedor_url,
          assinaturaNome: formData.assinatura_recolhedor_nome,
          responsavel: formData.responsavel_recebimento,
          destinacao: formData.destinacao,
          observacoes: formData.observacoes,
          anexos: formData.anexos_temporarios || [],
          fotos: formData.fotos_temporarias || [],
        });

        const consumoSalvo = { ...payload, ...created, numero: created?.numero || numero };
        setConsumoSelecionado(consumoSalvo);
        setConsumos((prev) => [consumoSalvo, ...prev.filter((item) => item.id !== consumoSalvo.id)]);
        dismissConsumoOverlayHistory();
        setShowForm(false);
        setEditandoConsumo(null);
        setFormData(resetFormData());
        setShowComprovante(true);
        toast.success('Consumo registrado! Abrindo comprovante…');
        abrirComprovante = true;
        await loadData();
      }

      if (!abrirComprovante) {
        const consumoSalvo = { ...payload, ...created };
        setConsumoSelecionado(consumoSalvo);
        setConsumos((prev) => [consumoSalvo, ...prev.filter((item) => item.id !== consumoSalvo.id)]);
        fecharFormulario();
        await loadData();
      }
    } catch (error) {
      console.error('Erro ao salvar consumo interno:', error);
      toast.error(error?.message || 'Não foi possível registrar o consumo. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const overlays = (
    <>
      <ConsumoSubmittingOverlay open={isSubmitting} />
      <ComprovanteConsumoInterno
        open={showComprovante}
        onClose={() => setShowComprovante(false)}
        consumo={consumoSelecionado}
      />
    </>
  );

  if (showForm) {
    return (
      <>
        <ConsumoInternoFormPage
          onBack={fecharFormulario}
          formData={formData}
          setFormData={setFormData}
          turnos={turnos}
          destinacoes={destinacoes}
          responsaveis={responsaveis}
          setNovoCadastro={setNovoCadastro}
          totalAtual={totalAtual}
          onOpenSelector={() => setShowProdutoSelector(true)}
          currentUser={currentUser}
          onOpenAssinatura={() => setShowAssinatura(true)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
        <Dialog open={!!novoCadastro.tipo} onOpenChange={() => setNovoCadastro({ tipo: '', valor: '' })}>
          <DialogContent overlayClassName={CONSUMO_FORM_OVERLAY_Z} className={`${CONSUMO_FORM_DIALOG_CONTENT_Z} max-w-sm rounded-[28px] border-0 bg-card p-5 shadow-2xl dark:bg-background`}>
            <div className="space-y-4">
              <p className="text-lg font-semibold text-foreground">Novo cadastro interno</p>
              <Input value={novoCadastro.valor} onChange={(e) => setNovoCadastro((prev) => ({ ...prev, valor: e.target.value }))} placeholder={novoCadastro.tipo === 'destinacao' ? 'Nome da destinação' : 'Nome do responsável'} className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-muted" />
              <Button onClick={handleSalvarCadastro} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        <AssinaturaConsumoDialog open={showAssinatura} onOpenChange={setShowAssinatura} onConfirm={handleAssinaturaConfirm} />
        <ConsumoProdutoSelectorPDV open={showProdutoSelector} onOpenChange={setShowProdutoSelector} produtos={produtos} onAddItem={addItem} />
        {overlays}
      </>
    );
  }

  return (
    <>
      <ConsumoInternoPainelInicial
        filtroTemporal={filtroTemporal}
        setFiltroTemporal={setFiltroTemporal}
        labelFiltro={labelFiltro}
        consumosFiltrados={consumosFiltrados}
        search={search}
        setSearch={setSearch}
        consumosAgrupadosPorDia={consumosAgrupadosPorDia}
        onRefresh={loadData}
        onView={async (item) => {
          if (!podeVerHistorico) {
            toast.error('Sem permissão para visualizar histórico');
            return;
          }
          setConsumoSelecionado(item);
          setShowResumo(true);
          await carregarAnexosConsumo(item);
        }}
        onViewAttachments={async (item) => {
          if (!podeAnexos) {
            toast.error('Sem permissão para ver anexos');
            return;
          }
          await handleVerAnexos(item);
        }}
        onEdit={(item) => {
          if (!podeRegistrar) {
            toast.error('Sem permissão para editar consumo');
            return;
          }
          handleEditar(item);
        }}
        onAttach={(item) => {
          if (!podeAnexos) {
            toast.error('Sem permissão para anexar documentos');
            return;
          }
          handleAnexarDocumento(item);
        }}
        onDelete={(item) => {
          if (!podeRegistrar) {
            toast.error('Sem permissão para excluir consumo');
            return;
          }
          handleDelete(item);
        }}
        onNovoFormulario={() => {
          if (!podeRegistrar) {
            toast.error('Sem permissão para registrar consumo interno');
            return;
          }
          setShowForm(true);
        }}
        podeRegistrar={podeRegistrar}
        podeVerHistorico={podeVerHistorico}
        podeAnexos={podeAnexos}
      />

      <input ref={anexoInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleAnexoFileChange} />
      <ConsumoResumoDialog open={showResumo} onOpenChange={setShowResumo} consumo={consumoSelecionado} anexos={anexosResumo} />
      <ConsumoAnexosDialog open={showAnexosDialog} onOpenChange={setShowAnexosDialog} anexos={anexosResumo} consumoNumero={consumoSelecionado?.numero} />
      {overlays}
    </>
  );
}