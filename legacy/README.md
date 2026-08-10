# Legado — não usar em produção

Produção: **Next.js** (`app/`, `npm run dev`, `npm run build`) → Vercel.

Esta pasta guarda artefactos da transição Base44/Vite, mantidos só para referência ou desenvolvimento local opcional.

| Item | Papel |
|------|--------|
| `vite/vite.config.js` | Dev server Vite (`npm run dev:vite`) |
| `../index.html` (raiz) | Entry HTML do Vite — **não** do Next |
| `../base44/` | Funções e metadados Base44 históricos |
| `../vercel.vite.legacy.json` | Config Vercel antiga (framework: vite) |

**Não adicionar features novas aqui.** Novo código vai para `app/`, `src/` e `supabase/`.
