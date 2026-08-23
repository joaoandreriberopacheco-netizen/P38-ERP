'use client';

/**
 * Estação do corredor Pulso — deixa a "saca de cartas" (marcadores) para o comboio recolher.
 * Não carrega a página de negócio; só expõe os IDs que o manifesto espera.
 */
export default function PulseStation({ pageName, route, label, module, letters }) {
  const mail = {
    station: pageName,
    route,
    label,
    module: module || null,
    letters: letters.map(({ id, label: letterLabel, type }) => ({ id, label: letterLabel, type })),
  };

  return (
    <section
      data-pulse-station={pageName}
      data-pulse-route={route}
      className="rounded-lg border border-border/50 bg-card/40 px-4 py-3"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="truncate text-xs text-muted-foreground">{route}</span>
      </header>

      {/* Saca de cartas — metadados que o comboio lê ao passar */}
      <div data-pulse-mail hidden>
        {JSON.stringify(mail)}
      </div>

      <ul className="flex flex-wrap gap-2">
        {letters.map((letter) => (
          <li key={letter.id}>
            <span
              data-pulse-sensor={letter.id}
              data-pulse-letter={letter.label}
              className="inline-block rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
              title={letter.label}
            >
              {letter.id}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
