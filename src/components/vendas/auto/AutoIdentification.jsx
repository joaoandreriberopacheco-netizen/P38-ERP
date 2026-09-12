import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, ArrowRight, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_PRIMARY_BTN,
  AUTO_PAGE_CANVAS,
  AUTO_EDITORIAL_PANEL,
  AUTO_FIELD_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_DISPLAY,
  AUTO_SUBHEADING,
  AUTO_LABEL,
  AUTO_STORE_MAX,
  AUTO_GHOST_BTN,
  AUTO_EYEBROW,
} from './autoAtendimentoUi';

export default function AutoIdentification({ onIdentify, onSkip, onRegister, onBack }) {
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e) => {
    e.preventDefault();
    const digits = documento.replace(/\D/g, '');
    if (digits.length < 3) return;

    setLoading(true);
    try {
      const clientes = await base44.entities.Terceiro.filter({
        tipo: ['Cliente', 'Ambos'],
        ativo: true,
      });

      const cliente = clientes.find(
        (c) =>
          (c.cpf_cnpj && c.cpf_cnpj.replace(/\D/g, '') === digits) ||
          (c.telefone && c.telefone.replace(/\D/g, '') === digits)
      );

      if (cliente) {
        onIdentify(cliente);
      } else {
        toast({
          title: 'Não encontrado',
          description: 'Cliente não encontrado. Verifique o número ou cadastre-se.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro',
        description: 'Erro ao buscar cliente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 ${AUTO_PAGE_CANVAS}`}>
      <AutoShellHeader>
        <Button variant="ghost" onClick={onBack} className="text-[#242424] hover:bg-[#eef4f8]">
          Voltar
        </Button>
        <span className={AUTO_EYEBROW}>Identificação</span>
        <span className="w-16" />
      </AutoShellHeader>

      <div className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y p-6 sm:p-10">
        <div className={`${AUTO_STORE_MAX} max-w-md py-4 sm:py-8`}>
          <div className="mb-10">
            <p className={AUTO_EYEBROW}>Cliente</p>
            <h2 className={`${AUTO_DISPLAY} mt-2`}>Quem está comprando?</h2>
            <p className={`${AUTO_SUBHEADING} mt-3`}>
              CPF, CNPJ ou telefone — ou continue sem identificar.
            </p>
          </div>

          <form onSubmit={handleSearch} className={`${AUTO_EDITORIAL_PANEL} space-y-5`}>
            <div>
              <label className={`block mb-2 ${AUTO_LABEL}`}>CPF, CNPJ ou telefone</label>
              <div className="relative">
                <Input
                  type="tel"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Somente números"
                  className={`pr-12 ${AUTO_FIELD_CLASS}`}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 ${AUTO_ACCENT_TEXT} hover:bg-white/60 rounded-lg`}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className={AUTO_PRIMARY_BTN}>
              {loading ? 'Buscando...' : 'Continuar'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <Button variant="outline" className={AUTO_GHOST_BTN} onClick={onSkip}>
              Continuar sem identificar
            </Button>
            <Button
              variant="ghost"
              className={`w-full h-12 rounded-lg ${AUTO_ACCENT_TEXT} hover:bg-white/80`}
              onClick={onRegister}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar novo cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
