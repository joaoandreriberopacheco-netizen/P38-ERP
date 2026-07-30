#!/usr/bin/env bash
# Sincroniza env de produção no projecto Vercel (Next.js + fallback Vite).
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

supabase_url="${VITE_SUPABASE_URL:-}"
supabase_anon="${VITE_SUPABASE_ANON_KEY:-}"
provider="${VITE_P38_PROVIDER:-supabase}"
bypass="${VITE_P38_BYPASS_BASE44:-true}"
use_auth="${VITE_P38_USE_SUPABASE_AUTH:-true}"
google_login="${VITE_P38_ENABLE_GOOGLE_LOGIN:-}"

echo "[sync-vercel-env] A actualizar env vars de produção no Vercel (Next.js)…"

# Next.js (produção canónica)
add_env NEXT_PUBLIC_P38_PROVIDER "$provider"
add_env NEXT_PUBLIC_P38_BYPASS_BASE44 "$bypass"
add_env NEXT_PUBLIC_SUPABASE_URL "$supabase_url" 1
add_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$supabase_anon" 1
add_env NEXT_PUBLIC_P38_USE_SUPABASE_AUTH "$use_auth"
add_env NEXT_PUBLIC_P38_ENABLE_GOOGLE_LOGIN "$google_login"

# VITE_* — scripts locais / api/auth-p38.js / p38PublicEnv fallback
add_env VITE_P38_PROVIDER "$provider"
add_env VITE_P38_BYPASS_BASE44 "$bypass"
add_env VITE_SUPABASE_URL "$supabase_url" 1
add_env VITE_SUPABASE_ANON_KEY "$supabase_anon" 1
add_env VITE_P38_USE_SUPABASE_AUTH "$use_auth"
add_env VITE_P38_ENABLE_GOOGLE_LOGIN "$google_login"

if [ -n "${P38_AUTH_URL:-}" ]; then
  add_env P38_AUTH_URL "${P38_AUTH_URL}"
elif [ -n "$supabase_url" ]; then
  add_env P38_AUTH_URL "${supabase_url%/}/functions/v1/p38-auth"
fi

echo "[sync-vercel-env] OK."
