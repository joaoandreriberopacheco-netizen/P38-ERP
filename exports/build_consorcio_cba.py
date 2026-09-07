#!/usr/bin/env python3
"""Extende amazonas_cba_metadados.xlsx com folhas do Consórcio Missionário CBA."""

from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

XLSX = Path("/workspace/exports/amazonas_cba_metadados.xlsx")
PROPOSTA = Path("/workspace/exports/consorcio_missionario_cba_proposta.md")

VALOR_PROJETO = 20_000
MISSIONARIOS_TOTAL = 65

TIERS = [
    {
        "porte": "P1",
        "nome": "Micro (interior remoto)",
        "contribuicao_mensal": 80,
        "criterio": "Interior + município com 1–2 igrejas filiadas",
    },
    {
        "porte": "P2",
        "nome": "Pequena (interior local)",
        "contribuicao_mensal": 150,
        "criterio": "Interior + município com 3–6 igrejas",
    },
    {
        "porte": "P3",
        "nome": "Média (polo interior / sede regional)",
        "contribuicao_mensal": 220,
        "criterio": "Interior + município com 7+ igrejas OU igreja mãe com 2+ filhas no interior",
    },
    {
        "porte": "P4",
        "nome": "Grande (capital)",
        "contribuicao_mensal": 280,
        "criterio": "Zona Capital (Manaus) sem rede ampla de congregações filhas",
    },
    {
        "porte": "P5",
        "nome": "Sede (capital estruturante)",
        "contribuicao_mensal": 350,
        "criterio": "Zona Capital + igreja mãe com 2+ congregações filhas referenciadas",
    },
]

SCENARIOS = [
    ("Conservador", 0.70, "70% das igrejas aderem e pagam com regularidade"),
    ("Moderado", 0.85, "85% de adesão — meta operacional realista"),
    ("Otimista", 1.00, "100% das igrejas filiadas participam"),
]

MOTHER_THRESHOLD = 2


def style_header(ws, ncols: int):
    fill = PatternFill("solid", fgColor="1F4E79")
    font = Font(color="FFFFFF", bold=True)
    for col in range(1, ncols + 1):
        cell = ws.cell(row=1, column=col)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def add_table(ws, name: str):
    max_row = ws.max_row
    max_col = ws.max_column
    ref = f"A1:{get_column_letter(max_col)}{max_row}"
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)
    for col in range(1, max_col + 1):
        letter = get_column_letter(col)
        val = ws.cell(row=1, column=col).value or ""
        width = min(max(len(str(val)) + 2, 12), 52)
        ws.column_dimensions[letter].width = width


def mother_reference_counts(churches: pd.DataFrame) -> dict[str, int]:
    counts: dict[str, int] = {}
    for raw in churches["Igreja mãe"].dropna():
        name = str(raw).strip()
        if name:
            counts[name] = counts.get(name, 0) + 1
    return counts


def is_mother_church(church_name: str, mother_counts: dict[str, int]) -> int:
    name = church_name.strip()
    direct = mother_counts.get(name, 0)
    if direct >= MOTHER_THRESHOLD:
        return direct
    fuzzy = sum(v for k, v in mother_counts.items() if name in k or k in name)
    return fuzzy


def assign_tier(row, churches_per_muni: dict[str, int], mother_counts: dict[str, int]) -> tuple[str, str, int]:
    muni = row.get("Município") or ""
    zona = row.get("Zona") or "Interior"
    igreja = str(row.get("Igreja", ""))
    qtd_muni = churches_per_muni.get(muni, 1)
    filhas = is_mother_church(igreja, mother_counts)

    if zona == "Capital":
        if filhas >= MOTHER_THRESHOLD:
            return "P5", "Sede (capital estruturante)", 350
        return "P4", "Grande (capital)", 280

    if filhas >= MOTHER_THRESHOLD:
        return "P3", "Média (polo interior / sede regional)", 220
    if qtd_muni >= 7:
        return "P3", "Média (polo interior / sede regional)", 220
    if qtd_muni >= 3:
        return "P2", "Pequena (interior local)", 150
    return "P1", "Micro (interior remoto)", 80


