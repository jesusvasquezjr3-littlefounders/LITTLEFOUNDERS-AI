#!/usr/bin/env python3
"""
update_facts.py — AGENTE DE ACTUALIZACIÓN ATÓMICA de la tabla canónica (_meta/facts.yaml).

Mantiene FRESCO el cerebro sin re-fabricarlo. Diseñado para correr en cron (p.ej. semanal):
re-verifica SOLO los hechos VENCIDOS (review_due) con UNA consulta ATÓMICA por hecho (búsqueda
en fuente primaria vía el cliente con búsqueda), PROPONE cambios (no auto-aplica: un humano/SME
aprueba), y LISTA los docs afectados que habría que regenerar cuando un valor cambia.

review_due = last_verified + cadencia(volatility)  (cadencias en volatility_policy.yaml)
"due" = verified:false  ∨  review_due ≤ hoy  ∨  effective_to < hoy

Uso:
  python3 tools/update_facts.py --due                  # lista hechos vencidos (SIN red)
  python3 tools/update_facts.py --verify [--all]       # consulta atómica → reporte de propuestas
  python3 tools/update_facts.py --affected mx.uma.diaria  # docs que citan ese @fact

NO edita facts.yaml automáticamente: escribe index/facts_update_report.json para revisión humana.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

import yaml

TOOLS = Path(__file__).resolve().parent
KB = TOOLS.parent
META = KB / "_meta"
sys.path.insert(0, str(TOOLS))
from facts_table import FACTS_FILE, load_facts, values_match  # noqa: E402
from llm_qwen import Qwen, provider_for  # noqa: E402

POLICY = yaml.safe_load((META / "build_policy.yaml").read_text(encoding="utf-8"))
VPOL = yaml.safe_load((META / "volatility_policy.yaml").read_text(encoding="utf-8"))["cadences"]
# Frescura = TIEMPO REAL (wall-clock), NO el date_anchor congelado del build: un fact que venció en el
# calendario debe detectarse aunque el anchor de contenido no se haya movido (bug del reloj congelado).
TODAY = dt.date.today()
ANCHOR = POLICY["content_conventions"]["date_anchor"]   # solo informativo (fecha 'as of' del contenido)
JUDGE_MODEL = POLICY["models"]["judge"]      # cliente con búsqueda (GLM)
_MONTHS = {"static": None, "low": 24, "medium": 12, "high": 3}


def _add_months(d: dt.date, months: int) -> dt.date:
    m0 = d.month - 1 + months
    y = d.year + m0 // 12
    return dt.date(y, m0 % 12 + 1, min(d.day, 28))


def review_due(fact: dict) -> dt.date | None:
    lv = fact.get("last_verified")
    months = _MONTHS.get(fact.get("volatility", "medium"))
    if not lv or months is None:
        return None
    return _add_months(dt.date.fromisoformat(str(lv)), months)


def is_due(fact: dict) -> tuple[bool, str]:
    if not fact.get("verified"):
        return True, "no verificado"
    et = fact.get("effective_to")
    if et and et not in (None, "null"):
        try:
            if dt.date.fromisoformat(str(et)) < TODAY:
                return True, f"vigencia expiró ({et})"
        except ValueError:
            pass
    rd = review_due(fact)
    if rd and rd <= TODAY:
        return True, f"review_due vencido ({rd})"
    return False, ""


def due_facts(facts: dict) -> list[tuple[str, dict, str]]:
    out = []
    for fid, f in facts.items():
        due, why = is_due(f)
        if due:
            out.append((fid, f, why))
    return out


def affected_docs(fact_id: str) -> list[str]:
    pat = re.compile(rf"@fact\s+id={re.escape(fact_id)}\b")
    hits = []
    for c in ("shared", "mx", "us"):
        base = KB / c
        if not base.exists():
            continue
        for p in base.rglob("*.md"):
            try:
                if pat.search(p.read_text(encoding="utf-8")):
                    hits.append(str(p.relative_to(KB)))
            except Exception:
                continue
    return sorted(hits)


def verify_one(qw: Qwen, fid: str, fact: dict) -> dict:
    """UNA consulta atómica: pide el valor oficial vigente y su fuente primaria."""
    msg = [{"role": "system", "content":
            "Eres verificador fiscal/financiero. Usa BÚSQUEDA WEB en fuentes PRIMARIAS oficiales. "
            "Devuelve SOLO JSON."},
           {"role": "user", "content":
            f"Jurisdicción={fact.get('jurisdiction')}. Verifica el valor VIGENTE de: "
            f"{fact.get('label_es', fid)} (id={fid}). Valor que tengo registrado: '{fact.get('value')}' "
            f"(last_verified {fact.get('last_verified')}). Busca la fuente oficial más reciente y dime el "
            'valor actual. Devuelve {"current_value":"...","changed":true|false,"effective_from":"...",'
            '"source_url":"...","confidence":"high|medium|low","note":"..."}'}]
    try:
        return qw.json(msg, model=JUDGE_MODEL, enable_search=True, temperature=0.1, timeout=120)
    except Exception as e:
        return {"current_value": None, "changed": None, "error": str(e)[:200]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--due", action="store_true", help="lista hechos vencidos (sin red)")
    ap.add_argument("--verify", action="store_true", help="consulta atómica de los vencidos → reporte")
    ap.add_argument("--all", action="store_true", help="con --verify: re-verifica TODOS, no solo los vencidos")
    ap.add_argument("--affected", metavar="FACT_ID", help="lista docs que citan ese @fact")
    args = ap.parse_args()

    facts = load_facts()

    if args.affected:
        docs = affected_docs(args.affected)
        print(f"{len(docs)} doc(s) citan @fact {args.affected}:")
        for d in docs:
            print(f"  {d}")
        return 0

    due = due_facts(facts)
    if args.due or not (args.verify):
        print(f"Hoy = {TODAY}.  {len(due)}/{len(facts)} hechos VENCIDOS:")
        for fid, f, why in due:
            print(f"  · {fid}: {f.get('value')}  [{why}]  (vol={f.get('volatility')})")
        if not args.verify:
            return 0

    targets = list(facts.items()) if args.all else [(fid, f) for fid, f, _ in due]
    if not targets:
        print("Nada que verificar.")
        return 0
    qw = Qwen(provider=provider_for(JUDGE_MODEL))
    report = []
    print(f"\nVerificación atómica de {len(targets)} hecho(s) con {JUDGE_MODEL}…")
    for fid, f in targets:
        res = verify_one(qw, fid, f)
        cur = res.get("current_value")
        changed = bool(cur) and not values_match(cur, f.get("value", ""))
        rec = {"fact_id": fid, "stored": f.get("value"), "found": cur,
               "changed": changed, "source_url": res.get("source_url"),
               "confidence": res.get("confidence"), "note": res.get("note") or res.get("error"),
               "affected_docs": affected_docs(fid) if changed else []}
        report.append(rec)
        flag = "⚠️ CAMBIÓ" if changed else "= igual" if cur else "? sin dato"
        print(f"  {flag}  {fid}: stored={f.get('value')} found={cur}")

    out = KB / "index" / "facts_update_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"date": str(TODAY), "report": report}, ensure_ascii=False, indent=2),
                   encoding="utf-8")
    changed = [r for r in report if r["changed"]]
    print(f"\nReporte → {out.relative_to(KB.parent)}")
    print(f"{len(changed)} cifra(s) cambiaron. NO se editó facts.yaml (requiere aprobación humana/SME).")
    if changed:
        print("Para cada cambio: actualizar value+last_verified en facts.yaml y regenerar los docs afectados")
        print("(build_dataset.py --retry-drafts tras marcar esos docs como draft, o borrar y reconstruir).")
    print(f"usage={qw.usage}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
