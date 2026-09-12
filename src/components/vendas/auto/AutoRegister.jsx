import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_PRIMARY_BTN,
  AUTO_PAGE_CANVAS,
  AUTO_EDITORIAL_PANEL,
  AUTO_FIELD_CLASS,
  AUTO_DISPLAY,
  AUTO_SUBHEADING,
  AUTO_LABEL,
  AUTO_STORE_MAX,
  AUTO_EYEBROW,
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
      className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden ${AUTO_PAGE_CANVAS}`}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <AutoShellHeader>
        <Button variant="ghost" onClick={onBack} className="text-[#242424] hover:bg-[#eef4f8] pl-0">
          <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
        </Button>
        <span className={AUTO_EYEBROW}>Cadastro</span>
        <span className="w-16" />
      </AutoShellHeader>

      <div className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y p-6 sm:p-10">
        <div className={`${AUTO_STORE_MAX} max-w-md pb-8`}>
          <div className="mb-8">
            <p className={AUTO_EYEBROW}>Novo cliente</p>
            <h2 className={`${AUTO_DISPLAY} mt-2`}>Criar cadastro</h2>
            <p className={`${AUTO_SUBHEADING} mt-3`}>Preencha seus dados para continuar a compra.</p>
          </div>

          <form onSubmit={handleSubmit} className={`space-y-5 ${AUTO_EDITORIAL_PANEL}`}>
            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>Nome completo *</label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={AUTO_FIELD_CLASS}
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
                className={AUTO_FIELD_CLASS}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>CPF (opcional)</label>
              <Input
                type="tel"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                className={AUTO_FIELD_CLASS}
                placeholder="000.000.000-00"
              />
            </div>

            <Button type="submit" disabled={loading} className={`mt-2 ${AUTO_PRIMARY_BTN}`}>
              {loading ? 'Cadastrando...' : 'Concluir cadastro'}
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