def build_church_tiers(churches: pd.DataFrame, unmapped: pd.DataFrame | None) -> pd.DataFrame:
    churches_per_muni = churches.groupby("Município").size().to_dict()
    mother_counts = mother_reference_counts(churches)

    rows = []
    for _, row in churches.iterrows():
        porte, porte_nome, mensal = assign_tier(row, churches_per_muni, mother_counts)
        rows.append(
            {
                "Igreja": row["Igreja"],
                "Município": row["Município"],
                "Macroregião": row["Macroregião"],
                "Zona": row["Zona"],
                "Associação": row["Associação"],
                "Igrejas no município": churches_per_muni.get(row["Município"], 0),
                "Congregações filhas (ref.)": is_mother_church(str(row["Igreja"]), mother_counts),
                "Porte": porte,
                "Descrição porte": porte_nome,
                "Contribuição mensal (R$)": mensal,
                "Contribuição anual (R$)": mensal * 12,
                "Mapeamento": "Completo",
            }
        )

    if unmapped is not None and len(unmapped):
        for _, row in unmapped.iterrows():
            assoc = str(row.get("Associação", ""))
            zona = "Capital" if "Metropolitana" in assoc or "AR1" in assoc or "AR2" in assoc else "Interior"
            fake = {"Município": "Manaus" if zona == "Capital" else "", "Zona": zona, "Igreja": row["Igreja"]}
            porte, porte_nome, mensal = assign_tier(
                fake,
                churches_per_muni,
                mother_counts,
            )
            if zona == "Capital" and porte == "P1":
                porte, porte_nome, mensal = "P4", "Grande (capital)", 280
            rows.append(
                {
                    "Igreja": row["Igreja"],
                    "Município": row.get("Cidade informada", "(sem município IBGE)"),
                    "Macroregião": "",
                    "Zona": zona,
                    "Associação": assoc,
                    "Igrejas no município": "",
                    "Congregações filhas (ref.)": 0,
                    "Porte": porte,
                    "Descrição porte": porte_nome,
                    "Contribuição mensal (R$)": mensal,
                    "Contribuição anual (R$)": mensal * 12,
                    "Mapeamento": "Estimado (sem município)",
                }
            )

    return pd.DataFrame(rows).sort_values(["Porte", "Município", "Igreja"])


