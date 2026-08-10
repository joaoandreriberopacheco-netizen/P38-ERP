#!/usr/bin/env python3
"""
Backtest — Política de Preço Justo (P38 ERP / Supabase)

Simula markup global de 40% sobre custo real nos últimos N dias de vendas faturadas.
Classifica produtos em Destino (KVI), Rotina/Subsidiadores e Conveniência.

Uso:
  export DATABASE_URL="postgresql://..."
  python scripts/backtest_preco_justo.py
  python scripts/backtest_preco_justo.py --dias 60 --output ./saida/

Requer: pandas, sqlalchemy, psycopg2-binary, openpyxl
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import pandas as pd
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Constantes de negócio
# ---------------------------------------------------------------------------

GLOBAL_MARKUP_ALVO = 0.40
MARKUP_DESTINO = 0.20
MARKUP_ROTINA = 0.40

STATUS_VENDA_FATURADA = (
    "Financeiro OK",
    "Pedido Concluído",
    "Em Separação",
    "Em Rota de Entrega",
)

Grupo = Literal["destino", "rotina", "conveniencia"]

# Palavras-chave (normalizadas sem acento, minúsculas)
KW_DESTINO = (
    "cimento",
    "areia",
    "brita",
    "vergalhao",
    "vergalhão",
    "ferro",
    "telha",
    "tubo pvc",
    "tubo esgoto",
    "tubo agua",
    "tubo água",
    "concreto",
    "cal hidratada",
    "cal virgem",
    "bloco",
    "tijolo",
    "argamassa estrutural",
)

KW_ROTINA = (
    "porcelanato",
    "piso",
    "pisos",
    "ceramica",
    "cerâmica",
    "argamassa",
    "revestimento",
    "azulejo",
)

KW_CONVENIENCIA = (
    "rejunte",
    "espacador",
    "espaçador",
    "parafuso",
    "ferramenta",
    "fita",
    "disco de corte",
    "disco corte",
    "broca",
    "impermeabilizante",
    "pincel",
    "conexao",
    "conexão",
    "interruptor",
    "tomada",
    "silicone",
    "cola",
    "rodape",
    "rodapé",
)

# Flexibilidade: promove para Destino itens de margem baixa com alto peso no faturamento
FLEX_MARGEM_MAX_PCT = 25.0       # margem real ≤ isto = candidato KVI
FLEX_PESO_FATURAMENTO_MIN_PCT = 1.5  # representa ≥ isto do faturamento real
FLEX_DESTINO_CUSTO_MIN_PCT = 12.0    # se Destino (só keywords) < isto do custo, complementa


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def normalizar_texto(valor: str | None) -> str:
    if not valor:
        return ""
    texto = unicodedata.normalize("NFKD", str(valor))
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower().strip()


def contem_palavra_chave(texto: str, palavras: tuple[str, ...]) -> bool:
    norm = normalizar_texto(texto)
    for kw in palavras:
        if normalizar_texto(kw) in norm:
            return True
    return False


def round_money(valor: float) -> float:
    return round(float(valor or 0), 2)


def markup_pct(custo: float, faturamento: float) -> float:
    if custo <= 0:
        return 0.0
    return round(((faturamento / custo) - 1) * 100, 2)


# ---------------------------------------------------------------------------
# Classificação semântica + flexibilidade por margem/peso
# ---------------------------------------------------------------------------

@dataclass
class ClassificacaoResult:
    grupo: Grupo
    motivo: str
    margem_real_pct: float = 0.0
    peso_faturamento_pct: float = 0.0
    peso_custo_pct: float = 0.0


def classificar_por_palavras(nome: str, categoria: str | None) -> tuple[Grupo | None, str]:
    texto = f"{nome} {categoria or ''}"
    if contem_palavra_chave(texto, KW_ROTINA):
        return "rotina", "palavra-chave rotina"
    if contem_palavra_chave(texto, KW_DESTINO):
        return "destino", "palavra-chave destino"
    if contem_palavra_chave(texto, KW_CONVENIENCIA):
        return "conveniencia", "palavra-chave conveniência"
    return None, ""


def aplicar_classificacao_flexivel(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fase 1: palavras-chave.
    Fase 1b: se Destino (só keywords) não representa o suficiente no custo,
    promove itens de margem baixa com alto peso no faturamento real.
    """
    if df.empty:
        return df

    total_custo = df["custo_real"].sum()
    total_faturamento = df["faturamento_real"].sum()

    grupos: list[Grupo] = []
    motivos: list[str] = []

    for _, row in df.iterrows():
        g, m = classificar_por_palavras(row["produto_nome"], row.get("categoria_nome"))
        if g is None:
            g, m = "conveniencia", "padrão (sem palavra-chave)"
        grupos.append(g)
        motivos.append(m)

    df = df.copy()
    df["grupo"] = grupos
    df["motivo_classificacao"] = motivos

    df["margem_real_pct"] = df.apply(
        lambda r: markup_pct(r["custo_real"], r["faturamento_real"]), axis=1
    )
    df["peso_faturamento_pct"] = (
        (df["faturamento_real"] / total_faturamento * 100) if total_faturamento > 0 else 0
    ).round(2)
    df["peso_custo_pct"] = (
        (df["custo_real"] / total_custo * 100) if total_custo > 0 else 0
    ).round(2)

    custo_destino_kw = df.loc[df["grupo"] == "destino", "custo_real"].sum()
    peso_destino_kw = (custo_destino_kw / total_custo * 100) if total_custo > 0 else 0

    if peso_destino_kw < FLEX_DESTINO_CUSTO_MIN_PCT:
        candidatos = df[
            (df["grupo"] == "conveniencia")
            & (df["margem_real_pct"] <= FLEX_MARGEM_MAX_PCT)
            & (df["peso_faturamento_pct"] >= FLEX_PESO_FATURAMENTO_MIN_PCT)
        ].sort_values(
            ["margem_real_pct", "peso_faturamento_pct"],
            ascending=[True, False],
        )

        custo_acum = custo_destino_kw
        meta_custo = total_custo * (FLEX_DESTINO_CUSTO_MIN_PCT / 100)

        for idx, row in candidatos.iterrows():
            if custo_acum >= meta_custo:
                break
            df.at[idx, "grupo"] = "destino"
            df.at[idx, "motivo_classificacao"] = (
                f"flexível: margem real {row['margem_real_pct']:.1f}% "
                f"+ peso faturamento {row['peso_faturamento_pct']:.1f}%"
            )
            custo_acum += row["custo_real"]

    # Segunda passagem: margem muito baixa + peso alto, mesmo com Destino já razoável
    for idx, row in df.iterrows():
        if row["grupo"] != "conveniencia":
            continue
        if (
            row["margem_real_pct"] <= MARKUP_DESTINO * 100 + 5  # ~25%
            and row["peso_faturamento_pct"] >= FLEX_PESO_FATURAMENTO_MIN_PCT * 2
        ):
            df.at[idx, "grupo"] = "destino"
            df.at[idx, "motivo_classificacao"] = (
                f"flexível alto impacto: margem {row['margem_real_pct']:.1f}%, "
                f"faturamento {row['peso_faturamento_pct']:.1f}% do total"
            )

    return df


