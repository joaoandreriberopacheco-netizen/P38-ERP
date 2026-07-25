import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Upload, CheckCircle, AlertTriangle, Loader2, FileText, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { dataHoje } from '@/components/utils/dateUtils';

export default function ImportacaoTerceiros({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ step: '', progress: 0 });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const cacheRef = useRef({ terceiros: null });

  const handleDownloadTemplate = async () => {
    try {
      let csvContent = "\uFEFF";
      csvContent += "NOME;CPF_CNPJ;EMAIL;TELEFONE;ENDERECO;BAIRRO;CIDADE;ESTADO;CEP;TIPO\n";
      csvContent += "FORNECEDOR EXEMPLO LTDA;12.345.678/0001-90;contato@fornecedor.com.br;(11) 98765-4321;RUA DAS FLORES, 123;CENTRO;SÃO PAULO;SP;01234-567;FORNECEDOR\n";
      csvContent += "JOÃO DA SILVA;123.456.789-00;joao@email.com;(11) 91234-5678;AV. PRINCIPAL, 456;JARDIM CENTRAL;CAMPINAS;SP;13087-000;CLIENTE\n";
      csvContent += "DISTRIBUIDORA COMERCIAL;98.765.432/0001-10;vendas@distribuidora.com;(11) 3333-4444;RUA COMERCIAL, 789;INDUSTRIAL;GUARULHOS;SP;07010-000;AMBOS\n";

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `template_importacao_terceiros_${dataHoje()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Template baixado",
        description: "Use este arquivo como base para importação",
        className: "bg-muted text-foreground"
      });
    } catch (error) {
      toast({ title: "Erro ao gerar template", description: error.message, variant: "destructive" });
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
    }
  };

  const handleValidateFile = async () => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo CSV primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    setIsValidating(true);
    setValidationProgress({ step: 'Lendo arquivo...', progress: 10 });

    try {
      const text = await file.text();
      
      setValidationProgress({ step: 'Carregando dados do sistema...', progress: 30 });

      let terceirosExistentes = cacheRef.current.terceiros;

      if (!terceirosExistentes) {
        await new Promise(resolve => setTimeout(resolve, 300));
        terceirosExistentes = await base44.entities.Terceiro.list();
        cacheRef.current.terceiros = terceirosExistentes;
      }

      setValidationProgress({ step: 'Identificando formato...', progress: 50 });

      const linhas = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
      if (linhas.length < 2) {
        throw new Error("Arquivo vazio ou com dados insuficientes");
      }

      const primeiraLinha = linhas[0];
      const separador = primeiraLinha.includes(';') ? ';' : (primeiraLinha.includes(',') ? ',' : '\t');
      
      const headers = primeiraLinha.split(separador).map(h => h.trim().toUpperCase());
      
      const mapearColuna = (nomesOpcoes) => {
        for (const nome of nomesOpcoes) {
          const idx = headers.findIndex(h => h === nome.toUpperCase());
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const mapeamento = {
        separador,
        indice_nome: mapearColuna(['NOME', 'RAZAO_SOCIAL', 'RAZAO SOCIAL', 'NAME']),
        indice_cpf_cnpj: mapearColuna(['CPF_CNPJ', 'CPF/CNPJ', 'DOCUMENTO', 'DOC']),
        indice_email: mapearColuna(['EMAIL', 'E-MAIL']),
        indice_telefone: mapearColuna(['TELEFONE', 'FONE', 'PHONE', 'CELULAR']),
        indice_endereco: mapearColuna(['ENDERECO', 'ENDEREÇO', 'ADDRESS', 'RUA']),
        indice_bairro: mapearColuna(['BAIRRO', 'NEIGHBORHOOD']),
        indice_cidade: mapearColuna(['CIDADE', 'CITY']),
        indice_estado: mapearColuna(['ESTADO', 'UF', 'STATE']),
        indice_cep: mapearColuna(['CEP', 'ZIPCODE', 'ZIP']),
        indice_tipo: mapearColuna(['TIPO', 'TYPE'])
      };
      
      if (mapeamento.indice_nome === -1) {
        throw new Error(`Coluna obrigatória NOME não encontrada. Cabeçalhos: ${headers.join(', ')}`);
      }

      setValidationProgress({ step: 'Processando todos os terceiros...', progress: 70 });

      const linhasDados = linhas.slice(1);
      const terceirosIA = [];

      for (let i = 0; i < linhasDados.length; i++) {
        const cols = linhasDados[i].split(separador).map(c => c.trim());
        
        const getCol = (idx) => {
          if (idx < 0 || idx >= cols.length) return '';
          let val = cols[idx];
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          }
          return val;
        };

        const nome = getCol(mapeamento.indice_nome);
        if (!nome) continue;

        const tipo = getCol(mapeamento.indice_tipo) || 'CLIENTE';

        terceirosIA.push({
          nome: nome.toUpperCase(),
          cpf_cnpj: getCol(mapeamento.indice_cpf_cnpj),
          email: getCol(mapeamento.indice_email),
          telefone: getCol(mapeamento.indice_telefone),
          endereco: getCol(mapeamento.indice_endereco),
          bairro: getCol(mapeamento.indice_bairro),
          cidade: getCol(mapeamento.indice_cidade),
          estado: getCol(mapeamento.indice_estado),
          cep: getCol(mapeamento.indice_cep),
          tipo: tipo.toUpperCase()
        });

        if (i % 50 === 0) {
          setValidationProgress({ 
            step: `Processando ${i}/${linhasDados.length} terceiros...`, 
            progress: 70 + Math.floor((i / linhasDados.length) * 20)
          });
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      setValidationProgress({ step: 'Processando resultados...', progress: 90 });
      
      if (terceirosIA.length === 0) {
        throw new Error("Nenhum terceiro válido encontrado no arquivo. Verifique se a coluna NOME está preenchida.");
      }

      let novos = 0;
      let atualizacoes = 0;

      terceirosIA.forEach(terc => {
        if (terc.cpf_cnpj) {
          const existe = terceirosExistentes.find(t => 
            t.cpf_cnpj?.toUpperCase() === terc.cpf_cnpj?.toUpperCase()
          );
          if (existe) atualizacoes++;
          else novos++;
        } else {
          novos++;
        }
      });

      cacheRef.current.terceirosIA = terceirosIA;

      setValidationProgress({ step: 'Finalizando...', progress: 100 });

      setValidationResult({
        success: true,
        totalLinhas: terceirosIA.length,
        novos,
        atualizacoes
      });

      toast({
        title: "Validação concluída!",
        description: `${terceirosIA.length} terceiros reconhecidos`,
        className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
      });

      setTimeout(() => setStep(2), 100);
    } catch (error) {
      console.error('Erro detalhado na validação:', error);
      
      setValidationResult({
        success: false,
        error: error.message,
        totalLinhas: 0
      });
      
      toast({
        title: "Erro na análise",
        description: error.message,
        variant: "destructive",
        duration: 5000
      });

      setTimeout(() => setStep(2), 100);
    } finally {
      setIsValidating(false);
      setValidationProgress({ step: '', progress: 0 });
    }
  };

  const handleImport = async () => {
    setStep(3);
    setIsImporting(true);

    try {
      const terceirosIA = cacheRef.current.terceirosIA || [];
      const terceirosExistentes = cacheRef.current.terceiros;

      setImportProgress({ current: 0, total: terceirosIA.length });

      let criados = 0;
      let atualizados = 0;

      for (let i = 0; i < terceirosIA.length; i++) {
        const terc = terceirosIA[i];
        
        if (!terc.nome) continue;

        const cpfCnpj = terc.cpf_cnpj?.toUpperCase() || null;
        const existe = cpfCnpj ? terceirosExistentes.find(t => 
          t.cpf_cnpj?.toUpperCase() === cpfCnpj
        ) : null;

        const tercData = {
          nome: terc.nome,
          cpf_cnpj: terc.cpf_cnpj || null,
          email: terc.email || null,
          telefone: terc.telefone || null,
          endereco: terc.endereco || null,
          bairro: terc.bairro || null,
          cidade: terc.cidade || null,
          estado: terc.estado || null,
          cep: terc.cep || null,
          tipo: terc.tipo || 'Cliente',
          ativo: true
        };

        if (existe) {
          await base44.entities.Terceiro.update(existe.id, tercData);
          atualizados++;
        } else {
          const allTerceiros = await base44.entities.Terceiro.list();
          const nextNumber = (allTerceiros.length > 0 
            ? Math.max(...allTerceiros.map(t => parseInt(t.codigo_interno?.split('-')[1] || 0))) 
            : 0) + 1;
          const prefix = tercData.tipo === 'CLIENTE' || tercData.tipo === 'AMBOS' ? 'CLI' : 'FOR';
          const codigo = `${prefix}-${String(nextNumber).padStart(5, '0')}`;

          await base44.entities.Terceiro.create({
            ...tercData,
            codigo_interno: codigo
          });
          criados++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        setImportProgress({ current: i + 1, total: terceirosIA.length });
      }

      toast({
        title: "✓ Importação Concluída!",
        description: `${criados} terceiros criados, ${atualizados} atualizados.`,
        className: "bg-green-100 text-green-800",
        duration: 5000
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);

    } catch (error) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
      setStep(2);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-border/40">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Importação de Terceiros
              </h2>
              <p className="text-sm text-muted-foreground">
                Importe clientes e fornecedores em lote via CSV
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  step >= s 
                    ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground shadow-md' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? <CheckCircle className="w-5 h-5" /> : <span className="text-sm font-medium">{s}</span>}
                </div>
                {s < 3 && <div className={`w-16 h-0.5 ${step > s ? 'bg-primary dark:bg-card' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-card dark:bg-muted flex items-center justify-center flex-shrink-0">
                    <Download className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      1. Baixe o template CSV
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use nosso modelo com todas as colunas necessárias
                    </p>
                    <Button onClick={handleDownloadTemplate} className="gap-2">
                      <Download className="w-4 h-4" />
                      Baixar Template
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-card dark:bg-muted flex items-center justify-center flex-shrink-0">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      2. Selecione o arquivo preenchido
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Formato CSV com separador ponto-e-vírgula (;)
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {!file ? (
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Selecionar Arquivo
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-card dark:bg-muted rounded-xl">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setFile(null)}
                          className="rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {file && !isValidating && (
                      <Button
                        onClick={handleValidateFile}
                        className="gap-2 mt-4 w-full"
                      >
                        Validar e Continuar
                      </Button>
                    )}

                    {file && isValidating && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {validationProgress.step}
                          </span>
                          <span className="font-medium text-foreground">
                            {validationProgress.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary dark:bg-card h-full transition-all duration-500 rounded-full"
                            style={{ width: `${validationProgress.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Validation Result */}
          {step === 2 && validationResult && (
            <div className="space-y-6">
              {validationResult.success ? (
                <>
                  <div className="bg-muted/50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <h3 className="text-lg font-medium text-foreground">
                        Arquivo validado com sucesso!
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-card dark:bg-muted rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total de Linhas</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {validationResult.totalLinhas}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                        <p className="text-xs text-green-700 dark:text-green-400 mb-1">Novos</p>
                        <p className="text-2xl font-semibold text-green-700 dark:text-green-400">
                          {validationResult.novos}
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                        <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Atualizações</p>
                        <p className="text-2xl font-semibold text-blue-700 dark:text-blue-400">
                          {validationResult.atualizacoes}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => { 
                        setStep(1); 
                        setFile(null); 
                        setValidationResult(null); 
                      }} 
                      className="flex-1"
                      disabled={isImporting}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      className="flex-1 gap-2"
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Confirmar Importação'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="bg-muted/50 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Erro na validação
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {validationResult.error}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => { setStep(1); setFile(null); setValidationResult(null); }}>
                    Voltar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="bg-muted/50 rounded-xl p-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Importando terceiros...
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Por favor, aguarde. Não feche esta página.
                </p>

                <div className="bg-card dark:bg-muted rounded-xl p-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-foreground/90">
                      Progresso
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-muted dark:bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary dark:bg-card h-full transition-all duration-300 rounded-full"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}