# PagLeve — sites oficiais (fonte da verdade)

**Regra:** fabricante e descrição só entram na tabela quando houver **página no site oficial** (URL gravada). Sem regra ERP, sem “consenso por formato”, sem fallback inventado.

---

## Grupos que você citou

| Grupo / holding | Site oficial (catálogo) | Marcas no site (exemplos) | Como o P38 já estuda isso |
|-----------------|-------------------------|---------------------------|---------------------------|
| **Grupo Formigres** | https://www.formigres.com.br | Formigres, Premium, Prime, Marcela, Stargolden, JG | API `busca.php` + `produto.php` — catálogo Tintão |
| **Lume Cerâmica** | https://lumeceramica.com.br/produtos/ | Lume, Megalume, Megalume Premium, Linha Tesoro Polidos | A fazer (site + PDF; sem API igual Formigres) |
| **Carmelo Fior** | https://www.carmelofior.com.br/produtos | **Arielle**, **Cecafi**, **Fiorano**, **Idealle** (cada uma = categoria no site) | API Arielle + fichas `/produto/{slug}`; 90×90 ex. `solaria-plus-rt-90x90`, `dream-plus-rt-90x90` |
| **Grupo Rocha** (pisos) | https://www.portalgruporocha.com.br | Rocha Cerâmica, Rocha Porcelanato, Ecoforte, **Rochaforte** (marca do grupo) | A fazer (estrutura do portal) |

**Não confundir:**

- **`ROCHAPRIME` / `ROCHAMAXX` na descrição do SIAH** = linhas comerciais ligadas ao **catálogo Formigres** (Santa Gertrudes), não ao portal “Grupo Rocha” acima.
- **Rochaforte (pisos)** = marca do **Grupo Rocha** (Cordeirópolis) — site do grupo: portalgruporocha.com.br.
- **rochaforte.ind.br** = empresa de **esmaltes/matéria-prima** (Içara/SC), **não** é catálogo de piso para loja.

Outros fornecedores comuns (fora da sua lista, mas no ecossistema P38):

| Grupo | Site |
|-------|------|
| Grupo Ceral | https://www.ceralpisos.com.br/produtos (Ceral, Luna, Rosa, Unique, Belle) |
| Cerbras | https://novo.cerbras.com/todos-produtos/ |
| **Grupo Incopisos** | https://grupoincopisos.com.br/produto/… — nome (`ladrillo-red`) ou **HD** `hd-160104` (HD 160.104 sem ponto, prefixo `hd-`) |
| **Cedasa** | https://www.cedasa.com.br |
| **Cecafi / Etna (ERP)** | No SIAH costuma vir como **Cecafi**; no site do **grupo Carmelo Fior** a ficha traz a marca real (Cecafi, Fiorano, Idealle…) | Priorizar `carmelofior.com.br/produto/…` antes de Formigres |

**Indicações João André (out/2026):** Marcelagres/Novara e Siena = Formigres 50×50; 57×57 “7×57” no OCR = **grupo Carmelo Fior** (marcas Cecafi/Fiorano/Idealle no site); 58×58 “8×58” = Cedasa; 22×90 = Lume; 32×58 / 39×75 = Incopisos; 38×75 = linhas do grupo Carmelo Fior.

---

## O que estava errado no CSV anterior (`raio-x-pagleve-fabrica.csv`)

- Preenchia **fabricante** por heurística (`HD` → Formigres, consenso 70×70, etc.).
- Tratava **tudo sem match** como “Formigres” com texto ERP — **isso não é prova de site**.
- **Rochaforte** nem aparecia como grupo à parte.

**Esse arquivo deve ser tratado como rascunho descartável** para atribuição de fábrica. A tabela certa é a próxima fase (abaixo).

---

## Tabela alvo (fase 1 — só site)

Uma linha por item do `raio-x-produtos.csv`:

| Coluna | Conteúdo |
|--------|----------|
| `codigo` | Do ERP |
| `formato` | Do raio-x |
| `descricao_erp` | Texto original |
| `fabricante_grupo` | Só após confirmar no site: ex. `Formigres`, `Lume`, `Carmelo Fior`, `Grupo Rocha` |
| `marca_no_site` | Ex. Marcela, Arielle, Rochaforte |
| `descricao_no_site` | Título/texto da ficha oficial |
| `evidencia_url` | URL da página do produto (ou busca oficial que abre a ficha) |
| `status` | `confirmado_site` \| `nao_encontrado` \| `pendente` |
| `sites_consultados` | Lista de domínios onde buscou (auditoria) |

**Códigos do relatório SIAH (PR…, R…, código da coluna):** são **código interno do fornecedor/ERP** — **não** usar para buscar no site. A pista é o **texto da descrição** (nome do modelo, linha comercial, acabamento).

**Fluxo por item (sem inventar):**

1. Montar busca: `{formato} {nome modelo}` extraído da descrição (como 62×119 Calacatta → Lume).
2. Abrir resultado que seja **domínio oficial** da tabela acima.
3. Se não achou em um grupo, **não** assumir outro — marcar `pendente` ou `nao_encontrado`.
4. Se o ERP diz `ROCHAPRIME`, buscar primeiro em **formigres.com.br**; se o negócio diz Rochaforte, buscar em **portalgruporocha.com.br** — são grupos diferentes.

---

## Próximo passo técnico (quando você autorizar)

1. Zerar colunas inventadas e gerar `raio-x-pagleve-site-verificado.csv` só com `pendente` em todas as linhas.
2. Conector **Formigres**: só gravar linha quando `busca.php` / ficha devolver match com score + URL (já existe no P38).
3. Conector **Carmelo Fior**: idem snapshot Arielle + URL.
4. Conector **Lume** + **Grupo Rocha**: implementar busca no site (HTML ou catálogo) **sem** fallback ERP.
5. Opcional: você revisa em lote por **formato** (70×70, 45×45…) só para **priorizar** buscas, não para **decidir** fabricante sem URL.

Nada de imagem ou preço até esta coluna `evidencia_url` estiver aceite.