# ---------------------------------------------------------------------------
# Motor de cálculo — equação do subsídio
# ---------------------------------------------------------------------------

@dataclass
class ResultadoSimulacao:
    resumo_grupos: pd.DataFrame
    detalhe_produtos: pd.DataFrame
    markup_conveniencia_pct: float
    faturamento_alvo_global: float
    custo_real_total: float
    meta_global_pct: float = GLOBAL_MARKUP_ALVO * 100


def simular_preco_justo(df: pd.DataFrame) -> ResultadoSimulacao:
    df = aplicar_classificacao_flexivel(df)

    custo_total = df["custo_real"].sum()
    faturamento_alvo = round_money(custo_total * (1 + GLOBAL_MARKUP_ALVO))

    markup_por_grupo = {
        "destino": MARKUP_DESTINO,
        "rotina": MARKUP_ROTINA,
        "conveniencia": None,
    }

    resumo_rows = []
    fat_destino = fat_rotina = 0.0

    for grupo, markup_fixo in markup_por_grupo.items():
        if markup_fixo is None:
            continue
        sub = df[df["grupo"] == grupo]
        custo_g = sub["custo_real"].sum()
        fat_g = round_money(custo_g * (1 + markup_fixo))
        if grupo == "destino":
            fat_destino = fat_g
        else:
            fat_rotina = fat_g
        resumo_rows.append({
            "grupo": grupo,
            "grupo_label": _label_grupo(grupo),
            "custo_real": round_money(custo_g),
            "peso_custo_pct": round(custo_g / custo_total * 100, 2) if custo_total else 0,
            "markup_simulado_pct": markup_fixo * 100,
            "faturamento_simulado": fat_g,
        })

    sub_conv = df[df["grupo"] == "conveniencia"]
    custo_conv = sub_conv["custo_real"].sum()
    fat_conv_necessario = round_money(faturamento_alvo - fat_destino - fat_rotina)

    if custo_conv > 0:
        markup_conv = (fat_conv_necessario / custo_conv) - 1
        markup_conv_pct = round(markup_conv * 100, 2)
    else:
        markup_conv_pct = 0.0
        fat_conv_necessario = 0.0

    resumo_rows.append({
        "grupo": "conveniencia",
        "grupo_label": _label_grupo("conveniencia"),
        "custo_real": round_money(custo_conv),
        "peso_custo_pct": round(custo_conv / custo_total * 100, 2) if custo_total else 0,
        "markup_simulado_pct": markup_conv_pct,
        "faturamento_simulado": fat_conv_necessario,
    })

    resumo = pd.DataFrame(resumo_rows)
    resumo["peso_faturamento_simulado_pct"] = (
        resumo["faturamento_simulado"] / faturamento_alvo * 100
    ).round(2) if faturamento_alvo else 0

    detalhe = df.copy()
    detalhe["markup_grupo_pct"] = detalhe["grupo"].map({
        "destino": MARKUP_DESTINO * 100,
        "rotina": MARKUP_ROTINA * 100,
        "conveniencia": markup_conv_pct,
    })
    detalhe["preco_venda_simulado"] = (
        detalhe["custo_real"] * (1 + detalhe["markup_grupo_pct"] / 100)
    ).round(2)
    detalhe["preco_unitario_simulado"] = detalhe.apply(
        lambda r: round_money(
            r["preco_venda_simulado"] / r["quantidade_base"]
            if r["quantidade_base"] > 0
            else r["preco_venda_simulado"]
        ),
        axis=1,
    )
    detalhe = detalhe.sort_values(["grupo", "custo_real"], ascending=[True, False])

    return ResultadoSimulacao(
        resumo_grupos=resumo,
        detalhe_produtos=detalhe,
        markup_conveniencia_pct=markup_conv_pct,
        faturamento_alvo_global=faturamento_alvo,
        custo_real_total=round_money(custo_total),
    )


