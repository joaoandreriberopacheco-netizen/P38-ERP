#!/usr/bin/env node
/**
 * Corrige padrões dark-first que quebram contraste no modo claro.
 * Uso: node scripts/fix-light-mode-contrast.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const SRC = path.join(process.cwd(), 'src');

/** @type {Array<[RegExp, string]>} */
const REPLACEMENTS = [
  // Painéis / cartões — texto branco em fundo claro
  [
    /bg-background dark:bg-card text-white dark:text-foreground/g,
    'bg-card text-card-foreground',
  ],
  [
    /bg-card dark:bg-card text-white dark:text-foreground/g,
    'bg-card text-card-foreground',
  ],
  [
    /bg-muted dark:bg-muted text-white dark:text-foreground/g,
    'bg-muted text-foreground',
  ],
  [
    /bg-background text-white dark:text-foreground/g,
    'bg-muted text-foreground',
  ],
  // Botões primários — hover que apaga contraste
  [
    /bg-primary hover:bg-card text-white dark:bg-primary dark:text-primary-foreground dark:hover:bg-card/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/80 dark:border-transparent',
  ],
  [
    /bg-primary hover:bg-card text-white dark:bg-primary dark:text-primary-foreground/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/80 dark:border-transparent',
  ],
  // Botões com text-white redundante
  [
    /bg-primary hover:bg-primary\/90 text-white dark:bg-primary dark:text-primary-foreground/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground',
  ],
  [
    /bg-primary text-white dark:bg-primary dark:text-primary-foreground/g,
    'bg-primary text-primary-foreground',
  ],
  [
    /bg-primary text-white hover:bg-primary\/90/g,
    'bg-primary text-primary-foreground hover:bg-primary/90',
  ],
  // Seleção calendário / chips
  [
    /bg-primary text-white hover:bg-primary dark:bg-primary dark:text-primary-foreground/g,
    'bg-primary text-primary-foreground hover:bg-primary/90',
  ],
  [
    /bg-muted dark:bg-card text-white dark:text-foreground/g,
    'bg-muted text-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /bg-background dark:bg-muted text-white dark:text-foreground/g,
    'bg-muted text-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /bg-primary hover:bg-background text-white dark:bg-muted dark:text-foreground/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /bg-primary hover:bg-background dark:bg-muted dark:text-foreground text-white/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /bg-primary text-white dark:bg-muted dark:text-foreground/g,
    'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /bg-primary dark:bg-card text-white dark:text-foreground/g,
    'bg-primary text-primary-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /bg-card dark:bg-muted text-white dark:text-foreground/g,
    'bg-card text-card-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /text-white dark:text-foreground\/90/g,
    'text-primary-foreground dark:text-foreground/90',
  ],
  [
    /bg-background text-white dark:bg-card dark:text-foreground/g,
    'bg-primary text-primary-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /bg-background text-white dark:bg-muted dark:text-foreground/g,
    'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground',
  ],
  [
    /bg-background hover:bg-primary dark:bg-muted dark:hover:bg-muted dark:text-foreground text-white/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:hover:bg-muted dark:text-foreground',
  ],
  [
    /bg-background hover:bg-primary dark:bg-card dark:hover:bg-muted dark:text-foreground text-white/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-card dark:hover:bg-muted dark:text-foreground',
  ],
  [
    /bg-background hover:bg-primary text-white/g,
    'bg-primary hover:bg-primary/90 text-primary-foreground',
  ],
  [
    /rounded-xl bg-background text-white hover:bg-primary dark:bg-card dark:text-foreground/g,
    'rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground',
  ],
  [
    /rounded-2xl bg-background text-white hover:bg-primary dark:bg-card dark:text-foreground/g,
    'rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground',
  ],
  [
    /rounded-2xl bg-background text-base font-semibold text-white dark:bg-card dark:text-foreground/g,
    'rounded-2xl bg-primary text-base font-semibold text-primary-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /rounded-2xl bg-background text-white dark:bg-card dark:text-foreground/g,
    'rounded-2xl bg-primary text-primary-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /rounded-2xl bg-background px-4 text-white hover:bg-primary dark:bg-card dark:text-foreground/g,
    'rounded-2xl bg-primary px-4 text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground',
  ],
  [
    /rounded-2xl bg-background px-5 text-white hover:bg-primary dark:bg-card dark:text-foreground/g,
    'rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground',
  ],
  [
    /bg-background text-white(?!\s+dark:)/g,
    'bg-primary text-primary-foreground',
  ],
  [
    /\? 'bg-background text-white dark:bg-card dark:text-foreground'/g,
    "? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground'",
  ],
  [
    /\? 'bg-background text-white dark:bg-muted dark:text-foreground'/g,
    "? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'",
  ],
  [
    /active \? 'bg-background text-white dark:bg-card dark:text-foreground'/g,
    "active ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground'",
  ],
  [
    /active \? 'bg-background text-white dark:bg-muted dark:text-foreground'/g,
    "active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground'",
  ],
  [
    /rounded-xl bg-background px-5 text-white dark:bg-card dark:text-foreground/g,
    'rounded-xl bg-primary px-5 text-primary-foreground dark:bg-card dark:text-foreground',
  ],
  [
    /h-10 rounded-2xl bg-background px-3 text-sm font-medium text-white hover:bg-primary dark:bg-muted dark:text-foreground dark:hover:bg-card/g,
    'h-10 rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground dark:hover:bg-card',
  ],
  [
    /h-10 rounded-2xl bg-background px-3 text-white hover:bg-primary dark:bg-card dark:text-foreground/g,
    'h-10 rounded-2xl bg-primary px-3 text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground',
  ],
  [
    /h-9 gap-1\.5 rounded-xl bg-background px-4 text-xs text-white hover:bg-primary dark:bg-muted dark:text-foreground/g,
    'h-9 gap-1.5 rounded-xl bg-primary px-4 text-xs text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground',
  ],
  [
    /border-border\/40 bg-background text-white dark:border-white dark:bg-card dark:text-foreground/g,
    'border-primary/30 bg-primary text-primary-foreground dark:border-white dark:bg-card dark:text-foreground',
  ],
  [
    /text-white dark:text-foreground/g,
    'text-primary-foreground dark:text-foreground',
  ],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(full, files);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let totalFiles = 0;
let totalReplacements = 0;

for (const file of walk(SRC)) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of REPLACEMENTS) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      const count = (before.match(pattern) || []).length;
      totalReplacements += count;
      changed = true;
    }
  }
  if (changed) {
    totalFiles += 1;
    if (!DRY_RUN) fs.writeFileSync(file, content);
    console.log(DRY_RUN ? '[dry-run] ' : '', path.relative(process.cwd(), file));
  }
}

console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'} ${totalFiles} files (${totalReplacements} replacements).`);
