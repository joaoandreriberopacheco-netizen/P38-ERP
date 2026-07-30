import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // Evita que `src/pages/*.jsx` (rotas Vite) sejam tratadas como Pages Router do Next.
  pageExtensions: ['next.jsx', 'next.js', 'next.tsx', 'next.ts'],
  // Prédio novo: auth/Supabase só no browser durante a migração paralela.
  experimental: {
    disableOptimizedLoading: true,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      sonner: path.resolve(__dirname, './src/lib/sonner-shim.js'),
      'sonner-original': path.resolve(__dirname, 'node_modules/sonner'),
    };
    return config;
  },
};

export default nextConfig;
