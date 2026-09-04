/**
 * Config Vite legada — NÃO é produção (produção = Next.js em `app/`).
 * Uso: npm run dev:vite | npm run build:vite
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const supabaseProjectUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

function requireSupabaseEnvForProduction() {
  return {
    name: 'p38-require-supabase-env',
    config(_config, { mode }) {
      if (mode !== 'production') return
      const provider = String(process.env.VITE_P38_PROVIDER || '').toLowerCase().trim()
      if (provider !== 'supabase') return
      const url = String(process.env.VITE_SUPABASE_URL || '').trim()
      const key = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim()
      if (!url || !key) {
        throw new Error(
          '[P38] Build de produção com VITE_P38_PROVIDER=supabase exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
        )
      }
    },
  }
}

export default defineConfig({
  root: repoRoot,
  plugins: [
    requireSupabaseEnvForProduction(),
    react(),
    base44({
      legacySDKImports: false,
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, './src'),
      sonner: path.resolve(repoRoot, './src/lib/sonner-shim.js'),
      'sonner-original': path.resolve(repoRoot, 'node_modules/sonner'),
    },
  },
  server: {
    proxy: {
      ...(supabaseProjectUrl
        ? {
            '/api/auth-p38': {
              target: `${supabaseProjectUrl}/functions/v1/p38-auth`,
              changeOrigin: true,
              secure: true,
              rewrite: () => '',
            },
            '/api/p38-core': {
              target: `${supabaseProjectUrl}/functions/v1/p38-core`,
              changeOrigin: true,
              secure: true,
              rewrite: () => '',
            },
            '^/api/p38-edge': {
              target: supabaseProjectUrl,
              changeOrigin: true,
              secure: true,
              rewrite: (p) => p.replace(/^\/api\/p38-edge/, '/functions/v1'),
            },
          }
        : {}),
    },
  },
})
