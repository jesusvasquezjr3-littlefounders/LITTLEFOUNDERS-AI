#!/usr/bin/env python3
"""
Arnés de evaluación del Lesson Factory v2.

Corre AHORA las dimensiones DETERMINISTAS de la rúbrica (hard-fail por código):
  - structural_validity  (LessonV2)
  - abstraction_ceiling  (números > max_number de la banda; abstracciones prohibidas)
  - vocabulary_language  (palabras prohibidas de la banda; longitud de oración advisory)
  - feedback_explains_why (PRE-CHECK determinista: feedback genérico / faltante)

Las dimensiones `check: llm` se marcan "pending_judge" (requieren el juez calibrado, Fase 1).

Uso:
  python3 eval/run_eval.py <lesson.json> [<lesson.json> ...]
  python3 eval/run_eval.py --glob "pilot_v2/*.json"
"""
from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "schema"))
from lesson_v2 import LessonV2  # noqa: E402

ABSTRACTION = json.loads((BASE / "abstraction_ceiling.json").read_text(encoding="utf-8"))["bands"]
PEDAGOGY = json.loads((BASE / "pedagogy_rules.json").read_text(encoding="utf-8")).get("adventures", {})
RUBRIC = json.loads((BASE / "eval" / "rubric.json").read_text(encoding="utf-8"))

GENERIC_ERRORS = ["inténtalo de nuevo", "intenta de nuevo", "try again", "incorrecto", "wrong"]

# Lista de bloqueo de profanidad / typos vulgares (es). Hallazgo: el ciego cazó "pedo"
# (typo de "pago") en 5-3-19-2 — invisible para el determinista y el juez factual.
PROFANITY_ES = ["pedo", "pedos", "caca", "culo", "mierda", "puta", "puto", "putas", "putos",
                "pendejo", "pendejos", "verga", "joder", "coño", "cabron", "cabrón",
                "chingar", "chingada", "teta", "tetas", "pene", "nalga", "nalgas"]
_PROF_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in PROFANITY_ES) + r")\b", re.I)


def _collect_strings(node, out: list[str]):
    """Recolecta recursivamente todos los valores string (texto visible: ítems, opciones, pares...)."""
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, dict):
        for v in node.values():
            _collect_strings(v, out)
    elif isinstance(node, list):
        for v in node:
            _collect_strings(v, out)


def all_text(lesson: dict) -> list[str]:
    out: list[str] = []
    for ex in lesson.get("content_es", []):
        _collect_strings(ex.get("content", {}), out)
    return out


def check_abstraction(lesson: dict, band: str) -> tuple[bool, list[str]]:
    spec = ABSTRACTION.get(band, {})
    issues = []
    maxn = spec.get("max_number")
    text = " ".join(all_text(lesson))
    if maxn is not None:
        for n in re.findall(r"\$?(\d+)", text):
            if int(n) > maxn:
                issues.append(f"número {n} > max_number {maxn} de la banda {band}")
    # abstracciones prohibidas por palabra clave
    for term in spec.get("forbidden_abstractions", []):
        kw = term.split(" ")[0].lower().rstrip("s")
        if kw in ("porcentaje", "porcentual", "interé", "razón", "fórmula") and kw in text.lower():
            issues.append(f"abstracción prohibida para banda {band}: '{term}'")
    return (len(issues) == 0, list(dict.fromkeys(issues)))


def check_vocabulary(lesson: dict, band: str) -> tuple[bool, list[str]]:
    rules = PEDAGOGY.get(band, {}).get("language_rules", {})
    forbidden = [w.lower() for w in rules.get("forbidden_words", [])]
    maxw = rules.get("max_words_per_sentence")
    issues, advisories = [], []
    for txt in all_text(lesson):
        low = txt.lower()
        for w in forbidden:
            if re.search(rf"\b{re.escape(w)}\b", low):
                issues.append(f"palabra prohibida '{w}' en: \"{txt[:40]}…\"")
        if maxw:
            for sent in re.split(r"[.!?¿¡]\s*", txt):
                words = [w for w in re.findall(r"\w+", sent)]
                if len(words) > maxw:
                    advisories.append(f"oración de {len(words)} palabras (máx {maxw}): \"{sent[:40]}…\"")
    return (len(issues) == 0, list(dict.fromkeys(issues))[:10]), list(dict.fromkeys(advisories))[:5]


