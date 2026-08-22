import { Link } from 'react-router-dom';
import { ArrowLeftRight, Package, Ship, CheckSquare, PackageSearch, ClipboardList } from 'lucide-react';
import { createPageUrl } from '@/components/utils';
import { P38PageHeader, P38SectionHeader } from '@/components/layout/P38PageHeader';
import { P38_LIGHT_JUICE_OLIVE_WASH } from '@/lib/p38LightTheme';
import { cn } from '@/components/utils';

/**
 * Central de estoque: atalhos para fluxos diferentes, mantendo ajuste pontual separado de conferência/auditoria.
 */
export default function EstoquePage() {
  const links = [
    {
      to: createPageUrl('ContagemExpress'),
      icon: ClipboardList,
      title: 'Contagem Express',
      desc: 'Contagem rápida com carrinho e confirmação por PIN',
    },
    {
      to: createPageUrl('MovimentosInventario'),
      icon: ArrowLeftRight,
      title: 'Movimentos de inventário',
      desc: 'Entradas e saídas pontuais para ajustes manuais de saldo',
    },
    {
      to: createPageUrl('Produtos'),
      icon: Package,
      title: 'Produtos',
      desc: 'Cadastro, estoque atual e ajustes vinculados ao catálogo',
    },
    {
      to: createPageUrl('ConferenciaEstoque'),
      icon: CheckSquare,
      title: 'Conferência de estoque',
      desc: 'Contagens e conferências formais',
    },
    {
      to: createPageUrl('InterfaceSeparador'),
      icon: PackageSearch,
      title: 'Separação de pedidos',
      desc: 'Fila e separação para expedição',
    },
    {
      to: createPageUrl('ItinerarioFluvial'),
      icon: Ship,
      title: 'Boats',
      desc: 'Itinerário fluvial e logística',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className={cn('rounded-2xl border border-border/40 p-5 shadow-sm', P38_LIGHT_JUICE_OLIVE_WASH)}>
        <P38PageHeader
          variant="page"
          title="Central de Estoque"
          description="Escolha o fluxo correto para cada operação. Movimentos de inventário servem para ajustes pontuais; conferência e auditoria continuam separados para contagens formais."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex gap-3 rounded-2xl border border-border/40 bg-card p-4 shadow-sm transition-colors hover:bg-secondary/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/40">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <P38SectionHeader title={title} description={desc} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
