import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  ClipboardCheck,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Package,
  Upload,
  Save,
  Eye,
  EyeOff,
  FileSignature
} from 'lucide-react';

export default function ConferenciaCega({ pedido, isOpen, onClose, onSuccess }) {
  const [modo, setModo] = useState('cega');
  const [currentUser, setCurrentUser] = useState(null);
  const [itensConferidos, setItensConferidos] = useState([]);
  const [step, setStep] = useState(1);
  const [observacoes, setObservacoes] = useState('');
  const [assinaturaFile, setAssinaturaFile] = useState(null);
  const [senha, setSenha] = useState('');
  const [interveniente, setInterveniente] = useState(null);
  const [intervenientes, setIntervenientes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [produtos, setProdutos] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && pedido) {
      loadUser();
      loadIntervenientes();
      loadProdutos();
      inicializarConferencia();
    }
  }, [isOpen, pedido]);

  const loadUser = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);
  };

  const loadIntervenientes = async () => {
    const lista = await base44.entities.Interveniente.filter({ ativo: true });
    setIntervenientes(lista);
  };

  const loadProdutos = async () => {
    const ids = pedido.itens.map(i => i.produto_id);
    const prods = await base44.entities.Produto.filter({ id: { $in: ids } });
    const map = {};
    prods.forEach(p => { map[p.id] = p; });
    setProdutos(map);
  };

  const inicializarConferencia = () => {
    if (modo === 'cega') {
      setItensConferidos([]);
    } else {
      const itens = pedido.itens.map(item => ({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade_pedido: item.quantidade,
        quantidade_conferida: 0,
        divergencia: false,
        tipo_divergencia: null,
        observacao: '',
        fotos: [],
        lotes: []
      }));
      setItensConferidos(itens);
    }
  };

  const adicionarItemCego = () => {
    setItensConferidos([...itensConferidos, {
      produto_id: '',
      produto_nome: '',
      quantidade_conferida: 0,
      divergencia: false,
      tipo_divergencia: null,
      observacao: '',
      fotos: [],
      lotes: []
    }]);
  };

  const adicionarLote = (itemIndex) => {
    const novosItens = [...itensConferidos];
    if (!novosItens[itemIndex].lotes) novosItens[itemIndex].lotes = [];
    novosItens[itemIndex].lotes.push({
      numero_lote: '',
      data_validade: '',
      quantidade: 0,
      numeros_serie: []
    });
    setItensConferidos(novosItens);
  };

  const validarDadosRastreabilidade = () => {
    for (const item of itensConferidos) {
      const produto = produtos[item.produto_id];
      if (!produto) continue;

      if (produto.controla_validade || produto.controla_lote) {
        if (!item.lotes || item.lotes.length === 0) {
          toast({ 
            title: `${item.produto_nome} requer lote/validade`, 
            variant: 'destructive' 
          });
          return false;
        }

        const totalLote = item.lotes.reduce((sum, l) => sum + (parseInt(l.quantidade) || 0), 0);
        if (totalLote !== item.quantidade_conferida) {
          toast({ 
            title: `${item.produto_nome}: soma dos lotes (${totalLote}) diferente da quantidade (${item.quantidade_conferida})`, 
            variant: 'destructive' 
          });
          return false;
        }

        for (const lote of item.lotes) {
          if (produto.controla_lote && !lote.numero_lote) {
            toast({ title: `Lote obrigatório para ${item.produto_nome}`, variant: 'destructive' });
            return false;
          }
          if (produto.controla_validade && !lote.data_validade) {
            toast({ title: `Validade obrigatória para ${item.produto_nome}`, variant: 'destructive' });
            return false;
          }
        }
      }

      if (produto.controla_serial) {
        const totalSerial = item.lotes?.reduce((sum, l) => sum + (l.numeros_serie?.length || 0), 0) || 0;
        if (totalSerial !== item.quantidade_conferida) {
          toast({ 
            title: `${item.produto_nome}: quantidade de séries (${totalSerial}) diferente da quantidade (${item.quantidade_conferida})`, 
            variant: 'destructive' 
          });
          return false;
        }
      }
    }
    return true;
  };

  const handleUploadFoto = async (index, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const novosItens = [...itensConferidos];
      novosItens[index].fotos = [...(novosItens[index].fotos || []), file_url];
      setItensConferidos(novosItens);
      toast({ title: 'Foto anexada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao fazer upload da foto', variant: 'destructive' });
    }
  };

  const handleUploadAssinatura = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAssinaturaFile(file_url);
        toast({ title: 'Assinatura carregada!' });
      } catch (error) {
        toast({ title: 'Erro ao carregar assinatura', variant: 'destructive' });
      }
    }
  };

  const compararComPedido = () => {
    if (!validarDadosRastreabilidade()) return;
    const novosItens = itensConferidos.map(conferido => {
      const itemPedido = pedido.itens.find(p => p.produto_id === conferido.produto_id);
      
      if (!itemPedido) {
        return { ...conferido, divergencia: true, tipo_divergencia: 'Produto a Mais' };
      }

      if (conferido.quantidade_conferida < itemPedido.quantidade) {
        return { ...conferido, divergencia: true, tipo_divergencia: 'Falta' };
      }

      if (conferido.quantidade_conferida > itemPedido.quantidade) {
        return { ...conferido, divergencia: true, tipo_divergencia: 'Produto a Mais' };
      }

      return conferido;
    });

    pedido.itens.forEach(itemPedido => {
      const encontrado = itensConferidos.find(c => c.produto_id === itemPedido.produto_id);
      if (!encontrado) {
        novosItens.push({
          produto_id: itemPedido.produto_id,
          produto_nome: itemPedido.produto_nome,
          quantidade_pedido: itemPedido.quantidade,
          quantidade_conferida: 0,
          divergencia: true,
          tipo_divergencia: 'Falta',
          observacao: 'Item não recebido',
          fotos: []
        });
      }
    });

    setItensConferidos(novosItens);
    setStep(2);
  };

  const finalizarConferencia = async () => {
    if (!interveniente || !senha || !assinaturaFile) {
      toast({ title: 'Preencha todos os campos de aprovação', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const totalDivergencias = itensConferidos.filter(i => i.divergencia).length;
      const totalOk = itensConferidos.filter(i => !i.divergencia).length;

      const conferencia = await base44.entities.ConferenciaCompra.create({
        pedido_compra_id: pedido.id,
        pedido_numero: pedido.numero,
        tipo: modo === 'cega' ? 'Conferência Cega' : 'Conferência com Nota',
        status: totalDivergencias > 0 ? 'Com Divergências' : 'Concluída',
        conferente_id: currentUser.id,
        conferente_nome: currentUser.full_name,
        itens_conferidos: itensConferidos,
        total_itens_ok: totalOk,
        total_divergencias: totalDivergencias,
        interveniente_id: interveniente,
        interveniente_nome: intervenientes.find(i => i.id === interveniente)?.nome,
        assinatura_url: assinaturaFile,
        senha_confirmacao: senha,
        data_conclusao: new Date().toISOString(),
        observacoes_gerais: observacoes
      });

      // Criar divergências individuais
      for (const item of itensConferidos.filter(i => i.divergencia)) {
        await base44.entities.DivergenciaCompra.create({
          pedido_compra_id: pedido.id,
          conferencia_id: conferencia.id,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          tipo: item.tipo_divergencia,
          quantidade_esperada: item.quantidade_pedido || 0,
          quantidade_recebida: item.quantidade_conferida,
          quantidade_avariada: item.tipo_divergencia === 'Avaria' ? item.quantidade_conferida : 0,
          status: 'Pendente',
          descricao: item.observacao,
          fotos_urls: item.fotos || []
        });
      }

      // Criar movimentações de estoque com lote/validade/serial
      for (const item of itensConferidos.filter(i => !i.divergencia && i.quantidade_conferida > 0)) {
        if (item.lotes && item.lotes.length > 0) {
          for (const lote of item.lotes) {
            await base44.entities.MovimentacaoEstoque.create({
              tipo: 'Entrada',
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              quantidade: lote.quantidade,
              referencia_tipo: 'PedidoCompra',
              referencia_id: pedido.id,
              referencia_numero: pedido.numero,
              numero_lote: lote.numero_lote,
              data_validade: lote.data_validade,
              numeros_serie: lote.numeros_serie
            });
          }
        } else {
          await base44.entities.MovimentacaoEstoque.create({
            tipo: 'Entrada',
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade_conferida,
            referencia_tipo: 'PedidoCompra',
            referencia_id: pedido.id,
            referencia_numero: pedido.numero
          });
        }
        await base44.functions.invoke('recalcularEstoqueProduto', { produtoId: item.produto_id });
      }

      // Atualizar status do pedido
      const novoStatus = totalDivergencias > 0 ? 'Pendências' : 'Concluído';
      await base44.entities.PedidoCompra.update(pedido.id, {
        status: novoStatus,
        conferencia_id: conferencia.id,
        tem_divergencias: totalDivergencias > 0,
        data_chegada: new Date().toISOString(),
        data_conclusao: totalDivergencias === 0 ? new Date().toISOString() : null
      });

      toast({ title: 'Conferência concluída com sucesso!' });
      onSuccess();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao finalizar conferência', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!pedido) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            Conferência de Recebimento - {pedido.numero}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <Button
                variant={modo === 'cega' ? 'default' : 'outline'}
                onClick={() => { setModo('cega'); inicializarConferencia(); }}
                className="flex-1"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                Conferência Cega
              </Button>
              <Button
                variant={modo === 'nota' ? 'default' : 'outline'}
                onClick={() => { setModo('nota'); inicializarConferencia(); }}
                className="flex-1"
              >
                <Eye className="w-4 h-4 mr-2" />
                Com Nota Fiscal
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                {modo === 'cega' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Confira os produtos recebidos sem consultar o pedido original
                    </p>
                    {itensConferidos.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 p-4 bg-muted/40 rounded-lg">
                        <div className="col-span-4">
                          <Label>Produto</Label>
                          <Input
                            value={item.produto_nome}
                            onChange={e => {
                              const novos = [...itensConferidos];
                              novos[idx].produto_nome = e.target.value;
                              setItensConferidos(novos);
                            }}
                            placeholder="Nome do produto"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            value={item.quantidade_conferida}
                            onChange={e => {
                              const novos = [...itensConferidos];
                              novos[idx].quantidade_conferida = parseInt(e.target.value) || 0;
                              setItensConferidos(novos);
                            }}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label>Condição</Label>
                          <Select
                            value={item.tipo_divergencia || 'ok'}
                            onValueChange={v => {
                              const novos = [...itensConferidos];
                              novos[idx].tipo_divergencia = v === 'ok' ? null : v;
                              novos[idx].divergencia = v !== 'ok';
                              setItensConferidos(novos);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ok">OK</SelectItem>
                              <SelectItem value="Avaria">Avaria</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3 flex items-end gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handleUploadFoto(idx, e.target.files[0])}
                            />
                            <Button type="button" variant="outline" size="sm" className="w-full">
                              <Camera className="w-4 h-4" />
                            </Button>
                          </label>
                          {item.fotos?.length > 0 && (
                            <Badge variant="outline">{item.fotos.length}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button onClick={adicionarItemCego} variant="outline" className="w-full">
                      <Package className="w-4 h-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Confira cada item do pedido marcando quantidade e condição
                    </p>
                    {itensConferidos.map((item, idx) => {
                      const produto = produtos[item.produto_id];
                      const precisaLote = produto?.controla_lote || produto?.controla_validade;
                      const precisaSerial = produto?.controla_serial;

                      return (
                        <div key={idx} className="space-y-3 p-4 bg-muted/40 rounded-lg border">
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4">
                              <Label>Produto</Label>
                              <div className="font-medium">{item.produto_nome}</div>
                              <div className="text-xs text-muted-foreground">Esperado: {item.quantidade_pedido}</div>
                            </div>
                            <div className="col-span-2">
                              <Label>Recebido</Label>
                              <Input
                                type="number"
                                value={item.quantidade_conferida}
                                onChange={e => {
                                  const novos = [...itensConferidos];
                                  novos[idx].quantidade_conferida = parseInt(e.target.value) || 0;
                                  setItensConferidos(novos);
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <Label>Problema</Label>
                              <Select
                                value={item.tipo_divergencia || 'ok'}
                                onValueChange={v => {
                                  const novos = [...itensConferidos];
                                  novos[idx].tipo_divergencia = v === 'ok' ? null : v;
                                  novos[idx].divergencia = v !== 'ok';
                                  setItensConferidos(novos);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ok">Tudo OK</SelectItem>
                                  <SelectItem value="Avaria">Avaria</SelectItem>
                                  <SelectItem value="Pedido Diferente">Item Errado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3 flex items-end gap-2">
                              <label className="cursor-pointer flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleUploadFoto(idx, e.target.files[0])}
                                />
                                <Button type="button" variant="outline" size="sm" className="w-full">
                                  <Camera className="w-4 h-4" />
                                </Button>
                              </label>
                              {item.fotos?.length > 0 && (
                                <Badge variant="outline">{item.fotos.length}</Badge>
                              )}
                            </div>
                          </div>

                          {(precisaLote || precisaSerial) && (
                            <div className="pl-4 border-l border-indigo-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-indigo-700">
                                  {produto.controla_lote && 'Lote'}
                                  {produto.controla_lote && produto.controla_validade && ' / '}
                                  {produto.controla_validade && 'Validade'}
                                  {produto.controla_serial && ' / Serial'}
                                </Label>
                                <Button type="button" size="sm" variant="outline" onClick={() => adicionarLote(idx)}>
                                  + Lote
                                </Button>
                              </div>

                              {item.lotes?.map((lote, loteIdx) => (
                                <div key={loteIdx} className="grid grid-cols-12 gap-2 p-2 bg-white rounded">
                                  {produto.controla_lote && (
                                    <div className="col-span-3">
                                      <Input
                                        placeholder="Nº Lote"
                                        value={lote.numero_lote}
                                        onChange={e => {
                                          const novos = [...itensConferidos];
                                          novos[idx].lotes[loteIdx].numero_lote = e.target.value;
                                          setItensConferidos(novos);
                                        }}
                                      />
                                    </div>
                                  )}
                                  {produto.controla_validade && (
                                    <div className="col-span-3">
                                      <Input
                                        type="date"
                                        value={lote.data_validade}
                                        onChange={e => {
                                          const novos = [...itensConferidos];
                                          novos[idx].lotes[loteIdx].data_validade = e.target.value;
                                          setItensConferidos(novos);
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="col-span-2">
                                    <Input
                                      type="number"
                                      placeholder="Qtd"
                                      value={lote.quantidade}
                                      onChange={e => {
                                        const novos = [...itensConferidos];
                                        novos[idx].lotes[loteIdx].quantidade = parseInt(e.target.value) || 0;
                                        setItensConferidos(novos);
                                      }}
                                    />
                                  </div>
                                  {produto.controla_serial && (
                                    <div className="col-span-4">
                                      <Input
                                        placeholder="Séries (sep. vírgula)"
                                        value={lote.numeros_serie?.join(', ') || ''}
                                        onChange={e => {
                                          const novos = [...itensConferidos];
                                          novos[idx].lotes[loteIdx].numeros_serie = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                          setItensConferidos(novos);
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <Label>Observações Gerais</Label>
                  <Textarea
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Observações sobre a conferência..."
                    rows={3}
                  />
                </div>

                <Button onClick={compararComPedido} className="w-full bg-indigo-600">
                  Avançar para Aprovação
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {itensConferidos.filter(i => !i.divergencia).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Itens OK</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600">
                      {itensConferidos.filter(i => i.divergencia).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Divergências</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-indigo-600">
                      {itensConferidos.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Total de Itens</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {itensConferidos.filter(i => i.divergencia).length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Divergências Encontradas
                  </h3>
                  {itensConferidos.filter(i => i.divergencia).map((item, idx) => (
                    <div key={idx} className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="font-medium">{item.produto_nome}</div>
                      <div className="text-sm text-red-600">{item.tipo_divergencia}</div>
                      <div className="text-sm text-muted-foreground">
                        Esperado: {item.quantidade_pedido || 'N/A'} | Recebido: {item.quantidade_conferida}
                      </div>
                      {item.fotos?.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          {item.fotos.map((foto, i) => (
                            <img key={i} src={foto} className="w-20 h-20 object-cover rounded" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-indigo-600" />
                  Aprovação do Interveniente
                </h3>

                <div>
                  <Label>Interveniente Responsável *</Label>
                  <Select value={interveniente} onValueChange={setInterveniente}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o interveniente" />
                    </SelectTrigger>
                    <SelectContent>
                      {intervenientes.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Assinatura (Foto) *</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadAssinatura}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {assinaturaFile && (
                    <img src={assinaturaFile} className="mt-2 w-32 h-20 object-contain border rounded" />
                  )}
                </div>

                <div>
                  <Label>Senha de Confirmação *</Label>
                  <Input
                    type="password"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Digite a senha"
                  />
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Voltar
                  </Button>
                  <Button
                    onClick={finalizarConferencia}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {saving ? 'Salvando...' : 'Finalizar Conferência'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}