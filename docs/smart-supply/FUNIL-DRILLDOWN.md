# Funil Smart Supply — drill-down 5 vs 6 níveis

Design: tabela **aberta**, linhas **finas**, sem sombras (tokens em `smartSupplyCursorTableTheme.js`).

## Mix (5 níveis) — ex. Linha Soldável, cerâmica

```
Categoria → LINHA → Produto compra → SKU
```

Alerta sobe; reposição desce até ao SKU (bitola / cor).

## Portfólio + kit (6 níveis) — ex. FORRO PVC

```
Categoria → LINHA → Faixa → Modelo portfólio → Papel kit → SKU
```

- **Faixa** agrupa portfólio vs mix PVC vs mix metálico na mesma LINHA (sem abas).
- **Modelo** só em `faixa=portfolio`.
- **Kit** só em portfólio — entre modelo e SKU.
- Mix metálico (armação) alerta a LINHA inteira, como argamassa na cerâmica.

## UI

- Smart Supply preview: `HierarquiaPortal` → tab **SMART SUPPLY**.
- Expand/collapse por linha; LED cítrico/vermelho propaga nos níveis superiores.
