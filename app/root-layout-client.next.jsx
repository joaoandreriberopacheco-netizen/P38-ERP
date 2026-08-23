'use client';

import '@/index.css';
import { Providers } from './providers.next';

const themeBootScript = `
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
  if (localStorage.getItem('p38_orientation_mode') === 'landscape' && window.innerHeight > window.innerWidth) {
    var w = window.innerWidth, h = window.innerHeight;
    document.documentElement.setAttribute('data-p38-force-landscape', 'true');
    document.documentElement.style.setProperty('--p38-force-landscape-shift', w + 'px');
    document.documentElement.style.setProperty('--p38-force-landscape-width', h + 'px');
    document.documentElement.style.setProperty('--p38-force-landscape-height', w + 'px');
    document.documentElement.style.setProperty('--p38-stage-height', w + 'px');
    document.documentElement.style.setProperty('--p38-stage-width', h + 'px');
  }
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
