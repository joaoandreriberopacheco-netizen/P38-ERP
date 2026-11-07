# Corte financeiro — 06/11/2026

## Comportamento no P38 (produção)

- Data de corte histórico padrão: `2026-11-06` (`src/lib/filtroDataFinanceiro.js`).
- Fluxo de Caixa abre com período **Tudo** (desde o corte, sem chip “este mês” por defeito).
- Saldo = `saldo_inicial` na abertura do corte + movimentação paga desde 06/11.
- Aba **Caixas e Bancos** e **Fluxo**: por defeito **Caixa Geral, Banco do Brasil e PagBank** (Caixa PDV fora da lista).
- Fluxo: Poupança / Caixa PJ fora da carteira padrão (ícone carteira); ainda visíveis no seletor.

## Aplicar saldos de abertura na Supabase (uma vez)

1. No Supabase → **Database** → connection string (URI), copiar para `DATABASE_URL` (não commitar).
2. Na pasta `P38-ERP`:

```powershell
cd C:\dev\P38-ERP
$env:DATABASE_URL = "postgresql://..."   # colar URI
npm run financeiro:contas-ativas          # conferir nomes e valores alvo
npm run financeiro:corte-2026-11-06       # dry-run
npm run financeiro:corte-2026-11-06:apply # gravar saldo_inicial + ajustes
```

Valores de abertura (regra automática): Caixa Geral / PDV / BB → 0; Poupança CAIXA → 5997; Caixa PJ → 8,55.
