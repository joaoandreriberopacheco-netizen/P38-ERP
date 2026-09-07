#!/usr/bin/env node
/**
 * Envia documentos Consórcio Missionário CBA:
 * - WhatsApp (CallMeBot): texto com resumo (sem anexos — limitação da API)
 * - Telegram: PDFs como documentos (se configurado)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPORTS = path.join(ROOT, 'exports');

const PDFS = [
  {
    file: 'consorcio_missionario_RESUMO_1pagina.pdf',
    label: 'Resumo executivo (1 página)',
  },
  {
    file: 'consorcio_missionario_ESCOPO_lideranca_CBA.pdf',
    label: 'Escopo para liderança',
  },
  {
    file: 'consorcio_missionario_cba_proposta.pdf',
    label: 'Proposta completa',
  },
];

function maskPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

function buildWhatsAppMessage() {
  const repo = process.env.GITHUB_REPOSITORY || 'joaoandreriberopacheco-netizen/varejosync';
  const branch = process.env.GITHUB_REF_NAME || 'main';
  const base = `https://github.com/${repo}/blob/${branch}/exports`;

  const lines = [
    '📄 *Consórcio Missionário CBA* — documentos prontos',
    '',
    'Foram gerados 3 PDFs:',
    '1️⃣ Resumo executivo (1 página)',
    '2️⃣ Escopo para liderança (workshop)',
    '3️⃣ Proposta completa (cenários, portes, governança)',
    '',
    '⚠️ CallMeBot só envia *texto* (sem anexo). PDFs no Telegram e no GitHub:',
    `${base}/consorcio_missionario_RESUMO_1pagina.pdf`,
    `${base}/consorcio_missionario_ESCOPO_lideranca_CBA.pdf`,
    `${base}/consorcio_missionario_cba_proposta.pdf`,
    '',
    'Resumo: programa cooperativo — 311 igrejas, R$ 80–350/mês por porte, fundo para projetos de R$ 20 mil (kit fluvial). Complementa a ME; não substitui.',
    '',
    'Set/2026 · CBA / Amazonas',
  ];
  return lines.join('\n');
}

async function notifyWhatsApp(message) {
  const phone = (process.env.PULSE_NOTIFY_WHATSAPP_PHONE || '').replace(/\D/g, '');
  const apikey = process.env.PULSE_NOTIFY_CALLMEBOT_APIKEY;
  if (!phone || !apikey) {
    console.log('[consorcio:notify] WhatsApp: credenciais em falta — ignorado');
    return { ok: false, reason: 'missing_credentials' };
  }

  const text = message.length > 1200 ? `${message.slice(0, 1197)}…` : message;
  const url = new URL('https://api.callmebot.com/whatsapp.php');
  url.searchParams.set('phone', phone);
  url.searchParams.set('text', text);
  url.searchParams.set('apikey', apikey);

  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok || /ERROR/i.test(body)) {
    throw new Error(`WhatsApp (CallMeBot): ${body || res.status}`);
  }
  console.log(`[consorcio:notify] WhatsApp enviado para ${maskPhone(phone)}`);
  return { ok: true, phoneMasked: maskPhone(phone) };
}

async function notifyTelegramDocument(filePath, caption) {
  const token = process.env.PULSE_NOTIFY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.PULSE_NOTIFY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'missing_credentials' };

  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', blob, path.basename(filePath));
  if (caption) form.append('caption', caption);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram document: ${data.description || res.status}`);
  }
  console.log(`[consorcio:notify] Telegram documento: ${path.basename(filePath)}`);
  return { ok: true };
}

async function notifyTelegramText(message) {
  const token = process.env.PULSE_NOTIFY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.PULSE_NOTIFY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'missing_credentials' };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram text: ${data.description || res.status}`);
  }
  console.log('[consorcio:notify] Telegram texto enviado');
  return { ok: true };
}

async function main() {
  const results = { whatsapp: null, telegram: { text: null, documents: [] } };

  for (const { file } of PDFS) {
    const full = path.join(EXPORTS, file);
    if (!fs.existsSync(full)) {
      throw new Error(`PDF em falta: ${full}`);
    }
  }

  const message = buildWhatsAppMessage();

  try {
    results.whatsapp = await notifyWhatsApp(message);
  } catch (err) {
    results.whatsapp = { ok: false, error: err.message };
    console.warn('[consorcio:notify]', err.message);
  }

  const hasTelegram =
    process.env.PULSE_NOTIFY_TELEGRAM_BOT_TOKEN && process.env.PULSE_NOTIFY_TELEGRAM_CHAT_ID;

  if (hasTelegram) {
    try {
      await notifyTelegramText(
        '📄 Consórcio Missionário CBA — PDFs anexados abaixo.\n\n' +
          '1. Resumo executivo\n2. Escopo liderança\n3. Proposta completa',
      );
      results.telegram.text = { ok: true };

      for (const { file, label } of PDFS) {
        try {
          const r = await notifyTelegramDocument(path.join(EXPORTS, file), label);
          results.telegram.documents.push({ file, ...r });
        } catch (err) {
          results.telegram.documents.push({ file, ok: false, error: err.message });
          console.warn(`[consorcio:notify] ${file}:`, err.message);
        }
      }
    } catch (err) {
      results.telegram.text = { ok: false, error: err.message };
      console.warn('[consorcio:notify]', err.message);
    }
  } else {
    console.log('[consorcio:notify] Telegram: credenciais em falta — ignorado');
  }

  console.log('\n--- Resultado ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('[consorcio:notify]', err.message);
  process.exit(1);
});
