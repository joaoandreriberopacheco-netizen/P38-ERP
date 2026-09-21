# Importação OCR — cadeia flexível (pedido / cotação / lista)

## Princípio

1. **Não depender de layout** — cada fornecedor muda colunas, cabeçalhos e ordem. Parsers por distribuidor quebram com frequência.
2. **Código do fornecedor ≠ código P38** — `121161` (MASS) quase nunca é o `AR3-20K` do catálogo. Match é por **descrição semântica** (e EAN quando existir no cadastro).
3. **Uma leitura flexível por documento** — Groq/Llama (tier gratuito) estrutura o JSON a partir do texto OCR; parsers locais ficam só como **fallback offline**.

## Fluxo (pedido, cotação PDF, lista foto)

```
PDF/imagem
  → ① OCR local (pdf.js ou Paddle) — só texto
  → ② Groq estrutura JSON (layout-agnóstico) — ~1 req/doc
  → ③ Parser por regras — só se ② falhar ou IA desligada
  → Match local por descrição + hierarquia do catálogo
  → Revisão humana no importador
```

Boleto e comprovante mantêm parser local primeiro (campos fixos: linha digitável, valor).

## Variáveis de ambiente (cliente)

| Variável | Default | Efeito |
|----------|---------|--------|
| `VITE_P38_OCR_CLOUD_FALLBACK` | `true` | Liga/desliga chamadas Groq |
| `VITE_P38_OCR_GROQ_PRIMARY` | `true` | Pedido/cotação/lista: IA **antes** do parser por layout |

## Match com catálogo

- **Não** usa código numérico do fornecedor para auto-vincular.
- **Usa** descrição, marca, tokens da hierarquia P38, fuzz parcial.
- **Usa** código de barras (EAN 8+ dígitos) quando o produto está cadastrado com barras.
- Sem match claro → linha na revisão com busca pré-preenchida pela descrição do PDF.

## Parsers locais (MASS, Tintão, …)

Mantidos como rede de segurança (sem internet, limite Groq, PDF muito simples). Não são o caminho principal de evolução.
