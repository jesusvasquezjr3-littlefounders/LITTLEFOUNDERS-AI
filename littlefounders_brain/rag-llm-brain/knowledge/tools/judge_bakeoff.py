#!/usr/bin/env python3
"""
judge_bakeoff.py — compara modelos JUEZ candidatos sobre los MISMOS docs (modo LEAN), para decidir
EMPÍRICAMENTE si un modelo más barato (p.ej. deepseek-v4-flash) puede reemplazar a GLM sin perder
discriminación. Es el instrumento del head-to-head que exige "certeza del éxito" (anti-AP1: no cambiar el
juez por razonamiento, validar con datos).

Mide, por modelo: media + desviación por dimensión (K samples → varianza/saturación), distribución de
`verdict`, y $/llamada estimado. Y el ACUERDO cross-modelo en verdict.

Criterio de adopción (un modelo barato es viable si):
  (a) DISCRIMINA: no satura a 5/5 en todas las dimensiones y su stdev entre samples es baja, y
  (b) CONCUERDA con GLM en el verdict (publish/revise) sobre el mismo doc.
Si satura o es ruidoso → quédate en GLM.

⚠️ Requiere llamadas PAGADAS (juez K veces × M modelos × N docs). Estima antes; usa --samples bajo.
⚠️ Para un modelo NO cableado (p.ej. MiniMax): primero añádelo como provider en llm_qwen.py (base_url+key+
   provider_for). Este bake-off solo prueba modelos resolubles por provider_for (qwen/glm/deepseek).

Uso:
  python3 tools/judge_bakeoff.py us/taxes/income_tax/definition-and-purpose.es.md
  python3 tools/judge_bakeoff.py <doc> --models glm-4.6,deepseek-v4-flash --samples 3
"""
from __future__ import annotations

import argparse
import statistics
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import build_dataset as bd  # noqa: E402
from kb_common import parse_frontmatter  # noqa: E402
from llm_qwen import Qwen, provider_for  # noqa: E402

DIMS = ["factual_accuracy", "pedagogical_scaffolding", "country_correctness", "translation_fidelity",
        "engagement", "completeness", "worked_example", "citation_quality"]


def _cost_per_call(model: str, usage: dict) -> float:
    pr = bd.PRICING.get(model, {"in": 0.0, "out": 0.0})
    calls = max(usage.get("calls", 1), 1)
    return (usage.get("prompt_tokens", 0) / 1e6 * pr.get("in", 0.0)
            + usage.get("completion_tokens", 0) / 1e6 * pr.get("out", 0.0)) / calls


def run_model(es_text: str, country: str, model: str, samples: int):
    cli = Qwen(provider=provider_for(model), cache=False)   # sin caché: queremos varianza REAL
    rows = []
    for _ in range(samples):
        try:
            j = bd.q_judge(None, country, es_text, evidence="", use_search=False, model=model, client=cli)
            sc = j.get("scores", {})
            rows.append({"scores": {d: sc.get(d) for d in DIMS}, "verdict": j.get("verdict")})
        except Exception as e:
            rows.append({"error": str(e)[:140]})
    return rows, _cost_per_call(model, cli.usage_snapshot())


def summarize(model: str, rows: list, cpc: float) -> list:
    ok = [r for r in rows if "scores" in r]
    errs = [r for r in rows if "error" in r]
    print(f"\n=== {model} === ({len(ok)}/{len(rows)} ok · ~${cpc:.4f}/llamada)")
    if errs:
        print(f"  errores: {[e['error'] for e in errs][:3]}")
    saturated = True
    for d in DIMS:
        vals = [r["scores"].get(d) for r in ok if isinstance(r["scores"].get(d), (int, float))]
        if vals:
            sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
            if not all(v >= 5 for v in vals):
                saturated = False
            print(f"  {d:24s} media={statistics.mean(vals):.2f} stdev={sd:.2f} vals={vals}")
    verdicts = [r.get("verdict") for r in ok]
    print(f"  verdicts: {verdicts}  {'⚠️ SATURADO (todo 5/5)' if (ok and saturated) else ''}")
    return verdicts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("doc", help="ruta del doc (relativa a knowledge/ o absoluta)")
    ap.add_argument("--models", default="glm-4.6,deepseek-v4-flash")
    ap.add_argument("--samples", type=int, default=3)
    args = ap.parse_args()

    p = Path(args.doc)
    if not p.exists():
        p = bd.KB / args.doc
    if not p.exists():
        print(f"❌ No existe el doc {args.doc}")
        return 1
    fm, body = parse_frontmatter(p.read_text(encoding="utf-8"))
    country = (fm or {}).get("country", "us")
    models = [m.strip() for m in args.models.split(",") if m.strip()]

    print(f"Bake-off JUEZ (modo LEAN) · doc={args.doc} · país={country} · {args.samples} samples/modelo")
    print(f"Modelos: {models}  (cache OFF para medir varianza real)")
    all_verdicts = {}
    for m in models:
        rows, cpc = run_model(body, country, m, args.samples)
        all_verdicts[m] = summarize(m, rows, cpc)

    print("\n── ACUERDO de verdict cross-modelo ──")
    base = models[0]
    for m in models[1:]:
        agree = sum(1 for a, b in zip(all_verdicts.get(base, []), all_verdicts.get(m, [])) if a == b)
        n = min(len(all_verdicts.get(base, [])), len(all_verdicts.get(m, [])))
        print(f"  {m} vs {base}: {agree}/{n} verdicts coinciden")
    print("\nVEREDICTO: un modelo barato reemplaza a GLM solo si DISCRIMINA (no satura) Y concuerda en verdict.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
