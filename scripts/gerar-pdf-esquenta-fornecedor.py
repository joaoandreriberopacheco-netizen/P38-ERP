#!/usr/bin/env python3
"""PDF tabela-lista: esquenta fornecedor (com imagem + preço líquido)."""

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
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

STATUS_OK = "encontrado"
IMG_COL_W = 24 * mm
THUMB_BOX = 22 * mm
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


def fmt_br_money(value: str | float | int) -> str:
    if value in ("", "—", None):
        return "—"
    try:
        n = float(str(value).replace(",", "."))
    except ValueError:
        return str(value)
    return f"R$ {n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def parse_csv_row(fields: list[str]) -> dict[str, str]:
    keys = [
        "linha", "descricao_excel", "estoque_m2", "termo_busca", "formato_excel",
        "m2_excel", "encontrado", "formato_site", "acabamento_site", "fabricante_site",
        "m2_caixa", "preco_liquido_m2", "preco_caixa", "imagem_url", "imagem_arquivo",
        "score", "status",
    ]
    return dict(zip(keys, fields + [""] * max(0, len(keys) - len(fields))))


def sort_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    def key(row: dict[str, str]) -> tuple:
        fab = str(row.get("fabricante_site") or "").strip().upper()
        fmt = row.get("formato_site") or row.get("formato_excel") or ""
        nome = str(row.get("encontrado") or row.get("descricao_excel") or "").strip().upper()
        return (fab, fmt, nome)

    return sorted(rows, key=key)


def read_rows(csv_path: Path) -> list[dict[str, str]]:
    text = csv_path.read_text(encoding="utf-8")
    reader = csv.reader(text.splitlines(), delimiter=";")
    next(reader, None)
    rows = []
    for fields in reader:
        if len(fields) < 10:
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
            im.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, subsampling=0)
            buf.seek(0)
            return Image(buf, width=disp_w, height=disp_h)
    except Exception:
        return None


def short_desc(s: str, max_len: int = 38) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def build_pdf(rows: list[dict[str, str]], img_dir: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=landscape(A4),
        leftMargin=8 * mm,
        rightMargin=8 * mm,
        topMargin=10 * mm,
        bottomMargin=8 * mm,
        title="Esquenta fornecedor — pisos 45×45 / 46×46",
    )

    cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=6.5, leading=8, textColor=colors.HexColor("#111827"))
    cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Helvetica-Bold", fontSize=6.5)
    cell_c = ParagraphStyle("cell_c", parent=cell, alignment=TA_CENTER)
    title_s = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=13, textColor=colors.HexColor("#111827"))
    sub_s = ParagraphStyle("sub", fontName="Helvetica", fontSize=8.5, textColor=colors.HexColor("#6B7280"))

    preco_m2 = rows[0].get("preco_liquido_m2", "24.23") if rows else "24.23"

    story = [
        Paragraph("Esquenta fornecedor — catálogo com preço líquido", title_s),
        Paragraph(
            f"Gerado em {date.today().strftime('%d/%m/%Y')} · "
            f"{len(rows)} itens · tabela R$ 28,50/m² · desconto 15% · líquido {fmt_br_money(preco_m2)}/m²",
            sub_s,
        ),
        Spacer(1, 3 * mm),
    ]

    header = [
        Paragraph("<b>Foto</b>", cell_c),
        Paragraph("<b>Descrição ERP</b>", cell_b),
        Paragraph("<b>Produto</b>", cell_b),
        Paragraph("<b>Fabric.</b>", cell_c),
        Paragraph("<b>Fmt</b>", cell_c),
        Paragraph("<b>Acab.</b>", cell_c),
        Paragraph("<b>m²/cx</b>", cell_c),
        Paragraph("<b>R$/m²</b>", cell_c),
        Paragraph("<b>R$/cx</b>", cell_c),
    ]

    col_widths = [IMG_COL_W, 52 * mm, 44 * mm, 16 * mm, 14 * mm, 22 * mm, 12 * mm, 14 * mm, 16 * mm]
    data = [header]

    for row in rows:
        thumb = load_thumb(img_dir, row.get("imagem_arquivo", ""))
        img_cell = thumb if thumb else Paragraph("—", cell_c)
        desc = short_desc(row.get("descricao_excel", ""))
        m2cx = fmt_br_num(row.get("m2_caixa", ""))
        pliq = fmt_br_money(row.get("preco_liquido_m2", ""))
        pcx = fmt_br_money(row.get("preco_caixa", ""))

        data.append([
            img_cell,
            Paragraph(f"{desc}<br/><font size=5 color='#6B7280'>L{row.get('linha', '')}</font>", cell),
            Paragraph(str(row.get("encontrado", "—")), cell),
            Paragraph(str(row.get("fabricante_site", "—")), cell_c),
            Paragraph(str(row.get("formato_site", row.get("formato_excel", "—"))).replace("cm", ""), cell_c),
            Paragraph(str(row.get("acabamento_site", "—")), cell),
            Paragraph(m2cx, cell_c),
            Paragraph(pliq, cell_c),
            Paragraph(pcx, cell_c),
        ])

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 6.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    story.append(table)
    doc.build(story)


def main() -> None:
    if len(sys.argv) < 4:
        print("Uso: python3 gerar-pdf-esquenta-fornecedor.py <csv> <img_dir> <out.pdf>")
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
