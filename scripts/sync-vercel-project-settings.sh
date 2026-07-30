#!/usr/bin/env bash
# Garante que o projecto Vercel está em Next.js (corte Vite → Next).
# O `vercel pull` traz settings antigas (ex.: outputDirectory=dist) que quebram `vercel build`.
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN em falta}"

project_name="${VERCEL_PROJECT_NAME:-p-38_erp}"
build_cmd="${VERCEL_BUILD_COMMAND:-node scripts/generate-next-page-registry.mjs && next build}"
install_cmd="${VERCEL_INSTALL_COMMAND:-npm ci}"

echo "[sync-vercel-project] A alinhar framework/build do projecto ${project_name}…"

result=$(npx --yes vercel@latest project update "$project_name" \
  --framework nextjs \
  --build-command "$build_cmd" \
  --install-command "$install_cmd" \
  --auto-detect output-directory \
  --format json \
  --token "$VERCEL_TOKEN")

changed=$(printf '%s' "$result" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).changed?'1':'0')}catch{console.log('0')}})")
if [ "$changed" = "1" ]; then
  echo "[sync-vercel-project] Settings actualizadas no Vercel."
else
  echo "[sync-vercel-project] Settings já estavam correctas."
fi

# `vercel pull` sobrescreve .vercel/project.json — remover outputDirectory localmente.
if [ -f .vercel/project.json ]; then
  node -e "
    const fs = require('fs');
    const p = '.vercel/project.json';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j.settings) {
      j.settings.framework = 'nextjs';
      j.settings.buildCommand = process.env.VERCEL_BUILD_COMMAND || 'node scripts/generate-next-page-registry.mjs && next build';
      j.settings.installCommand = process.env.VERCEL_INSTALL_COMMAND || 'npm ci';
      delete j.settings.outputDirectory;
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  "
  echo "[sync-vercel-project] .vercel/project.json corrigido (sem outputDirectory dist)."
fi

echo "[sync-vercel-project] OK."
