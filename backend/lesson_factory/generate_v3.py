#!/usr/bin/env python3
"""
Lesson Factory v3 — taxonomy-pure generator (drafter + gate + retry + provenance)
=================================================================================

What v3 fixes vs. the archived v1/v2 (see archive/README.md):
  1. TAXONOMY-PURE BY CONSTRUCTION. The per-type content + correct_answer contract
     for ALL 47 canonical types is DERIVED from schema/exercise_registry.json
     (required_content + verified content_example/answer_example from the 0-0-0-X
     smoke fixtures). v2 hardcoded shapes for only ~7 types, so the other 40 drifted
     from what the Lesson Engine components actually consume — the exact class of
     grading bug found in the 2026-07 engine audit.
  2. MODEL-AGNOSTIC. The drafter LLM is injected as a `complete(system, user) -> dict`
     callable. No provider is hardwired (v2 was pinned to the now-retired DeepSeek).
  3. STRONGER GATE. Reuses the deterministic gate (LessonV2 structure + abstraction +
     vocabulary + content_quality + feedback) AND adds the semantic answer-key
     contracts from validate.py::validate_answer_keys, so lessons that would mis-grade
     (positional mindset, missing sorting/drag classifications, options-mode
     portfolio/shop keys, etc.) cannot pass.

Usage:
  # Inspect the derived taxonomy contract for a band (no LLM call, no key needed):
  python3 generate_v3.py --plan path/to/plan.json --dry-run

  # Generate with any OpenAI-compatible endpoint (provider-agnostic):
  python3 generate_v3.py --plan plan.json --endpoint https://api.provider.com/v1/chat/completions \
      --model some-model --key-env SOME_API_KEY --out test_lessons/

`--plan` is a dict (or list of dicts); see PLAN_SCHEMA below.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "schema"))
sys.path.insert(0, str(BASE / "eval"))
import run_eval  # noqa: E402
import validate as _validate  # noqa: E402  (validate_answer_keys + ValidationResult)
from lesson_v2 import LessonV2  # noqa: E402

REGISTRY = json.loads((BASE / "schema" / "exercise_registry.json").read_text(encoding="utf-8"))
CANON = REGISTRY["canonical_types"]
ANSWER_OPTIONAL = set(REGISTRY.get("answer_optional_types", []))
PEDAGOGY = json.loads((BASE / "pedagogy_rules.json").read_text(encoding="utf-8"))["adventures"]
CEILING = json.loads((BASE / "abstraction_ceiling.json").read_text(encoding="utf-8"))["bands"]
PROMPT_VERSION = "v3.0"

# Gold-standard exemplar (a pilot that passed the gate) — shows the SHAPE of a lesson.
_GOLD_PATH = BASE / "pilot_v2" / "1-1-1-1.json"
GOLD_MIN = {}
if _GOLD_PATH.exists():
    _g = json.loads(_GOLD_PATH.read_text(encoding="utf-8"))
    GOLD_MIN = {k: _g[k] for k in ("lesson_code", "content_es") if k in _g}

# PLAN_SCHEMA (dict):
#   lesson_code:str, band:int, character:str, micro_objective:str, concept_ids:[str],
#   scenario:str, activity_plan:[{phase,type,purpose}], levels:[adventure,saga,topic,number]


def build_type_contract(allowed_types: list[str]) -> str:
    """Derive the EXACT content + correct_answer contract for each allowed type from the
    registry. This is what makes generation taxonomy-pure — it cannot drift from the engine."""
    lines = []
    for t in allowed_types:
        spec = CANON.get(t)
        if not spec:
            continue
        req = spec.get("required_content") or []
        ans_key = spec.get("canonical_answer")
        ce = spec.get("content_example")
        ae = spec.get("answer_example")
        sim = spec.get("generation_mode") == "simulator"
        no_answer = t in ANSWER_OPTIONAL
        ans_note = (
            "SIN correct_answer (auto-validado por el motor)" if no_answer
            else "simulador exploratorio: correct_answer OPCIONAL (el motor siempre acepta)" if sim
            else f"correct_answer DEBE usar la clave canónica: {json.dumps(ans_key)}"
        )
        block = [
            f"• {t}",
            f"    required_content: {req}",
            f"    {ans_note}",
            f"    EJEMPLO content (forma mínima válida, verificada en el motor): {json.dumps(ce, ensure_ascii=False)}",
        ]
        if ae is not None:
            block.append(f"    EJEMPLO correct_answer: {json.dumps(ae, ensure_ascii=False)}")
        lines.append("\n".join(block))
    return "\n".join(lines)


def build_system_prompt(band: int) -> str:
    b = str(band)
    lr = PEDAGOGY[b]["language_rules"]
    ac = PEDAGOGY[b]["activity_constraints"]
    ceil = CEILING[b]
    allowed = ac["allowed_types"]
    contract = build_type_contract(allowed)
    gold = json.dumps(GOLD_MIN, ensure_ascii=False)[:1800] if GOLD_MIN else "(sin exemplar)"
    return f"""Eres un diseñador pedagógico experto en educación financiera para la banda de edad {ceil['age_range']} ({ceil['piaget_stage']}).
