#!/usr/bin/env python3
"""
run_kb_eval.py — arnés de evaluación del cerebro. Tres suites (BRAIN_STRATEGY.md §6):
  A. Golden Q&A      — exactitud + grounding (must_cite recuperado; expect_any presente)
  B. Fuga jurisdicc. — HARD: ningún chunk del país opuesto en el resultado (la suite crítica)
  C. Frescura        — high-volatility cita primaria y no está stale; exclude_stale funciona

Uso:
  python3 eval/run_kb_eval.py                 # requiere index/kb.db (corre build_index antes)
  python3 eval/run_kb_eval.py --db index/kb.db
Exit 0 si todo verde; 1 si algún HARD-FAIL (B siempre es hard).
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from kb_common import KB  # noqa: E402
from retriever import Retriever  # noqa: E402

EVAL = KB / "eval"


def full_texts(con, chunk_ids):
    if not chunk_ids:
        return ""
    q = "SELECT text FROM chunks WHERE chunk_id IN (%s)" % ",".join("?" * len(chunk_ids))
    return " ".join(r[0] for r in con.execute(q, list(chunk_ids)).fetchall()).lower()


def suite_golden(r, con):
    items = json.loads((EVAL / "golden_qa.json").read_text())["items"]
    passed = failed = 0
    print("\n── Suite A: Golden Q&A ──")
    for it in items:
        hits = r.query(it["q"], country=it["country"], language=it["language"],
                       domain=it.get("domain"), top_k=6)
        ids = [h["chunk_id"] for h in hits]
        srcs = {s for h in hits for s in h["sources"]}
        text = full_texts(con, ids)
        grounded = bool(set(it["must_cite"]) & srcs)
        factual = any(e.lower() in text for e in it["expect_any"])
        ok = grounded and factual
        passed += ok; failed += (not ok)
        if not ok:
            why = []
            if not grounded: why.append(f"sin grounding (esperaba una de {it['must_cite']}, trajo {sorted(srcs)})")
            if not factual: why.append(f"sin hecho {it['expect_any']}")
            print(f"  ✗ {it['id']}: {'; '.join(why)}")
        else:
            print(f"  ✓ {it['id']}")
    return passed, failed


def suite_leakage(r):
    items = json.loads((EVAL / "leakage_tests.json").read_text())["items"]
    passed = failed = 0
    print("\n── Suite B: Fuga de jurisdicción (HARD) ──")
    for it in items:
        hits = r.query(it["q"], country=it["country"], language=it["language"], top_k=10)
        leaks = [h for h in hits if h["country"] == it["forbid_country"]]
        ok = not leaks
        passed += ok; failed += (not ok)
        if ok:
            print(f"  ✓ {it['id']} (hits={len(hits)}, 0 de {it['forbid_country']})")
        else:
            print(f"  ✗ {it['id']}: {len(leaks)} chunk(s) de {it['forbid_country']}! {[h['doc_id'] for h in leaks]}")
    return passed, failed


def suite_competency(r, con):
    """Suite D — RECALL funcional: el corpus de cada celda DEBE poder responder sus competency questions.
    Salta celdas sin contenido aún (informa el 'en espera de --run'); para celdas CON contenido, mide si
    un chunk de la propia celda es recuperado. Convierte competency_questions.json (antes código muerto)
    en un gate de cobertura real (bloqueante solo con --strict-recall)."""
    f = EVAL / "competency_questions.json"
    if not f.exists():
        return 0, 0
    cells = json.loads(f.read_text())["cells"]
    have = {(row[0], row[1], row[2]) for row in
            con.execute("SELECT DISTINCT country, domain, subdomain FROM chunks").fetchall()}
    print("\n── Suite D: Competency recall (cobertura funcional) ──")
    tested = hit = skipped = 0
    for cell, questions in sorted(cells.items()):
        country, domain, subdomain = cell.split("/")
        language = "en" if country == "us" else "es"     # mx/shared canónico = es; us = en
        if (country, domain, subdomain) not in have:
            skipped += len(questions)
            continue
        for q in questions:
            tested += 1
            hits = r.query(q, country=country, language=language, domain=domain, top_k=8)
            ok = any(h["subdomain"] == subdomain for h in hits)
            hit += bool(ok)
            if not ok:
                print(f"  ✗ {cell}: sin recall para «{q[:58]}»")
    if tested:
        print(f"  recall {hit}/{tested} ({100*hit//max(tested,1)}%) · {skipped} preguntas sin contenido aún (skip)")
    else:
        print(f"  (sin celdas con contenido todavía; {skipped} preguntas en espera del --run)")
    return hit, tested - hit


def suite_freshness(r, con):
    print("\n── Suite C: Frescura ──")
    passed = failed = 0
    # C1: todo chunk volatility=high tiene review_due futuro (no stale) y review_due presente
    rows = con.execute("SELECT chunk_id, review_due, volatility FROM chunks WHERE volatility='high'").fetchall()
    bad = [r0[0] for r0 in rows if not r0[1]]
    ok1 = not bad
    passed += ok1; failed += (not ok1)
    print(f"  {'✓' if ok1 else '✗'} C1: high-volatility con review_due ({len(rows)} chunks, {len(bad)} sin review_due)")
    # C2: exclude_stale devuelve subconjunto no vacío (el piloto no está stale)
    a = r.query("impuesto tax", country="mx", language="es", top_k=10)
    b = r.query("impuesto tax", country="mx", language="es", exclude_stale=True, top_k=10)
    ok2 = len(b) > 0 and len(b) <= len(a)
    passed += ok2; failed += (not ok2)
    print(f"  {'✓' if ok2 else '✗'} C2: exclude_stale funciona (all={len(a)}, fresh={len(b)})")
    return passed, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(KB / "index" / "kb.db"))
    ap.add_argument("--strict-recall", action="store_true",
                    help="hace BLOQUEANTE el recall de competency (Suite D) — usar tras --run con contenido")
    args = ap.parse_args()
    db = Path(args.db)
    if not db.exists():
        print(f"❌ No existe el índice {db}. Corre primero: python3 tools/build_index.py")
        return 1
    r = Retriever(db)
    con = sqlite3.connect(db)

    gp, gf = suite_golden(r, con)
    lp, lf = suite_leakage(r)
    dp, df = suite_competency(r, con)
    fp, ff = suite_freshness(r, con)

    print("\n" + "=" * 60)
    print(f"A Golden:     {gp} pass / {gf} fail")
    print(f"B Leakage:    {lp} pass / {lf} fail   (HARD)")
    print(f"D Competency: {dp} pass / {df} fail   ({'HARD' if args.strict_recall else 'advisory'})")
    print(f"C Freshness:  {fp} pass / {ff} fail")
    # Leakage siempre bloqueante; golden/freshness cuentan; competency bloquea solo con --strict-recall.
    hard = lf > 0
    total_fail = gf + lf + ff + (df if args.strict_recall else 0)
    print("\nEVAL: " + ("❌ FALLÓ" if total_fail else "✅ VERDE") +
          ("  [FUGA DETECTADA — bloqueante]" if hard else ""))
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
