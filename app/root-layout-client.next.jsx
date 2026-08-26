'use client';

import '@/index.css';
import { Providers } from './providers.next';

const themeBootScript = `
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
  if (localStorage.getItem('p38_orientation_mode') === 'landscape') {
    localStorage.setItem('p38_orientation_mode', 'auto');
  }
  document.documentElement.removeAttribute('data-p38-force-landscape');
} catch (_) {}
`;

export default function RootLayoutClient({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>P38 | ERP</title>
        <meta name="description" content="P38 ERP — sistema integrado de gestão empresarial." />
        <link rel="icon" type="image/png" href="/brand/p38-app-icon.png" />
        <link rel="shortcut icon" href="/brand/p38-app-icon.png" />
        <link rel="apple-touch-icon" href="/brand/p38-app-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
