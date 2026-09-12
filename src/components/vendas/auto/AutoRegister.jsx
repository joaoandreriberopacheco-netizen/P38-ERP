import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { AUTO_ACCENT_TEXT, AUTO_PRIMARY_BTN, AUTO_SHELL_BG, AUTO_SURFACE_CLASS, AUTO_FIELD_CLASS } from './autoAtendimentoUi';

export default function AutoRegister({ onSuccess, onBack }) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cpf_cnpj: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome) return;

    setLoading(true);
    try {
      // Cria o cliente
      const novoCliente = await base44.entities.Terceiro.create({
        ...formData,
        tipo: 'Cliente',
        ativo: true,
        perfil: 'Pessoa Física'
      });

      toast({
        title: "Cadastro realizado!",
        description: `Bem-vindo(a), ${novoCliente.nome}!`,
        className: "bg-emerald-100 text-emerald-800"
      });

      onSuccess(novoCliente);
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro no cadastro",
        description: "Não foi possível realizar o cadastro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className={`flex-1 flex flex-col ${AUTO_SHELL_BG} p-6 md:p-12`}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <div className="max-w-md mx-auto w-full">
        <Button 
          onClick={onBack}
          variant="ghost"
          className={`mb-6 pl-0 hover:bg-transparent ${AUTO_ACCENT_TEXT}`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
        </Button>

        <h2 className="text-3xl font-bold text-foreground mb-2">Novo Cadastro</h2>
        <p className="text-muted-foreground mb-8">Preencha seus dados para criar sua conta</p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-2xl shadow-xl">
          <div>
            <Label className="text-base font-medium mb-2 block">Nome Completo *</Label>
            <Input
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
              className="h-12 text-lg bg-muted/40 border-border/40 rounded-xl"
              placeholder="Seu nome"
              required
            />
          </div>

          <div>
            <Label className="text-base font-medium mb-2 block">Telefone / WhatsApp</Label>
            <Input
              type="tel"
              value={formData.telefone}
              onChange={e => setFormData({...formData, telefone: e.target.value})}
              className="h-12 text-lg bg-muted/40 border-border/40 rounded-xl"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <Label className="text-base font-medium mb-2 block">CPF (Opcional)</Label>
            <Input
              type="tel"
              value={formData.cpf_cnpj}
              onChange={e => setFormData({...formData, cpf_cnpj: e.target.value})}
              className="h-12 text-lg bg-muted/40 border-border/40 rounded-xl"
              placeholder="000.000.000-00"
            />
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className={`w-full h-14 text-lg font-bold rounded-xl mt-4 ${AUTO_PRIMARY_BTN}`}
          >
            {loading ? 'Cadastrando...' : 'Concluir Cadastro'}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}