def _label_grupo(grupo: str) -> str:
    return {
        "destino": "Destino (KVI)",
        "rotina": "Rotina / Subsidiadores",
        "conveniencia": "Conveniência / Complementar",
    }.get(grupo, grupo)


# ---------------------------------------------------------------------------
# Extração Supabase (somente leitura)
# ---------------------------------------------------------------------------

SQL_VENDAS_AGREGADAS = text("""
SELECT
    COALESCE(pvi.produto_id, 'sem-id-' || md5(COALESCE(pvi.produto_nome, ''))) AS produto_id,
    COALESCE(NULLIF(TRIM(pvi.produto_nome), ''), p.nome, 'Sem nome') AS produto_nome,
    COALESCE(p.categoria_nome, '') AS categoria_nome,
    SUM(
        COALESCE(
            NULLIF(pvi.quantidade_base, 0),
            pvi.quantidade_comercial * COALESCE(NULLIF(pvi.fator_aplicado, 0), 1),
            0
        )
    ) AS quantidade_base,
    SUM(
        COALESCE(
            NULLIF(pvi.quantidade_base, 0),
            pvi.quantidade_comercial * COALESCE(NULLIF(pvi.fator_aplicado, 0), 1),
            0
        )
        * COALESCE(
            NULLIF(pvi.custo_unitario_momento, 0),
            NULLIF(p.preco_custo_calculado, 0),
            NULLIF(p.valor_compra, 0)
                + COALESCE(p.custo_frete_padrao, 0)
                + COALESCE(p.custo_imposto1_padrao, 0)
                + COALESCE(p.custo_imposto2_padrao, 0)
                + COALESCE(p.custo_outros_padrao, 0),
            0
        )
    ) AS custo_real,
    SUM(COALESCE(NULLIF(pvi.total, 0), 0)) AS faturamento_real
FROM public.pedido_venda_item pvi
INNER JOIN public.pedido_venda pv ON pv.id = pvi.pedido_venda_id
LEFT JOIN public.produto p ON p.id = pvi.produto_id
WHERE COALESCE(pv.status, pv.dados->>'status', '') = ANY(:status_ok)
  AND COALESCE(pv.status, pv.dados->>'status', '') <> 'Cancelado'
  AND COALESCE(pv.created_at, (pv.dados->>'created_date')::timestamptz, pv.updated_at)
      >= (NOW() AT TIME ZONE 'America/Rio_Branco')::date - CAST(:dias AS integer)
  AND (
        COALESCE(NULLIF(pvi.quantidade_base, 0), pvi.quantidade_comercial, 0) > 0
        OR COALESCE(pvi.total, 0) > 0
      )
GROUP BY 1, 2, 3
HAVING SUM(
    COALESCE(
        NULLIF(pvi.quantidade_base, 0),
        pvi.quantidade_comercial * COALESCE(NULLIF(pvi.fator_aplicado, 0), 1),
        0
    )
) > 0
   OR SUM(COALESCE(NULLIF(pvi.total, 0), 0)) > 0
ORDER BY custo_real DESC
""")


