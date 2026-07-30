import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Falha o build em produção se provider=supabase sem credenciais (evita bundle quebrado no Vercel). */
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
          '[P38] Build de produção com VITE_P38_PROVIDER=supabase exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. ' +
            'Use o workflow GitHub Actions "Vercel Deploy" (não deploy Git nativo da Vercel).'
        )
      }
    },
  }
}

export default defineConfig({
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
      '@': path.resolve(__dirname, './src'),
      sonner: path.resolve(__dirname, './src/lib/sonner-shim.js'),
      'sonner-original': path.resolve(__dirname, 'node_modules/sonner'),
    },
  },
  server: {
    proxy: {
      '/api/auth-p38': {
        target: 'https://zhonvxkkqabfdyehyxpu.supabase.co/functions/v1/p38-auth',
        changeOrigin: true,
        secure: true,
        rewrite: () => '',
      },
    },
  },
})
