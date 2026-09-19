# Maná ERP — governança para agentes Cursor

## Dois agentes, dois repos

| Agente | Repo | Supabase | Utilizador |
|--------|------|----------|------------|
| **P38 Operação** | `P38-ERP` | Produção `zhonvxkkqabfdyehyxpu` | Equipa + bugs do dia |
| **Maná Laboratório** | `mana-erp` | Sandbox `xmjppfivqyaqxwxdrorn` | João (experiências) |

## Regras P38 (produção)

1. Prioridade: **corrigir bugs** que afectam a operação — não funcionalidades novas.
2. Commit directo na `main` (regra existente do repo).
3. **Nunca** puxar código do Maná sem promoção explícita do João.
4. Validar com `npm run build`.

## Regras Maná (laboratório)

1. Ambiente de **testes** — dados fictícios; banner `NEXT_PUBLIC_P38_ENV=mana`.
2. **Proibido** usar secrets de produção P38.
3. **Proibido** PR/push para `P38-ERP` sem o João dizer: *"aprovo promoção para o P38"* (ou equivalente).
4. **Sync P38 → Maná** quando o João pedir *"atualiza o Maná com o P38"* ou rotina semanal:
   - `git fetch` do upstream P38
   - merge na `main` do mana-erp
   - clonar schema/migrações novas se houver (`db:apply-migrations` com `DATABASE_URL` Maná)
   - registo em `docs/SYNC_LOG.md`
5. Promoção Maná → P38: PR ou cherry-pick + checklist em `docs/mana/PROMOCAO_CHECKLIST.md`.

## O que o João controla

- **Sim/não** para promoção Maná → P38
- **Descrição** do bug ou da experiência
- **Não** controla Git, migrações nem sync (agente)

## Frases úteis (João)

| Frase | Agente |
|-------|--------|
| "O caixa / PDV / financeiro não funciona" | P38 |
| "Quero testar…" | Maná |
| "Atualiza o Maná com o P38" | Maná |
| "Aprovado — pode levar para o P38" | Maná (executa promoção) |
