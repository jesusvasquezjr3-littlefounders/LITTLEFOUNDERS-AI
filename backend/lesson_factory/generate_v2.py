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
import argparse, json, sys, time, urllib.request, urllib.error
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "schema"))
sys.path.insert(0, str(BASE / "eval"))
from lesson_v2 import LessonV2, CANONICAL_TYPES  # noqa
import run_eval  # noqa
import render_compat  # noqa
from pydantic import ValidationError  # noqa

PEDAGOGY = json.loads((BASE / "pedagogy_rules.json").read_text(encoding="utf-8"))["adventures"]
CEILING = json.loads((BASE / "abstraction_ceiling.json").read_text(encoding="utf-8"))["bands"]
CONTRACTS = json.loads((BASE / "schema" / "render_contracts.json").read_text(encoding="utf-8"))["contracts"]
PROMPT_VERSION = "v2.1"  # v2.1: split bilingüe ES→EN + inyección de contrato de render por tipo


def _contract_block(types: list[str]) -> str:
    """Bloque de prompt con la forma EXACTA (content + correct_answer) de cada tipo usado.
    El motor SOLO sabe leer estas formas; otras se ven en blanco o califican mal (silent-true)."""
    lines = []
    for t in dict.fromkeys(types):  # únicos, preservando orden
        c = CONTRACTS.get(t)
        if not c:
            continue
        entry = f"• {t}: {c['answer_shape']}\n  EJEMPLO VÁLIDO: {c['canonical_example']}"
        gotcha = (c.get("render_gotchas") or [None])[0]
        if gotcha:
            entry += f"\n  ⚠ EVITA: {gotcha}"
        if c.get("design_rule"):
            entry += f"\n  ✚ REGLA DE DISEÑO: {c['design_rule']}"
        lines.append(entry)
    if not lines:
        return ""
    return ("\n\nCONTRATO DE RENDER (forma EXACTA obligatoria — el Lesson Engine SOLO lee estas claves; "
            "inventar otras = ejercicio en blanco o 'siempre correcto'):\n" + "\n".join(lines))

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
FORMAS de correct_answer por tipo (usa EXACTAMENTE estas claves): multiple_choice→{{"correctOptionId":"a"}}; true_false→{{"isTrue":true}}; tap_action→{{"targetIds":["i2"]}}; sequencing→{{"sequence":["s1","s2","s3"]}}; matching_pairs→SIN correct_answer; intro_narrative→SIN correct_answer.

