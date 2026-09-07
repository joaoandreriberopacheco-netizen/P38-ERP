# Cursor → WhatsApp (mensagens e ficheiros)

Guia simples para enviar **mensagens e arquivos** a partir do Cursor, usando o teu número WhatsApp ligado à [Whapi.Cloud](https://panel.whapi.cloud).

**Sentido:** Cursor → WhatsApp (não é para mandar prompts do telemóvel para o agente).

**Onde funciona:** Cursor **no teu computador** (Windows/Mac/Linux). O servidor MCP corre localmente; não depende do Cloud Agent.

---

## 1. Conta Whapi + número WhatsApp

1. Abre [panel.whapi.cloud](https://panel.whapi.cloud) e cria conta (há trial gratuito).
2. Cria um **canal** e liga o teu número WhatsApp (QR code, como no WhatsApp Web).
3. Quando estiver **AUTH** (conectado), na página do canal copia o **Channel token** (não uses Partner Token).

Guarda o token num gestor de passwords — não colas no chat nem no Git.

---

## 2. Token no computador (variável de ambiente)

O ficheiro `.cursor/mcp.json` deste repo já está preparado. Falta só o token no sistema:

| Nome | Valor |
|------|--------|
| `WHAPI_API_TOKEN` | Channel token copiado do painel Whapi |

### Windows

1. **Configurações** → **Sistema** → **Acerca** → **Configurações avançadas do sistema**
2. **Variáveis de ambiente** → **Novo** (utilizador)
3. Nome: `WHAPI_API_TOKEN` | Valor: o teu token
4. Fecha o Cursor por completo e abre de novo

### macOS / Linux

No terminal (substitui o token):

```bash
echo 'export WHAPI_API_TOKEN="COLOCA_O_TOKEN_AQUI"' >> ~/.bashrc
source ~/.bashrc
```

Reinicia o Cursor.

---

## 3. Activar no Cursor

1. Abre este projeto no **Cursor Desktop**.
2. Barra lateral → **Customize** → **MCP** → confirma que **whapi-whatsapp** aparece e está ligado.
3. Se não aparecer: reinicia o Cursor ou vê **Output** → **MCP Logs** (erros de token ou Node).

**Requisito:** Node.js 18+ instalado (`node -v` no terminal).

---

## 4. Testar ligação

No chat do Agent, pede:

> Chama a ferramenta `checkHealth` do Whapi e diz-me o status.

| Status | Significado |
|--------|-------------|
| `AUTH` | Pronto a usar |
| `QR` | Volta ao painel Whapi e escaneia o QR |
| `STOP` | Canal desactivado — ver subscrição |

---

## 5. Enviar mensagem

Formato do destinatário (número **sem** `+`, só dígitos):

```text
5511999999999@s.whatsapp.net
```

Exemplo no chat:

> Envia no WhatsApp para `5511999999999@s.whatsapp.net`: "Olá, aqui está o orçamento que pediste."

O Cursor pede **aprovação** antes de enviar (configurável em Settings → Agents).

---

## 6. Enviar arquivo (PDF, imagem, etc.)

Exemplo:

> Envia o ficheiro `docs/exemplo.pdf` para `5511999999999@s.whatsapp.net` com a legenda "Orçamento Formigres".

O agente usa a ferramenta de documento/mídia do Whapi. O ficheiro tem de existir no projeto (ou indica o caminho completo no disco).

**Grupos:** ID no formato `123456789012345678@g.us` (o agente pode ajudar a descobrir se pedires).

---

## Segurança

- **Nunca** commits o token no Git — só a variável `WHAPI_API_TOKEN` no PC.
- O `.cursor/mcp.json` usa `${env:WHAPI_API_TOKEN}` de propósito.
- Whapi corre **local** no teu PC; o token não vai para servidores do Cursor.

---

## Problemas comuns

| Problema | O que fazer |
|----------|-------------|
| MCP não aparece | Reiniciar Cursor; verificar Node 18+ |
| `404 Channel not found` | Token errado ou número ainda não emparelhado no painel |
| Modelo “lento” com ferramentas | Este repo usa `whapi-mcp-optimal` (conjunto reduzido). Para API completa, troca no `mcp.json` para `whapi-mcp@latest` |
| Quero só avisos automáticos (Pulso) | Isso é outro fluxo — ver `docs/pulse/README.md` (CallMeBot, só notificações para ti) |

---

## Referências

- [Whapi — MCP](https://support.whapi.cloud/help-desk/ai-tools/mcp-model-context-protocol)
- [Cursor — MCP](https://cursor.com/docs/mcp)