Generas UNA lección como JSON válido (LessonV2). Devuelve SOLO el JSON, sin markdown.

REGLAS DE LENGUAJE (banda {band}): máx {lr.get('max_words_per_sentence','?')} palabras/oración; emojis={lr.get('use_emojis')}; PROHIBIDO: {lr.get('forbidden_words', [])}.
TECHO DE ABSTRACCIÓN (HARD): números ≤ {ceil.get('max_number')}; {'solo enteros; ' if ceil.get('whole_numbers_only') else ''}PROHIBIDAS: {ceil.get('forbidden_abstractions', [])}.
Ejercicios por lección: {ac.get('exercises_per_lesson', {})}.

════════ CONTRATO DE TAXONOMÍA (PUREZA CON EL LESSON ENGINE) ════════
Sólo puedes usar estos tipos. Para CADA ejercicio, `content` DEBE incluir los required_content
y `correct_answer` DEBE usar EXACTAMENTE la clave canónica indicada (o ninguna cuando se indica).
Copia la FORMA de los ejemplos (mismos nombres de campo, mismos ids referenciados entre content y answer):
{contract}
════════════════════════════════════════════════════════════════════

CALIDAD OBLIGATORIA (rúbrica v3, alineada con RULES.md):
- FORMA: 6 fases conectar→enseñar→practicar→reforzar→aplicar_variante→cerrar. El 1er ejercicio ENGANCHA (misterio/predicción/escena relatable); el último CONECTA y anticipa la próxima lección.
- ENSEÑAR antes de EVALUAR (nunca preguntes sin antes explicar).
- Cada concepto sigue: ¿por qué importa? → ¿qué es? → ¿cómo se usa? → ¿qué error evitar? → ¿con qué se relaciona?
- FEEDBACK que explica el PORQUÉ. Para tipos de opción añade feedback.per_option {{"a":"...","b":"..."}} nombrando la confusión de cada distractor. NUNCA "Inténtalo de nuevo" genérico.
- Precisión disciplinar: métricas con unidades y rango realista; supuestos explícitos; hecho vs. teoría vs. práctica.
- ENGAGEMENT: ≥1 momento de autonomía o de relación con el personaje; voz cálida, sin condescendencia.
- BILINGÜE: content_es y content_en con MISMO número de ejercicios y MISMOS tipos por índice; los IDS (option/item/category) son IDÉNTICOS entre idiomas.
- Cada ejercicio lleva tags v2: "phase", "engagement_role" (hook|learn|apply|connect), "concept_ids" [], "bloom_level", "scaffold_level" (modeled|guided|independent; DECRECE a lo largo de la lección).

EJEMPLO DE FORMA (content_es de una lección que pasó el gate):
{gold}

El sobre debe incluir: lesson_code, title_es/en, description_es/en, duration, age_rate, points_reward, adventure_level, saga_level, topic_level, lesson_number, content_es[], content_en[]."""


def build_user_prompt(plan: dict, feedback: str | None) -> str:
    base = f"""Genera la lección {plan['lesson_code']} (banda {plan['band']}, personaje {plan.get('character', 'liruf')}).
