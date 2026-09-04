import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // Evita que `src/pages/*.jsx` (rotas Vite) sejam tratadas como Pages Router do Next.
  pageExtensions: ['next.jsx', 'next.js', 'next.tsx', 'next.ts'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-icons',
      'recharts',
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      '@base44/sdk': path.resolve(__dirname, './src/integrations/p38/base44SdkShim.js'),
      'react-router-dom': path.resolve(__dirname, './src/next/shims/react-router-dom.jsx'),
      sonner: path.resolve(__dirname, './src/lib/sonner-shim.js'),
      'sonner-original': path.resolve(__dirname, 'node_modules/sonner'),
    };
    return config;
  },
};

export default nextConfig;
