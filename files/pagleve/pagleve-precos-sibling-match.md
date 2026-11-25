# PagLeve — preços por “irmão” (próximo passo)

**Status:** planejado — executar **depois** do sweep de imagens/fichas oficiais (228 itens Casa Israel). **Não** rodar em paralelo com a conferência de URLs no site do fabricante.

## Contexto

O Excel da Casa Israel (`raio-x-pagleve-site-verificado` / estoque SIAH) **não traz preço de venda**. Preços entram hoje sobretudo via OCR dos scans SIAH fornecedor (`fornecedor-siah-scans/` → `precos-siah-fornecedor.csv`), mas muitos itens ficam **sem preço** na publicação.

## Regra (João André — nov/2026)

Para qualquer produto **sem preço** no catálogo atual:

1. **Formato primeiro** — procurar outros produtos do **mesmo formato** que **já tenham** preço no catálogo vigente.
2. **Refinar o “irmão”** antes de importar/adaptar:
   - **Acabamento** (ex.: bold vs retificado; polido dentro de retificado; brilhante vs acetinado vs mate)
   - **Espessura / linha** quando a descrição ERP indicar (evitar misturar premium e básico no mesmo formato)
3. **Importar/adaptar** o preço do irmão escolhido — método “sibling-match”, não chute por formato sozinho.

## O que evitar

- Copiar preço só porque o formato é 90×90 ou 57×57, sem olhar acabamento/linha.
- Usar site de varejo (Noval, Vivian, Locmaster, etc.) como fonte de preço — esta regra é de **catálogo interno**; preço de fornecedor continua sendo SIAH/scans quando existir.

## Ordem de trabalho sugerida

1. Concluir sweep oficial: nome comercial, fabricante, URL oficial, contagem de imagens (228 itens).
2. Implementar/revisar sibling-match de preços nos scripts de publicação PagLeve (`catalogo:publicar-pagleve`), com trilha de auditoria (código irmão + motivo).
3. Revisão humana em formatos com alta mistura de linhas (ex.: 90×90 Plus, 57×57 HD).

## Referências no repo

| Recurso | Uso |
|---------|-----|
| `pagleve-fabricantes-sites-oficiais.md` | Fabricante e URL — independente de preço |
| `scripts/lib/paglevePrecosSiah.mjs` | Preços extraídos SIAH |
| `scripts/catalogo/pagleve-extrair-precos-siah.mjs` | OCR scans |