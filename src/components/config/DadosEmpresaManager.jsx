import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Search, Save, Building2, FileText } from 'lucide-react';

const Field = ({ label, value, onChange, placeholder, type = 'text', className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
    <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="bg-muted/50 border-0 shadow-sm h-9 text-sm dark:text-foreground" />
  </div>
);

const Section = ({ icon: Icon, label, desc, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 pb-2 border-b border-border/40">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-foreground/90">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
      </div>
    </div>
    {children}
  </div>
);

export default function DadosEmpresaManager() {
  const [empresa, setEmpresa] = useState({
    razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
    endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
    telefone: '', email: '', site: '', atividade_principal: '', natureza_juridica: '',
    situacao_cadastral: '', data_abertura: '', porte: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    const dados = await base44.entities.DadosEmpresa.list();
    if (dados?.length > 0) setEmpresa(dados[0]);
    setIsLoading(false);
  };

  const set = (key) => (val) => setEmpresa(e => ({ ...e, [key]: val }));

  const handleSave = async () => {
    setIsSaving(true);
    if (empresa.id) {
      await base44.entities.DadosEmpresa.update(empresa.id, empresa);
    } else {
      const ne = await base44.entities.DadosEmpresa.create(empresa);
      setEmpresa(ne);
    }
    toast({ title: "Dados salvos", className: "bg-card" });
    setIsSaving(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsImporting(true);
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const aiRes = await base44.integrations.Core.InvokeLLM({
      prompt: `Extraia os dados do Cartão CNPJ deste arquivo. Retorne JSON com: razao_social, nome_fantasia, cnpj, data_abertura (YYYY-MM-DD), natureza_juridica, atividade_principal, endereco, numero, complemento, bairro, cidade, estado, cep, email, telefone, situacao_cadastral, porte.`,
      file_urls: [uploadRes.file_url],
      response_json_schema: { type: "object", properties: { razao_social:{type:"string"}, nome_fantasia:{type:"string"}, cnpj:{type:"string"}, data_abertura:{type:"string"}, natureza_juridica:{type:"string"}, atividade_principal:{type:"string"}, endereco:{type:"string"}, numero:{type:"string"}, complemento:{type:"string"}, bairro:{type:"string"}, cidade:{type:"string"}, estado:{type:"string"}, cep:{type:"string"}, email:{type:"string"}, telefone:{type:"string"}, situacao_cadastral:{type:"string"}, porte:{type:"string"} } }
    });
    setEmpresa(prev => ({ ...prev, ...(typeof aiRes === 'string' ? JSON.parse(aiRes) : aiRes) }));
    toast({ title: "Importação concluída", description: "Verifique os dados e salve.", className: "bg-card" });
    setIsImporting(false); e.target.value = null;
  };

  const handleConsultarCNPJ = async () => {
    if (!empresa.cnpj) { toast({ title: "Informe o CNPJ", variant: "destructive" }); return; }
    setIsSearching(true);
    const aiRes = await base44.integrations.Core.InvokeLLM({
      prompt: `Busque dados públicos da empresa com CNPJ ${empresa.cnpj}. Retorne em JSON.`,
      add_context_from_internet: true,
      response_json_schema: { type:"object", properties:{ razao_social:{type:"string"}, nome_fantasia:{type:"string"}, endereco:{type:"string"}, bairro:{type:"string"}, cidade:{type:"string"}, estado:{type:"string"}, cep:{type:"string"}, atividade_principal:{type:"string"} } }
    });
    const r = typeof aiRes === 'string' ? JSON.parse(aiRes) : aiRes;
    setEmpresa(prev => ({ ...prev, razao_social: r.razao_social||prev.razao_social, nome_fantasia: r.nome_fantasia||prev.nome_fantasia, endereco: r.endereco||prev.endereco, bairro: r.bairro||prev.bairro, cidade: r.cidade||prev.cidade, estado: r.estado||prev.estado, cep: r.cep||prev.cep, atividade_principal: r.atividade_principal||prev.atividade_principal }));
    toast({ title: "Consulta concluída", className: "bg-card" });
    setIsSearching(false);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Dados da Empresa</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Informações cadastrais para emissão de documentos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="file" accept=".pdf,image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileUpload} disabled={isImporting} />
            <Button variant="ghost" size="sm" disabled={isImporting}
              className="h-8 px-3 text-xs gap-1.5 text-muted-foreground">
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Importar CNPJ</span>
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Identificação */}
      <Section icon={Building2} label="Identificação" desc="Dados principais de registro da empresa">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">CNPJ</Label>
            <div className="flex gap-2">
              <Input value={empresa.cnpj || ''} onChange={e => set('cnpj')(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm dark:text-foreground" />
              <Button size="icon" variant="ghost" onClick={handleConsultarCNPJ} disabled={isSearching}
                className="h-9 w-9 flex-shrink-0 bg-muted/50 shadow-sm">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          <Field label="Razão Social" value={empresa.razao_social} onChange={set('razao_social')} className="sm:col-span-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome Fantasia" value={empresa.nome_fantasia} onChange={set('nome_fantasia')} />
          <Field label="Atividade Principal" value={empresa.atividade_principal} onChange={set('atividade_principal')} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Natureza Jurídica" value={empresa.natureza_juridica} onChange={set('natureza_juridica')} />
          <Field label="Situação Cadastral" value={empresa.situacao_cadastral} onChange={set('situacao_cadastral')} />
          <Field label="Data Abertura" value={empresa.data_abertura ? empresa.data_abertura.split('T')[0] : ''} onChange={set('data_abertura')} type="date" />
          <Field label="Porte" value={empresa.porte} onChange={set('porte')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inscrição Estadual" value={empresa.inscricao_estadual} onChange={set('inscricao_estadual')} />
          <Field label="Inscrição Municipal" value={empresa.inscricao_municipal} onChange={set('inscricao_municipal')} />
        </div>
      </Section>

      {/* Endereço e Contato */}
      <Section icon={FileText} label="Endereço e Contato" desc="Localização e canais de comunicação">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <Field label="Logradouro" value={empresa.endereco} onChange={set('endereco')} className="col-span-2 sm:col-span-3" />
          <Field label="Número" value={empresa.numero} onChange={set('numero')} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Complemento" value={empresa.complemento} onChange={set('complemento')} />
          <Field label="Bairro" value={empresa.bairro} onChange={set('bairro')} />
          <Field label="CEP" value={empresa.cep} onChange={set('cep')} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Cidade" value={empresa.cidade} onChange={set('cidade')} />
          <Field label="Estado (UF)" value={empresa.estado} onChange={set('estado')} />
          <Field label="Telefone" value={empresa.telefone} onChange={set('telefone')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email" value={empresa.email} onChange={set('email')} />
          <Field label="Site" value={empresa.site} onChange={set('site')} />
        </div>
      </Section>
    </div>
  );
}