CALIDAD OBLIGATORIA (rúbrica v2):
- FORMA: cubre las 6 fases conectar→enseñar→practicar→reforzar→aplicar_variante→cerrar. El 1er ejercicio ENGANCHA (misterio/predicción/escena relatable), el último CONECTA con un concepto y anticipa la próxima lección.
- ENSEÑA antes de evaluar (no lances preguntas sin antes explicar el concepto).
- FEEDBACK que explica el PORQUÉ. OBLIGATORIO: TODO ejercicio gradable (con correct_answer) DEBE incluir feedback.success Y feedback.error, ambos no vacíos y específicos al concepto — esto aplica TAMBIÉN a math_challenge, interest_calculator, estimation_slider, matching_pairs, classification, etc. Para multiple_choice/true_false añade además feedback.per_option: {{"a":"...","b":"..."}} nombrando la confusión de cada distractor. NUNCA uses "Inténtalo de nuevo" genérico.
- GRADING INEQUÍVOCO (tipos de decisión: risk_reward, opportunity_cost, roleplay_chat, market_reaction, quiz_battle, portfolio_builder, decision_*): el escenario DEBE incluir una RESTRICCIÓN EXPLÍCITA que haga que UNA sola opción sea objetivamente la mejor (ej.: "necesitas el dinero seguro la próxima semana" → gana la de bajo riesgo). PROHIBIDO marcar una preferencia SUBJETIVA como la única correcta. Si de verdad hay varias opciones válidas, usa correct_answer.correctOptionIds (array). El feedback.per_option de las opciones NO-correctas debe explicar por qué NO son la respuesta — NUNCA afirmar "también es válida" (contradice la clave).
- RIGOR FACTUAL: NO inventes cifras regulatorias específicas (tablas de ISR/impuestos, tasas legales, montos del SAT/IMSS). Usa números ILUSTRATIVOS redondos enmarcados como ejemplo ("supón que el impuesto es 10 de cada 100") o aproximados bien conocidos. Verifica TODA la aritmética: que el correct_answer sea realmente correcto y que ningún feedback lo contradiga.
- FEEDBACK NUNCA CONDICIONAL: el feedback no debe condicionar la corrección a una preferencia ("es válida si no quieres perder", "si prefieres..."). Si te ves escribiendo feedback condicional, el ejercicio ES preference-forcing → reescríbelo con una restricción que haga UNA sola opción correcta. Toda afirmación numérica del feedback debe ser CONSISTENTE con las cantidades del escenario (recalcula: no afirmes "$425 cabe en $450" si ya gastaste $50 antes).
- SIMULADORES GANABLES (emergency_fund, credit_score, savings_race, mystery_investment): el escenario DEBE ser ganable — verifica numéricamente que las decisiones correctas alcanzan la meta (minBalance/minScore/target); las opciones que enseñan el concepto deben MOVER el balance hacia la meta, no costar 0.
- ENGAGEMENT: ≥1 momento de autonomía o de relación con el personaje. Voz cálida, consistente, sin condescendencia.
- IDIOMA: genera SOLO el contenido en ESPAÑOL (title_es, description_es, content_es[]). NO generes title_en/description_en/content_en — la versión en inglés se produce en un SEGUNDO paso de traducción (esto evita que el JSON se trunque en lecciones largas).
- Cada ejercicio lleva tags v2: "phase", "engagement_role" (hook|learn|apply|connect), "concept_ids" (array), "bloom_level", "scaffold_level" (modeled|guided|independent; debe DECRECER a lo largo de la lección).

EJEMPLO DE FORMA (estructura de content_es de una lección que pasó el gate):
{json.dumps(GOLD_MIN, ensure_ascii=False)[:1800]}

El sobre debe incluir: lesson_code, title_es, description_es, duration, age_rate, points_reward, adventure_level, saga_level, topic_level, lesson_number, content_es[]. (Los campos _en y content_en se generan en el paso de traducción, NO aquí.)"""


def build_user_prompt(plan: dict, feedback: str | None) -> str:
    base = f"""Genera la lección {plan['lesson_code']} (banda {plan['band']}, personaje {plan.get('character','liruf')}).
