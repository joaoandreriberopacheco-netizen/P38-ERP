# Excel Smart Supply — FORRO PVC (portfólio + kit)

Folha **`Catálogo SKUs`** em `docs/P38-catalogo-skus-completo.xlsx` (mesmo ficheiro do piloto cerâmica).

## Colunas (ordem)

| # | Coluna | Obrigatório | Exemplo cerâmica | Exemplo forro PVC |
|---|--------|-------------|------------------|-------------------|
| A | `categoria` | sim | E - PISOS E REVESTIMENTOS | B - COBERTURAS E FORROS |
| B | `codigo_interno` | sim | ABC-123 | XYZ-456 |
| C | `linha` | sim | CERÂMICA BOLD | FORRO PVC |
| D | `faixa` | forro | *(vazio)* | `portfolio` · `mix_pvc` · `mix_metal` |
| E | `modelo_portfolio` | portfólio | *(vazio)* | Amadeirado · Liso · Frisado |
| F | `kit_papel` | portfólio+kit | *(vazio)* | Lâmina · Perfil U · Emenda |
| G | `produto_compra` | sim | CAL SUPERCAL | LÂMINA FORRO PVC |
| H | `ex_a` | variável | 45x45 | Cerejeira |
| I | `ex_b` | variável | BANDEIRANTE 46 | 8×20×6m |
| J | `novo_sku` | sim | nome vitrine | FORRO PVC AMADEIRADO CEREJEIRA… |

Cerâmica e mix soldável: deixar **D–F vazios** → funil de **5 níveis** (categoria → LINHA → produto compra → SKU).

Forro PVC: preencher **faixa** (+ modelo e kit quando aplicável) → funil de **6 níveis** (… → modelo → kit → SKU).

## Faixas dentro da LINHA FORRO PVC

| `faixa` | Analogia cerâmica | Papel |
|---------|-------------------|--------|
| `portfolio` | Piso 45×45, Bold, Retif… | Variante que o cliente escolhe (modelo/acabamento) |
| `mix_pvc` | — | Peças do **mesmo sistema** PVC (perfis forro, emenda…) |
| `mix_metal` | Argamassa AC-1, AC-3… | Consumível **geral** — armação metálica, serve **toda** a linha |

## Regras

1. **`linha`** = `FORRO PVC` (código manifest `FORRO_PVC`, tipo `portfolio_kit`).
2. **`mix_pvc` / `mix_metal`**: `modelo_portfolio` e `kit_papel` vazios; `produto_compra` = esquadra (Perfil H, Armação…).
3. **`portfolio`**: `modelo_portfolio` obrigatório; `kit_papel` = papel no kit (Lâmina, Emenda…); SKU no nível 6.
4. Regenerar manifest: `npm run portal:excel-manifest`.

Exemplo CSV (referência): [`../exports/P38-forro-pvc-smart-supply-exemplo.csv`](../exports/P38-forro-pvc-smart-supply-exemplo.csv)
