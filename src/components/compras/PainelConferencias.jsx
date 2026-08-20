import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText, 
  RefreshCw,
  Loader2,
  Camera,
  Eye,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function PainelConferencias() {
  const [supermanifestos, setSupermanifestos] = useState([]);
  const [manifetosEntrada, setManifestosEntrada] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalReabertura, setModalReabertura] = useState(false);
  const [manifestoSelecionado, setManifestoSelecionado] = useState(null);
  const [senha, setSenha] = useState('');
  const [foto, setFoto] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [sms, mes] = await Promise.all([
        base44.entities.Supermanifesto.list(),
        base44.entities.ManifestoEntrada.list()
      ]);
      setSupermanifestos(sms);
      setManifestosEntrada(mes);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar conferências');
    } finally {
      setCarregando(false);
    }
  };

  const smNaoIniciados = supermanifestos.filter(
    sm => sm.status_codigo_conferencia_volumes === 'Gerado'
  );

  const smFinalizados = supermanifestos.filter(
    sm => sm.status_codigo_conferencia_volumes === 'Concluído'
  );

  const meNaoIniciados = manifetosEntrada.filter(
    me => me.status_codigo_conferencia_itens === 'Gerado'
  );

  const meFinalizados = manifetosEntrada.filter(
    me => me.status_codigo_conferencia_itens === 'Concluído'
  );

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
          const file = new File([blob], 'responsavel_foto.jpg', { type: 'image/jpeg' });
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setFoto(file_url);
          
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

  const handleReabrir = async () => {
    if (!senha || !foto) {
      toast.error('Senha e foto são obrigatórios');
      return;
    }

    try {
      setProcessando(true);
      const senhaHash = btoa(senha);

      await base44.entities.Supermanifesto.update(manifestoSelecionado.id, {
        status_codigo_conferencia_volumes: 'Gerado',
        reabertura_responsavel: await base44.auth.me().then(u => u.full_name),
        reabertura_senha_hash: senhaHash,
        reabertura_foto: foto,
        reabertura_data: new Date().toISOString()
      });

      toast.success('Conferência reaberta com sucesso');
      setModalReabertura(false);
      setSenha('');
      setFoto(null);
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao reabrir conferência');
    } finally {
      setProcessando(false);
    }
  };

  const abrirModalReabertura = (manifesto) => {
    setManifestoSelecionado(manifesto);
    setModalReabertura(true);
    setSenha('');
    setFoto(null);
  };

  const abrirDetalhes = (manifesto) => {
    setManifestoSelecionado(manifesto);
    setModalDetalhes(true);
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="volumes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="volumes">CONFERÊNCIA DE VOLUMES</TabsTrigger>
          <TabsTrigger value="itens">CONFERÊNCIA DE ITENS</TabsTrigger>
        </TabsList>

        <TabsContent value="volumes" className="space-y-6">
          {/* Não Iniciadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              NÃO INICIADAS ({smNaoIniciados.length})
            </h3>
            {smNaoIniciados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conferência pendente</p>
            ) : (
              <div className="grid gap-3">
                {smNaoIniciados.map(sm => (
                  <div key={sm.id} className="bg-card rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {sm.numero}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {sm.transportadora_nome}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Código: {sm.codigo_conferencia_volumes}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        AGUARDANDO
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Finalizadas */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              FINALIZADAS ({smFinalizados.length})
            </h3>
            {smFinalizados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conferência finalizada</p>
            ) : (
              <div className="grid gap-3">
                {smFinalizados.map(sm => (
                  <div key={sm.id} className="bg-card rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {sm.numero}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {sm.transportadora_nome}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Conferente: {sm.conferente_volumes_nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Data: {sm.data_conferencia_volumes ? new Date(sm.data_conferencia_volumes).toLocaleString('pt-BR') : '-'}
                        </p>
                      </div>
                      <Badge className={sm.tem_divergencias 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      }>
                        {sm.tem_divergencias ? 'COM DIVERGÊNCIAS' : 'OK'}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirDetalhes(sm)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        VER DETALHES
                      </Button>
                      {sm.relatorio_conferencia_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(sm.relatorio_conferencia_url, '_blank')}
                          className="flex-1"
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          RELATÓRIO
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirModalReabertura(sm)}
                        className="text-amber-600 hover:text-amber-700"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="itens" className="space-y-6">
          {/* Similar para itens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              NÃO INICIADAS ({meNaoIniciados.length})
            </h3>
            {meNaoIniciados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conferência pendente</p>
            ) : (
              <div className="grid gap-3">
                {meNaoIniciados.map(me => (
                  <div key={me.id} className="bg-card rounded-xl shadow-sm p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {me.numero}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Código: {me.codigo_conferencia_itens}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        AGUARDANDO
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Reabertura */}
      <Dialog open={modalReabertura} onOpenChange={setModalReabertura}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              REABRIR CONFERÊNCIA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Esta ação reabrirá a conferência para correção. Digite sua senha e tire uma foto para autenticar.
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 block">
                SENHA
              </label>
              <Input
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="bg-background"
              />
            </div>

            {!foto ? (
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold block">
                  FOTO
                </label>
                <div className="relative bg-background rounded-xl overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={iniciarCamera}
                    variant="outline"
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    INICIAR CÂMERA
                  </Button>
                  <Button
                    onClick={tirarFoto}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    CAPTURAR
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold block">
                  FOTO CAPTURADA
                </label>
                <div className="relative bg-muted dark:bg-muted rounded-xl overflow-hidden aspect-video">
                  <img src={foto} alt="Responsável" className="w-full h-full object-cover" />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFoto(null);
                    setTimeout(() => iniciarCamera(), 100);
                  }}
                  className="w-full"
                >
                  TIRAR NOVAMENTE
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setModalReabertura(false)}
                disabled={processando}
                className="flex-1"
              >
                CANCELAR
              </Button>
              <Button
                onClick={handleReabrir}
                disabled={processando || !senha || !foto}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {processando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    REABRIR
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={modalDetalhes} onOpenChange={setModalDetalhes}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DETALHES DA CONFERÊNCIA</DialogTitle>
          </DialogHeader>

          {manifestoSelecionado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">SUPERMANIFESTO</p>
                  <p className="font-medium text-foreground">{manifestoSelecionado.numero}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">STATUS</p>
                  <Badge className={manifestoSelecionado.tem_divergencias 
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                  }>
                    {manifestoSelecionado.tem_divergencias ? 'COM DIVERGÊNCIAS' : 'OK'}
                  </Badge>
                </div>
              </div>

              {manifestoSelecionado.volumes_conferidos && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground/90">VOLUMES CONFERIDOS</p>
                  <div className="bg-background rounded-lg p-3 space-y-2">
                    {manifestoSelecionado.volumes_conferidos.map((v, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-foreground/90">{v.descricao}</span>
                        <span className="font-medium text-foreground">{v.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {manifestoSelecionado.ocorrencias_conferencia && manifestoSelecionado.ocorrencias_conferencia.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground/90">OCORRÊNCIAS</p>
                  <div className="space-y-2">
                    {manifestoSelecionado.ocorrencias_conferencia.map((o, idx) => (
                      <div key={idx} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                        <p className="text-sm text-amber-900 dark:text-amber-200">{o.descricao}</p>
                        {o.midias && o.midias.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {o.midias.map((url, i) => (
                              <img key={i} src={url} alt="Evidência" className="w-16 h-16 rounded object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {manifestoSelecionado.conferente_volumes_foto && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground/90">FOTO DO CONFERENTE</p>
                  <img 
                    src={manifestoSelecionado.conferente_volumes_foto} 
                    alt="Conferente" 
                    className="w-32 h-32 rounded-lg object-cover"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}