def carregar_vendas(engine, dias: int) -> pd.DataFrame:
    with engine.connect() as conn:
        conn.execute(text("SET default_transaction_read_only = on"))
        df = pd.read_sql(
            SQL_VENDAS_AGREGADAS,
            conn,
            params={"dias": dias, "status_ok": list(STATUS_VENDA_FATURADA)},
        )
    for col in ("quantidade_base", "custo_real", "faturamento_real"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def criar_engine(database_url: str):
    url = database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
  # read-only hint na connection string não é padrão; usamos SET na sessão
    return create_engine(url, connect_args={"options": "-c default_transaction_read_only=on"})


# ---------------------------------------------------------------------------
# Exportação XLSX + visor HTML interativo
# ---------------------------------------------------------------------------

def exportar_xlsx(resultado: ResultadoSimulacao, path: Path, dias: int) -> None:
    resumo = resultado.resumo_grupos.copy()
    resumo.columns = [
        "Grupo (código)",
        "Grupo",
        "Custo Real (R$)",
        "Peso % no Custo",
        "Markup Simulado %",
        "Faturamento Simulado (R$)",
        "Peso % Faturamento Simulado",
    ]

    detalhe = resultado.detalhe_produtos[[
        "produto_id", "produto_nome", "categoria_nome", "grupo", "motivo_classificacao",
        "quantidade_base", "custo_real", "faturamento_real", "margem_real_pct",
        "peso_custo_pct", "peso_faturamento_pct",
        "markup_grupo_pct", "preco_venda_simulado", "preco_unitario_simulado",
    ]].copy()
    detalhe.columns = [
        "ID Produto", "Produto", "Categoria", "Grupo", "Motivo Classificação",
        "Qtd Base Vendida", "Custo Real (R$)", "Faturamento Real (R$)", "Margem Real %",
        "Peso Custo %", "Peso Faturamento %",
        "Markup Grupo %", "Preço Venda Simulado (R$)", "Preço Unit. Simulado (R$)",
    ]
    detalhe["Grupo"] = detalhe["Grupo"].map({
        "destino": "Destino (KVI)",
        "rotina": "Rotina / Subsidiadores",
        "conveniencia": "Conveniência / Complementar",
    })

    meta = pd.DataFrame([
        {"Métrica": "Período (dias)", "Valor": dias},
        {"Métrica": "Custo Real Total (R$)", "Valor": resultado.custo_real_total},
        {"Métrica": "Faturamento Alvo Global (R$)", "Valor": resultado.faturamento_alvo_global},
        {"Métrica": "Markup Global Alvo %", "Valor": resultado.meta_global_pct},
        {"Métrica": "Markup Conveniência Calculado %", "Valor": resultado.markup_conveniencia_pct},
        {"Métrica": "Gerado em (UTC)", "Valor": datetime.now(timezone.utc).isoformat()},
    ])

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        meta.to_excel(writer, sheet_name="Metadados", index=False)
        resumo.to_excel(writer, sheet_name="Visão Executiva", index=False)
        detalhe.to_excel(writer, sheet_name="Detalhe por Produto", index=False)


def gerar_visor_html(resultado: ResultadoSimulacao, path: Path, dias: int) -> None:
    resumo = resultado.resumo_grupos
    payload = {
        "dias": dias,
        "meta_global_pct": resultado.meta_global_pct,
        "markup_conveniencia_pct": resultado.markup_conveniencia_pct,
        "custo_total": resultado.custo_real_total,
        "faturamento_alvo": resultado.faturamento_alvo_global,
        "grupos": [
            {
                "codigo": row["grupo"],
                "label": row["grupo_label"],
                "markup_pct": float(row["markup_simulado_pct"]),
                "peso_custo_pct": float(row["peso_custo_pct"]),
                "custo_real": float(row["custo_real"]),
                "faturamento_simulado": float(row["faturamento_simulado"]),
            }
            for _, row in resumo.iterrows()
        ],
    }

    html = _HTML_VISOR_TEMPLATE.replace("__DATA_JSON__", json.dumps(payload, ensure_ascii=False))
    path.write_text(html, encoding="utf-8")


_HTML_VISOR_TEMPLATE = r"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preço Justo — Visor Interativo</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a2332;
      --text: #e8edf4;
      --muted: #8b9cb3;
      --destino: #3b82f6;
      --rotina: #22c55e;
      --conv: #f97316;
      --global: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg); color: var(--text); padding: 1.25rem;
    }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    .sub { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.25rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--card); border-radius: 12px; padding: 1rem 1.25rem;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .card h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); margin: 0 0 0.75rem; }
    .metrics { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .metric strong { display: block; font-size: 1.5rem; }
    .metric span { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; }
    .metric.conv strong { color: var(--conv); }
    .sliders { display: grid; gap: 0.75rem; }
    label { font-size: 0.8rem; color: var(--muted); display: flex; justify-content: space-between; }
    input[type=range] { width: 100%; accent-color: var(--destino); }
    .chart-wrap { position: relative; height: 220px; }
    .legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem; margin-top: 0.5rem; }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
  </style>
