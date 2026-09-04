#!/usr/bin/env bash
# Escreve no GitHub Actions Step Summary um link clicável para abrir o deploy.
set -euo pipefail

url="${1:?URL em falta}"
label="${2:-Abrir no browser}"
kind="${3:-preview}"

login_url="${url%/}/login"
produtos_url="${url%/}/Produtos"

{
  echo "## ✅ Build concluído"
  echo ""
  echo "[**👉 ${label}**](${url})"
  echo ""
  echo "| Atalho | Link |"
  echo "|--------|------|"
  echo "| App | [${url}](${url}) |"
  echo "| Login | [${login_url}](${login_url}) |"
  echo "| Produtos | [${produtos_url}](${produtos_url}) |"
  echo ""
  if [ "$kind" = "production" ]; then
    echo "Deploy em **produção** — alterações já visíveis em \`p-38erp.vercel.app\`."
  else
    echo "Preview **antes** de produção — \`p-38erp.vercel.app\` só muda após merge na \`main\`."
  fi
} >> "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY em falta}"

echo "::notice title=${label}::${url}"
