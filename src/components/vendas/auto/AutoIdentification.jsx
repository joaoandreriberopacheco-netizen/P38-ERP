import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, ArrowRight, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { AUTO_HEADER_CLASS, AUTO_PRIMARY_BTN, AUTO_SHELL_BG, AUTO_SURFACE_CLASS, AUTO_FIELD_CLASS, AUTO_ACCENT_TEXT } from './autoAtendimentoUi';

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
    <div className={`flex-1 flex flex-col min-h-screen ${AUTO_SHELL_BG}`}>
      <header className={AUTO_HEADER_CLASS}>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white hover:bg-indigo-700 hover:text-white"
        >
          Voltar
        </Button>
        <span className="font-bold">Identificação</span>
        <span className="w-16" />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Quem está comprando?</h2>
            <p className="text-muted-foreground">CPF, CNPJ ou telefone — ou continue sem identificar.</p>
          </div>

          <form
            onSubmit={handleSearch}
            className={`${AUTO_SURFACE_CLASS} p-6 space-y-4`}
          >
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                CPF, CNPJ ou telefone
              </label>
              <div className="relative">
                <Input
                  type="tel"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Somente números"
                  className={`h-12 text-lg pr-12 rounded-xl ${AUTO_FIELD_CLASS}`}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 ${AUTO_ACCENT_TEXT} hover:bg-secondary/60 dark:hover:bg-[#26262e] rounded-lg`}
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={`w-full h-12 ${AUTO_PRIMARY_BTN}`}
            >
              {loading ? 'Buscando...' : 'Continuar'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={onSkip}
            >
              Continuar sem identificar
            </Button>
            <Button
              variant="ghost"
              className={`w-full h-12 rounded-xl ${AUTO_ACCENT_TEXT}`}
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
