import React, { useState, useEffect, useRef } from 'react';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, CheckCircle, AlertCircle, Loader2, Camera, Upload, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ConferenciaVolumes() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const codigo = searchParams.get('codigo');

  const [manifesto, setManifesto] = useState(null);
  const [conferente, setConferente] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [volumes, setVolumes] = useState([]);
  const [finalizando, setFinalizando] = useState(false);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [uploadandoMidia, setUploadandoMidia] = useState(false);
  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const [divergencias, setDivergencias] = useState([]);
  const [senha, setSenha] = useState('');
  const [foto, setFoto] = useState(null);
  const [etapaFinal, setEtapaFinal] = useState('analise'); // analise, senha, foto
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!codigo) {
      navigate('/ConferenciaEntrada');
      return;
    }
    carregarDados();

    // Expirar código ao sair da página
    return () => {
      if (manifesto && manifesto.status_codigo_conferencia_volumes === 'Em Uso') {
        base44.entities.Supermanifesto.update(manifesto.id, {
          status_codigo_conferencia_volumes: 'Expirado'
        }).catch(err => console.error('Erro ao expirar código:', err));
      }
    };
  }, [codigo]);

  const carregarDados = async () => {
    try {
      const response = await base44.functions.invoke('validateConferenceCode', { codigo });
      
      if (!response.data.success) {
        toast.error(response.data.error || 'Código inválido');
        navigate('/ConferenciaEntrada');
        return;
      }

      if (response.data.tipo !== 'volumes') {
        toast.error('Este código é para conferência de itens');
        navigate('/ConferenciaEntrada');
        return;
      }

      const manifestoData = response.data.manifesto;
      setManifesto(manifestoData);
      setConferente(response.data.conferente);

      // Inicializar volumes com descrições esperadas mas quantidades vazias (cega)
      let volumesIniciais = [];
      if (manifestoData.volumes && manifestoData.volumes.length > 0) {
        volumesIniciais = manifestoData.volumes.map(v => ({
          descricao: v.descricao,
          quantidade: '',
          quantidadeEsperada: v.quantidade
        }));
        setVolumes(volumesIniciais);
      } else {
        // Fallback caso não tenha volumes cadastrados
        volumesIniciais = [{ descricao: 'Volumes diversos', quantidade: '' }];
        setVolumes(volumesIniciais);
      }
      
      console.log('Volumes carregados:', manifestoData.volumes);
      console.log('Volumes state:', volumesIniciais);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
      navigate('/ConferenciaEntrada');
    } finally {
      setCarregando(false);
    }
  };

  const handleAddVolume = () => {
    setVolumes([...volumes, { descricao: '', quantidade: '' }]);
  };

  const handleRemoveVolume = (index) => {
    if (volumes.length > 1) {
      setVolumes(volumes.filter((_, i) => i !== index));
    }
  };

  const handleVolumeChange = (index, field, value) => {
    const novosVolumes = [...volumes];
    novosVolumes[index][field] = value;
    setVolumes(novosVolumes);
  };

  const handleAdicionarOcorrencia = () => {
    setOcorrencias([...ocorrencias, { descricao: '', midias: [] }]);
  };

  const handleOcorrenciaChange = (index, value) => {
    const novasOcorrencias = [...ocorrencias];
    novasOcorrencias[index].descricao = value;
    setOcorrencias(novasOcorrencias);
  };

  const handleUploadMidia = async (index, file) => {
    try {
      setUploadandoMidia(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const novasOcorrencias = [...ocorrencias];
      novasOcorrencias[index].midias.push(file_url);
      setOcorrencias(novasOcorrencias);
      
      toast.success('Mídia adicionada');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadandoMidia(false);
    }
  };

  const handleRemoverOcorrencia = (index) => {
    setOcorrencias(ocorrencias.filter((_, i) => i !== index));
  };

  const detectarDivergencias = () => {
    const diverg = [];
    const volumesValidos = volumes.filter(v => v.descricao.trim() && v.quantidade);

    // Verificar divergências de quantidade
    volumesValidos.forEach(v => {
      const esperado = v.quantidadeEsperada || 0;
      const conferido = parseFloat(v.quantidade) || 0;
      
      if (esperado !== conferido) {
        diverg.push({
          tipo: 'volume',
          descricao: v.descricao,
          esperado,
          conferido,
          diferenca: conferido - esperado
        });
      }
    });

    // Verificar ocorrências
    const ocorrenciasValidas = ocorrencias.filter(o => o.descricao.trim());
    if (ocorrenciasValidas.length > 0) {
      diverg.push({
        tipo: 'ocorrencia',
        quantidade: ocorrenciasValidas.length,
        descricao: 'Ocorrências registradas durante a conferência'
      });
    }

    return diverg;
  };

  const handleFinalizar = async () => {
    // Validar
    const volumesValidos = volumes.filter(v => v.descricao.trim() && v.quantidade);
    if (volumesValidos.length === 0) {
      toast.error('Adicione pelo menos um volume');
      return;
    }

    // Detectar divergências
    const diverg = detectarDivergencias();
    setDivergencias(diverg);
    setModalConfirmacao(true);
    setEtapaFinal('analise');
  };

  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      toast.error('Não foi possível acessar a câmera');
    }
  };

  const tirarFoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        try {
          const file = new File([blob], 'conferente_foto.jpg', { type: 'image/jpeg' });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setFoto(file_url);
          
          // Parar a câmera
          const stream = video.srcObject;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (error) {
          console.error('Erro ao enviar foto:', error);
          toast.error('Erro ao enviar foto');
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const finalizarConferencia = async () => {
    try {
      setFinalizando(true);

      const volumesValidos = volumes.filter(v => v.descricao.trim() && v.quantidade);
      const volumesConferidos = volumesValidos.map(v => ({
        descricao: v.descricao.trim(),
        quantidade: parseFloat(v.quantidade)
      }));

      const temDivergencias = divergencias.length > 0;

      // Hash da senha (simplificado - em produção use bcrypt)
      const senhaHash = btoa(senha);

      // Atualizar supermanifesto
      await base44.entities.Supermanifesto.update(manifesto.id, {
        volumes_conferidos: volumesConferidos,
        ocorrencias_conferencia: ocorrencias.filter(o => o.descricao.trim()),
        data_conferencia_volumes: new Date().toISOString(),
        conferente_volumes_id: conferente.id,
        conferente_volumes_nome: conferente.full_name,
        conferente_volumes_senha_hash: senhaHash,
        conferente_volumes_foto: foto,
        tem_divergencias: temDivergencias,
        status_codigo_conferencia_volumes: 'Concluído',
        status: 'Recebido'
      });

      // Gerar relatório
      await base44.functions.invoke('gerarRelatorioConferencia', {
        supermanifesto_id: manifesto.id
      });

      toast.success('Conferência finalizada com sucesso!');
      navigate('/ConferenciaEntrada');
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao finalizar conferência');
    } finally {
      setFinalizando(false);
    }
  };

  const handleAvancarEtapa = () => {
    if (etapaFinal === 'analise') {
      setEtapaFinal('senha');
    } else if (etapaFinal === 'senha') {
      if (!senha) {
        toast.error('Digite sua senha para autenticar');
        return;
      }
      setEtapaFinal('foto');
      setTimeout(() => iniciarCamera(), 100);
    } else if (etapaFinal === 'foto') {
      if (!foto) {
        toast.error('Tire uma foto para finalizar');
        return;
      }
      finalizarConferencia();
    }
  };

  const handleRecontar = () => {
    setModalConfirmacao(false);
    setSenha('');
    setFoto(null);
    setEtapaFinal('analise');
    toast.info('Revise as quantidades e confira novamente');
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-din-1451 p-4 md:p-6 pb-[var(--p38-scroll-pad-below-nav)]">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
              <Package className="w-7 h-7 text-foreground/90" />
            </div>
        <P38PageHeader
          variant="page"
          title="Conferência de Volumes"
          description="Registre os volumes recebidos"
        />
          </div>

          <div className="bg-muted/40 border border-border/40 dark:border-white/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Conferência Cega de Quantidade</p>
                <p className="text-xs text-muted-foreground">
                  Os tipos de volumes esperados estão listados abaixo. Informe a quantidade REAL recebida de cada tipo sem consultar documentos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário de Volumes */}
        <div className="rounded-lg border border-border/40 dark:border-white/10 bg-background overflow-hidden">
          {volumes.map((volume, index) => (
            <div key={index} className="border-b border-border/50 dark:border-white/10 p-4 last:border-b-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 block">
                      Tipo de Volume
                    </label>
                    <div className="bg-muted dark:bg-muted rounded-lg px-4 h-11 flex items-center text-foreground/90 font-medium">
                      {volume.descricao || 'Volume sem descrição'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 block">
                      Quantidade Recebida
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Informe a quantidade"
                      value={volume.quantidade}
                      onChange={(e) => handleVolumeChange(index, 'quantidade', e.target.value)}
                      className="bg-background border-0 shadow-sm h-11"
                      autoFocus={index === 0}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>

        {/* Ocorrências */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/90">OCORRÊNCIAS (OPCIONAL)</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAdicionarOcorrencia}
              className="text-muted-foreground"
            >
              <Camera className="w-4 h-4 mr-1" />
              Registrar Ocorrência
            </Button>
          </div>

          {ocorrencias.map((ocorrencia, index) => (
            <div key={index} className="bg-card rounded-xl shadow-sm p-4 space-y-3">
              <Textarea
                placeholder="Descreva a ocorrência (ex: Caixa avariada, volume faltando...)"
                value={ocorrencia.descricao}
                onChange={(e) => handleOcorrenciaChange(index, e.target.value)}
                className="bg-background border-0 shadow-sm min-h-[80px]"
              />
              
              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleUploadMidia(index, e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    disabled={uploadandoMidia}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={uploadandoMidia}
                    onClick={(e) => e.currentTarget.previousElementSibling.click()}
                  >
                    {uploadandoMidia ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Adicionar Foto/Vídeo
                  </Button>
                </label>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoverOcorrencia(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Remover
                </Button>
              </div>

              {ocorrencia.midias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ocorrencia.midias.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted dark:bg-muted">
                      <img src={url} alt="Evidência" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="bg-card rounded-2xl shadow-lg p-6">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/ConferenciaEntrada')}
              className="flex-1 h-12 border-0 shadow-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalizar}
              disabled={finalizando}
              className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground shadow-lg"
            >
              {finalizando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Finalizar Conferência
                </>
              )}
            </Button>
          </div>
        </div>
        </div>

        {/* Modal de Confirmação */}
        <Dialog open={modalConfirmacao} onOpenChange={setModalConfirmacao}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {divergencias.length === 0 ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  CONFERÊNCIA EM ORDEM
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  CONFERÊNCIA COM DIVERGÊNCIAS
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {etapaFinal === 'analise' && (
            <div className="space-y-4">
              {divergencias.length === 0 ? (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Todos os volumes conferidos estão de acordo com o esperado e não há ocorrências registradas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
                      Foram identificadas {divergencias.length} divergência(s):
                    </p>
                    <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                      {divergencias.filter(d => d.tipo === 'volume').map((div, idx) => (
                        <li key={idx}>
                          • {div.descricao}: Esperado {div.esperado}, Conferido {div.conferido}
                          {div.diferenca > 0 ? ` (+${div.diferenca})` : ` (${div.diferenca})`}
                        </li>
                      ))}
                      {divergencias.filter(d => d.tipo === 'ocorrencia').map((div, idx) => (
                        <li key={idx}>
                          • {div.quantidade} ocorrência(s) registrada(s)
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Você pode salvar com divergências ou recontar os volumes.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {divergencias.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleRecontar}
                    className="flex-1"
                  >
                    Recontar
                  </Button>
                )}
                <Button
                  onClick={handleAvancarEtapa}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground"
                >
                  {divergencias.length > 0 ? 'Salvar com Divergências' : 'Prosseguir'}
                </Button>
              </div>
            </div>
          )}

          {etapaFinal === 'senha' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Digite sua senha para autenticar a conferência.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 block">
                  Senha
                </label>
                <Input
                  type="password"
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEtapaFinal('analise')}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleAvancarEtapa}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Avançar
                </Button>
              </div>
            </div>
          )}

          {etapaFinal === 'foto' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Tire uma foto para registrar a conferência.
                </p>
              </div>

              {!foto ? (
                <div className="space-y-3">
                  <div className="relative bg-background rounded-xl overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    onClick={tirarFoto}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Tirar Foto
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative bg-muted dark:bg-muted rounded-xl overflow-hidden aspect-video">
                    <img src={foto} alt="Foto do conferente" className="w-full h-full object-cover" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFoto(null);
                      setTimeout(() => iniciarCamera(), 100);
                    }}
                    className="w-full"
                  >
                    Tirar Novamente
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEtapaFinal('senha')}
                  disabled={finalizando}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleAvancarEtapa}
                  disabled={finalizando || !foto}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {finalizando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Finalizar Conferência
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
        </Dialog>

        <canvas ref={canvasRef} className="hidden" />
        </div>
        );
        }