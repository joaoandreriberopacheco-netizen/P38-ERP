#!/usr/bin/env bash
# Sincroniza env no projecto Vercel (Next.js + fallback Vite legado).
# VERCEL_TARGET_ENV: production (default) | preview | development
set -euo pipefail
: "${VERCEL_TOKEN:?VERCEL_TOKEN em falta}"

TARGET_ENV="${VERCEL_TARGET_ENV:-production}"

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
  # NEXT_PUBLIC_* / VITE_* são expostas no bundle — Vercel CLI 59+ rejeita "secret" em Production.
  local sensitive_flags=()
  if [[ "$name" == NEXT_PUBLIC_* || "$name" == VITE_* ]]; then
    sensitive_flags=(--no-sensitive)
  fi
  printf '%s' "$value" | npx --yes "vercel@${VERCEL_CLI_VERSION:-59.6.2}" env add "$name" "$TARGET_ENV" --token "$VERCEL_TOKEN" --force "${sensitive_flags[@]}" >/dev/null
  echo "  $name → $TARGET_ENV (Vercel)"
}

# Next.js produção — NEXT_PUBLIC_* canónico; VITE_* só espelho para scripts locais.
supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
supabase_anon="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
provider="${NEXT_PUBLIC_P38_PROVIDER:-${VITE_P38_PROVIDER:-supabase}}"
bypass="${NEXT_PUBLIC_P38_BYPASS_BASE44:-${VITE_P38_BYPASS_BASE44:-true}}"
use_auth="${NEXT_PUBLIC_P38_USE_SUPABASE_AUTH:-${VITE_P38_USE_SUPABASE_AUTH:-true}}"
google_login="${NEXT_PUBLIC_P38_ENABLE_GOOGLE_LOGIN:-${VITE_P38_ENABLE_GOOGLE_LOGIN:-}}"

echo "[sync-vercel-env] A actualizar env vars ($TARGET_ENV) no Vercel (Next.js)…"

# Next.js (produção canónica)
add_env NEXT_PUBLIC_P38_PROVIDER "$provider"
add_env NEXT_PUBLIC_P38_BYPASS_BASE44 "$bypass"
add_env NEXT_PUBLIC_SUPABASE_URL "$supabase_url" 1
add_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$supabase_anon" 1
add_env NEXT_PUBLIC_P38_USE_SUPABASE_AUTH "$use_auth"
add_env NEXT_PUBLIC_P38_ENABLE_GOOGLE_LOGIN "$google_login"

# Laboratório portal / cadastro v2 — desligado em produção (só homologação)
portal_homolog="${NEXT_PUBLIC_HIERARQUIA_PORTAL_ENABLED:-${VITE_HIERARQUIA_PORTAL_ENABLED:-false}}"
cadastro_v2="${NEXT_PUBLIC_CADASTRO_PRODUTO_V2_ENABLED:-${VITE_CADASTRO_PRODUTO_V2_ENABLED:-false}}"
modelo_catalogo="${NEXT_PUBLIC_MODELO_CATALOGO_ENABLED:-${VITE_MODELO_CATALOGO_ENABLED:-false}}"
add_env NEXT_PUBLIC_HIERARQUIA_PORTAL_ENABLED "$portal_homolog"
add_env NEXT_PUBLIC_CADASTRO_PRODUTO_V2_ENABLED "$cadastro_v2"
add_env NEXT_PUBLIC_MODELO_CATALOGO_ENABLED "$modelo_catalogo"
add_env VITE_HIERARQUIA_PORTAL_ENABLED "$portal_homolog"
add_env VITE_CADASTRO_PRODUTO_V2_ENABLED "$cadastro_v2"
add_env VITE_MODELO_CATALOGO_ENABLED "$modelo_catalogo"

# VITE_* — espelho legado (dev Vite / scripts); preenchido a partir de NEXT_PUBLIC quando possível
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
