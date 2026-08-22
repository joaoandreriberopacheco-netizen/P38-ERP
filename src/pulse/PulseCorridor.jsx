'use client';

import { PULSE_CORRIDOR } from '@/pulse/corridorManifest.generated';
import PulseStation from '@/pulse/PulseStation';

/**
 * Linha vertical do Pulso — todas as estações numa página; o comboio passa uma vez.
 */
export default function PulseCorridor() {
  const { stations } = PULSE_CORRIDOR;

  return (
    <div
      data-pulse-corridor
      data-pulse-station-count={stations.length}
      className="mx-auto min-h-screen max-w-3xl space-y-3 bg-background px-4 py-6 font-mono text-foreground"
    >
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 pb-4 backdrop-blur">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Pulso — corredor</p>
        <h1 className="text-xl font-semibold">Linha de estações</h1>
        <p className="text-sm text-muted-foreground">
          {stations.length} estações · cada uma deixa a saca de cartas para o comboio recolher
        </p>
      </header>

      <div data-pulse-track className="space-y-2">
        {stations.map((station) => (
          <PulseStation
            key={station.pageName}
            pageName={station.pageName}
            route={station.route}
            label={station.label}
            module={station.module}
            letters={station.letters}
          />
        ))}
      </div>

      <footer data-pulse-terminal className="border-t border-border/40 pt-4 text-center text-xs text-muted-foreground">
        Terminal — fim da linha
      </footer>
    </div>
  );
}
