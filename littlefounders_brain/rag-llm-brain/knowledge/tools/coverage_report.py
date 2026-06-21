#!/usr/bin/env python3
"""
coverage_report.py — MÉTRICAS DE COBERTURA ENCICLOPÉDICA (mundo cerrado, relativas al concept_map).

La cobertura "total" no es un absoluto platónico: se mide RELATIVA a un esquema cerrado de referencia
(como hacen Wikidata/FIBO/CFA). Aquí el oráculo es la malla `all_jobs()` (251 celdas país×dominio×
subdominio) + el `concept_map.yaml` (~13k temas = "qué es TODO"). Este reporte convierte "¿ya cubrimos
todo?" en NÚMEROS diffables por PR. Sin API → corre en CI.

Métricas (ver ENCYCLOPEDIA_STRATEGY.md):
  · GRID_Φ        % de celdas aplicables con ≥ baseline docs (cubrimos TODO a baseline = hito #1).
  · GRID_μ        la celda PEOR cubierta (el siguiente trabajo; mejor señal de paro que el promedio).
  · madurez       semáforo por celda: rojo=vacía, amarillo=baseline, verde=deep (modelo FIBO).
  · MAP_COVERAGE  docs/temas POR CELDA (no el ratio global ingenuo) + celdas más rezagadas.
  · CONCEPT_RECALL fracción de términos CLAVE por jurisdicción presentes en el corpus + huecos + FUGA.

Uso:  python3 tools/coverage_report.py            # resumen + persiste index/coverage_report.json
      python3 tools/coverage_report.py --gaps      # además lista celdas vacías y conceptos sin cubrir
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
sys.path.insert(0, str(TOOLS))
import build_dataset as bd  # noqa: E402  (all_jobs, CONCEPT_MAP, POLICY)

BASELINE = bd.POLICY.get("breadth", {}).get("baseline_docs_per_subdomain", 2)
DEEP = bd.POLICY.get("depth", {}).get("min_docs_per_subdomain", 8)

# Términos CLAVE por jurisdicción (false-friends incluidos): CONCEPT_RECALL + detección de FUGA.
TERMS = {
    "mx": ["IVA", "ISR", "SAT", "RFC", "CFDI", "RESICO", "UMA", "IMSS", "INFONAVIT", "CONDUSEF",
           "Banxico", "salario mínimo", "deducciones personales", "declaración anual", "aguinaldo", "AFORE"],
    "us": ["IRS", "EIN", "SSN", "1099", "W-2", "401(k)", "IRA", "Roth", "HSA", "FICA",
           "standard deduction", "SALT", "NIIT", "capital gains", "wash sale", "Social Security"],
    "shared": ["interés compuesto", "presupuesto", "ahorro", "diversificación", "inflación",
               "tasa de interés", "crédito", "préstamo", "riesgo", "liquidez"],
}


def _es_docs(cell_dir: Path) -> int:
    return len(list(cell_dir.glob("*.es.md"))) if cell_dir.exists() else 0


def _corpus_text(country: str) -> str:
    base = KB / country
    if not base.exists():
        return ""
    return "\n".join(p.read_text(encoding="utf-8") for p in base.rglob("*.md")).lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gaps", action="store_true", help="listar celdas vacías y conceptos sin cubrir")
    args = ap.parse_args()

    jobs = bd.all_jobs()
    cmap = bd.CONCEPT_MAP

    # ── rejilla cerrada: madurez por celda ──────────────────────────────────
    empty = baseline = deep = 0
    worst = (10**9, None)
    map_cov = []          # (key, docs, map_topics)
    empties = []
    for (c, d, s) in jobs:
        key = f"{c}/{d}/{s}"
        n = _es_docs(KB / c / d / s)
        if n == 0:
            empty += 1; empties.append(key)
        elif n >= DEEP:
            deep += 1
        else:
            baseline += 1
        if n < worst[0]:
            worst = (n, key)
        mt = len(cmap.get(key, {}).get("topics", [])) if cmap else 0
        map_cov.append((key, n, mt))

    total = len(jobs)
    grid_phi = 100 * (baseline + deep) / total if total else 0
    mapped = len(cmap)
    map_topics = sum(len(c.get("topics", [])) for c in cmap.values()) if cmap else 0
    docs_total = sum(n for _, n, _ in map_cov)

    # ── CONCEPT_RECALL + fuga ───────────────────────────────────────────────
    recall = {}
    leaks = []
    text = {c: _corpus_text(c) for c in ("mx", "us", "shared")}
    for juris, terms in TERMS.items():
        present = [t for t in terms if t.lower() in text.get(juris, "")]
        recall[juris] = {"covered": len(present), "total": len(terms),
                         "missing": [t for t in terms if t not in present]}
    # menciones cross-jurisdicción (INFORMATIVO, no necesariamente fuga: las comparaciones MX↔US son
    # legítimas y deseables). El firewall DURO real lo hace el gate sobre la jurisdicción de cada @fact.
    for t in TERMS["mx"]:
        if t.lower() in text["us"]:
            leaks.append(f"MX '{t}' mencionado en corpus US")
    for t in TERMS["us"]:
        if t.lower() in text["mx"]:
            leaks.append(f"US '{t}' mencionado en corpus MX")

    report = {
        "grid": {"total_cells": total, "empty": empty, "baseline": baseline, "deep": deep,
                 "GRID_phi_pct": round(grid_phi, 1), "GRID_mu_worst": {"docs": worst[0], "cell": worst[1]}},
        "concept_map": {"cells_mapped": mapped, "cells_total": total, "map_topics": map_topics,
                        "docs_total": docs_total},
        "concept_recall": recall,
        "cross_mentions": leaks,   # informativo (comparaciones MX↔US son válidas); el firewall duro = gate
    }
    out = KB / "index" / "coverage_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── salida legible ──────────────────────────────────────────────────────
    print("=" * 64)
    print("COBERTURA ENCICLOPÉDICA (mundo cerrado vs concept_map)")
    print("=" * 64)
    print(f"REJILLA: {total} celdas · vacías {empty} · baseline {baseline} · deep {deep}")
    print(f"  GRID_Φ (celdas ≥ baseline {BASELINE}): {grid_phi:.1f}%   ← hito 'cubrimos TODO a baseline' = 100%")
    print(f"  GRID_μ (celda peor cubierta): {worst[0]} docs en {worst[1]}")
    print(f"CONCEPT MAP: {mapped}/{total} celdas mapeadas · {map_topics} temas · {docs_total} docs generados")
    print("CONCEPT_RECALL (términos clave por jurisdicción):")
    for j, r in recall.items():
        print(f"  {j}: {r['covered']}/{r['total']}" + (f"  faltan: {r['missing']}" if (args.gaps and r['missing']) else ""))
    print(f"Menciones cross-jurisdicción (informativo, comparaciones OK): {len(leaks)}")
    if args.gaps and empties:
        print(f"\nCELDAS VACÍAS ({len(empties)}):")
        for k in empties[:60]:
            print(f"  · {k}")
    print(f"\nReporte → {out.relative_to(KB.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