</head>
<body>
  <h1>Convenience Margin Calculator</h1>
  <p class="sub">Backtest Preço Justo — últimos <span id="dias-label"></span> dias · meta global 40%</p>

  <div class="metrics">
    <div class="metric conv">
      <span>Req. Conveniência Markup</span>
      <strong id="req-conv">—</strong>
    </div>
    <div class="metric">
      <span>Global Margin (simulado)</span>
      <strong id="global-margin">—</strong>
    </div>
    <div class="metric">
      <span>Faturamento alvo</span>
      <strong id="fat-alvo">—</strong>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Markup Comparison</h2>
      <div class="chart-wrap"><canvas id="chartMarkup"></canvas></div>
      <div class="legend">
        <span><i style="background:var(--destino)"></i>KVI (Destino)</span>
        <span><i style="background:var(--rotina)"></i>Rotina</span>
        <span><i style="background:var(--conv)"></i>Conveniência</span>
        <span><i style="background:var(--global)"></i>Global (meta)</span>
      </div>
    </div>
    <div class="card">
      <h2>Cost Share Distribution</h2>
      <div class="chart-wrap"><canvas id="chartPeso"></canvas></div>
    </div>
  </div>

  <div class="card" style="margin-top:1rem">
    <h2>Cenário what-if (ajuste fino)</h2>
    <p style="font-size:0.8rem;color:var(--muted);margin:0 0 1rem">
      Simule markups fixos de Destino e Rotina; o markup de Conveniência recalcula para fechar em 40% global.
    </p>
    <div class="sliders">
      <div>
        <label>Destino (KVI) Markup % <span id="val-destino">20</span></label>
        <input type="range" id="sl-destino" min="5" max="35" step="0.5" value="20" />
      </div>
      <div>
        <label>Rotina Markup % <span id="val-rotina">40</span></label>
        <input type="range" id="sl-rotina" min="20" max="60" step="0.5" value="40" />
      </div>
      <div>
        <label>KVI Cost Share % (peso real dos dados) <span id="val-peso-destino">—</span></label>
        <input type="range" id="sl-peso-destino" min="5" max="70" step="0.5" disabled title="Peso real fixo dos dados" />
      </div>
      <div>
        <label>Rotina Cost Share % (peso real) <span id="val-peso-rotina">—</span></label>
        <input type="range" id="sl-peso-rotina" min="5" max="70" step="0.5" disabled />
      </div>
    </div>
  </div>

