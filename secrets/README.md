# Chaves P38 — ficheiro mestre (Cloud)

João, este é o **único sítio** onde colas todas as chaves no Cursor Cloud — sem escrever uma a uma no painel Secrets.

## Passo a passo

```bash
npm run secrets:init
```

Isto cria `secrets/p38-chaves.txt` (a partir do modelo `p38-chaves.exemplo.txt`).

1. Abre **`secrets/p38-chaves.txt`** no editor
2. Cola os valores depois de cada `=` (formato `NOME=valor`)
3. **Grava** o ficheiro
4. Valida:

```bash
npm run secrets:check -- --context=cloud-agent
```

## Como funciona

- Todos os scripts do repo leem automaticamente `secrets/p38-chaves.txt`
- Este ficheiro **sobrepõe** secrets antigos/errados do painel Cursor
- O código distribui cada chave para onde precisa (`DATABASE_URL`, `VITE_*`, deploy, etc.)

## Segurança

| Fazer | Não fazer |
|-------|-----------|
| Editar só `secrets/p38-chaves.txt` | Commitar este ficheiro (está no `.gitignore`) |
| Correr `secrets:check` depois de gravar | Colar chaves no chat com o agente |
| Usar o modelo `p38-chaves.exemplo.txt` como referência | Partilhar o ficheiro por email/WhatsApp |

## DATABASE_URL — atenção

O project ref P38 é **`zhonvxkkqabfdyehyxpu`**. Na connection string pooler, o utilizador deve ser:

```
postgres.zhonvxkkqabfdyehyxpu
```

Se for `postgres.OUTRO_REF`, estás noutro projecto Supabase.

## Documentação completa

[`docs/migration/P38_SECRETS_CANONICOS.md`](../docs/migration/P38_SECRETS_CANONICOS.md)
