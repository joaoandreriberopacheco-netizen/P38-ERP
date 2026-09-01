import { P38PageHeader } from '@/components/layout/P38PageHeader';
import DizimoPlano from '@/components/financeiro/dizimo/DizimoPlano';

export default function DizimoPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-4 overflow-x-hidden">
      <P38PageHeader
        variant="page"
        title="Dízimo"
        description="Décima parte do lucro líquido operacional estimado — separada para o Criador"
      />

      <DizimoPlano />
    </div>
  );
}
