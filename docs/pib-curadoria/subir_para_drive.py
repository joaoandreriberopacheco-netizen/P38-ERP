#!/usr/bin/env python3
"""
Cria no Google Drive duas pastas dentro de FOTOS PIB:
  - 01-SELECIONADAS-50  (atalhos para as 50 escolhidas)
  - 02-DE-FORA-75       (atalhos para as 75 restantes)

Uso (no seu computador, com Python 3):
  pip install google-api-python-client google-auth-oauthlib
  python subir_para_drive.py

Na primeira vez abre o browser para login Google.
"""

import json
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]
PARENT_FOLDER_ID = "18Kdy7Q7-qqtAqlkUwHo_1LRKGJK82LGK"  # FOTOS PIB
REPORT = Path(__file__).with_name("relatorio_curadoria.json")
TOKEN = Path(__file__).with_name("token.json")
CREDENTIALS = Path(__file__).with_name("credentials.json")


def auth():
    creds = None
    if TOKEN.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS.exists():
                print(
                    "\nFalta credentials.json\n"
                    "1. Aceda https://console.cloud.google.com/apis/credentials\n"
                    "2. Crie credencial OAuth (app desktop)\n"
                    "3. Baixe JSON e grave como credentials.json nesta pasta\n"
                )
                raise SystemExit(1)
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN.write_text(creds.to_json())
    return build("drive", "v3", credentials=creds)


def mkdir(drive, name: str, parent: str) -> str:
    meta = {"name": name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent]}
    return drive.files().create(body=meta, fields="id, webViewLink").execute()


def shortcut(drive, file_id: str, name: str, parent: str):
    meta = {
        "name": name,
        "mimeType": "application/vnd.google-apps.shortcut",
        "parents": [parent],
        "shortcutDetails": {"targetId": file_id},
    }
    drive.files().create(body=meta, fields="id").execute()


def main():
    data = json.loads(REPORT.read_text(encoding="utf-8"))
    drive = auth()

    sel = mkdir(drive, "01-SELECIONADAS-50", PARENT_FOLDER_ID)
    out = mkdir(drive, "02-DE-FORA-75", PARENT_FOLDER_ID)
    sel_id, out_id = sel["id"], out["id"]

    for item in data["selecionadas"]:
        shortcut(drive, item["id"], item["nome"], sel_id)

    for item in data["removidas"]:
        shortcut(drive, item["id"], item["nome"], out_id)

    print("\nPronto!")
    print(f"50 selecionadas: https://drive.google.com/drive/folders/{sel_id}")
    print(f"75 de fora:      https://drive.google.com/drive/folders/{out_id}")


if __name__ == "__main__":
    main()
