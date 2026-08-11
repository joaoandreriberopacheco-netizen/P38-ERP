import React, { useCallback, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildPortalMassaCriticaRelatorio } from '@/lib/hierarquiaPortal/portalMassaCriticaCusto';
import { toast } from 'sonner';

export default function PortalMassaCriticaRelatorioButton({
  filteredSupply = [],
  filterSummary = '',
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  const handleGerar = useCallback(async () => {
    if (!filteredSupply.length) {
      toast.message('Nenhuma esquadra no filtro actual.');
      return;
    }
    setLoading(true);
    try {
      const relatorio = buildPortalMassaCriticaRelatorio(filteredSupply);
      const { generatePortalMassaCriticaRelatorioPdf } = await import(
        '@/lib/hierarquiaPortal/generatePortalMassaCriticaRelatorioPdf'
      );
      await generatePortalMassaCriticaRelatorioPdf({
        ...relatorio,
        filters_summary: filterSummary,
      });
      toast.success('Relatório PDF gerado.');
    } catch (e) {
      console.error('[PortalMassaCriticaRelatorio]', e);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }, [filteredSupply, filterSummary]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      disabled={disabled || loading || !filteredSupply.length}
      onClick={handleGerar}
      title="Estimativa de investimento para massa crítica (filtro actual)"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="h-3.5 w-3.5" />
      )}
      Relatório massa crítica
    </Button>
  );
}
