#!/usr/bin/env python3
"""
Lesson Factory v2 — motor de generación (drafter + gate + retry + provenance)
=============================================================================

Pipeline scriptable para regeneración (masiva o puntual):
  plan (Opus/planner) → DRAFTER (DeepSeek, JSON, banda-aware) → valida LessonV2
  → GATE determinista → retry con feedback del gate (máx 2) → sella provenance.

El plan lo provee el planner (Opus). El drafter es DeepSeek (barato) por defecto.
El juicio pedagógico de Opus (crítico) es una capa separada (se aplica a las pruebas
manualmente / vía agente; para escala desatendida se cablea una key de juez).

Uso:
  python3 generate_v2.py --plan path/al/plan.json [--out test_lessons/]
  (el plan es un dict; ver PLAN_SCHEMA abajo)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "schema"))
sys.path.insert(0, str(BASE / "eval"))
from lesson_v2 import LessonV2, CANONICAL_TYPES  # noqa
import run_eval  # noqa

PEDAGOGY = json.loads((BASE / "pedagogy_rules.json").read_text(encoding="utf-8"))["adventures"]
CEILING = json.loads((BASE / "abstraction_ceiling.json").read_text(encoding="utf-8"))["bands"]
PROMPT_VERSION = "v2.0"

# Exemplar gold-standard (el piloto que pasó el gate)
GOLD = json.loads((BASE / "pilot_v2" / "1-1-1-1.json").read_text(encoding="utf-8"))
GOLD_MIN = {k: GOLD[k] for k in ("lesson_code", "content_es")}  # muestra de forma

DS_URL = "https://api.deepseek.com/chat/completions"


def _deepseek_key() -> str:
    for line in (BASE.parent / "audio_factory" / ".env").read_text().splitlines():
        if line.startswith("DEEPSEEK_API_KEY"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DEEPSEEK_API_KEY no encontrada")


def build_system_prompt(band: int) -> str:
    b = str(band)
    lr = PEDAGOGY[b]["language_rules"]
    ac = PEDAGOGY[b]["activity_constraints"]
    ceil = CEILING[b]
    allowed = ac["allowed_types"]
    return f"""Eres un diseñador pedagógico experto en educación financiera para la banda de edad {ceil['age_range']} ({ceil['piaget_stage']}).
Generas UNA lección como JSON válido (LessonV2). Devuelve SOLO el JSON, sin markdown.

REGLAS DE LENGUAJE (banda {band}): máx {lr.get('max_words_per_sentence','?')} palabras/oración; emojis={lr.get('use_emojis')}; PROHIBIDO usar: {lr.get('forbidden_words',[])}.
TECHO DE ABSTRACCIÓN (HARD): números ≤ {ceil.get('max_number')}; {'solo enteros; ' if ceil.get('whole_numbers_only') else ''}PROHIBIDAS estas abstracciones: {ceil.get('forbidden_abstractions',[])}.
TIPOS DE EJERCICIO PERMITIDOS: {allowed}. Ejercicios por lección: {ac.get('exercises_per_lesson',{})}.
FORMAS de correct_answer por tipo (usa EXACTAMENTE estas claves): multiple_choice→{{"correctOptionId":"a"}}; true_false→{{"isTrue":true}}; tap_action→{{"targetIds":["i2"]}}; sequencing→{{"sequence":["s1","s2","s3"]}}; estimation_slider→{{"value":10,"tolerance":0}} (Usa tolerance: 0 SI ES CÁLCULO ABSOLUTO EXACTO, > 0 solo si es estimación real); mystery_investment→{{"correctOptionId":"b1"}} (totalCoins DEBE ser entre 5 y 10 para evitar fatiga de clics, y cada caja DEBE tener minReturn y maxReturn como números válidos); matching_pairs→SIN correct_answer; intro_narrative→SIN correct_answer.

CALIDAD OBLIGATORIA (rúbrica v2):
- FORMA: cubre las 6 fases conectar→enseñar→practicar→reforzar→aplicar_variante→cerrar. El 1er ejercicio ENGANCHA (misterio/predicción/escena relatable), el último CONECTA con un concepto y anticipa la próxima lección.
- ENSEÑA antes de evaluar (no lances preguntas sin antes explicar el concepto).
- FEEDBACK que explica el PORQUÉ. Para multiple_choice añade feedback.per_option: {{"a":"...","b":"..."}} nombrando la confusión de cada distractor. NUNCA uses "Inténtalo de nuevo" genérico.
- ENGAGEMENT: ≥1 momento de autonomía o de relación con el personaje. Voz cálida, consistente, sin condescendencia.
- BILINGÜE: content_es y content_en con MISMO número de ejercicios y MISMOS tipos por índice.
- Cada ejercicio lleva tags v2: "phase", "engagement_role" (hook|learn|apply|connect), "concept_ids" (array), "bloom_level", "scaffold_level" (modeled|guided|independent; debe DECRECER a lo largo de la lección).

