# P38 — Next.js em paralelo ao Vite

O **prédio novo** (Next.js App Router) vive neste repo ao lado do Vite em produção.

## Estrutura

| Pasta | Papel |
|-------|--------|
| `app/*.next.jsx` | Rotas Next (extensão `.next.jsx` — não confunde com `src/pages/`) |
| `app/[pageName]/` | **Todas as 95 páginas** via rota dinâmica + lazy load |
| `src/next/P38NextRoutePage.jsx` | Auth + Layout + página Vite |
| `src/next/shims/react-router-dom.jsx` | Link/navigate compatível com Next |
| `src/next/pageRegistry.generated.js` | Loaders lazy (gerado pelo script) |
| `src/pages/` | Componentes de página (partilhados Vite + Next) |

## Comandos

```bash
# Produção actual (Vite) — porta 5173
npm run dev

# Prédio novo (Next) — porta 3000
npm run dev:next

# Build Next (validação CI / preview)
npm run build:next
```

## Variáveis de ambiente

Durante a transição, gravar **as duas convenções** no Vercel/GitHub (ou só `NEXT_PUBLIC_*` no preview Next):

| Vite | Next |
|------|------|
| `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `VITE_P38_PROVIDER=supabase` | `NEXT_PUBLIC_P38_PROVIDER=supabase` |
| `VITE_P38_USE_SUPABASE_AUTH=true` | `NEXT_PUBLIC_P38_USE_SUPABASE_AUTH=true` |

A leitura unificada está em `src/lib/p38PublicEnv.js`.

## Rotas disponíveis no Next

- `/` — Home
- `/Produtos`, `/PDVCaixa`, `/Financeiro`, … (95 páginas — mesmo nome que no Vite)
- `/login`, `/auth/callback`, `/ativar-acesso`

Regenerar registry após adicionar ficheiro em `src/pages/`:

```bash
node scripts/generate-next-page-registry.mjs
```

## Build Next (CI / local)

O `npm run build:next` exige as variáveis `NEXT_PUBLIC_*` (mínimo Supabase + provider).
Em local, podes copiar de `.env.local` ou exportar antes do build:

```bash
export NEXT_PUBLIC_P38_PROVIDER=supabase
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
export NEXT_PUBLIC_P38_USE_SUPABASE_AUTH=true
npm run build:next
```

No preview Vercel, gravar os mesmos nomes `NEXT_PUBLIC_*` no projecto de preview.

## Deploy

- **Produção** (`p-38erp.vercel.app`): continua Vite até ao corte.
- **Preview Next**: projecto ou branch Vercel separado com `build:next` e env `NEXT_PUBLIC_*`.

## Ordem de migração de rotas

1. ~~Login + Home~~ (feito)
2. ~~Layout + 95 páginas via `[pageName]`~~ (feito — lazy load)
3. Testes E2E por módulo (PDV, compras, financeiro)
4. Preview Vercel com `build:next`
5. Corte de produção Vite → Next

## Checklist do corte

- [ ] Rotas críticas migradas e testadas no preview Next
- [ ] `npm run build:next` no CI
- [ ] Workflow Vercel usa `build:next`
- [ ] Domínio de produção aponta para Next
- [ ] Remover Vite (`vite.config.js`, `index.html`, scripts antigos)
