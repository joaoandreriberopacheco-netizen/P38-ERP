#!/usr/bin/env python3
"""PDF tabela-lista: pisos Formigres encontrados (com imagem na célula)."""

from __future__ import annotations

import csv
import io
import sys
from datetime import date
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

STATUS_OK = "encontrado"
IMG_COL_W = 26 * mm
# Tamanho visível na tabela (pontos PDF)
THUMB_BOX = 24 * mm
# Resolução embutida (px) — maior que o display para zoom nítido no leitor PDF
MAX_EMBED_PX = 720
JPEG_QUALITY = 95


def fmt_br_num(value: str | float | int) -> str:
    if value in ("", "—", None):
        return "—"
    try:
        n = float(str(value).replace(",", "."))
    except ValueError:
        return str(value)
    s = f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if s.endswith(",00"):
        s = s[:-3]
    return s


def parse_csv_row(line_fields: list[str]) -> dict[str, str]:
    keys = [
        "linha", "descricao_excel", "estoque_m2", "termo_busca", "formato_excel",
        "m2_excel", "encontrado", "formato_site", "acabamento_site", "marca_site",
        "m2_caixa", "imagem_url", "imagem_arquivo", "score", "status",
    ]
    return dict(zip(keys, line_fields))


def norm_fmt_key(fmt: str) -> tuple[int, int, str]:
    s = str(fmt or "").lower().replace("cm", "").strip()
    parts = s.split("x")
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
        return (int(parts[0]), int(parts[1]), s)
    return (9999, 9999, s)


def sort_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Ordenação: acabamento → formato → nome (site)."""

    def key(row: dict[str, str]) -> tuple:
        acab = str(row.get("acabamento_site") or "").strip().upper()
        fmt = row.get("formato_site") or row.get("formato_excel") or ""
        nome = str(row.get("encontrado") or row.get("descricao_excel") or "").strip().upper()
        w, h, _ = norm_fmt_key(fmt)
        return (acab, w, h, nome)

    return sorted(rows, key=key)


def read_rows(csv_path: Path) -> list[dict[str, str]]:
    text = csv_path.read_text(encoding="utf-8")
    reader = csv.reader(text.splitlines(), delimiter=";")
    header = next(reader)
    if not header:
        return []
    rows = []
    for fields in reader:
        if len(fields) < 15:
            continue
        row = parse_csv_row(fields)
        if row.get("status") != STATUS_OK:
            continue
        rows.append(row)
    return sort_rows(rows)


def load_thumb(img_dir: Path, arquivo: str) -> Image | None:
    if not arquivo or arquivo == "—":
        return None
    p = img_dir / arquivo
    if not p.is_file():
        return None
    try:
        with PILImage.open(p) as im:
            im = im.convert("RGB")
            # Alta resolução no ficheiro; tamanho pequeno só na página
            im.thumbnail((MAX_EMBED_PX, MAX_EMBED_PX), PILImage.Resampling.LANCZOS)
            pw, ph = im.size
            if pw <= 0 or ph <= 0:
                return None
            if pw >= ph:
                disp_w = THUMB_BOX
                disp_h = THUMB_BOX * ph / pw
            else:
                disp_h = THUMB_BOX
                disp_w = THUMB_BOX * pw / ph
            buf = io.BytesIO()
            im.save(
                buf,
                format="JPEG",
                quality=JPEG_QUALITY,
                optimize=True,
                subsampling=0,
            )
            buf.seek(0)
            return Image(buf, width=disp_w, height=disp_h)
    except Exception:
        return None


def short_desc(s: str, max_len: int = 42) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def build_pdf(rows: list[dict[str, str]], img_dir: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=10 * mm,
        title="Pisos Pop e Premium — Formigres",
    )

    cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=7, leading=8.5, textColor=colors.HexColor("#111827"))
    cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold", fontSize=7)
    cell_c = ParagraphStyle("cell_c", parent=cell, alignment=TA_CENTER)
    title_s = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=14, textColor=colors.HexColor("#111827"))
    sub_s = ParagraphStyle("sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#6B7280"))

    story = [
        Paragraph("Pisos Pop e Premium — catálogo Formigres", title_s),
        Paragraph(
            f"Gerado em {date.today().strftime('%d/%m/%Y')} · {len(rows)} itens (formatos válidos no site)",
            sub_s,
        ),
        Spacer(1, 4 * mm),
    ]

    header = [
        Paragraph("<b>Foto</b>", cell_c),
        Paragraph("<b>Descrição (estoque)</b>", cell_b),
        Paragraph("<b>Produto site</b>", cell_b),
        Paragraph("<b>Formato</b>", cell_c),
        Paragraph("<b>Acabamento</b>", cell_c),
        Paragraph("<b>m²/cx</b>", cell_c),
        Paragraph("<b>Marca</b>", cell_c),
        Paragraph("<b>Estoque m²</b>", cell_c),
    ]

    col_widths = [IMG_COL_W, 60 * mm, 52 * mm, 18 * mm, 28 * mm, 14 * mm, 18 * mm, 20 * mm]
    data = [header]

    for row in rows:
        thumb = load_thumb(img_dir, row.get("imagem_arquivo", ""))
        img_cell = thumb if thumb else Paragraph("—", cell_c)
        desc = short_desc(row.get("descricao_excel", ""))
        estoque = fmt_br_num(row.get("estoque_m2", ""))
        m2cx = fmt_br_num(row.get("m2_caixa", ""))

        data.append([
            img_cell,
            Paragraph(f"{desc}<br/><font size=6 color='#6B7280'>L{row.get('linha', '')}</font>", cell),
            Paragraph(str(row.get("encontrado", "—")), cell),
            Paragraph(str(row.get("formato_site", row.get("formato_excel", "—"))).replace("cm", ""), cell_c),
            Paragraph(str(row.get("acabamento_site", "—")), cell),
            Paragraph(m2cx, cell_c),
            Paragraph(str(row.get("marca_site", "—")), cell_c),
            Paragraph(estoque, cell_c),
        ])

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    story.append(table)
    doc.build(story)


def main() -> None:
    if len(sys.argv) < 4:
        print("Uso: python3 gerar-pdf-pisos-formigres.py <csv> <img_dir> <out.pdf>")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    img_dir = Path(sys.argv[2])
    out_path = Path(sys.argv[3])

    rows = read_rows(csv_path)
    if not rows:
        print("Nenhum item encontrado no CSV.")
        sys.exit(1)

    build_pdf(rows, img_dir, out_path)
    print(f"PDF gerado: {out_path} ({len(rows)} linhas)")


if __name__ == "__main__":
    main()
