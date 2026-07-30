import React from 'react';
import { FinanceiroGrupo } from '@/components/financeiro/fluxo/FinanceiroListaShared';
import { calcularTotaisGrupo } from '@/lib/agefinPrevisaoCalculos';
import AgefinPrevisaoRow from './AgefinPrevisaoRow';

function ListaLinhas({ items, modelosMap, onOpen, flat = false }) {
  const content = (
    <>
      {items.map((c, i) => (
        <AgefinPrevisaoRow
          key={c.id}
          competencia={c}
          modelo={modelosMap[c.serie_id]}
          onClick={onOpen}
          striped={i % 2 === 1}
        />
      ))}
    </>
  );

  if (flat) {
    return (
      <div className="min-w-0 w-full max-w-full overflow-x-hidden rounded-xl border border-border/50">
        {content}
      </div>
    );
  }

  return content;
}

function SecaoGrupo({ label, items, modelosMap, onOpen }) {
  if (!items?.length) return null;
  const totais = calcularTotaisGrupo(items, modelosMap);

  return (
    <FinanceiroGrupo
      label={`${label} (${items.length})`}
      labelClassName="text-[10px] font-medium normal-case tracking-normal text-muted-foreground"
      receitas={0}
      despesas={totais.total}
      liquido={-totais.total}
      card={false}
      defaultOpen
    >
      <div className="pl-1 sm:pl-2">
        <ListaLinhas items={items} modelosMap={modelosMap} onOpen={onOpen} />
      </div>
    </FinanceiroGrupo>
  );
}

export default function AgefinPrevisaoLista({
  grupos = [],
  competencias = [],
  modelosMap,
  onOpen,
  semAgrupamento = false,
}) {
  if (semAgrupamento) {
    return <ListaLinhas items={competencias} modelosMap={modelosMap} onOpen={onOpen} flat />;
  }

  if (!grupos.length) {
    return <ListaLinhas items={competencias} modelosMap={modelosMap} onOpen={onOpen} flat />;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-2 overflow-x-hidden pb-2 md:pb-0">
      {grupos.map((grupo) => (
        <SecaoGrupo
          key={grupo.key}
          label={grupo.label}
          items={grupo.items}
          modelosMap={modelosMap}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
