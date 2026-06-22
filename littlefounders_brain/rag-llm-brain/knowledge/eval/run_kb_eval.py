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


import re as _re


def _opposite_in_index(con, query, forbid_country) -> int:
    """¿Cuántos chunks del país PROHIBIDO matchean léxicamente la query en el índice (SIN firewall)?
    Si >0, existe contenido FUGABLE: el firewall tiene algo REAL que suprimir → un PASS es significativo.
    Si ==0, el test es VACUO (no hay nada que filtrar) y no demuestra nada (lo marcamos inconcluso)."""
    toks = _re.findall(r"[a-záéíóúñü0-9]+", query.lower())
    if not toks:
        return 0
    match = " OR ".join(f'"{t}"' for t in toks)
    try:
        ids = [row[0] for row in con.execute(
            "SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH ?", (match,)).fetchall()]
    except sqlite3.OperationalError:
        return 0
    if not ids:
        return 0
    q = "SELECT COUNT(*) FROM chunks WHERE country=? AND chunk_id IN (%s)" % ",".join("?" * len(ids))
    return con.execute(q, [forbid_country, *ids]).fetchone()[0]


def suite_leakage(r, con):
    """HARD. NO es una tautología: además de exigir 0 chunks del país opuesto en el resultado FILTRADO,
    comprueba (vía FTS sin firewall) que SÍ existía contenido opuesto fugable. Así, si el firewall
    regresara (se quitara el pre-filtro), estos chunks aparecerían → el test FALLA. Sin contenido
    opuesto que matchee, el caso es INCONCLUSO (no demuestra el firewall), no un falso verde."""
    items = json.loads((EVAL / "leakage_tests.json").read_text())["items"]
    passed = failed = inconclusive = 0
    print("\n── Suite B: Fuga de jurisdicción (HARD · able-to-fail) ──")
    for it in items:
        hits = r.query(it["q"], country=it["country"], language=it["language"], top_k=10)
        leaks = [h for h in hits if h["country"] == it["forbid_country"]]
        leakable = _opposite_in_index(con, it["q"], it["forbid_country"])
        if leaks:
            failed += 1
            print(f"  ✗ {it['id']}: FUGA — {len(leaks)} chunk(s) de {it['forbid_country']}! {[h['doc_id'] for h in leaks]}")
        elif leakable == 0:
            inconclusive += 1
            print(f"  ! {it['id']} INCONCLUSO: no hay contenido de {it['forbid_country']} que matchee (firewall no demostrable aquí)")
        else:
            passed += 1
            print(f"  ✓ {it['id']}: firewall suprimió {leakable} chunk(s) fugables de {it['forbid_country']} (0 en el resultado)")
    if inconclusive:
        print(f"  ({inconclusive} inconcluso(s): añade contenido del país opuesto en esos temas para que el test sea demostrativo)")
    return passed, failed, inconclusive


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


def validate_index(con) -> list[str]:
    """Valida que el índice servido sea de PRODUCCIÓN (loop 3): embedder fastembed (no 'hash' placeholder),
    vectores L2-normalizados (flag embed_normalized) y modelo == build_policy. Atrapa el riesgo de SERVIR un
    índice no-servible/sesgado (CI sólo construye el índice hash; un GO podría servir con vectores crudos)."""
    meta = {row[0]: row[1] for row in con.execute("SELECT k, v FROM meta").fetchall()}
    probs = []
    backend = meta.get("embed_backend", "?")
    if backend != "fastembed":
        probs.append(f"embed_backend='{backend}' NO servible (usa build_index.py --production --embedder fastembed)")
    if meta.get("embed_normalized") != "true":
        probs.append("embed_normalized!=true → cosine (producto punto) sesgado; reconstruye el índice")
    try:
        import yaml
        bp = yaml.safe_load((KB / "_meta" / "build_policy.yaml").read_text(encoding="utf-8"))
        want = (bp.get("embedding", {}) or {}).get("fastembed_model")
        got = meta.get("embed_model")
        if backend == "fastembed" and want and got and want != got:
            probs.append(f"embed_model '{got}' != build_policy '{want}' (provenance/consistencia)")
    except Exception:
        pass
    return probs


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
    ap.add_argument("--require-production", action="store_true",
                    help="HARD-FAIL si el índice no es de producción (fastembed + normalizado + modelo de policy)")
    args = ap.parse_args()
    db = Path(args.db)
    if not db.exists():
        print(f"❌ No existe el índice {db}. Corre primero: python3 tools/build_index.py")
        return 1
    r = Retriever(db)
    con = sqlite3.connect(db)

    idx_probs = validate_index(con)
    if idx_probs:
        print("⚠️  ÍNDICE no-producción:")
        for p in idx_probs:
            print(f"   - {p}")
        if args.require_production:
            print("\nEVAL: ❌ índice no servible para PRODUCCIÓN (--require-production).")
            return 1

    gp, gf = suite_golden(r, con)
    lp, lf, linc = suite_leakage(r, con)
    dp, df = suite_competency(r, con)
    fp, ff = suite_freshness(r, con)
    # Firewall NUNCA demostrado (todo inconcluso, 0 pass demostrativos): el único eval HARD pasaría verde sobre
    # un firewall potencialmente roto (riesgo en un dominio nuevo). Loud siempre; bloqueante en producción.
    firewall_undemonstrated = lp == 0 and lf == 0 and linc > 0

    print("\n" + "=" * 60)
    print(f"A Golden:     {gp} pass / {gf} fail")
    print(f"B Leakage:    {lp} pass / {lf} fail   (HARD)")
    print(f"D Competency: {dp} pass / {df} fail   ({'HARD' if args.strict_recall else 'advisory'})")
    print(f"C Freshness:  {fp} pass / {ff} fail")
    if firewall_undemonstrated:
        print("\n⚠️  FIREWALL NO DEMOSTRADO: todos los casos de fuga salieron inconclusos (no hay contenido del "
              "país opuesto que matchee). El test no puede probar el firewall — añade contenido opuesto en esos "
              "temas. " + ("[BLOQUEANTE con --require-production]" if args.require_production else ""))
    # Leakage siempre bloqueante; golden/freshness cuentan; competency bloquea solo con --strict-recall.
    hard = lf > 0
    total_fail = (gf + lf + ff + (df if args.strict_recall else 0)
                  + (1 if (args.require_production and firewall_undemonstrated) else 0))
    print("\nEVAL: " + ("❌ FALLÓ" if total_fail else "✅ VERDE") +
          ("  [FUGA DETECTADA — bloqueante]" if hard else ""))
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
