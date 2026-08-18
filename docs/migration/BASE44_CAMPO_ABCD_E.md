# Base44 — classe **E** no campo `abcd` da entidade Produto

Após o merge da curva ABCDE, actualize o schema da entidade **Produto** na consola Base44.

## 1. Entidade Produto — enum `abcd`

No editor de schema da entidade `Produto`, o campo `abcd` deve aceitar **E**:

```json
"abcd": {
  "type": "string",
  "enum": ["A", "B", "C", "D", "E"],
  "description": "Classificação ABCDE: A–D por participação no lucro do subtipo; E = sem venda no período."
}
```

**Alternativa:** copiar o bloco completo de [`base44/entities/Produto.jsonc`](../../base44/entities/Produto.jsonc) e sincronizar com o painel (se o conector Git ↔ Base44 estiver activo, o push em `main` pode já reflectir a função; o enum da entidade por vezes exige confirmação manual no editor).

## 2. Função `calcularIEP`

Confirme no painel Base44 que a função **`calcularIEP`** está na versão **`V17-grupo-h2-pareto-7095105-e-sem-venda`** (código em [`base44/functions/calcularIEP/entry.ts`](../../base44/functions/calcularIEP/entry.ts)).

## 3. Executar o job ABCDE

**Opção A — automático (recomendado)**  
Todo **sábado à meia-noite** (hora de Tabatinga) o GitHub Actions corre `abcd:recalcular` e grava `produto.abcd` no Supabase.  
Pré-requisitos: secrets `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no GitHub; `ABCD_JOB_NOTURNO=true` na Edge Function (`npm run abcd:enable-noturno`).

**Opção B — no app (manual)**  
Configurações → ferramenta **Curva ABCD** → «Recalcular todos» ou «Só vazios».

**Opção C — terminal / agente**

```bash
npm run abcd:recalcular              # recalcula todos
npm run abcd:recalcular -- --somente-vazios
```

**Opção D — console do browser (legado Base44)**  
`npm run abcd:executar-console` — só se ainda usares Base44 como backend.

## 4. Verificação rápida

1. Catálogo → filtro **E** → deve listar produtos sem venda nos últimos 90 dias.
2. Um produto com vendas recentes deve manter A/B/C/D conforme o subtipo.