def check_content_quality(lesson: dict) -> tuple[bool, list[str]]:
    """Hard-fail determinista: profanidad / typos vulgares en el texto visible (ej. 'pedo' por 'pago')."""
    issues = []
    for txt in all_text(lesson):
        for m in _PROF_RE.finditer(txt):
            issues.append(f"término vulgar '{m.group(0)}' en: \"{txt[:50]}…\"")
    return (len(issues) == 0, issues[:10])


def check_feedback(lesson: dict) -> tuple[bool, list[str]]:
    issues = []
    for i, ex in enumerate(lesson.get("content_es", [])):
        if ex.get("type") == "intro_narrative":
            continue
        fb = ex.get("feedback") or {}
        err = (fb.get("error") or "").strip().lower()
        if ex.get("correct_answer") is not None and not err:
            issues.append(f"ejercicio #{i} ({ex.get('type')}) sin feedback de error")
        elif err and any(err == g or err.startswith(g) for g in GENERIC_ERRORS) and not fb.get("per_option"):
            issues.append(f"ejercicio #{i} feedback de error genérico: \"{err[:40]}\"")
    return (len(issues) == 0, issues[:10])


def evaluate(path: str):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    band = str(data.get("adventure_level", "?"))
    result = {"lesson_code": data.get("lesson_code"), "band": band, "deterministic": {}, "llm_pending": []}

    # structural
    try:
        LessonV2.model_validate(data)
        result["deterministic"]["structural_validity"] = {"passed": True}
    except Exception as e:
        result["deterministic"]["structural_validity"] = {"passed": False, "error": str(e).splitlines()[0]}

    ok_abs, abs_issues = check_abstraction(data, band)
    result["deterministic"]["abstraction_ceiling"] = {"passed": ok_abs, "issues": abs_issues}

    (ok_vocab, vocab_issues), vocab_adv = check_vocabulary(data, band)
    result["deterministic"]["vocabulary_language"] = {"passed": ok_vocab, "issues": vocab_issues, "advisories": vocab_adv}

    ok_cq, cq_issues = check_content_quality(data)
    result["deterministic"]["content_quality"] = {"passed": ok_cq, "issues": cq_issues}

    ok_fb, fb_issues = check_feedback(data)
    result["deterministic"]["feedback_prelim"] = {"passed": ok_fb, "issues": fb_issues}

    for d in RUBRIC["dimensions"]:
        if d["check"] == "llm":
            result["llm_pending"].append(d["id"])

    hard_det = ["structural_validity", "abstraction_ceiling", "vocabulary_language", "content_quality"]
    result["deterministic_hard_fail"] = any(not result["deterministic"][k]["passed"] for k in hard_det)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--glob")
    args = ap.parse_args()
    paths = list(args.files)
    if args.glob:
        paths += glob.glob(str(BASE / args.glob))
    if not paths:
        ap.print_help(); return 0
    for p in paths:
        r = evaluate(p)
        print(f"\n=== {r['lesson_code']} (banda {r['band']}) ===")
        for dim, v in r["deterministic"].items():
            mark = "✅" if v["passed"] else "❌"
            extra = ""
            if not v["passed"]:
                extra = " | " + "; ".join(v.get("issues", []) or [v.get("error", "")])
            print(f"  {mark} {dim}{extra}")
            for adv in v.get("advisories", []):
                print(f"       advisory: {adv}")
        print(f"  ⏳ pendientes del juez LLM (calibración Fase 1): {', '.join(r['llm_pending'])}")
        print(f"  → hard-fail determinista: {'❌ SÍ' if r['deterministic_hard_fail'] else '✅ no'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
