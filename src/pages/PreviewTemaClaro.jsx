/**
 * Preview do modo claro P38 — sem dados reais, só superfícies e contraste.
 * Aceder em /PreviewTemaClaro (com npm run dev:preview = sem login).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { p38Table } from '@/lib/p38TableSurfaces';
import { P38_PALETTE } from '@/lib/p38Palette';
import { contrastRatio } from '@/lib/p38Contrast';
import { Sun, Moon, ArrowRight, Palette } from 'lucide-react';

const SWATCHES = [
  { name: 'Oliva mediterrâneo', token: 'primary', hex: P38_PALETTE.olive.hex },
  { name: 'Limão P38', token: 'lime', hex: P38_PALETTE.lime.hex },
  { name: 'Amarelo cítrico', token: 'citrus-yellow', hex: P38_PALETTE.citrusYellow.hex },
  { name: 'Laranja cítrico', token: 'citrus-orange', hex: P38_PALETTE.citrusOrange.hex },
  { name: 'Fundo claro', token: 'background', hex: P38_PALETTE.light.bg },
  { name: 'Superfície', token: 'card', hex: P38_PALETTE.light.surface },
];

const SAMPLE_PAGES = [
  { path: '/Home', label: 'Home' },
  { path: '/Vendas', label: 'Vendas' },
  { path: '/Produtos', label: 'Produtos' },
  { path: '/Financeiro', label: 'Financeiro' },
  { path: '/RelatorioMargem', label: 'Relatório Margem' },
  { path: '/ImportacaoProdutos', label: 'Importação Produtos' },
];

function useThemeToggle() {
  const [isDark, setIsDark] = React.useState(() => {
    try {
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  const setTheme = React.useCallback((dark) => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setIsDark(dark);
  }, []);

  React.useEffect(() => {
    setTheme(false);
  }, [setTheme]);

  return { isDark, toggle: () => setTheme(!isDark), setLight: () => setTheme(false), setDark: () => setTheme(true) };
}

function ContrastBadge({ fg, bg, label }) {
  const ratio = contrastRatio(fg, bg).toFixed(1);
  const ok = Number(ratio) >= 4.5;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${
        ok ? 'bg-p38-olive/10 text-p38-olive border-p38-olive/30' : 'bg-red-50 text-red-700 border-red-200'
      }`}
    >
      {label}: {ratio}:1 {ok ? '✓' : '✗'}
    </span>
  );
}

export default function PreviewTemaClaro() {
  const { isDark, toggle, setLight, setDark } = useThemeToggle();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-din-1451">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-p38-olive dark:text-p38-lime mb-1">
              <Palette className="w-5 h-5" />
              <span className="text-xs uppercase tracking-widest font-medium">Preview local</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-wide">Modo claro P38</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Demonstração de contraste (fundo · texto · contorno). Sem login — dados mock.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={setLight} className="gap-1.5">
              <Sun className="w-4 h-4" /> Claro
            </Button>
            <Button variant="outline" size="sm" onClick={setDark} className="gap-1.5">
              <Moon className="w-4 h-4" /> Escuro
            </Button>
            <Button variant="secondary" size="sm" onClick={toggle}>
              Alternar ({isDark ? 'escuro' : 'claro'})
            </Button>
          </div>
        </header>

        {/* Paleta */}
        <section className="p38-panel">
          <div className="p38-panel__accent-bar" />
          <div className="p38-panel__body space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Paleta P38</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SWATCHES.map((s) => (
                <div key={s.token} className="rounded-xl border border-border overflow-hidden">
                  <div className="h-14" style={{ backgroundColor: s.hex }} />
                  <div className="p-2 text-xs">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground font-mono">{s.hex}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <ContrastBadge fg={P38_PALETTE.light.text} bg={P38_PALETTE.light.bg} label="Texto/fundo" />
              <ContrastBadge fg="#fafafa" bg={P38_PALETTE.olive.hex} label="Botão oliva" />
              <ContrastBadge fg={P38_PALETTE.citrusOrange.hex} bg={P38_PALETTE.light.surface} label="Cítrico/cartão" />
            </div>
          </div>
        </section>

        {/* Botões */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold uppercase tracking-wide">Botões</h2>
          <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-card border border-border">
            <Button>Primário (oliva)</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Ghost</Button>
            <button type="button" className="p38-btn-primary px-4 py-2 rounded-md text-sm">
              .p38-btn-primary
            </button>
            <button type="button" className="p38-btn-outline px-4 py-2 rounded-md text-sm">
              .p38-btn-outline
            </button>
            <span className="p38-badge-citrus px-3 py-1.5 rounded-full text-xs font-medium self-center">
              Badge cítrico
            </span>
          </div>
        </section>

        {/* Cartões e painel */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wide">Cartão shadcn</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <span className="text-foreground font-medium">Título legível</span> — texto secundário com contraste
                adequado no fundo branco.
              </p>
              <p className="p38-text-accent font-semibold tabular-nums">R$ 1.234,56 lucro</p>
            </CardContent>
          </Card>

          <div className={`relative ${p38Table.panel}`}>
            <div className={`absolute left-3 top-3 bottom-3 w-[3px] rounded-sm ${p38Table.panelAccentBar}`} />
            <div className="pl-7 pr-4 py-4 space-y-2">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">Painel tabela (mobile)</p>
              <p className="font-medium">Texto em cartão — antes era branco em branco</p>
              <p className="text-sm text-muted-foreground">Agora usa text-card-foreground</p>
            </div>
          </div>
        </section>

        {/* Tipografia */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold uppercase tracking-wide">Tipografia</h2>
          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
            <p className="text-base">Corpo — peso 400 no claro (mais robusto que o escuro 300)</p>
            <p className="font-medium">Medium — labels e destaques</p>
            <p className="font-semibold">Semibold — valores e totais</p>
            <p className="p38-line-title">Título de linha mobile P38</p>
          </div>
        </section>

        {/* Links para páginas reais */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold uppercase tracking-wide">Páginas corrigidas</h2>
          <p className="text-sm text-muted-foreground">
            Navegue para ver o tema aplicado (dados podem estar vazios sem Supabase real).
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PAGES.map((p) => (
              <Link
                key={p.path}
                to={p.path}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-card border border-border hover:bg-accent transition-colors"
              >
                {p.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            ))}
          </div>
        </section>

        <footer className="text-xs text-muted-foreground border-t border-border pt-4">
          Preview local · <code className="text-foreground/80">npm run dev:preview</code> · sem deploy Vercel
        </footer>
      </div>
    </div>
  );
}
