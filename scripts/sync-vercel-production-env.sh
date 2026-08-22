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
  # NEXT_PUBLIC_* / VITE_* são expostas no bundle — Vercel CLI 59+ rejeita "secret" em Production.
  local sensitive_flags=()
  if [[ "$name" == NEXT_PUBLIC_* || "$name" == VITE_* ]]; then
    sensitive_flags=(--no-sensitive)
  fi
  printf '%s' "$value" | npx --yes vercel@latest env add "$name" production --token "$VERCEL_TOKEN" --force "${sensitive_flags[@]}" >/dev/null
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

# Laboratório portal / cadastro v2 — desligado em produção (só homologação)
portal_homolog="${VITE_HIERARQUIA_PORTAL_ENABLED:-false}"
cadastro_v2="${VITE_CADASTRO_PRODUTO_V2_ENABLED:-false}"
modelo_catalogo="${VITE_MODELO_CATALOGO_ENABLED:-false}"
add_env NEXT_PUBLIC_HIERARQUIA_PORTAL_ENABLED "$portal_homolog"
add_env NEXT_PUBLIC_CADASTRO_PRODUTO_V2_ENABLED "$cadastro_v2"
add_env NEXT_PUBLIC_MODELO_CATALOGO_ENABLED "$modelo_catalogo"
add_env VITE_HIERARQUIA_PORTAL_ENABLED "$portal_homolog"
add_env VITE_CADASTRO_PRODUTO_V2_ENABLED "$cadastro_v2"
add_env VITE_MODELO_CATALOGO_ENABLED "$modelo_catalogo"

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