def build_scenarios(igrejas_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    tier_summary = (
        igrejas_df.groupby(["Porte", "Descrição porte", "Contribuição mensal (R$)"])
        .agg(
            Qtd_Igrejas=("Igreja", "count"),
            Mensal_total=("Contribuição mensal (R$)", "sum"),
            Anual_total=("Contribuição anual (R$)", "sum"),
        )
        .reset_index()
        .sort_values("Porte")
    )

    total_mensal = igrejas_df["Contribuição mensal (R$)"].sum()
    total_anual = igrejas_df["Contribuição anual (R$)"].sum()
    total_igrejas = len(igrejas_df)

    scenario_rows = []
    for nome, taxa, nota in SCENARIOS:
        mensal_efetivo = total_mensal * taxa
        anual_efetivo = total_anual * taxa
        projetos = anual_efetivo / VALOR_PROJETO
        scenario_rows.append(
            {
                "Cenário": nome,
                "Taxa adesão": f"{taxa * 100:.0f}%",
                "Igrejas participantes (est.)": round(total_igrejas * taxa),
                "Arrecadação mensal (R$)": round(mensal_efetivo, 2),
                "Arrecadação anual (R$)": round(anual_efetivo, 2),
                "Projetos R$ 20 mil/ano": round(projetos, 2),
                "Projetos/ano (inteiro)": math.floor(projetos),
                "Nota": nota,
            }
        )

    lottery_rows = []
    for nome, taxa, _ in SCENARIOS:
        anual = total_anual * taxa
        projetos = math.floor(anual / VALOR_PROJETO)
        if projetos <= 0:
            p_ano = 0
            espera = float("inf")
        else:
            p_ano = projetos / MISSIONARIOS_TOTAL
            espera = MISSIONARIOS_TOTAL / projetos
        lottery_rows.append(
            {
                "Cenário": nome,
                "Missionários elegíveis": MISSIONARIOS_TOTAL,
                "Projetos financiados/ano": projetos,
                "Prob. contemplação/ano/missionário": f"{p_ano * 100:.1f}%",
                "Tempo médio espera (anos)": round(espera, 1) if projetos else "—",
                "Sorteios sugeridos/ano": min(projetos, 12) if projetos else 0,
                "Contemplados por sorteio (média)": round(projetos / min(projetos, 12), 2) if projetos else 0,
            }
        )

    tier_defs = pd.DataFrame(TIERS).rename(
        columns={
            "porte": "Porte",
            "nome": "Nome",
            "contribuicao_mensal": "Contribuição mensal (R$)",
            "criterio": "Critério",
        }
    )
    tier_defs["Contribuição anual (R$)"] = tier_defs["Contribuição mensal (R$)"] * 12

    capa = pd.DataFrame(
        [
            ["Programa", "Consórcio Missionário CBA — kit fluvial R$ 20.000"],
            ["Igrejas no modelo", total_igrejas],
            ["Missionários ME 2026", MISSIONARIOS_TOTAL],
            ["Arrecadação mensal máxima (100%)", f"R$ {total_mensal:,.2f}"],
            ["Arrecadação anual máxima (100%)", f"R$ {total_anual:,.2f}"],
            ["Valor por projeto", f"R$ {VALOR_PROJETO:,.2f}"],
            ["Lógica de porte", "Zona (Capital/Interior) + igrejas no município + igreja mãe (≥2 filhas)"],
        ],
        columns=["Indicador", "Valor"],
    )

    return tier_summary, pd.DataFrame(scenario_rows), pd.DataFrame(lottery_rows), tier_defs, capa


def br_money(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def write_proposal(
    igrejas_df: pd.DataFrame,
    tier_summary: pd.DataFrame,
    scenarios: pd.DataFrame,
    lottery: pd.DataFrame,
):
    total_mensal = igrejas_df["Contribuição mensal (R$)"].sum()
    total_anual = igrejas_df["Contribuição anual (R$)"].sum()
    mod = scenarios[scenarios["Cenário"] == "Moderado"].iloc[0]
    lot_mod = lottery[lottery["Cenário"] == "Moderado"].iloc[0]

    tier_table = "\n".join(
        f"| {r['porte']} | {r['nome']} | {r['criterio']} | R$ {r['contribuicao_mensal']}/mês | R$ {r['contribuicao_mensal']*12}/ano |"
        for r in TIERS
    )

    porte_dist = igrejas_df.groupby("Porte").size().sort_index()
    dist_lines = "\n".join(f"- **{p}**: {n} igrejas" for p, n in porte_dist.items())

    scenario_table = "\n".join(
        f"| {r['Cenário']} | {r['Taxa adesão']} | {br_money(r['Arrecadação mensal (R$)'])} | {br_money(r['Arrecadação anual (R$)'])} | {int(r['Projetos/ano (inteiro)'])} |"
        for _, r in scenarios.iterrows()
    )

    kit_breakdown = """
| Item | Estimativa (R$) | Observação |
|------|-----------------|------------|
| Baleeira/canoa alumínio 6 m (casco) | 9.000 – 14.000 | Novo básico; usado/regional pode ser menos |
| Motor popa Yamaha 15 HP 2T | 11.000 – 15.000 | PJ/produtor rural altera nota fiscal |
| Carreta rodoviária | 3.500 – 5.500 | Frete AM costuma elevar preço final |
| Coletes, remos, âncora, cordas | 800 – 1.500 | Kit segurança mínimo |
| Combustível/óleo reserva + ferramentas | 500 – 1.000 | Arranque de operação |
| Licenciamento/documentação | 500 – 1.500 | Varia por município |
| **Total referência** | **~18.000 – 22.000** | **R$ 20 mil é meta enxuta; conjunto novo completo tende a R$ 27–31 mil** |
"""

    text = f"""# Proposta: Consórcio Missionário CBA (Amazonas)

**Documento para apresentação interna — Convenção Batista do Amazonas (CBA)**  
**Elaborado com base em:** 293 igrejas mapeadas + 18 estimadas (total 311 filiadas), 65 missionários (ME 2026), dados IBGE 2024.

---

## Resumo executivo

A CBA pode criar um **consórcio missionário** em que cada igreja filiada contribui com um valor **mensal adicional** ao plano cooperativo, escalonado pelo **porte da igreja** (sem precisar saber o número exato de membros). O dinheiro forma um fundo comum para financiar **projetos de R$ 20.000** — pensados para dar **arranque logístico em missões fluviais**: baleeira ~6 m, motor Yamaha 15 HP, coletes, acessórios, frete, documentação e combustível inicial.

A **distribuição** do benefício seria por **sorteio entre missionários** elegíveis (Convênio + AME), com regras claras de governança e prestação de contas.

**Números-chave (cenário moderado — 85% de adesão):**

- Arrecadação estimada: **{br_money(mod['Arrecadação mensal (R$)'])}/mês** (**{br_money(mod['Arrecadação anual (R$)'])}/ano**)
- Projetos financiáveis: **{int(mod['Projetos/ano (inteiro)'])} por ano** de R$ 20 mil
- Com {MISSIONARIOS_TOTAL} missionários, cada um teria em média **{lot_mod['Prob. contemplação/ano/missionário']}** de chance por ano e esperaria **~{lot_mod['Tempo médio espera (anos)']} anos** para ser contemplado (se as regras permitirem uma contemplação por missionário por ciclo)

**Comparação com a Campanha ME 2026 (~R$ 420 mil):** o consórcio **não substitui** a ME; é uma **camada adicional** previsível. No cenário moderado, o consórcio acrescenta cerca de **{br_money(mod['Arrecadação anual (R$)'])}/ano** — equivalente a **{int(mod['Projetos/ano (inteiro)'])} kits fluviais** estruturados, além do que a campanha já mobiliza para salários, obras e ações gerais.

---

## Estrutura do programa

### O que é o consórcio

Modelo cooperativo: as igrejas **contribuem mensalmente** para um fundo único administrado pela CBA (ou comitê designado). Periodicamente, missionários concorrem a uma **contemplação** de até R$ 20.000 para montar o kit fluvial, mediante **aprovação prévia do projeto** e **prestação de contas** após a compra.

### O sorteio (mecânica sugerida)

1. **Elegíveis:** missionários em campo ativo (Convênio e AME) com relatório em dia e aprovação do comitê.
2. **Frequência:** até **{int(lot_mod['Sorteios sugeridos/ano'])} sorteios por ano** (ex.: mensal), contemplando em média **{lot_mod['Contemplados por sorteio (média)']:.1f}** missionário(s) por evento no cenário moderado.
3. **Regras de fairness:**
   - Quem for contemplado **sai do sorteio** até que todos tenham sido atendidos **ou** por um período mínimo (ex.: 24 meses), evitando repetição.
   - Prioridade opcional para **áreas sem acesso rodoviário** ou **primeira contemplação da igreja-mãe** — definido em regulamento, não no sorteio puro.
   - Lista de participantes e resultado **publicados** (transparência).
4. **Probabilidade:** com {int(mod['Projetos/ano (inteiro)'])} projetos/ano e {MISSIONARIOS_TOTAL} missionários, a probabilidade **aproximada** por missionário por ano é **{lot_mod['Prob. contemplação/ano/missionário']}** (sorteio simples, uma vaga por projeto).

### Kit R$ 20.000 — composição estimada

{kit_breakdown}

**Validação de mercado:** conjuntos **novos** barco 6 m + Yamaha 15 HP + carreta, em lojas náuticas fora da Amazônia, aparecem na faixa **R$ 27.000–31.000** (2025/2026). Em Manaus/classificados, **usados** ou **casco + motor separados** podem fechar perto de **R$ 17.000–22.000**. Conclusão: **R$ 20 mil é uma meta enxuta e exige compra inteligente** (usado revisado, cotação local, eventual doação de carreta). Para kit **zero km completo**, considerar meta de **R$ 25–28 mil** ou **complemento** da igreja local.

---

## Porte das igrejas → contribuição

Como não há cadastro único de membros, usamos **critérios objetivos** já disponíveis no site da CBA:

| Porte | Nome | Critério | Mensal | Anual |
|-------|------|----------|--------|-------|
{tier_table}

### Distribuição no cadastro atual ({len(igrejas_df)} igrejas)

{dist_lines}

**Lógica em linguagem simples:** igrejas no **interior** com poucas congregações na cidade pagam menos; **polos** do interior (Itacoatiara, Coari, Manacapuru…) e igrejas **mãe** pagam mais; em **Manaus**, a maioria fica no patamar grande, e as que sustentam várias congregações filhas pagam o topo (R$ 350).

---

## Cenários de arrecadação

Potencial máximo (100% das igrejas): **{br_money(total_mensal)}/mês** · **{br_money(total_anual)}/ano**.

| Cenário | Adesão | Mensal | Anual | Projetos R$ 20k/ano |
|---------|--------|--------|-------|---------------------|
{scenario_table}

### Leitura para decisão

- **Conservador (70%):** útil para planejamento de caixa no primeiro ano de lançamento.
- **Moderado (85%):** melhor referência para metas e comunicação com igrejas.
- **Otimista (100%):** teto teórico se todas as 311 filiadas aderirem.

---

## Governança sugerida

| Papel | Sugestão |
|-------|----------|
| **Patrocínio** | Mesa diretora CBA + Departamento de Missões |
| **Comitê gestor** | 3–5 pessoas (tesouraria, missões, representante de associação interior, representante capital) |
| **Sorteio** | Sessão aberta em assembleia ou live; ata com nomes e critérios; opcional: auditor externo leve |
| **Aprovação do projeto** | Antes da contemplação: orçamento, prioridade de campo, segurança náutica |
| **Prestação de contas** | Notas fiscais em até 90 dias; fotos do equipamento; relatório de uso em 12 meses |
| **Fundo** | Conta específica; não misturar com dízimos locais; extrato trimestral às igrejas |

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Baixa adesão das igrejas | Período piloto 6 meses; comunicação via associações; metas por associação |
| R$ 20 mil insuficiente para kit novo | Regulamento permite complemento local ou contemplação parcial + segunda fase |
| Sorteio percebido como “sorte” | Regras de exclusão temporária, transparência, critérios de elegibilidade claros |
| Manutenção do barco/motor | Treinamento básico; parceria com igreja porte P5 para oficina solidária |
| Inadimplência | Cobrança via associação; possibilidade de pausa mediante aprovação |

---

## Próximos passos recomendados

1. Validar faixas de contribuição com tesouraria e pastores de associação.
2. Aprovar regulamento do consórcio em assembleia.
3. Piloto de 12 meses com meta de adesão **70%**.
4. Primeiro sorteio somente após **3 meses** de arrecadação (fundo mínimo).
5. Revisar valor do kit com **3 cotações em Manaus/Itacoatiara** antes de fixar R$ 20 mil no regulamento.

---

*Fontes: `amazonas_cba_metadados.xlsx` (igrejas CBA, missionários ME 2026, IBGE); cotações náuticas Martinelli/outlet 2025–2026; OLX/classificados Manaus (usados).*
"""
    PROPOSTA.write_text(text, encoding="utf-8")


def main():
    churches = pd.read_excel(XLSX, sheet_name="Igrejas_CBA")
    unmapped = pd.read_excel(XLSX, sheet_name="Igrejas_sem_municipio")

    igrejas_df = build_church_tiers(churches, unmapped)
    tier_summary, scenarios, lottery, tier_defs, capa = build_scenarios(igrejas_df)

    with pd.ExcelWriter(XLSX, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
        capa.to_excel(writer, sheet_name="Consorcio_Cenarios", index=False, startrow=0)
        tier_defs.to_excel(writer, sheet_name="Consorcio_Cenarios", index=False, startrow=len(capa) + 2)
        tier_summary.to_excel(writer, sheet_name="Consorcio_Cenarios", index=False, startrow=len(capa) + len(tier_defs) + 4)
        scenarios.to_excel(writer, sheet_name="Consorcio_Cenarios", index=False, startrow=len(capa) + len(tier_defs) + len(tier_summary) + 6)
        lottery.to_excel(writer, sheet_name="Consorcio_Cenarios", index=False, startrow=len(capa) + len(tier_defs) + len(tier_summary) + len(scenarios) + 8)
        igrejas_df.to_excel(writer, sheet_name="Consorcio_Igrejas", index=False)

    wb = load_workbook(XLSX)
    for sheet_name, table_name in [
        ("Consorcio_Cenarios", "TblConsorcioCenarios"),
        ("Consorcio_Igrejas", "TblConsorcioIgrejas"),
    ]:
        ws = wb[sheet_name]
        style_header(ws, ws.max_column)
        add_table(ws, table_name)
    wb.save(XLSX)

    write_proposal(igrejas_df, tier_summary, scenarios, lottery)

    print("=== Consórcio CBA ===")
    print(f"Igrejas: {len(igrejas_df)}")
    print(tier_summary.to_string(index=False))
    print()
    print(scenarios.to_string(index=False))
    print()
    print(lottery.to_string(index=False))
    print(f"\nProposta: {PROPOSTA}")
    print(f"Excel atualizado: {XLSX}")


if __name__ == "__main__":
    main()
