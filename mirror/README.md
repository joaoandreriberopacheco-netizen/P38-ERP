# Espelho UI local (P38-ERP)

Pasta de **exportação opcional** de snapshot da UI para comparação ou cópia manual. **Não entra no build de produção.**

> **Ago/2026:** O ambiente **Mana** (Supabase `Mana ERP`, Vercel `mana-erp`, sync GitHub → a29-erp) foi **removido**. Produção continua só em **P38** (`zhonvxkkqabfdyehyxpu` + `p-38_erp` no Vercel).

## Uso local

```bash
npm run mirror:pack
```

Gera `mirror/p38-ui/` e carimbos em `mirror/live/` (`VAREJO_UI_SYNC.stamp`, `mirrorpass`).

Os scripts `mirror:push` e `mirror:sync` ainda existem para push manual a outro diretório local, se precisares — **não há destino canónico no GitHub.**

## Carimbo de auditoria

Cada `mirror:pack` gera **`VAREJO_UI_SYNC.stamp`** com `export_id`, commit, data e branch.

Palavra-chave: **`VAREJO_UI_SYNC`**

## Estrutura

```
mirror/
├── README.md
├── live/               ← carimbos (mirrorpass, stamp)
└── p38-ui/             ← espelho UI (gerado por mirror:pack; gitignored)
```

Lista do pacote: [`p38-ui/INVENTARIO.md`](./p38-ui/INVENTARIO.md).

## Notas

- Conteúdo gerado por `mirror:pack` fica fora do Git (ver `.gitignore` em `p38-ui/`).
- Referência histórica A29/Mana: `docs/reference-a29-erp/` (só leitura local, gitignored checkout).
