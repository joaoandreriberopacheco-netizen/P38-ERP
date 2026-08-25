#!/usr/bin/env node
import { buildCatalogTourSteps } from '../lib/catalogoTour.mjs';

const steps = buildCatalogTourSteps({ qtyLabelPl: 'paletes' });
const ok = steps.length >= 5 && steps.length <= 8
  && steps[0].center === true
  && steps.some((s) => s.selector === '#search' || s.selectorDesktop);

console.log(JSON.stringify({ ok, steps: steps.length, ids: steps.map((s) => s.id) }, null, 2));
process.exit(ok ? 0 : 1);
