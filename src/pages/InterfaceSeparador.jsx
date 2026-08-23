import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  CheckCircle, 
  Package, 
  User, 
  MapPin,
  Truck,
  AlertCircle,
  Clock,
  Camera,
  X
} from 'lucide-react';
import { P38MobileLineList, P38MobileLine, P38StatusLabel } from '@/components/ui/p38-mobile-line';
export default function InterfaceSeparador() {
  const queryClient = useQueryClient();
  const [qrInput, setQrInput] = useState('');
  const [pedidoAtual, setPedidoAtual] = useState(null);
  const [clienteAtual, setClienteAtual] = useState(null);
  const [itensSeparados, setItensSeparados] = useState([]);
  const [erro, setErro] = useState('');
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const scannerRef = useRef(null);

  const buscarPedidoMutation = useMutation({
    mutationFn: async (pedidoId) => {
      const pedido = await base44.entities.PedidoVenda.get(pedidoId);
      if (!pedido) throw new Error('Pedido não encontrado');
      
      if (pedido.cliente_id) {
        const cliente = await base44.entities.Terceiro.get(pedido.cliente_id);
        setClienteAtual(cliente);
      }
      
      return pedido;
    },
    onSuccess: (pedido) => {
      setPedidoAtual(pedido);
      setItensSeparados([]);
      setErro('');
      
      // Atualizar status para "Em Separação"
      if (pedido.status !== 'Em Separação') {
        atualizarStatusMutation.mutate({ pedidoId: pedido.id, novoStatus: 'Em Separação' });
      }
    },
    onError: (error) => {
      setErro('Pedido não encontrado');
      setPedidoAtual(null);
      setClienteAtual(null);
    }
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, novoStatus }) => {
      return await base44.entities.PedidoVenda.update(pedidoId, { status: novoStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-entrega'] });
    }
  });

  const handleScanQR = (e) => {
    e.preventDefault();
    if (qrInput.trim()) {
      buscarPedidoMutation.mutate(qrInput.trim());
      setQrInput('');
    }
  };

  const iniciarScanner = () => {
    setScannerAtivo(true);
  };

  const pararScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScannerAtivo(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      if (!scannerAtivo || scannerRef.current) return;

      const { Html5QrcodeScanner } = await import('html5-qrcode');
      if (cancelled) return;

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          buscarPedidoMutation.mutate(decodedText);
          pararScanner();
        },
        () => {
          /* ignora erros de scan contínuo */
        }
      );

      scannerRef.current = scanner;
    }

    if (scannerAtivo) {
      startScanner();
    }

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [scannerAtivo, buscarPedidoMutation]);

  const handleMarcarItem = (index) => {
    if (itensSeparados.includes(index)) {
      setItensSeparados(itensSeparados.filter(i => i !== index));
    } else {
      setItensSeparados([...itensSeparados, index]);
    }
  };

  const handleFinalizarSeparacao = async () => {
    if (itensSeparados.length !== pedidoAtual.itens.length) {
      setErro('Separe todos os itens antes de finalizar');
      return;
    }

    const novoStatus = pedidoAtual.metodo_entrega === 'Delivery' 
      ? 'Em Rota de Entrega'
      : 'Aguardando Retirada';

    await atualizarStatusMutation.mutateAsync({ 
      pedidoId: pedidoAtual.id, 
      novoStatus 
    });

    setPedidoAtual(null);
    setClienteAtual(null);
    setItensSeparados([]);
    setErro('');
  };

  const formatValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const progressoSeparacao = pedidoAtual 
    ? (itensSeparados.length / pedidoAtual.itens.length) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">SEPARAÇÃO DE PEDIDOS</h1>
          <p className="text-sm text-muted-foreground">ESCANEIE O QR CODE PARA INICIAR</p>
        </div>

        {/* Scanner QR */}
        <Card className="shadow-lg">
          <CardContent className="p-6">
            {!scannerAtivo ? (
              <form onSubmit={handleScanQR} className="space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <QrCode className="w-10 h-10 text-muted-foreground" />
                  </div>
                </div>
                
                <Button
                  type="button"
                  onClick={iniciarScanner}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  <Camera className="w-5 h-5" />
                  ESCANEAR QR CODE
                </Button>

                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="text-xs text-muted-foreground">OU</span>
                  <div className="flex-1 h-px bg-muted" />
                </div>
                
                <div className="relative">
                  <Input
                    data-pulse-sensor="interface-separador.codigo-pedido"
                    placeholder="DIGITE O CÓDIGO DO PEDIDO"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    className="text-center text-lg h-14"
                  />
                </div>

                {erro && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>
                  </div>
                )}

                <Button type="submit" className="w-full h-12" disabled={buscarPedidoMutation.isPending}>
                  {buscarPedidoMutation.isPending ? 'BUSCANDO...' : 'INICIAR SEPARAÇÃO'}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground/90">
                    POSICIONE O QR CODE NA CÂMERA
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={pararScanner}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div id="qr-reader" className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pedido em Separação */}
        {pedidoAtual && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Info do Pedido */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {pedidoAtual.numero}
                    </h2>
                    {pedidoAtual.senha_atendimento && (
                      <p className="text-sm text-muted-foreground">SENHA: {pedidoAtual.senha_atendimento}</p>
                    )}
                  </div>
                  <Badge className={pedidoAtual.metodo_entrega === 'Delivery' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                    {pedidoAtual.metodo_entrega === 'Delivery' ? (
                      <>
                        <Truck className="w-3 h-3 mr-1" />
                        DELIVERY
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3 h-3 mr-1" />
                        RETIRADA
                      </>
                    )}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span className="font-medium">{pedidoAtual.cliente_nome}</span>
                  </div>
                  
                  {clienteAtual?.telefone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">📞</span>
                      <span>{clienteAtual.telefone}</span>
                    </div>
                  )}

                  {pedidoAtual.metodo_entrega === 'Delivery' && clienteAtual?.endereco && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <div className="text-xs">
                        <p>{clienteAtual.endereco}</p>
                        <p>
                          {clienteAtual.bairro && `${clienteAtual.bairro} - `}
                          {clienteAtual.cidade && `${clienteAtual.cidade}`}
                          {clienteAtual.estado && `/${clienteAtual.estado}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progresso */}
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground/90">
                    PROGRESSO DA SEPARAÇÃO
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {itensSeparados.length}/{pedidoAtual.itens.length}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-green-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progressoSeparacao}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lista de Itens */}
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">ITENS PARA SEPARAR</h3>
                <P38MobileLineList>
                  {pedidoAtual.itens.map((item, index) => {
                    const separado = itensSeparados.includes(index);
                    return (
                      <P38MobileLine
                        key={index}
                        as="button"
                        type="button"
                        striped={index % 2 === 1}
                        accent={separado ? 'success' : 'default'}
                        onClick={() => handleMarcarItem(index)}
                        className="w-full text-left"
                        title={<span className={separado ? 'line-through opacity-70' : ''}>{item.produto_nome}</span>}
                        meta={
                          <P38StatusLabel tone={separado ? 'success' : 'muted'}>
                            {separado ? 'Separado' : 'Pendente'}
                          </P38StatusLabel>
                        }
                        value={`Qtd ${item.quantidade}`}
                        valueSub={formatValor(item.total)}
                        trailing={
                          separado ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                          )
                        }
                      />
                    );
                  })}
                </P38MobileLineList>
              </CardContent>
            </Card>

            {/* Observações */}
            {pedidoAtual.observacoes && (
              <Card className="shadow-lg bg-yellow-50 dark:bg-yellow-900/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">ATENÇÃO</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">{pedidoAtual.observacoes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botão Finalizar */}
            <Button 
              onClick={handleFinalizarSeparacao}
              disabled={itensSeparados.length !== pedidoAtual.itens.length}
              className="w-full h-14 text-lg shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {pedidoAtual.metodo_entrega === 'Delivery' 
                ? 'FINALIZAR E ENVIAR PARA ENTREGA' 
                : 'FINALIZAR - PRONTO PARA RETIRADA'}
            </Button>

            <Button 
              onClick={() => {
                setPedidoAtual(null);
                setClienteAtual(null);
                setItensSeparados([]);
                setErro('');
              }}
              variant="outline"
              className="w-full"
            >
              CANCELAR
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}