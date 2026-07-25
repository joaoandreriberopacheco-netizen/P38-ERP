import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function PersonalizacaoComprovanteManager() {
  const [dadosEmpresa, setDadosEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({ logo_url: '', mensagem_rodape: '' });

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    setLoading(true);
    const empresas = await base44.entities.DadosEmpresa.list();
    if (empresas?.length > 0) {
      setDadosEmpresa(empresas[0]);
      setFormData({ logo_url: empresas[0].logo_url || '', mensagem_rodape: empresas[0].mensagem_rodape || '' });
    }
    setLoading(false);
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFormData(prev => ({ ...prev, logo_url: file_url }));
    toast.success('Logo carregado com sucesso');
    setUploadingLogo(false);
  };

  const handleSalvar = async () => {
    if (!dadosEmpresa) { toast.error('Nenhuma empresa cadastrada'); return; }
    setSalvando(true);
    await base44.entities.DadosEmpresa.update(dadosEmpresa.id, formData);
    toast.success('Configurações salvas com sucesso');
    await carregarDados();
    setSalvando(false);
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-sm text-muted-foreground">Carregando...</div></div>;

  return (
    <div className="space-y-5 mt-4">
      {/* Header */}
      <div className="pb-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Personalização do Comprovante</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Configure a aparência dos comprovantes de venda impressos</p>
      </div>

      {/* Logo */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Logo da Empresa
        </Label>
        {formData.logo_url && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/50/60">
            <img src={formData.logo_url} alt="Logo" className="max-w-[100px] max-h-[60px] object-contain"
              style={{ filter: 'grayscale(100%) contrast(200%)' }} />
            <p className="text-xs text-muted-foreground">Preview em preto e branco</p>
          </div>
        )}
        <div className="flex gap-2">
          <label className="flex-1">
            <input type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" disabled={uploadingLogo} />
            <Button type="button" variant="ghost" className="w-full bg-muted/50/60 text-muted-foreground hover:bg-muted/60 h-9 text-xs gap-1.5"
              disabled={uploadingLogo} onClick={() => document.querySelector('input[type="file"]')?.click()}>
              <Upload className="w-3.5 h-3.5" />
              {uploadingLogo ? 'Enviando...' : formData.logo_url ? 'Alterar Logo' : 'Carregar Logo'}
            </Button>
          </label>
          {formData.logo_url && (
            <Button type="button" variant="ghost" size="sm"
              className="h-9 px-3 text-xs text-muted-foreground hover:text-red-500 bg-muted/50/60"
              onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}>
              Remover
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">PNG ou SVG com fundo transparente. Máx 2MB.</p>
      </div>

      {/* Rodapé */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Mensagem de Rodapé
        </Label>
        <Textarea value={formData.mensagem_rodape}
          onChange={e => setFormData(prev => ({ ...prev, mensagem_rodape: e.target.value }))}
          placeholder="Ex: OBRIGADO PELA PREFERÊNCIA!" maxLength={100} rows={2}
          className="bg-muted/50 border-0 shadow-sm font-mono text-xs dark:text-foreground resize-none" />
        <p className="text-[11px] text-muted-foreground">Máximo 100 caracteres. Exibido em negrito no rodapé.</p>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
        <div className="flex justify-center p-4 rounded-xl bg-muted/50/60">
          <div className="bg-card p-4 shadow-lg rounded" style={{ width: '240px', fontFamily: 'Courier, monospace', fontSize: '10px', color: '#000' }}>
            <div className="text-center space-y-1">
              {formData.logo_url && (
                <img src={formData.logo_url} alt="" className="mx-auto mb-2" style={{ maxWidth: '80px', maxHeight: '50px', filter: 'grayscale(100%) contrast(200%)' }} />
              )}
              <div className="font-bold">{dadosEmpresa?.razao_social || 'VAREJOSYNC'}</div>
              <div className="text-[9px]">{dadosEmpresa?.endereco || 'Endereço não cadastrado'}</div>
              {dadosEmpresa?.telefone && <div className="text-[9px]">Tel: {dadosEmpresa.telefone}</div>}
            </div>
            <div className="my-2 text-center">----------------------------</div>
            <div className="text-center font-bold">RECIBO Nº 00001</div>
            <div className="my-2 text-center">----------------------------</div>
            {formData.mensagem_rodape && (
              <div className="text-center font-bold text-[10px] mt-2">{formData.mensagem_rodape}</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={carregarDados} disabled={salvando}
          className="h-8 text-xs text-muted-foreground">
          Cancelar
        </Button>
        <Button onClick={handleSalvar} disabled={salvando} size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 text-xs">
          <Save className="w-3.5 h-3.5" />
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}