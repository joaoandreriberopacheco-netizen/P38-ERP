#!/usr/bin/env node
/**
 * Notificação Pulso diário — mensagem simples para João André.
 *
 * GitHub: comenta issue aberta com label pulse-diario (João recebe email se inscrito).
 * Telegram (opcional): secrets PULSE_NOTIFY_TELEGRAM_BOT_TOKEN + PULSE_NOTIFY_TELEGRAM_CHAT_ID
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUMMARY_IN = path.join(ROOT, 'docs/pulse/pulse-diario-summary.json');

/** GitHub username — recebe assign na issue digest. */
const NOTIFY_ASSIGNEE = process.env.PULSE_NOTIFY_GITHUB_USER || 'joaoandreriberopacheco-netizen';
const ISSUE_LABEL = 'pulse-diario';
const ISSUE_TITLE = '🔔 Pulso diário — notificações para João André';

function loadSummary() {
  if (!fs.existsSync(SUMMARY_IN)) {
    throw new Error(`Resumo não encontrado: ${SUMMARY_IN}. Corra primeiro: npm run pulse:diario`);
  }
  return JSON.parse(fs.readFileSync(SUMMARY_IN, 'utf8'));
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Rio_Branco',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatMessage(summary) {
  const when = formatDate(summary.finishedAt || summary.collectedAt);
  const lines = [`☀️ *Pulso diário* — ${when}`, ''];

  if (summary.status === 'ok') {
    lines.push('✅ *Tudo OK* — nada a rever hoje.');
    lines.push(`• Trem: ${summary.trem.passed}/${summary.trem.total}`);
    lines.push(`• Shipping: ${summary.shipping.passed}/${summary.shipping.total}`);
    return lines.join('\n');
  }

  if (summary.status === 'fixed') {
    lines.push('⚙️ *Encontrámos algo e corrigimos sozinhos* — confirma quando puderes.');
    lines.push('');
    for (const fix of summary.autoFixes) {
      lines.push(`• ${fix.phase}: ${fix.action}`);
    }
    lines.push('');
    lines.push(`• Trem: ${summary.trem.passed}/${summary.trem.total}`);
    lines.push(`• Shipping: ${summary.shipping.passed}/${summary.shipping.total}`);
    lines.push('');
    lines.push('_Sugestão: abre rapidamente os ecrãs que costumas usar de manhã._');
    return lines.join('\n');
  }

  lines.push('⚠️ *Precisa da tua revisão* — não conseguimos corrigir sozinhos.');
  lines.push('');

  if (summary.trem.failures?.length) {
    lines.push('*Trem (ecrã):*');
    for (const f of summary.trem.failures.slice(0, 5)) {
      lines.push(`• ${f.route} — parou em \`${f.failedAt}\`${f.error ? ` (${f.error})` : ''}`);
    }
  } else if (!summary.trem.ok) {
    lines.push(`*Trem:* falhou (${summary.trem.passed ?? '?'}/${summary.trem.total ?? '?'})`);
  }

  if (summary.shipping.failures?.length) {
    lines.push('');
    lines.push('*Shipping (processo):*');
    for (const f of summary.shipping.failures.slice(0, 5)) {
      lines.push(`• ${f.label || f.id} — parou em \`${f.failedAt}\`${f.error ? ` (${f.error})` : ''}`);
    }
  } else if (!summary.shipping.ok && !summary.shipping.attempts?.[0]?.skipped) {
    lines.push('');
    lines.push(`*Shipping:* falhou (${summary.shipping.passed ?? '?'}/${summary.shipping.total ?? '?'})`);
  }

  if (summary.autoFixes?.length) {
    lines.push('');
    lines.push('*Já tentámos:*');
    for (const fix of summary.autoFixes) {
      lines.push(`• ${fix.action}`);
    }
  }

  if (summary.workflowUrl) {
    lines.push('');
    lines.push(`[Ver detalhes no GitHub Actions](${summary.workflowUrl})`);
  }

  return lines.join('\n');
}

function gh(args, input) {
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `gh ${args.join(' ')} falhou`);
  }
  return result.stdout.trim();
}

function findOrCreateDigestIssue() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return null;

  try {
    const listed = gh([
      'issue', 'list',
      '--repo', repo,
      '--label', ISSUE_LABEL,
      '--state', 'open',
      '--limit', '1',
      '--json', 'number',
    ]);
    const issues = JSON.parse(listed || '[]');
    if (issues.length > 0) return issues[0].number;

    const url = gh([
      'issue', 'create',
      '--repo', repo,
      '--title', ISSUE_TITLE,
      '--label', ISSUE_LABEL,
      '--assignee', NOTIFY_ASSIGNEE,
      '--body', 'Issue de digest do Pulso diário. Cada comentário = resumo de uma corrida (trem + shipping).\n\nInscreve-te nesta issue para receber email do GitHub.',
    ]);
    const match = url.match(/\/issues\/(\d+)/);
    return match ? Number(match[1]) : null;
  } catch (err) {
    console.warn('[pulse:notify] GitHub issue:', err.message);
    return null;
  }
}

function notifyGitHub(message, summary) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.log('[pulse:notify] Fora do GitHub Actions — mensagem só na consola.');
    return false;
  }

  const issueNumber = findOrCreateDigestIssue();
  if (!issueNumber) return false;

  const body = `${message.replace(/\*/g, '**')}\n\n---\n\`status\`: ${summary.status} · \`trem\`: ${summary.trem.passed}/${summary.trem.total} · \`shipping\`: ${summary.shipping.passed}/${summary.shipping.total}`;

  gh(['issue', 'comment', String(issueNumber), '--repo', repo, '--body', body]);
  console.log(`[pulse:notify] Comentário na issue #${issueNumber} (@${NOTIFY_ASSIGNEE})`);
  return true;
}

async function notifyTelegram(message) {
  const token = process.env.PULSE_NOTIFY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.PULSE_NOTIFY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message.replace(/\*/g, '*'),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram: ${err}`);
  }
  console.log('[pulse:notify] Telegram enviado');
  return true;
}

async function main() {
  const summary = loadSummary();
  const message = formatMessage(summary);

  console.log('\n--- Notificação Pulso diário ---\n');
  console.log(message.replace(/\*/g, ''));
  console.log('\n--------------------------------\n');

  await notifyTelegram(message).catch((err) => {
    console.warn('[pulse:notify]', err.message);
  });
  notifyGitHub(message, summary);
}

main().catch((err) => {
  console.error('[pulse:notify]', err.message);
  process.exit(1);
});
