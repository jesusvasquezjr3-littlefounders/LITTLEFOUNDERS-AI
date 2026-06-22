#!/usr/bin/env python3
"""
cost_projection.py — proyecta el COSTO TOTAL de la corrida completa por proveedor y lo compara con
los caps de presupuesto. Mata el riesgo #1 de la corrida masiva: que `budget_usd` muera al 3% del mapa
(STOP-por-budget disfrazado de STOP-por-cobertura). Convierte "GO-para-arrancar" en "GO-para-TERMINAR".

Método: toma el costo de AUTOR OBSERVADO por doc (de index/build_log.jsonl, campo `spent`), estima el
costo de JUEZ y de VERIFICACIÓN ATÓMICA (v4) por doc con supuestos CONSERVADORES y explícitos, multiplica
por los temas RESTANTES del concept_map, aplica precios + surcharge de búsqueda, y suma un margen de
seguridad. Reporta: $ proyectado por proveedor, cap actual, y el cap RECOMENDADO.

Uso:
  python3 tools/cost_projection.py                 # proyección de la corrida completa
  python3 tools/cost_projection.py --safety 1.4    # margen de seguridad (default 1.3)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
META = KB / "_meta"
sys.path.insert(0, str(TOOLS))
from llm_qwen import provider_for  # noqa: E402

POLICY = yaml.safe_load((META / "build_policy.yaml").read_text(encoding="utf-8"))
MODELS = POLICY["models"]
PRICING = POLICY.get("pricing_usd_per_mtok", {})
SEARCH = POLICY.get("search_usd_per_call", {})
WISE = POLICY.get("wise_use", {})

# ── supuestos v4 por doc-par (CONSERVADORES; el smoke de Fase 1 los re-calibra) ──────────────────────
# Cada doc = par ES/EN en UNA llamada de autor. Estos números se SUMAN al autor observado.
JUDGE_IN_TOK = 14000      # juez ve doc + evidencia + prompt
JUDGE_OUT_TOK = 2500
ATOMIC_IN_TOK = 14000     # verificador atómico ve evidencia + claims (v4)
ATOMIC_OUT_TOK = 2500
REVISE_FACTOR = 1.8       # rondas medias en que se invoca juez/atómico (revise-loop)
V4_AUTHOR_EVIDENCE_IN = 4000   # RAG-to-write: evidencia recuperada inyectada al prompt del autor


def observed_author_per_doc() -> tuple[float, float, int]:
    """(prompt_tok, completion_tok, n) promedio del AUTOR por doc, de build_log.jsonl. Fallback si <3."""
    log = KB / "index" / "build_log.jsonl"
    ins, outs = [], []
    if log.exists():
        for line in log.read_text(encoding="utf-8").splitlines():
            try:
                d = json.loads(line)
                s = d.get("spent")
                if s and s.get("prompt_tokens"):
                    ins.append(s["prompt_tokens"]); outs.append(s.get("completion_tokens", 0))
            except Exception:
                continue
    if len(ins) >= 3:
        return sum(ins) / len(ins), sum(outs) / len(outs), len(ins)
    return 24000.0, 11600.0, 0      # fallback: media observada en el piloto v3


def map_topics() -> int:
    cm = yaml.safe_load((META / "concept_map.yaml").read_text(encoding="utf-8")) or {}
    return sum(len(c.get("topics", [])) for c in cm.get("cells", {}).values())


def _price(model: str) -> dict:
    return PRICING.get(model, {"in": 0.0, "out": 0.0})


def project(n_docs: int, safety: float, atomic: bool = True) -> dict:
    a_in, a_out, n_obs = observed_author_per_doc()
    a_in += V4_AUTHOR_EVIDENCE_IN
    author_m, judge_m = MODELS["author"], MODELS["judge"]
    ap, jp = _price(author_m), _price(judge_m)
    jprov = provider_for(judge_m)
    aprov = provider_for(author_m)

    # costo por doc, por proveedor
    author_doc = (a_in / 1e6 * ap["in"] + a_out / 1e6 * ap["out"])
    judge_doc = ((JUDGE_IN_TOK / 1e6 * jp["in"] + JUDGE_OUT_TOK / 1e6 * jp["out"]
                  + float(SEARCH.get(jprov, 0.0))) * REVISE_FACTOR)
    atomic_doc = ((ATOMIC_IN_TOK / 1e6 * jp["in"] + ATOMIC_OUT_TOK / 1e6 * jp["out"]) * REVISE_FACTOR) if atomic else 0.0

    by_prov: dict = {}
    by_prov[aprov] = by_prov.get(aprov, 0.0) + author_doc * n_docs * safety
    by_prov[jprov] = by_prov.get(jprov, 0.0) + (judge_doc + atomic_doc) * n_docs * safety
    return {
        "n_docs": n_docs, "safety": safety, "n_observed": n_obs,
        "author_per_doc": round(author_doc, 4), "judge_per_doc": round(judge_doc, 4),
        "atomic_per_doc": round(atomic_doc, 4),
        "by_provider": {k: round(v, 2) for k, v in by_prov.items()},
        "providers": {"author": aprov, "judge": jprov},
    }


def report(safety: float = 1.3, atomic: bool = True) -> bool:
    total = map_topics()
    p = project(total, safety, atomic)
    caps = (WISE.get("budget_usd") or {})
    print("\n" + "=" * 70)
    print(f"PROYECCIÓN DE COSTO — corrida COMPLETA ({total} temas del concept_map)")
    print("=" * 70)
    src = f"observado en {p['n_observed']} docs" if p["n_observed"] else "fallback (sin observaciones)"
    print(f"autor/doc≈${p['author_per_doc']}  juez/doc≈${p['judge_per_doc']}  "
          f"atómico/doc≈${p['atomic_per_doc']}  · margen seguridad ×{safety} · {src}")
    print(f"{'proveedor':<12}{'proyectado':>14}{'cap actual':>14}{'cap recomendado':>18}{'  estado'}")
    print("-" * 70)
    ok = True
    for prov, proj in sorted(p["by_provider"].items()):
        cap = caps.get(prov)
        capf = float(cap) if cap not in (None, "null", "") else None
        rec = round(proj * 1.1, 0)              # cap recomendado = proyección + 10%
        cap_s = f"${capf:.0f}" if capf is not None else "pay-go" if prov == p["providers"]["author"] else "—"
        covers = (capf is not None and capf >= proj)
        if not covers and not (capf is None and prov == p["providers"]["author"]):
            ok = False
        flag = "✓ cubre" if covers else ("⚠ pay-as-you-go" if capf is None and prov == p["providers"]["author"] else "✗ INSUFICIENTE")
        print(f"{prov:<12}{'$'+format(proj,'.2f'):>14}{cap_s:>14}{'$'+format(rec,'.0f'):>18}  {flag}")
    print("-" * 70)
    grand = sum(p["by_provider"].values())
    print(f"TOTAL proyectado (corrida completa): ~${grand:.0f} USD")
    print("Nota: estimación con supuestos v4 conservadores; el SMOKE de Fase 1 (1 celda) re-calibra los\n"
          "      números/doc reales ANTES de recargar saldos. atomic={}.".format("ON" if atomic else "OFF"))
    print("VEREDICTO PRESUPUESTO: " + ("✅ los caps cubren la corrida completa"
                                       if ok else "❌ SUBE los caps a 'recomendado' antes del --run masivo"))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--safety", type=float, default=1.3)
    ap.add_argument("--no-atomic", action="store_true", help="proyecta SIN la verificación atómica v4")
    args = ap.parse_args()
    return 0 if report(args.safety, atomic=not args.no_atomic) else 1


if __name__ == "__main__":
    raise SystemExit(main())