<script>
const DATA = __DATA_JSON__;
document.getElementById('dias-label').textContent = DATA.dias;

const CORES = { destino: '#3b82f6', rotina: '#22c55e', conveniencia: '#f97316', global: '#94a3b8' };
const LABELS = { destino: 'KVI', rotina: 'Routine', conveniencia: 'Convenience', global: 'Global (Goal)' };

function byCodigo(c) { return DATA.grupos.find(g => g.codigo === c) || { custo_real: 0, peso_custo_pct: 0 }; }

function calcMarkupConv(markupDestinoPct, markupRotinaPct) {
  const custoTotal = DATA.custo_total;
  const alvo = custoTotal * (1 + DATA.meta_global_pct / 100);
  const d = byCodigo('destino');
  const r = byCodigo('rotina');
  const c = byCodigo('conveniencia');
  const fatD = d.custo_real * (1 + markupDestinoPct / 100);
  const fatR = r.custo_real * (1 + markupRotinaPct / 100);
  const fatC = alvo - fatD - fatR;
  const mkC = c.custo_real > 0 ? ((fatC / c.custo_real) - 1) * 100 : 0;
  const fatTotal = fatD + fatR + Math.max(0, fatC);
  const globalMk = custoTotal > 0 ? ((fatTotal / custoTotal) - 1) * 100 : 0;
  return { mkC, globalMk, fatC, markupDestinoPct, markupRotinaPct };
}

let chartMk, chartPeso;

