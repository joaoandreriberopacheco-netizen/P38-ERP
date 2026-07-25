import React, { useState } from 'react';
import { ProtocoloEntrega } from '@/entities/ProtocoloEntrega';
import { PedidoVenda } from '@/entities/PedidoVenda';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Pen, Camera, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function ConfirmarEntrega({ pedido, open, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nome_recebedor: '',
    documento_recebedor: '',
    observacoes: ''
  });
  const [assinaturaFile, setAssinaturaFile] = useState(null);
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAssinaturaMenu, setShowAssinaturaMenu] = useState(false);
  const [showComprovanteMenu, setShowComprovanteMenu] = useState(false);
  const { toast } = useToast();

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAssinaturaOption = (option) => {
    setShowAssinaturaMenu(false);
    const input = document.createElement('input');
    input.type = 'file';
    
    if (option === 'camera') {
      input.setAttribute('capture', 'environment');
      input.accept = 'image/*';
    } else if (option === 'desenhar') {
      // Aqui você pode implementar um canvas para desenhar
      toast({
        title: "Funcionalidade em breve",
        description: "Assinatura digital com caneta será implementada em breve",
        className: "bg-blue-100 text-blue-800"
      });
      return;
    } else if (option === 'galeria') {
      input.accept = 'image/*';
    }
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setAssinaturaFile(file);
        toast({
          title: "Arquivo selecionado",
          description: file.name,
          className: "bg-green-100 text-green-800"
        });
      }
    };
    
    input.click();
  };

  const handleComprovanteOption = (option) => {
    setShowComprovanteMenu(false);
    const input = document.createElement('input');
    input.type = 'file';
    
    if (option === 'camera') {
      input.setAttribute('capture', 'environment');
      input.accept = 'image/*,video/*';
    } else if (option === 'galeria') {
      input.accept = 'image/*,video/*';
    } else if (option === 'arquivo') {
      input.accept = '*/*';
    }
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setComprovanteFile(file);
        toast({
          title: "Arquivo selecionado",
          description: file.name,
          className: "bg-green-100 text-green-800"
        });
      }
    };
    
    input.click();
  };

  const handleConfirmar = async () => {
    setIsProcessing(true);
    try {
      const currentUser = await base44.auth.me();
      
      // 1. Upload da assinatura (se houver)
      let assinaturaUrl = null;
      if (assinaturaFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: assinaturaFile });
        assinaturaUrl = file_url;
      }

      // 2. Upload do comprovante (se houver)
      let comprovanteUrl = null;
      if (comprovanteFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: comprovanteFile });
        comprovanteUrl = file_url;
      }

      // 3. Criar protocolo de entrega
      await ProtocoloEntrega.create({
        pedido_venda_id: pedido.id,
        pedido_numero: pedido.numero,
        tipo_entrega: pedido.metodo_entrega || 'Retirada na Loja',
        cliente_nome: pedido.cliente_nome,
        responsavel_entrega_id: currentUser.id,
        responsavel_entrega_nome: currentUser.full_name,
        data_hora_entrega: new Date().toISOString(),
        nome_recebedor: formData.nome_recebedor,
        documento_recebedor: formData.documento_recebedor,
        assinatura_url: assinaturaUrl,
        foto_comprovante_url: comprovanteUrl,
        observacoes: formData.observacoes
      });

      // 4. Atualizar status do pedido para Finalizado
      await PedidoVenda.update(pedido.id, {
        status: 'Finalizado'
      });

      toast({
        title: "Entrega confirmada!",
        description: "O protocolo de entrega foi registrado com sucesso.",
        className: "bg-green-100 text-green-800"
      });

      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      toast({
        title: "Erro ao confirmar entrega",
        description: error.message,
        variant: "destructive"
      });
    }
    setIsProcessing(false);
  };

  const formatValor = (valor) => {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-screen m-0 p-0 rounded-none sm:rounded-lg sm:h-auto sm:max-h-[90vh]">
        <div className="flex flex-col h-full bg-card">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[10px] text-muted-foreground">EXPEDIÇÃO</p>
              <p className="text-sm font-bold">Confirmar Entrega: {pedido?.numero}</p>
            </div>
            <button onClick={onClose} className="text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Info do Pedido */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-900 font-semibold">Cliente:</span>
                <span className="text-blue-900">{pedido?.cliente_nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-900 font-semibold">Valor Total:</span>
                <span className="text-blue-900 font-bold">R$ {formatValor(pedido?.valor_total)}</span>
              </div>
            </div>

            {/* Nome do Recebedor */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Nome de Quem Recebeu *</Label>
              <Input 
                value={formData.nome_recebedor}
                onChange={(e) => handleChange('nome_recebedor', e.target.value)}
                placeholder="Nome completo"
                className="h-10"
              />
            </div>

            {/* Documento */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">CPF/RG de Quem Recebeu</Label>
              <Input 
                value={formData.documento_recebedor}
                onChange={(e) => handleChange('documento_recebedor', e.target.value)}
                placeholder="Documento (opcional)"
                className="h-10"
              />
            </div>

            {/* Assinatura - Estilo WhatsApp */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Assinatura Digital ou Foto</Label>
              <div className="relative">
                <Input 
                  value={assinaturaFile?.name || ''}
                  placeholder="Anexar assinatura..."
                  className="h-10 pr-32"
                  readOnly
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAssinaturaMenu(!showAssinaturaMenu)}
                    className="p-2 bg-muted rounded-md hover:bg-muted transition"
                  >
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                
                {showAssinaturaMenu && (
                  <div className="absolute right-0 top-12 bg-card border rounded-lg shadow-lg z-10 overflow-hidden">
                    <button
                      onClick={() => handleAssinaturaOption('camera')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left"
                    >
                      <Camera className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold">Câmera</p>
                        <p className="text-xs text-muted-foreground">Tirar foto</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAssinaturaOption('galeria')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left border-t"
                    >
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-semibold">Galeria</p>
                        <p className="text-xs text-muted-foreground">Escolher foto</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAssinaturaOption('desenhar')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left border-t"
                    >
                      <Pen className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold">Desenhar</p>
                        <p className="text-xs text-muted-foreground">Assinatura digital</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              {assinaturaFile && (
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Arquivo anexado</span>
                </div>
              )}
            </div>

            {/* Comprovante - Foto/Vídeo/Arquivo */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Comprovante Fotográfico (Opcional)</Label>
              <div className="relative">
                <Input 
                  value={comprovanteFile?.name || ''}
                  placeholder="Anexar foto, vídeo ou arquivo..."
                  className="h-10 pr-32"
                  readOnly
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setShowComprovanteMenu(!showComprovanteMenu)}
                    className="p-2 bg-muted rounded-md hover:bg-muted transition"
                  >
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                
                {showComprovanteMenu && (
                  <div className="absolute right-0 top-12 bg-card border rounded-lg shadow-lg z-10 overflow-hidden">
                    <button
                      onClick={() => handleComprovanteOption('camera')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left"
                    >
                      <Camera className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold">Câmera</p>
                        <p className="text-xs text-muted-foreground">Foto ou vídeo</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleComprovanteOption('galeria')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left border-t"
                    >
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-semibold">Galeria</p>
                        <p className="text-xs text-muted-foreground">Escolher mídia</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleComprovanteOption('arquivo')}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 w-full text-left border-t"
                    >
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">Arquivo</p>
                        <p className="text-xs text-muted-foreground">Qualquer tipo</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              {comprovanteFile && (
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Arquivo anexado</span>
                </div>
              )}
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">Observações</Label>
              <Textarea 
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações sobre a entrega..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-3 grid grid-cols-2 gap-2 flex-shrink-0">
            <Button variant="outline" onClick={onClose} className="h-11">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmar} 
              disabled={isProcessing || !formData.nome_recebedor}
              className="bg-green-600 hover:bg-green-700 h-11"
            >
              {isProcessing ? 'Processando...' : 'Confirmar Entrega'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}