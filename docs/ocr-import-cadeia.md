# Importação OCR — cadeia flexível (pedido / cotação / lista)

## Princípio

1. **Não depender de layout** — cada fornecedor muda colunas, cabeçalhos e ordem. Parsers por distribuidor quebram com frequência.
2. **Código do fornecedor ≠ código P38** — `121161` (MASS) quase nunca é o `AR3-20K` do catálogo. Match é só por **descrição** (nome, marca, embalagem no catálogo P38).
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

- **Não** usa código numérico do fornecedor nem EAN do PDF para auto-vincular.
- **Usa** descrição do documento vs hierarquia/nome do produto no P38 (tokens + similaridade).
- Sem match claro → linha na revisão com busca pré-preenchida pela **descrição** lida do PDF.

## Padrões vs layout por fornecedor

| Camada | O que faz | Depende do nome do ERP? |
|--------|-----------|-------------------------|
| **① Groq (primário)** | Lê o texto e monta JSON | **Não** — entende colunas diferentes |
| **② Padrões locais** | Descrição + qtde + R$ por linha | **Não** — regex em qualquer PDF |
| **③ Linha genérica** | Último recurso por linha de texto | **Não** |
| ~~Layout MASS/Tintão~~ | Legado; fundido nos padrões acima | Evitar novos parsers por nome |

**Para não ficar na mão sem Cursor:** mantenha `GROQ_API_KEY` no Supabase (Edge Functions) e `VITE_P38_OCR_GROQ_PRIMARY=true` (default). Novos fornecedores devem funcionar pela camada ①; ② só entra se a IA falhar ou estiver offline.

### O que você controla (sem programar)

1. **Groq ligado** — secret `GROQ_API_KEY` no Supabase (grátis em [console.groq.com](https://console.groq.com/keys)).
2. **Não desligar a IA** — não definir `VITE_P38_OCR_GROQ_PRIMARY=false` nem `VITE_P38_OCR_CLOUD_FALLBACK=false`.
3. **Revisão humana** — o importador sempre mostra os itens antes de gravar; PDF estranho = ajustar na tela, não precisa de código.

### Quando ainda precisaria de código

Só PDF **sem texto** (scan ruim) ou **sem** descrição/valores legíveis — aí o OCR de imagem ou ajuste manual.
