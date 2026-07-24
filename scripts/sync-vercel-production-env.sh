#!/usr/bin/env bash
# Sincroniza VITE_* para o projecto Vercel (fallback se alguém reactivar build Git nativo).
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN em falta}"

add_env() {
  local name="$1"
  local value="$2"
  local required="${3:-0}"
  if [ -z "$value" ]; then
    if [ "$required" = "1" ]; then
      echo "::error::Variável $name em falta — não é possível sincronizar env no Vercel."
      exit 1
    fi
    return 0
  fi
  printf '%s' "$value" | npx --yes vercel@latest env add "$name" production --token "$VERCEL_TOKEN" --force >/dev/null
  echo "  $name → production (Vercel)"
}

echo "[sync-vercel-env] A actualizar env vars de produção no Vercel…"
add_env VITE_P38_PROVIDER "${VITE_P38_PROVIDER:-supabase}"
add_env VITE_P38_BYPASS_BASE44 "${VITE_P38_BYPASS_BASE44:-true}"
add_env VITE_SUPABASE_URL "${VITE_SUPABASE_URL:-}" 1
add_env VITE_SUPABASE_ANON_KEY "${VITE_SUPABASE_ANON_KEY:-}" 1
add_env VITE_P38_USE_SUPABASE_AUTH "${VITE_P38_USE_SUPABASE_AUTH:-true}"
add_env VITE_P38_ENABLE_GOOGLE_LOGIN "${VITE_P38_ENABLE_GOOGLE_LOGIN:-}"
echo "[sync-vercel-env] OK."
