#!/usr/bin/env bash
# Espelha o branch p38-catalogo-b2b para o repositório dedicado (quando existir no GitHub).
set -euo pipefail

REPO="${1:-joaoandreriberopacheco-netizen/p38-catalogo-b2b}"
URL="https://github.com/${REPO}.git"

if ! git ls-remote "$URL" HEAD &>/dev/null; then
  echo "Repositório ainda não existe: $URL"
  echo ""
  echo "Crie em https://github.com/new (público, vazio, sem README):"
  echo "  Nome: p38-catalogo-b2b"
  echo ""
  echo "Depois corra de novo: npm run repo:publicar"
  exit 1
fi

git remote remove github-catalogo 2>/dev/null || true
git remote add github-catalogo "$URL"
git push github-catalogo main:main
echo ""
echo "OK: https://github.com/${REPO}"