EJEMPLO DE FORMA (estructura de content_es de una lección que pasó el gate):
{json.dumps(GOLD_MIN, ensure_ascii=False)[:1800]}

El sobre debe incluir: lesson_code, title_es/en, description_es/en, duration, age_rate, points_reward, adventure_level, saga_level, topic_level, lesson_number, content_es[], content_en[]."""


def build_user_prompt(plan: dict, feedback: str | None) -> str:
    base = f"""Genera la lección {plan['lesson_code']} (banda {plan['band']}, personaje {plan.get('character','liruf')}).
Objetivo de aprendizaje: {plan['micro_objective']}
Conceptos (concept_ids): {plan.get('concept_ids', [])}
Escenario/gancho sugerido: {plan.get('scenario','')}
Plan de actividades (fase → tipo → propósito): {json.dumps(plan.get('activity_plan', []), ensure_ascii=False)}
Niveles: adventure_level={plan['levels'][0]}, saga_level={plan['levels'][1]}, topic_level={plan['levels'][2]}, lesson_number={plan['levels'][3]}."""
    if feedback:
        base += f"\n\nLA VERSIÓN ANTERIOR FALLÓ EL GATE. Corrige EXACTAMENTE esto y devuelve el JSON completo de nuevo:\n{feedback}"
    return base


def gate(lesson: dict, band: int) -> tuple[bool, list[str]]:
    issues = []
    try:
        LessonV2.model_validate(lesson)
    except Exception as e:
        issues.append(f"estructura LessonV2: {str(e).splitlines()[0]}")
    ok_abs, ai = run_eval.check_abstraction(lesson, str(band)); issues += ai if not ok_abs else []
    (ok_v, vi), _ = run_eval.check_vocabulary(lesson, str(band)); issues += vi if not ok_v else []
    ok_cq, ci = run_eval.check_content_quality(lesson); issues += ci if not ok_cq else []
    ok_fb, fi = run_eval.check_feedback(lesson); issues += fi if not ok_fb else []
    return (len(issues) == 0, issues)


def call_deepseek(system: str, user: str, key: str) -> dict:
    body = {"model": "deepseek-chat", "temperature": 0.4, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "max_tokens": 8000}
    req = urllib.request.Request(DS_URL, data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    return json.loads(json.loads(urllib.request.urlopen(req, timeout=180).read())["choices"][0]["message"]["content"])


def generate_lesson(plan: dict, key: str, max_retries: int = 2) -> dict:
    band = plan["band"]
    system = build_system_prompt(band)
    feedback = None
    attempts = []
    for attempt in range(max_retries + 1):
        lesson = call_deepseek(system, build_user_prompt(plan, feedback), key)
        # forzar metadata de coordenada (no confiar en el modelo)
        a, s, t, l = plan["levels"]
        lesson.update({"lesson_code": plan["lesson_code"], "adventure_level": a, "saga_level": s,
                       "topic_level": t, "lesson_number": l, "age_rate": CEILING[str(band)]["age_range"],
                       "points_reward": 10})  # canónico; no confiar en el modelo
        passed, issues = gate(lesson, band)
        attempts.append({"attempt": attempt + 1, "passed": passed, "issues": issues[:6]})
        if passed:
            lesson["lf_meta"] = {"schema_version": "2.0", "prompt_version": PROMPT_VERSION,
                                 "drafter": "deepseek-chat", "plan": plan, "gate": "passed",
                                 "attempts": attempt + 1, "concept_spine": plan.get("concept_ids", [])}
            return {"ok": True, "lesson": lesson, "attempts": attempts}
        feedback = "\n".join(f"- {x}" for x in issues[:8])
    return {"ok": False, "lesson": lesson, "attempts": attempts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", default="test_lessons")
    args = ap.parse_args()
    key = _deepseek_key()
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    plans = plan if isinstance(plan, list) else [plan]
    outdir = BASE / args.out
    outdir.mkdir(exist_ok=True)
    for p in plans:
        print(f"\n→ {p['lesson_code']} (banda {p['band']})")
        r = generate_lesson(p, key)
        for a in r["attempts"]:
            print(f"   intento {a['attempt']}: {'✅ PASS' if a['passed'] else '❌ ' + '; '.join(a['issues'][:3])}")
        if r["ok"]:
            (outdir / f"{p['lesson_code']}.json").write_text(json.dumps(r["lesson"], ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"   ✅ escrito en {args.out}/{p['lesson_code']}.json ({len(r['lesson']['content_es'])} ej, {r['attempts'][-1]['attempt']} intento/s)")
        else:
            print(f"   ❌ no pasó el gate tras {len(r['attempts'])} intentos")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
