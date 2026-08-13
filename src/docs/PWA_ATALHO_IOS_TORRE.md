# Torre de Controle — manual operacional

## Objetivo

Receber documentos partilhados (comprovante, boleto, PDF de pedido, etc.) e encaminhar para o destino certo no P38 — financeiro, compras ou logística.

---

## Atalho iOS (sem Web Share Target)

Usar a Torre de Controle no iOS sem depender de Web Share Target, com base em conteúdo copiado e/ou seleção manual de arquivo.

### Passos no app Atalhos (iOS)

1. Criar atalho com ação para **obter texto/URL** da partilha ou da área de transferência.
2. Abrir URL:
   - `/AnexoCompartilhado?destino=torre&clipboard=1`
3. No app P38, tocar em **Colar da área de transferência**.

---

## Lançamentos financeiros (comprovante)

Fluxo típico: pagamento ou transferência entre contas → partilhar o comprovante → Torre → **Financeiro**.

### Vincular a lançamento existente

1. Partilhe o ficheiro → Torre de controle → tipo **Comprovante** (ou adequado).
2. **Financeiro** → **Lançamento existente**.
3. A lista mostra por defeito os **lançamentos de hoje** (mais recentes primeiro).
4. Se o OCR leu o valor, os lançamentos **parecidos aparecem no topo** — o valor **não esconde** a lista.
5. Escolha o lançamento → **Vincular** → o comprovante fica anexado.

**Filtros:** Hoje (padrão) → 7 dias → Mês → Todas. **Limpar** repõe período e busca.

### Criar lançamento novo (com anexo automático)

1. Partilhe o comprovante → Torre → **Financeiro** → **Novo lançamento**.
2. Abre o formulário no Fluxo de Caixa (valor/descrição sugeridos quando o OCR leu).
3. Preencha e **Salve** (funciona para despesa, receita e **transferência entre contas**).
4. O comprovante é anexado **automaticamente** após gravar (em transferência, nos **dois** lançamentos da par).
5. No fim:
   - **Outro lançamento (S)** — continua no formulário para registrar mais um.
   - **Concluir (N)** — termina o fluxo e tenta voltar à app anterior / fechar o P38.

> **Nota:** Com a data de corte histórica recente, a lista de “hoje” pode começar curta até haver movimentos no dia.

---

## Comportamento por plataforma

- **iOS (PWA):**
  - Melhor fluxo: `clipboard.readText()` (texto/URL) + botão **Selecionar arquivo**.
  - Colagem de binário via clipboard pode variar por versão/permissões.

- **Desktop/Android:**
  - **Selecionar arquivo** via input nativo.
  - **Colar** tenta `clipboard.read()` para PDF/imagem e fallback para `readText()`.
  - **Android / partilhar PDF:** o service worker tem de estar activo. Fallback: **Selecionar arquivo** ou **Colar**.

---

## Observações

- Se a permissão de clipboard estiver bloqueada, a Torre exibe mensagem e mantém o utilizador na mesma etapa.
- O share target nativo (manifest + service worker) continua ativo para navegadores/plataformas compatíveis.
- Se vir "Method Not Allowed" ao partilhar, abra o app uma vez, actualize o PWA e tente de novo.
