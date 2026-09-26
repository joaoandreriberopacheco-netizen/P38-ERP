# Stack operacional P38-ERP

| Camada | Ferramenta | Papel |
|--------|------------|--------|
| Desenvolvimento | **Cursor** (Cloud Agent / IDE) | Código, scripts, PRs |
| Código | **GitHub** | Repositório, Actions, secrets de CI |
| Frontend | **Vercel** | Deploy do app (preview + produção) |
| Dados + auth + Edge Functions | **Supabase** | Postgres, Storage, `functions/v1/*` |

**Base44 não está ligado a este projeto.** O nome `base44` no código é legado de compatibilidade (`base44Client` → cliente P38/Supabase).

## Secrets mínimos

- **Vercel / build:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `VITE_*` legado)
- **Scripts admin / Cloud Agent:** `SUPABASE_SERVICE_ROLE_KEY` + URL Supabase
- **Migrações / deploy Supabase:** `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`

Guia: [`P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md`](P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md)

## Scripts de compras (ex.: acordo órfão KA2-K4Q)

```bash
npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs        # dry-run
npx vite-node scripts/aplicar-ka2-k4q-pendente-acordo.mjs --apply
```

Cliente: `scripts/p38-supabase-script-client.mjs` (service role).

## UI vs operação (acordo órfão legado)

- **Pedidos novos:** um ecrã só — registro do acordo financeiro **com** ajuste na folha (sem passo separado de “completar baixa”).
- **Pedido com acordo antigo sem folha** (ex. KA2-K4Q): o modal **informa** e bloqueia novo lançamento; a baixa é feita no Supabase via script (`aplicar-ka2-k4q-pendente-acordo.mjs`), não na UI.

## Vercel — env no servidor

As rotas `/api/p38-edge/*` precisam de `NEXT_PUBLIC_SUPABASE_URL` (e anon key) nas **Environment Variables** do projeto Vercel. O app no browser também chama a Edge Function **directo** no Supabase quando o bundle tem a URL pública — evita o erro “não configurado no servidor” se o proxy Vercel falhar.
