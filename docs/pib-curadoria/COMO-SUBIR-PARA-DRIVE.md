# Como criar as 2 pastas no Google Drive

As fotos já estão organizadas localmente:

| Pasta | Conteúdo |
|-------|----------|
| `01-SELECIONADAS-50/` | 50 fotos escolhidas (por evento) |
| `02-DE-FORA-75/` | 75 fotos que ficaram de fora |

## Opção A — Manual (mais simples, sem script)

1. Abra https://drive.google.com/drive/folders/18Kdy7Q7-qqtAqlkUwHo_1LRKGJK82LGK
2. Clique **Nova pasta** → nome: `01-SELECIONADAS-50`
3. Outra pasta → `02-DE-FORA-75`
4. Baixe os ZIPs (se disponíveis) ou use as pastas locais deste agente
5. Arraste cada pasta para dentro da pasta **FOTOS PIB** no Drive

## Opção B — Script com atalhos (não duplica ficheiros)

O ficheiro `subir_para_drive.py` cria as duas pastas com **atalhos** às fotos originais (mais rápido, não gasta espaço extra).

```bash
pip install google-api-python-client google-auth-oauthlib
python subir_para_drive.py
```

Na primeira vez pede login Google. No final imprime os dois links das pastas.

## Opção C — Copiar ficheiros no Drive (sem script)

Para cada foto da lista em `relatorio_curadoria.json`:
- Abra a foto na pasta original
- `Ctrl+C` → entre na pasta nova → `Ctrl+V`

Demorado para 125 fotos; use A ou B.