Objetivo de aprendizaje: {plan['micro_objective']}
Conceptos (concept_ids): {plan.get('concept_ids', [])}
Escenario/gancho sugerido: {plan.get('scenario', '')}
Plan de actividades (fase → tipo → propósito): {json.dumps(plan.get('activity_plan', []), ensure_ascii=False)}
Niveles: adventure_level={plan['levels'][0]}, saga_level={plan['levels'][1]}, topic_level={plan['levels'][2]}, lesson_number={plan['levels'][3]}."""
    if feedback:
        base += f"\n\nLA VERSIÓN ANTERIOR FALLÓ EL GATE. Corrige EXACTAMENTE esto y devuelve el JSON completo de nuevo:\n{feedback}"
    return base


def gate(lesson: dict, band: int) -> tuple[bool, list[str]]:
    """Deterministic hard-fails + semantic answer-key contracts."""
    issues: list[str] = []
    try:
        LessonV2.model_validate(lesson)
    except Exception as e:
        issues.append(f"estructura LessonV2: {str(e).splitlines()[0]}")
    ok_abs, ai = run_eval.check_abstraction(lesson, str(band))
    issues += ai if not ok_abs else []
    (ok_v, vi), _ = run_eval.check_vocabulary(lesson, str(band))
    issues += vi if not ok_v else []
    ok_cq, ci = run_eval.check_content_quality(lesson)
    issues += ci if not ok_cq else []
    ok_fb, fi = run_eval.check_feedback(lesson)
    issues += fi if not ok_fb else []
    # Semantic answer-key contracts (taxonomy purity) — reuse validate.py.
    for lang in ("content_es", "content_en"):
        for i, exx in enumerate(lesson.get(lang, []) or []):
            r = _validate.ValidationResult(lesson_code=lesson.get("lesson_code", "?"))
            _validate.validate_answer_keys(exx, i, r)
            issues += [f"[{lang}] {e}" for e in r.errors]
    return (len(issues) == 0, issues)


def make_openai_completion(endpoint: str, model: str, api_key: str, temperature: float = 0.4):
    """Build a provider-agnostic completion fn for any OpenAI-compatible chat endpoint."""
    def complete(system: str, user: str) -> dict:
        body = {
            "model": model, "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "max_tokens": 8000,
        }
        req = urllib.request.Request(
            endpoint, data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
        resp = json.loads(urllib.request.urlopen(req, timeout=180).read())
        return json.loads(resp["choices"][0]["message"]["content"])
    return complete


def generate_lesson(plan: dict, complete, max_retries: int = 2) -> dict:
    band = plan["band"]
    system = build_system_prompt(band)
    feedback = None
    attempts = []
    lesson: dict = {}
    for attempt in range(max_retries + 1):
        lesson = complete(system, build_user_prompt(plan, feedback))
        # Force coordinate metadata (never trust the model for these).
        a, s, t, l = plan["levels"]
        lesson.update({"lesson_code": plan["lesson_code"], "adventure_level": a, "saga_level": s,
                       "topic_level": t, "lesson_number": l, "age_rate": CEILING[str(band)]["age_range"],
                       "points_reward": 10})
        passed, issues = gate(lesson, band)
        attempts.append({"attempt": attempt + 1, "passed": passed, "issues": issues[:8]})
        if passed:
            lesson["lf_meta"] = {"schema_version": "2.1", "prompt_version": PROMPT_VERSION,
                                 "registry_version": REGISTRY.get("registry_version"),
                                 "plan": plan, "gate": "passed", "attempts": attempt + 1,
                                 "concept_spine": plan.get("concept_ids", [])}
            return {"ok": True, "lesson": lesson, "attempts": attempts}
        feedback = "\n".join(f"- {x}" for x in issues[:10])
    return {"ok": False, "lesson": lesson, "attempts": attempts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", default="test_lessons")
    ap.add_argument("--dry-run", action="store_true", help="Print the derived system prompt for the plan's band and exit (no LLM call).")
    ap.add_argument("--endpoint", help="OpenAI-compatible chat completions URL.")
    ap.add_argument("--model", help="Model id for the endpoint.")
    ap.add_argument("--key-env", help="Env var name holding the API key.")
    args = ap.parse_args()

    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    plans = plan if isinstance(plan, list) else [plan]

    if args.dry_run:
        band = plans[0]["band"]
        print(build_system_prompt(band))
        return 0

    if not (args.endpoint and args.model and args.key_env):
        print("ERROR: para generar se requiere --endpoint, --model y --key-env (o usa --dry-run).", file=sys.stderr)
        return 2
    api_key = os.environ.get(args.key_env)
    if not api_key:
        print(f"ERROR: la variable de entorno {args.key_env} está vacía.", file=sys.stderr)
        return 2
    complete = make_openai_completion(args.endpoint, args.model, api_key)

    outdir = BASE / args.out
    outdir.mkdir(exist_ok=True)
    for p in plans:
        print(f"\n→ {p['lesson_code']} (banda {p['band']})")
        r = generate_lesson(p, complete)
        for a in r["attempts"]:
            print(f"   intento {a['attempt']}: {'✅ PASS' if a['passed'] else '❌ ' + '; '.join(a['issues'][:3])}")
        if r["ok"]:
            (outdir / f"{p['lesson_code']}.json").write_text(
                json.dumps(r["lesson"], ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"   ✅ escrito en {args.out}/{p['lesson_code']}.json")
        else:
            print(f"   ❌ no pasó el gate tras {len(r['attempts'])} intentos")
        time.sleep(0.3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