Objetivo de aprendizaje: {plan['micro_objective']}
Conceptos (concept_ids): {plan.get('concept_ids', [])}
Escenario/gancho sugerido: {plan.get('scenario','')}
Plan de actividades (fase → tipo → propósito): {json.dumps(plan.get('activity_plan', []), ensure_ascii=False)}
Niveles: adventure_level={plan['levels'][0]}, saga_level={plan['levels'][1]}, topic_level={plan['levels'][2]}, lesson_number={plan['levels'][3]}."""
    base += _contract_block([a.get("type") for a in plan.get("activity_plan", []) if a.get("type")])
    if feedback:
        base += f"\n\nLA VERSIÓN ANTERIOR FALLÓ EL GATE. Corrige EXACTAMENTE esto y devuelve el JSON completo de nuevo:\n{feedback}"
    return base


def gate(lesson: dict, band: int) -> tuple[bool, list[str]]:
    issues = []
    try:
        LessonV2.model_validate(lesson)
    except ValidationError as e:
        # Feedback accionable: ubicación + mensaje por error (no solo la 1ª línea genérica)
        for err in e.errors()[:6]:
            loc = ".".join(str(x) for x in err["loc"])
            issues.append(f"estructura {loc}: {err['msg']}")
    except Exception as e:
        issues.append(f"estructura LessonV2: {str(e).splitlines()[0]}")
    ok_abs, ai = run_eval.check_abstraction(lesson, str(band)); issues += ai if not ok_abs else []
    (ok_v, vi), _ = run_eval.check_vocabulary(lesson, str(band)); issues += vi if not ok_v else []
    ok_cq, ci = run_eval.check_content_quality(lesson); issues += ci if not ok_cq else []
    ok_fb, fi = run_eval.check_feedback(lesson); issues += fi if not ok_fb else []
    issues += render_compat.render_compat_issues(lesson)  # cierra "gate-pass ≠ jugable"
    return (len(issues) == 0, issues)


def call_deepseek(system: str, user: str, key: str, max_http_retries: int = 4) -> dict:
    """Llama a DeepSeek con reintentos + backoff exponencial. Tolera 503/timeout/JSON roto.
    Lanza RuntimeError solo tras agotar los reintentos (lo captura main() para no tumbar el lote)."""
    body = {"model": "deepseek-chat", "temperature": 0.4, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], "max_tokens": 8000}
    data = json.dumps(body).encode()
    last_err: Exception | None = None
    for i in range(max_http_retries):
        try:
            req = urllib.request.Request(DS_URL, data=data,
                                         headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            raw = urllib.request.urlopen(req, timeout=180).read()
            return json.loads(json.loads(raw)["choices"][0]["message"]["content"])
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            last_err = e
            if i < max_http_retries - 1:
                wait = 2 ** i  # 1s, 2s, 4s, 8s
                print(f"   ⚠ DeepSeek falló ({type(e).__name__}), reintento {i + 1}/{max_http_retries - 1} en {wait}s")
                time.sleep(wait)
    raise RuntimeError(f"DeepSeek no respondió tras {max_http_retries} intentos: {last_err}")


TRANSLATE_SYSTEM = (
    "Eres un traductor experto ES→EN para una plataforma educativa infantil/adolescente. "
    "Traduce de forma FIEL y NATURAL (adaptación, no literal). Devuelve SOLO JSON: "
    '{"title_en": "...", "description_en": "...", "content_en": [ ... ]}. '
    "content_en DEBE tener EXACTAMENTE el mismo número de ejercicios que content_es, en el MISMO "
    "orden, con el MISMO 'type' por índice y los MISMOS ids/claves/correct_answer. NO traduzcas "
    "ids, nombres de clave de objeto, ni valores de correct_answer (correctOptionId, targetIds, "
    "sequence, etc.). Traduce SOLO el texto visible para el niño: title, instruction, statement, "
    "prompt, question, options[].text/label, items[].text, categories[].name/label, "
    "feedback.success/error y feedback.per_option (mismas claves), y textos de scenarios/messages."
)


def translate_to_en(es_lesson: dict, key: str) -> dict:
    """Segundo paso: traduce ES→EN. Devuelve {title_en, description_en, content_en}.
    La paridad estructural (type + correct_answer) se FUERZA en Python tras volver."""
    payload = {"title_es": es_lesson.get("title_es"),
               "description_es": es_lesson.get("description_es"),
               "content_es": es_lesson.get("content_es", [])}
    user = ("Traduce al inglés esta lección. Devuelve title_en, description_en y content_en "
            "(content_es traducido, misma estructura):\n" + json.dumps(payload, ensure_ascii=False))
    return call_deepseek(TRANSLATE_SYSTEM, user, key)


def _lift_answer(ex: dict) -> None:
    """Sube un correct_answer mal-ubicado DENTRO de content al nivel del ejercicio (donde el
    grader lo lee). DeepSeek a veces anida content.correct_answer / content.correct_mapping;
    la data es correcta, solo está en el lugar equivocado. Solo actúa si el top-level está vacío."""
    if not isinstance(ex, dict):
        return
    if ex.get("correct_answer") not in (None, {}, []):
        return
    content = ex.get("content")
    if not isinstance(content, dict):
        return
    for key in ("correct_answer", "correctAnswer", "correct_mapping", "correctMapping", "answer_key"):
        v = content.get(key)
        if v not in (None, {}, [], ""):
            ex["correct_answer"] = v
            return


def _merge_bilingual(es_lesson: dict, en: dict, plan: dict) -> dict:
    """Ensambla el sobre ES + la traducción EN en una LessonV2 bilingüe completa.
    Fuerza type + correct_answer del EN = ES por índice (paridad y grading idénticos)."""
    lesson = es_lesson
    lesson["title_en"] = en.get("title_en") or lesson.get("title_es")
    lesson["description_en"] = en.get("description_en") or lesson.get("description_es")
    es_content = lesson.get("content_es", []) or []
    for ex in es_content:  # normaliza ubicación de correct_answer ANTES de copiar a EN
        _lift_answer(ex)
    en_content = en.get("content_en", []) or []
    for i, en_ex in enumerate(en_content):
        if i < len(es_content) and isinstance(en_ex, dict):
            es_ex = es_content[i]
            en_ex["type"] = es_ex.get("type")          # paridad de tipo garantizada
            if "correct_answer" in es_ex:              # grading idéntico (sin drift de traducción)
                en_ex["correct_answer"] = es_ex["correct_answer"]
            # vocabulario controlado: NUNCA se traduce (el traductor a veces convirtió
            # phase 'conectar'→'connect', 'por_que_importa'→'why_it_matters' → inválido).
            for k in ("phase", "engagement_role", "scaffold_level", "bloom_level"):
                if k in es_ex:
                    en_ex[k] = es_ex[k]
    lesson["content_en"] = en_content
    a, s, t, l = plan["levels"]
    lesson.update({"lesson_code": plan["lesson_code"], "adventure_level": a, "saga_level": s,
                   "topic_level": t, "lesson_number": l, "age_rate": CEILING[str(plan["band"])]["age_range"],
                   "points_reward": 10})  # canónico; no confiar en el modelo
    return lesson


def generate_lesson(plan: dict, key: str, max_retries: int = 2) -> dict:
    """Dos pasos: (1) DeepSeek redacta ES; (2) DeepSeek traduce a EN. Cada llamada es ~½
    del bilingüe combinado → cabe en la ventana de salida (evita truncamiento en bandas altas)."""
    band = plan["band"]
    system = build_system_prompt(band)
    feedback = None
    attempts = []
    lesson = {}
    for attempt in range(max_retries + 1):
        es_lesson = call_deepseek(system, build_user_prompt(plan, feedback), key)  # paso 1: ES
        en = translate_to_en(es_lesson, key)                                       # paso 2: EN
        lesson = _merge_bilingual(es_lesson, en, plan)
        passed, issues = gate(lesson, band)
        attempts.append({"attempt": attempt + 1, "passed": passed, "issues": issues[:6]})
        if passed:
            lesson["lf_meta"] = {"schema_version": "2.0", "prompt_version": PROMPT_VERSION,
                                 "drafter": "deepseek-chat", "translator": "deepseek-chat",
                                 "plan": plan, "gate": "passed", "attempts": attempt + 1,
                                 "concept_spine": plan.get("concept_ids", [])}
            return {"ok": True, "lesson": lesson, "attempts": attempts}
        feedback = "\n".join(f"- {x}" for x in issues[:8])
    return {"ok": False, "lesson": lesson, "attempts": attempts}


def revise_lesson(lesson: dict, defects: list[str], key: str, max_retries: int = 2) -> dict:
    """EDITOR del loop crítico: aplica los defectos específicos del crítico Opus.
    Re-redacta ES con los defectos (+ contrato + issues del gate) como feedback, re-traduce
    EN, re-gate. El crítico (Opus) lo provee el agente; el editor (DeepSeek) lo aplica aquí."""
    band = int(lesson.get("adventure_level") or lesson["lesson_code"].split("-")[0])
    meta = lesson.get("lf_meta") or {}
    plan = meta.get("plan") or {
        "lesson_code": lesson["lesson_code"], "band": band,
        "levels": [lesson["adventure_level"], lesson["saga_level"], lesson["topic_level"], lesson["lesson_number"]],
        "character": (lesson.get("content_es") or [{}])[0].get("character_code", "liruf"),
        "concept_ids": meta.get("concept_spine", []),
    }
    system = build_system_prompt(band)
    types = [ex.get("type") for ex in lesson.get("content_es", []) if ex.get("type")]
    current = {k: lesson[k] for k in ("title_es", "description_es", "content_es") if k in lesson}
    extra = ""
    attempts = []
    merged = lesson
    for attempt in range(max_retries + 1):
        fb = "DEFECTOS DEL CRÍTICO (corrige EXACTAMENTE, mantén ids/estructura):\n" + \
             "\n".join(f"- {d}" for d in defects) + extra + _contract_block(types)
        user = (f"Revisa la lección {plan['lesson_code']} (banda {band}). Devuelve el JSON completo "
                f"(title_es, description_es, content_es[]) con la MISMA estructura/ids, corrigiendo:\n{fb}"
                f"\n\nLECCIÓN ACTUAL:\n{json.dumps(current, ensure_ascii=False)}")
        es_lesson = call_deepseek(system, user, key)
        en = translate_to_en(es_lesson, key)
        merged = _merge_bilingual(es_lesson, en, plan)
        # la revisión no re-emite el sobre completo → preserva campos del original
        for k in ("duration",):
            merged.setdefault(k, lesson.get(k, 5))
        passed, issues = gate(merged, band)
        attempts.append({"attempt": attempt + 1, "passed": passed, "issues": issues[:6]})
        if passed:
            merged["lf_meta"] = {**meta, "schema_version": "2.0", "prompt_version": PROMPT_VERSION,
                                 "drafter": "deepseek-chat", "gate": "passed", "revised": True,
                                 "critic_defects": defects, "revise_attempts": attempt + 1}
            return {"ok": True, "lesson": merged, "attempts": attempts}
        current = es_lesson
        extra = "\nADEMÁS, el gate determinista marcó:\n" + "\n".join(f"- {x}" for x in issues[:6])
    return {"ok": False, "lesson": merged, "attempts": attempts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", help="ruta a plan(es) JSON para generar")
    ap.add_argument("--revise", help="ruta a una lección JSON a revisar (loop crítico)")
    ap.add_argument("--defects", help="ruta a JSON con lista de defectos del crítico Opus (para --revise)")
    ap.add_argument("--out", default="test_lessons")
    args = ap.parse_args()
    key = _deepseek_key()
    outdir = BASE / args.out
    outdir.mkdir(exist_ok=True)

    if args.revise:  # modo EDITOR del loop crítico
        lesson = json.loads(Path(args.revise).read_text(encoding="utf-8"))
        defects = json.loads(Path(args.defects).read_text(encoding="utf-8")) if args.defects else []
        code = lesson["lesson_code"]
        print(f"\n↻ revisando {code} con {len(defects)} defecto(s) del crítico")
        r = revise_lesson(lesson, defects, key)
        for a in r["attempts"]:
            print(f"   intento {a['attempt']}: {'✅ PASS' if a['passed'] else '❌ ' + '; '.join(a['issues'][:3])}")
        if r["ok"]:
            (outdir / f"{code}.json").write_text(json.dumps(r["lesson"], ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"   ✅ revisado → {args.out}/{code}.json")
        else:
            print(f"   ❌ no pasó tras {len(r['attempts'])} revisiones")
        return

    if not args.plan:
        ap.error("se requiere --plan o --revise")
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    plans = plan if isinstance(plan, list) else [plan]
    for p in plans:
        code = p["lesson_code"]
        outpath = outdir / f"{code}.json"
        if outpath.exists():  # idempotencia: re-correr el lote omite lo ya generado
            print(f"\n→ {code} (banda {p['band']}) — ya existe, se omite")
            continue
        print(f"\n→ {code} (banda {p['band']})")
        try:
            r = generate_lesson(p, key)
        except Exception as e:  # un fallo duro de una lección NO debe tumbar el lote
            print(f"   ❌ error de generación (se continúa con el resto): {e}")
            continue
        for a in r["attempts"]:
            print(f"   intento {a['attempt']}: {'✅ PASS' if a['passed'] else '❌ ' + '; '.join(a['issues'][:3])}")
        if r["ok"]:
            outpath.write_text(json.dumps(r["lesson"], ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"   ✅ escrito en {args.out}/{code}.json ({len(r['lesson']['content_es'])} ej, {r['attempts'][-1]['attempt']} intento/s)")
        else:
            print(f"   ❌ no pasó el gate tras {len(r['attempts'])} intentos")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
