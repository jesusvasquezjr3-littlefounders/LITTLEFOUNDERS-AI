#!/usr/bin/env python3
"""
facts_table.py — carga y normalización de la TABLA CANÓNICA DE HECHOS (_meta/facts.yaml).

Es la verdad de base estructurada de las cifras volátiles. Lo usan:
  · gate_kb.py        → compara cada @fact (cuyo id exista aquí y esté verified) contra el valor.
  · build_dataset.py  → inyecta los hechos verificados al AUTOR (para que copie, no invente).

Solo stdlib + yaml. El gate corre como subproceso, así que este módulo es self-contained.
"""
from __future__ import annotations

import re
from pathlib import Path

import yaml

META = Path(__file__).resolve().parent.parent / "_meta"
FACTS_FILE = META / "facts.yaml"


def load_facts(verified_only: bool = False) -> dict:
    """Devuelve {fact_id: factdict}. Si verified_only, solo los confirmados (enforced)."""
    if not FACTS_FILE.exists():
        return {}
    doc = yaml.safe_load(FACTS_FILE.read_text(encoding="utf-8")) or {}
    facts = doc.get("facts", {}) or {}
    if verified_only:
        return {k: v for k, v in facts.items() if v.get("verified") is True}
    return facts


_NUM_RE = re.compile(r"[-+]?\d+(?:\.\d+)?")


def _nums(s: str) -> list[float]:
    return [float(x) for x in _NUM_RE.findall(s)]


def normalize_value(v) -> str:
    """Normaliza para comparación robusta: minúsculas, sin moneda/comas/espacios."""
    s = str(v).strip().lower()
    for junk in ("us$", "usd", "mxn", "$", ","):
        s = s.replace(junk, "")
    return re.sub(r"\s+", "", s)


def values_match(doc_value, canonical_value) -> bool:
    """¿El valor del doc coincide con el canónico? String normalizado o set de números iguales."""
    a, b = normalize_value(doc_value), normalize_value(canonical_value)
    if a == b:
        return True
    na, nb = _nums(a), _nums(b)
    # mismos números (en cualquier formato): p.ej. "16%" vs "16.0%", "3500000" vs "3,500,000"
    if na and nb and len(na) == len(nb) and all(abs(x - y) < 1e-9 for x, y in zip(na, nb)):
        return True
    return False


def canonical_block(facts: dict, jurisdiction: str) -> str:
    """Bloque legible para inyectar al autor: ids+valores canónicos de la jurisdicción dada."""
    rows = [f"  {fid} = {f['value']}   # {f.get('label_es', '')}"
            for fid, f in sorted(facts.items())
            if f.get("jurisdiction") in (jurisdiction, "NONE")]
    return "\n".join(rows)


if __name__ == "__main__":
    import json
    import sys
    only = "--verified" in sys.argv
    f = load_facts(verified_only=only)
    print(f"{len(f)} hechos ({'verified' if only else 'todos'}):")
    print(json.dumps({k: v.get("value") for k, v in f.items()}, ensure_ascii=False, indent=2))
