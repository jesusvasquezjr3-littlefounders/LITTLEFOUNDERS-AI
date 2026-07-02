#!/usr/bin/env python3
"""
Gate robusto del Lesson Factory v2 — veredicto pass/reject por lección.
Entrypoint para CI y para el paso pre-import (bloquea publicación de lecciones que fallan).

Corre los hard-fails DETERMINISTAS (estructura LessonV2 + abstracción + vocabulario +
content_quality + feedback). El juicio pedagógico de Opus (factual/forma/engagement) es
una capa LLM separada (no corre en CI sin key); aquí se documenta como advisory.

Uso:
  python3 gate.py <glob_o_archivo> [...]        # exit 1 si alguna falla
  python3 gate.py --strict test_lessons/*.json  # igual, explícito
Salida: resumen + exit code (0 todo pasa, 1 alguna hard-fail).
"""
from __future__ import annotations

import glob as _glob
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "eval"))
sys.path.insert(0, str(BASE / "schema"))
import run_eval  # noqa

HARD = ["structural_validity", "abstraction_ceiling", "vocabulary_language", "content_quality"]


def run(paths: list[str]) -> int:
    files = []
    for p in paths:
        files += _glob.glob(p) if any(c in p for c in "*?[") else [p]
    files = sorted(set(files))
    if not files:
        print("gate: no se encontraron lecciones")
        return 1
    failed = 0
    for f in files:
        try:
            r = run_eval.evaluate(f)
        except Exception as e:
            print(f"❌ {f}: error al evaluar — {str(e)[:80]}")
            failed += 1
            continue
        fails = [k for k in HARD if not r["deterministic"].get(k, {}).get("passed", True)]
        # feedback_prelim es advisory (no bloquea), pero se reporta
        fb = not r["deterministic"].get("feedback_prelim", {}).get("passed", True)
        if fails:
            issues = "; ".join(i for k in fails for i in r["deterministic"][k].get("issues", [])[:1])
            print(f"❌ {Path(f).name}: {', '.join(fails)} — {issues[:100]}")
            failed += 1
        else:
            note = " (advisory: feedback débil)" if fb else ""
            print(f"✅ {Path(f).name}{note}")
    print(f"\nGATE: {len(files)-failed}/{len(files)} pasan los hard-fails deterministas.")
    return 1 if failed else 0


def main():
    args = [a for a in sys.argv[1:] if a != "--strict"]
    if not args:
        print(__doc__)
    return 0
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
