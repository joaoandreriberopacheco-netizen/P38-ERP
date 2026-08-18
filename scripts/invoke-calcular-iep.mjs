#!/usr/bin/env node
/**
 * Dispara o job calcularIEP na Base44 (admin).
 * Preferir: npm run abcd:recalcular (Supabase). Job semanal: sábado 00:00 Tabatinga.
 * Requer VITE_BASE44_APP_ID + BASE44_ACCESS_TOKEN ou BASE44_API_KEY nos secrets.
 */
import { requireFlareClient } from './flare-sdk.mjs';

const base44 = requireFlareClient();
const resp = await base44.functions.invoke('calcularIEP', {});
const data = resp?.data ?? resp;
console.log(JSON.stringify(data, null, 2));