function fmtPct(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
function fmtBrl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function render(markupDestino, markupRotina) {
  const { mkC, globalMk } = calcMarkupConv(markupDestino, markupRotina);
  document.getElementById('req-conv').textContent = fmtPct(mkC);
  document.getElementById('global-margin').textContent = fmtPct(globalMk);
  document.getElementById('fat-alvo').textContent = fmtBrl(DATA.faturamento_alvo);

  const d = byCodigo('destino');
  const r = byCodigo('rotina');
  const mkData = [markupDestino, markupRotina, mkC, DATA.meta_global_pct];
  const pesoData = [d.peso_custo_pct, r.peso_custo_pct, byCodigo('conveniencia').peso_custo_pct];

  document.getElementById('val-peso-destino').textContent = d.peso_custo_pct.toFixed(1);
  document.getElementById('val-peso-rotina').textContent = r.peso_custo_pct.toFixed(1);

  if (chartMk) chartMk.destroy();
  if (chartPeso) chartPeso.destroy();

  chartMk = new Chart(document.getElementById('chartMarkup'), {
    type: 'bar',
    data: {
      labels: ['KVI', 'Routine', 'Convenience', 'Global (Goal)'],
      datasets: [{
        data: mkData,
        backgroundColor: [CORES.destino, CORES.rotina, CORES.conv, CORES.global],
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {},
        tooltip: { callbacks: { label: ctx => fmtPct(ctx.raw) } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b9cb3', callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { color: '#e8edf4' } }
      }
    },
    plugins: [{
      id: 'goalLine',
      afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const x = scales.x.getPixelForValue(DATA.meta_global_pct);
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    }]
  });

  chartPeso = new Chart(document.getElementById('chartPeso'), {
    type: 'bar',
    data: {
      labels: ['Cost Share'],
      datasets: [
        { label: 'KVI', data: [pesoData[0]], backgroundColor: CORES.destino, stack: 's' },
        { label: 'Routine', data: [pesoData[1]], backgroundColor: CORES.rotina, stack: 's' },
        { label: 'Convenience', data: [pesoData[2]], backgroundColor: CORES.conv, stack: 's' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#e8edf4' } } },
      scales: {
        x: { stacked: true, max: 100, ticks: { color: '#8b9cb3', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { stacked: true, display: false }
      }
    }
  });
}

const slD = document.getElementById('sl-destino');
const slR = document.getElementById('sl-rotina');
const initD = byCodigo('destino').markup_pct || 20;
const initR = byCodigo('rotina').markup_pct || 40;
slD.value = initD; slR.value = initR;

function sync() {
  const d = parseFloat(slD.value);
  const r = parseFloat(slR.value);
  document.getElementById('val-destino').textContent = d;
  document.getElementById('val-rotina').textContent = r;
  render(d, r);
}
slD.addEventListener('input', sync);
slR.addEventListener('input', sync);
sync();
</script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Backtest Preço Justo — P38 ERP")
    p.add_argument("--dias", type=int, default=60, help="Janela de vendas faturadas (dias)")
    p.add_argument(
        "--output", type=Path,
        default=Path("output/backtest-preco-justo"),
        help="Pasta de saída para .xlsx e .html",
    )
    p.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="URL PostgreSQL (ou env DATABASE_URL)",
    )
    p.add_argument(
        "--flex-margem-max",
        type=float, default=FLEX_MARGEM_MAX_PCT,
        help="Margem real máxima para promoção flexível a Destino",
    )
    p.add_argument(
        "--flex-peso-min",
        type=float, default=FLEX_PESO_FATURAMENTO_MIN_PCT,
        help="Peso mínimo no faturamento para promoção flexível",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    global FLEX_MARGEM_MAX_PCT, FLEX_PESO_FATURAMENTO_MIN_PCT
    FLEX_MARGEM_MAX_PCT = args.flex_margem_max
    FLEX_PESO_FATURAMENTO_MIN_PCT = args.flex_peso_min

    if not args.database_url:
        print("Erro: defina DATABASE_URL ou use --database-url", file=sys.stderr)
        return 1

    args.output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    xlsx_path = args.output / f"backtest_preco_justo_{stamp}.xlsx"
    html_path = args.output / f"backtest_preco_justo_{stamp}.html"

    print(f"Conectando (read-only) · últimos {args.dias} dias…")
    engine = criar_engine(args.database_url)

    try:
        df = carregar_vendas(engine, args.dias)
    except Exception as exc:
        print(f"Erro ao consultar vendas: {exc}", file=sys.stderr)
        return 1

    if df.empty:
        print("Nenhuma venda faturada encontrada no período.", file=sys.stderr)
        return 1

    print(f"Produtos distintos: {len(df)} · Custo agregado: R$ {df['custo_real'].sum():,.2f}")

    resultado = simular_preco_justo(df)

    exportar_xlsx(resultado, xlsx_path, args.dias)
    gerar_visor_html(resultado, html_path, args.dias)

    print("\n── Resumo ──")
    for _, row in resultado.resumo_grupos.iterrows():
        print(
            f"  {row['grupo_label']:28} │ custo R$ {row['custo_real']:>12,.2f} "
            f"({row['peso_custo_pct']:5.1f}%) │ markup {row['markup_simulado_pct']:6.1f}%"
        )
    print(f"\n  Markup Conveniência calculado: {resultado.markup_conveniencia_pct:.1f}%")
    print(f"  Faturamento alvo global:       R$ {resultado.faturamento_alvo_global:,.2f}")
    print(f"\nArquivos gerados:")
    print(f"  XLSX: {xlsx_path}")
    print(f"  HTML: {html_path}")

    flex_count = (
        resultado.detalhe_produtos["motivo_classificacao"]
        .str.startswith("flexível", na=False)
        .sum()
    )
    if flex_count:
        print(f"\n  {flex_count} produto(s) promovido(s) a Destino pela regra flexível (margem baixa + alto peso).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
