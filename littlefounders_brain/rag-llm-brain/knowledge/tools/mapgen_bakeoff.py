#!/usr/bin/env python3
"""
mapgen_bakeoff.py — BAKE-OFF de proveedores para el concept map (¿quién genera mejor el espinazo?).

Pone a DeepSeek, Qwen y GLM a generar el MISMO conjunto de celdas con la MISMA alimentación (prompt lean +
higiene), y captura métricas deterministas para comparar quién lo hace mejor ANTES de elegir el planner
para la regeneración completa. Los candidatos se guardan para un juez ciego posterior.

Métricas por proveedor: temas crudos vs limpios (cuánto hubo que normalizar = 'suciedad'), depth/age fuera
de enum en crudo, costo USD estimado y latencia. (La CALIDAD subjetiva la decide un juez ciego aparte.)

Uso:  python3 tools/mapgen_bakeoff.py            # corre el bake-off sobre la muestra
      python3 tools/mapgen_bakeoff.py --metrics  # reimprime metrics.json sin regenerar
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
sys.path.insert(0, str(TOOLS))
import build_concept_map as bcm  # noqa: E402
import build_dataset as bd  # noqa: E402

DEPTH_ENUM = {"intro", "intermediate", "advanced"}
TIER_ENUM = {"tier1", "tier2", "tier3", "tier4", "tier5"}
OUT = KB / "index" / "bakeoff"

# Proveedores a comparar (tier estándar de planner de cada uno; todos confirmados operativos).
PROVIDERS = [("deepseek", "deepseek-v4-flash"), ("qwen", "qwen-plus-latest"), ("glm", "glm-4.6")]

# Muestra representativa: impuestos, inversión, finanzas personales, emprendimiento, economía, contabilidad;
# MX, US y shared.
CELLS = [
    "mx/taxes/income_tax", "us/investing/stock_market", "shared/personal_finance/budgeting",
    "mx/entrepreneurship/business_formation", "us/personal_finance/credit", "mx/economics/inflation",
    "shared/investing/compound_interest", "us/accounting/financial_statements",
]


def _cost(usage_after: dict, usage_before: dict, model: str) -> float:
    pr = bd._price(model)
    dp = usage_after.get("prompt_tokens", 0) - usage_before.get("prompt_tokens", 0)
    dc = usage_after.get("completion_tokens", 0) - usage_before.get("completion_tokens", 0)
    return dp / 1e6 * pr.get("in", 0.0) + dc / 1e6 * pr.get("out", 0.0)


def _raw_dirty(raw: list[dict]) -> tuple[int, int]:
    d_bad = sum(1 for t in raw if t.get("depth_tier") not in DEPTH_ENUM)
    a_bad = sum(1 for t in raw if not (isinstance(t.get("age_bands"), list)
                                       and t["age_bands"] and all(a in TIER_ENUM for a in t["age_bands"])))
    return d_bad, a_bad


def run_provider(prov: str, model: str) -> dict:
    client = bd.Qwen(provider=prov)
    (OUT / prov).mkdir(parents=True, exist_ok=True)
    rows = []
    for cell in CELLS:
        c, d, s = cell.split("/")
        u0 = dict(client.usage)
        t0 = time.time()
        try:
            raw = bcm._enumerate(c, d, s, client, model)          # salida cruda (para medir suciedad)
            clean = bcm.build_cell(c, d, s, client, model)        # _enumerate cachea → no re-cobra
        except Exception as e:
            rows.append({"cell": cell, "error": str(e)[:120]})
            print(f"  !! {prov} {cell}: {e}", flush=True)
            continue
        dt = time.time() - t0
        db, ab = _raw_dirty(raw)
        cost = _cost(client.usage, u0, model)
        (OUT / prov / (cell.replace("/", "__") + ".json")).write_text(
            json.dumps({"cell": cell, "topics": clean}, ensure_ascii=False, indent=2), encoding="utf-8")
        rows.append({"cell": cell, "raw": len(raw), "clean": len(clean),
                     "depth_bad": db, "age_bad": ab, "sec": round(dt, 1), "usd": round(cost, 4)})
        print(f"  {prov} {cell}: raw={len(raw)} clean={len(clean)} dirty(d/a)={db}/{ab} "
              f"{dt:.0f}s ${cost:.4f}", flush=True)
    ok = [r for r in rows if "clean" in r]
    tot = {
        "model": model,
        "cells_ok": len(ok),
        "avg_clean": round(sum(r["clean"] for r in ok) / max(len(ok), 1), 1),
        "avg_raw": round(sum(r["raw"] for r in ok) / max(len(ok), 1), 1),
        "dirty_depth_total": sum(r["depth_bad"] for r in ok),
        "dirty_age_total": sum(r["age_bad"] for r in ok),
        "total_usd": round(sum(r["usd"] for r in ok), 3),
        "avg_sec": round(sum(r["sec"] for r in ok) / max(len(ok), 1), 1),
        "rows": rows,
    }
    return tot


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--metrics", action="store_true")
    args = ap.parse_args()
    mfile = OUT / "metrics.json"
    if args.metrics and mfile.exists():
        print(mfile.read_text(encoding="utf-8"))
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"BAKE-OFF · {len(CELLS)} celdas × {len(PROVIDERS)} proveedores (misma alimentación)\n", flush=True)
    with ThreadPoolExecutor(max_workers=len(PROVIDERS)) as ex:
        results = dict(zip([p for p, _ in PROVIDERS],
                           ex.map(lambda pm: run_provider(*pm), PROVIDERS)))
    mfile.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 78)
    print(f"{'proveedor':<12}{'modelo':<22}{'avg_limpio':>11}{'avg_crudo':>11}{'sucio d/a':>11}{'$tot':>8}{'avg_s':>7}")
    print("-" * 78)
    for prov, t in results.items():
        print(f"{prov:<12}{t['model']:<22}{t['avg_clean']:>11}{t['avg_raw']:>11}"
              f"{str(t['dirty_depth_total'])+'/'+str(t['dirty_age_total']):>11}{t['total_usd']:>8}{t['avg_sec']:>7}")
    print("=" * 78)
    print(f"candidatos → {OUT.relative_to(KB.parent)}/<proveedor>/  ·  métricas → {mfile.relative_to(KB.parent)}")
    print("Siguiente: juez ciego sobre los candidatos para la CALIDAD subjetiva.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
