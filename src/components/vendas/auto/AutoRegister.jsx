import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_ACCENT_TEXT,
  AUTO_PRIMARY_BTN,
  AUTO_SHELL_BG,
  AUTO_SURFACE_CLASS,
  AUTO_FIELD_CLASS,
  AUTO_DISPLAY,
  AUTO_SUBHEADING,
  AUTO_LABEL,
  AUTO_STORE_MAX,
} from './autoAtendimentoUi';

export default function AutoRegister({ onSuccess, onBack }) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    cpf_cnpj: '',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome) return;

    setLoading(true);
    try {
      const novoCliente = await base44.entities.Terceiro.create({
        ...formData,
        tipo: 'Cliente',
        ativo: true,
        perfil: 'Pessoa Física',
      });

      toast({
        title: 'Cadastro realizado!',
        description: `Bem-vindo(a), ${novoCliente.nome}!`,
        className: 'bg-emerald-100 text-emerald-800',
      });

      onSuccess(novoCliente);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro no cadastro',
        description: 'Não foi possível realizar o cadastro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden ${AUTO_SHELL_BG}`}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <AutoShellHeader>
        <Button variant="ghost" onClick={onBack} className="text-[#242424] hover:bg-secondary/60 pl-0">
          <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
        </Button>
        <span className="text-sm font-medium tracking-tight text-[#242424]">Cadastro</span>
        <span className="w-16" />
      </AutoShellHeader>

      <div className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y p-6 md:p-10">
        <div className={`${AUTO_STORE_MAX} max-w-md pb-8`}>
          <h2 className={AUTO_DISPLAY}>Novo cadastro</h2>
          <p className={`${AUTO_SUBHEADING} mt-3 mb-8`}>Preencha seus dados para criar sua conta.</p>

          <form onSubmit={handleSubmit} className={`space-y-6 ${AUTO_SURFACE_CLASS} rounded-2xl p-6 sm:p-8`}>
            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>Nome completo *</label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={`h-12 text-base rounded-xl ${AUTO_FIELD_CLASS}`}
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>Telefone / WhatsApp</label>
              <Input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className={`h-12 text-base rounded-xl ${AUTO_FIELD_CLASS}`}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>CPF (opcional)</label>
              <Input
                type="tel"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                className={`h-12 text-base rounded-xl ${AUTO_FIELD_CLASS}`}
                placeholder="000.000.000-00"
              />
            </div>

            <Button type="submit" disabled={loading} className={`w-full h-12 mt-2 ${AUTO_PRIMARY_BTN}`}>
              {loading ? 'Cadastrando...' : 'Concluir cadastro'}
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
