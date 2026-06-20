#!/usr/bin/env python3
"""
LittleFounders Lesson Factory - Validator
==========================================
Valida la calidad pedagógica y estructura técnica de las lecciones generadas.

Uso:
    python validate.py --lesson adventure_1/saga_1/topic_2/lesson_1.json
    python validate.py --adventure 1                    # Toda la aventura
    python validate.py --adventure 1 --saga 1           # Una saga
    python validate.py --all                            # Todo
    python validate.py --adventure 1 --fix              # Intentar corregir automáticamente
    python validate.py --stats                          # Solo estadísticas
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).parent
RULES_FILE = BASE_DIR / "pedagogy_rules.json"
OUTPUT_DIR = BASE_DIR.parent.parent / "backend" / "lesson_engine" / "littlefounders_lessons"

# ─── Tipos ────────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    lesson_code: str
    passed: bool = True
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.passed = False

    def add_warning(self, msg: str):
        self.warnings.append(msg)

# ─── Carga ────────────────────────────────────────────────────────────────────

def load_rules() -> dict:
    with open(RULES_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_lesson(path: Path) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return None

# ─── Reglas de Validación ────────────────────────────────────────────────────

REQUIRED_TOP_FIELDS = [
    "lesson_code", "title_es", "title_en", "description_es", "description_en",
    "duration", "age_rate", "points_reward", "adventure_level", "saga_level",
    "topic_level", "lesson_number", "content_es", "content_en"
]

REQUIRED_EXERCISE_FIELDS_BY_TYPE = {
    # Tipos simples con esquema estricto (Lesson Engine los requiere exactamente)
    "intro_narrative": {"content": ["transcript"]},
    "multiple_choice": {"content": ["question", "options"], "top": ["correct_answer", "feedback"]},
    "true_false": {"content": ["statement"], "top": ["correct_answer", "feedback"]},
    "tap_action": {"content": ["statement", "items"], "top": ["correct_answer", "feedback"]},
    "matching_pairs": {"content": ["pairs"], "top": ["feedback"]},
    "sequencing": {"content": ["items"], "top": ["correct_answer", "feedback"]},
    "coin_counter": {"content": ["targetAmount", "coins_available"]},
    "word_scramble": {"content": ["word"]},
    # Tipos complejos con esquema flexible — el modelo usa variantes válidas de campos
    # Solo verificamos que content no esté vacío (el Lesson Engine los renderiza con flexibilidad)
    "classification": {"content_nonempty": True},
    "fill_blank": {"content_nonempty": True},
    "math_challenge": {"content_nonempty": True},
    "estimation_slider": {"content_nonempty": True},
    "story_mode": {"content_nonempty": True},
    "roleplay_chat": {"content_nonempty": True},
    "risk_reward": {"content_nonempty": True},
    "shop_sim": {"content_nonempty": True},
    "budget_builder": {"content_nonempty": True},
    "concept_builder": {"content_nonempty": True},
    "price_detective": {"content_nonempty": True},
    "spot_trap": {"content_nonempty": True},
    "market_reaction": {"content_nonempty": True},
    "bill_splitter": {"content_nonempty": True},
    "opportunity_cost": {"content_nonempty": True},
    "credit_score": {"content_nonempty": True},
    "debt_strategy": {"content_nonempty": True},
    "portfolio_builder": {"content_nonempty": True},
    "tax_puzzle": {"content_nonempty": True},
    "inflation_simulator": {"content_nonempty": True},
    "interest_calculator": {"content_nonempty": True},
    "salary_comparison": {"content_nonempty": True},
    "subscription_tracker": {"content_nonempty": True},
    "emergency_fund": {"content_nonempty": True},
    "passive_income": {"content_nonempty": True},
    "mystery_investment": {"content_nonempty": True},
    "savings_race": {"content_nonempty": True},
    "impact_meter": {"content_nonempty": True},
    "goal_roadmap": {"content_nonempty": True},
    "expense_timeline": {"content_nonempty": True},
    "mindset_comparison": {"content_nonempty": True},
    "quiz_battle": {"content_nonempty": True},
}

ADVENTURE_AGE_RANGES = {
    1: "5-7", 2: "8-9", 3: "10-12", 4: "13-14", 5: "15-17", 6: "18+"
}

FORBIDDEN_WORDS_BY_ADVENTURE = {
    1: ["porcentaje", "interés", "crédito", "inflación", "inversión", "deuda", "dividendo", "activo", "pasivo"],
    2: ["crédito", "inflación", "derivados", "portafolio", "hipoteca", "dividendo"],
}

# Mapeo tipo de ejercicio → objetivo pedagógico predominante (RULES.md §3)
EXERCISE_TYPE_TO_OBJECTIVE = {
    "intro_narrative": None,
    "tap_action": "recognize",
    "multiple_choice": "recognize",
    "true_false": "recognize",
    "matching_pairs": "recognize",
    "classification": "recognize",
    "sequencing": "apply",
    "math_challenge": "calculate",
    "coin_counter": "calculate",
    "interest_calculator": "calculate",
    "fill_blank": "calculate",
    "estimation_slider": "calculate",
    "price_detective": "compare",
    "opportunity_cost": "compare",
    "mindset_comparison": "compare",
    "salary_comparison": "compare",
    "risk_reward": "decide",
    "roleplay_chat": "decide",
    "spot_trap": "decide",
    "credit_score": "decide",
    "debt_strategy": "decide",
    "portfolio_builder": "decide",
    "tax_puzzle": "decide",
    "shop_sim": "apply",
    "budget_builder": "apply",
    "story_mode": "apply",
    "concept_builder": "apply",
    "goal_roadmap": "apply",
    "expense_timeline": "apply",
    "word_scramble": "recognize",
    "quiz_battle": "recognize",
    "bill_splitter": "calculate",
    "market_reaction": "decide",
    "savings_race": "apply",
    "impact_meter": "compare",
    "inflation_simulator": "calculate",
    "subscription_tracker": "compare",
    "emergency_fund": "calculate",
    "passive_income": "calculate",
    "mystery_investment": "decide",
}


def validate_lesson_code_format(lesson: dict, result: ValidationResult):
    """Verifica que lesson_code sea válido y coincida con los campos numéricos."""
    code = lesson.get("lesson_code", "")
    parts = code.split("-")
    if len(parts) != 4:
        result.add_error(f"lesson_code '{code}' debe tener formato A-S-T-L")
        return

    try:
        a, s, t, l = [int(x) for x in parts]
    except ValueError:
        result.add_error(f"lesson_code '{code}' contiene partes no numéricas")
        return

    if lesson.get("adventure_level") != a:
        result.add_error(f"adventure_level {lesson.get('adventure_level')} no coincide con lesson_code '{code}'")
    if lesson.get("saga_level") != s:
        result.add_error(f"saga_level {lesson.get('saga_level')} no coincide con lesson_code '{code}'")
    if lesson.get("topic_level") != t:
        result.add_error(f"topic_level {lesson.get('topic_level')} no coincide con lesson_code '{code}'")
    if lesson.get("lesson_number") != l:
        result.add_error(f"lesson_number {lesson.get('lesson_number')} no coincide con lesson_code '{code}'")


def validate_required_fields(lesson: dict, result: ValidationResult):
    """Verifica que todos los campos requeridos estén presentes."""
    for field in REQUIRED_TOP_FIELDS:
        if field not in lesson:
            result.add_error(f"Campo requerido faltante: '{field}'")
        elif lesson[field] is None:
            result.add_error(f"Campo '{field}' es null")


def validate_bilingual(lesson: dict, result: ValidationResult):
    """Verifica que content_es y content_en tengan el mismo número de ejercicios y tipos."""
    es = lesson.get("content_es", [])
    en = lesson.get("content_en", [])

    if not isinstance(es, list) or len(es) == 0:
        result.add_error("content_es está vacío o no es un array")
        return

    if not isinstance(en, list) or len(en) == 0:
        result.add_error("content_en está vacío o no es un array")
        return

    if len(es) != len(en):
        result.add_error(f"content_es tiene {len(es)} ejercicios pero content_en tiene {len(en)}")
        return

    for i, (ex_es, ex_en) in enumerate(zip(es, en)):
        if ex_es.get("type") != ex_en.get("type"):
            result.add_error(f"Ejercicio {i+1}: tipo ES='{ex_es.get('type')}' ≠ EN='{ex_en.get('type')}'")


def validate_exercise_structure(exercise: dict, index: int, result: ValidationResult, lang: str = "es"):
    """Valida la estructura de un ejercicio individual."""
    ex_type = exercise.get("type", "")
    prefix = f"Ejercicio {index+1} ({ex_type}, {lang})"

    if not ex_type:
        result.add_error(f"{prefix}: falta 'type'")
        return

    if "character_code" not in exercise:
        result.add_warning(f"{prefix}: falta 'character_code' recomendado")

    if "content" not in exercise or not isinstance(exercise["content"], dict):
        result.add_error(f"{prefix}: falta 'content' object")
        return

    # Verificar campos requeridos por tipo
    rules = REQUIRED_EXERCISE_FIELDS_BY_TYPE.get(ex_type)
    if rules:
        # Tipos complejos: solo verificar que content no esté vacío
        if rules.get("content_nonempty"):
            if not exercise["content"]:
                result.add_error(f"{prefix}: 'content' está vacío")
        else:
            for content_field in rules.get("content", []):
                if content_field not in exercise["content"]:
                    result.add_error(f"{prefix}: falta content.'{content_field}'")

            for top_field in rules.get("top", []):
                if top_field not in exercise:
                    if top_field == "feedback":
                        result.add_warning(f"{prefix}: falta 'feedback' (recomendado)")
                    else:
                        result.add_error(f"{prefix}: falta '{top_field}'")

    # Validar feedback structure si existe
    if "feedback" in exercise:
        fb = exercise["feedback"]
        if not isinstance(fb, dict):
            result.add_error(f"{prefix}: 'feedback' debe ser un objeto")
        else:
            if "success" not in fb:
                result.add_error(f"{prefix}: falta feedback.success")
            if "error" not in fb:
                result.add_error(f"{prefix}: falta feedback.error")

    # Validar contenido de intro_narrative
    if ex_type == "intro_narrative":
        transcript = exercise.get("content", {}).get("transcript", "")
        if not transcript or len(transcript) < 10:
            result.add_error(f"{prefix}: transcript muy corto o vacío")
        elif len(transcript) > 500 and lang == "es":
            result.add_warning(f"{prefix}: transcript muy largo ({len(transcript)} chars), considera acortarlo")

    # Validar multiple_choice
    if ex_type == "multiple_choice":
        options = exercise.get("content", {}).get("options", [])
        if len(options) < 2:
            result.add_error(f"{prefix}: multiple_choice necesita al menos 2 opciones")
        correct = exercise.get("correct_answer", {}).get("correctOptionId")
        if correct:
            option_ids = [o.get("id") for o in options]
            if correct not in option_ids:
                result.add_error(f"{prefix}: correctOptionId '{correct}' no existe en options {option_ids}")

    # Validar true_false
    if ex_type == "true_false":
        is_true = exercise.get("correct_answer", {}).get("isTrue")
        if is_true is None:
            result.add_error(f"{prefix}: correct_answer.isTrue debe ser true o false")

    # Validar tap_action
    if ex_type == "tap_action":
        items = exercise.get("content", {}).get("items", [])
        target_ids_correct = exercise.get("correct_answer", {}).get("targetIds", [])
        item_ids = [i.get("id") for i in items]
        for tid in target_ids_correct:
            if tid not in item_ids:
                result.add_error(f"{prefix}: targetId '{tid}' no existe en items")
        # Verificar que hay al menos 1 target y 1 no-target
        targets = [i for i in items if i.get("isTarget")]
        non_targets = [i for i in items if not i.get("isTarget")]
        if not targets:
            result.add_error(f"{prefix}: no hay ningún item con isTarget=true")
        if not non_targets:
            result.add_warning(f"{prefix}: todos los items son target (sin distractores)")


def validate_pedagogy(lesson: dict, result: ValidationResult, rules: dict):
    """Valida reglas pedagógicas según la aventura."""
    adventure_num = lesson.get("adventure_level")
    if not adventure_num:
        return

    adv_rules = rules.get("adventures", {}).get(str(adventure_num), {})
    if not adv_rules:
        result.add_warning(f"No hay reglas pedagógicas para aventura {adventure_num}")
        return

    lang_rules = adv_rules.get("language_rules", {})
    activity_constraints = adv_rules.get("activity_constraints", {})
    max_sentence_len = lang_rules.get("max_words_per_sentence", 15)
    allowed_types = activity_constraints.get("allowed_types", [])
    max_options = activity_constraints.get("max_options_per_question", 4)
    exercises_range = activity_constraints.get("exercises_per_lesson", {"min": 8, "max": 12})
    min_objectives = activity_constraints.get("required_objectives_min", 3)
    forbidden_words = FORBIDDEN_WORDS_BY_ADVENTURE.get(adventure_num, [])

    content_es = lesson.get("content_es", [])

    # Validar cantidad de ejercicios
    n_exercises = len(content_es)
    if n_exercises < exercises_range.get("min", 4):
        result.add_warning(f"Lección tiene {n_exercises} ejercicios (mínimo {exercises_range['min']})")
    if n_exercises > exercises_range.get("max", 6):
        result.add_warning(f"Lección tiene {n_exercises} ejercicios (máximo {exercises_range['max']})")

    # Validar estructura: debe empezar y terminar con intro_narrative
    if content_es and content_es[0].get("type") != "intro_narrative":
        result.add_warning("Lección no empieza con intro_narrative (recomendado)")
    if content_es and content_es[-1].get("type") != "intro_narrative":
        result.add_warning("Lección no termina con intro_narrative (recomendado)")

    # Validar tipos de actividad permitidos
    if allowed_types and isinstance(allowed_types, list):
        for i, ex in enumerate(content_es):
            ex_type = ex.get("type", "")
            if ex_type and ex_type not in allowed_types and ex_type != "intro_narrative":
                result.add_error(f"Ejercicio {i+1}: tipo '{ex_type}' NO está permitido en aventura {adventure_num}")

    # Validar longitud de oraciones en intro_narratives y preguntas
    for i, ex in enumerate(content_es):
        if ex.get("type") == "intro_narrative":
            transcript = ex.get("content", {}).get("transcript", "")
            sentences = [s.strip() for s in transcript.replace("!", ".").replace("?", ".").split(".") if s.strip()]
            for j, sentence in enumerate(sentences):
                words = sentence.split()
                if len(words) > max_sentence_len:
                    result.add_warning(
                        f"Ejercicio {i+1}, oración {j+1}: {len(words)} palabras (máximo {max_sentence_len}): '{sentence[:60]}...'"
                    )

    # Validar palabras prohibidas
    if forbidden_words:
        all_text = json.dumps(content_es, ensure_ascii=False).lower()
        for word in forbidden_words:
            if word.lower() in all_text:
                result.add_warning(f"Palabra prohibida encontrada: '{word}' (aventura {adventure_num})")

    # Validar max opciones en multiple_choice
    for i, ex in enumerate(content_es):
        if ex.get("type") == "multiple_choice":
            options = ex.get("content", {}).get("options", [])
            if len(options) > max_options:
                result.add_error(
                    f"Ejercicio {i+1}: multiple_choice tiene {len(options)} opciones (máximo {max_options} para aventura {adventure_num})"
                )

    # Validar que adventure 1 tenga emojis en opciones
    if adventure_num == 1 and lang_rules.get("use_emojis"):
        for i, ex in enumerate(content_es):
            if ex.get("type") == "multiple_choice":
                options = ex.get("content", {}).get("options", [])
                for opt in options:
                    text = opt.get("text", "")
                    has_emoji = any(ord(c) > 127 for c in text)
                    if not has_emoji:
                        result.add_warning(
                            f"Ejercicio {i+1}: opción '{text}' sin emoji (requerido para aventura 1)"
                        )

    # Validar feedback de error no usa palabras muy negativas duras (solo palabras que desaniman fuertemente)
    hard_negative_words = ["equivocado", "fallaste", "eres malo", "no sirves"]
    for i, ex in enumerate(content_es):
        error_fb = ex.get("feedback", {}).get("error", "")
        for neg in hard_negative_words:
            if neg.lower() in error_fb.lower():
                result.add_warning(f"Ejercicio {i+1}: feedback.error contiene '{neg}' (tono muy negativo)")

    # Validar que el feedback de success mencione el concepto
    for i, ex in enumerate(content_es):
        success_fb = ex.get("feedback", {}).get("success", "")
        if success_fb and len(success_fb) < 15:
            result.add_warning(f"Ejercicio {i+1}: feedback.success muy corto ('{success_fb}'), debería explicar el concepto")

    # ─── VALIDACIONES v2.0 (RULES.md) ────────────────────────────────────────
    # Diversidad de objetivos pedagógicos
    objectives_present = set()
    for ex in content_es:
        obj = EXERCISE_TYPE_TO_OBJECTIVE.get(ex.get("type", ""))
        if obj:
            objectives_present.add(obj)
    if len(objectives_present) < min_objectives:
        result.add_warning(
            f"Solo {len(objectives_present)} objetivos distintos ({', '.join(sorted(objectives_present))}); se esperan mínimo {min_objectives} para aventura {adventure_num}"
        )

    # Feedback de error instructivo: debe tener cierta longitud para explicar el "por qué"
    min_error_fb_len = 20 if adventure_num == 1 else 30
    for i, ex in enumerate(content_es):
        error_fb = ex.get("feedback", {}).get("error", "")
        if error_fb and len(error_fb) < min_error_fb_len:
            result.add_warning(
                f"Ejercicio {i+1}: feedback.error corto ({len(error_fb)} chars) — debe explicar conceptualmente el error"
            )

    # Exigir al menos un ejercicio de objetivo 'decide' a partir de A3
    if adventure_num >= 3 and "decide" not in objectives_present:
        result.add_warning(f"Aventura {adventure_num}: falta al menos un ejercicio de DECIDIR (roleplay_chat, risk_reward, spot_trap, etc.)")

    # Exigir cobertura de ¿qué error evitar? (al menos un true_false o spot_trap)
    has_error_prevention = any(ex.get("type") in ("true_false", "spot_trap") for ex in content_es)
    if not has_error_prevention and len(content_es) >= 8:
        result.add_warning("Falta cobertura de '¿qué error evitar?' (añadir true_false sobre malentendido común o spot_trap)")


def validate_lesson(lesson: dict, rules: dict) -> ValidationResult:
    """Valida una lección completa. Retorna un ValidationResult."""
    code = lesson.get("lesson_code", "UNKNOWN")
    result = ValidationResult(lesson_code=code)

    # 1. Campos requeridos
    validate_required_fields(lesson, result)

    # 2. Formato del lesson_code
    validate_lesson_code_format(lesson, result)

    # 3. Verificar bilingüe
    validate_bilingual(lesson, result)

    # 4. Estructura de ejercicios
    for lang, content_key in [("es", "content_es"), ("en", "content_en")]:
        exercises = lesson.get(content_key, [])
        if isinstance(exercises, list):
            for i, ex in enumerate(exercises):
                validate_exercise_structure(ex, i, result, lang)

    # 5. Reglas pedagógicas
    validate_pedagogy(lesson, result, rules)

    return result


# ─── Reporte ─────────────────────────────────────────────────────────────────

def print_result(result: ValidationResult, verbose: bool = True):
    status = "✅" if result.passed else "❌"
    error_count = len(result.errors)
    warn_count = len(result.warnings)

    if result.passed and warn_count == 0:
        if verbose:
            print(f"  {status} {result.lesson_code} — PASS")
    elif result.passed:
        print(f"  ⚠️  {result.lesson_code} — PASS con {warn_count} advertencia(s)")
        if verbose:
            for w in result.warnings:
                print(f"       ⚠️  {w}")
    else:
        print(f"  {status} {result.lesson_code} — FAIL ({error_count} error(s), {warn_count} advertencia(s))")
        for e in result.errors:
            print(f"       ❌ {e}")
        if verbose:
            for w in result.warnings:
                print(f"       ⚠️  {w}")


def validate_all_in_directory(path: Path, rules: dict, verbose: bool = True) -> tuple[int, int, int]:
    """Valida todas las lecciones en un directorio. Retorna (pass, fail, warn_only)."""
    json_files = list(path.rglob("lesson_*.json"))

    if not json_files:
        print(f"No se encontraron lecciones en {path}")
        return 0, 0, 0

    print(f"\n📂 Validando {len(json_files)} lecciones en {path.relative_to(OUTPUT_DIR.parent)}...")

    passed = 0
    failed = 0
    warn_only = 0

    for json_path in sorted(json_files):
        lesson = load_lesson(json_path)
        if lesson is None:
            print(f"  ❌ {json_path.name} — No se pudo parsear el JSON")
            failed += 1
            continue

        result = validate_lesson(lesson, rules)
        print_result(result, verbose)

        if result.passed and not result.warnings:
            passed += 1
        elif result.passed:
            warn_only += 1
        else:
            failed += 1

    return passed, failed, warn_only


# ─── CLI Principal ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="LittleFounders Lesson Validator")
    parser.add_argument("--lesson", type=str, help="Ruta relativa a una lección específica")
    parser.add_argument("--adventure", type=int, help="Validar toda una aventura")
    parser.add_argument("--saga", type=int, help="Filtrar por saga")
    parser.add_argument("--topic", type=int, help="Filtrar por topic")
    parser.add_argument("--all", action="store_true", help="Validar todo el contenido generado")
    parser.add_argument("--stats", action="store_true", help="Solo mostrar estadísticas")
    parser.add_argument("--quiet", action="store_true", help="Solo mostrar fallos")
    args = parser.parse_args()

    if not OUTPUT_DIR.exists():
        print(f"❌ Directorio de lecciones no encontrado: {OUTPUT_DIR}")
        print("   Primero genera algunas lecciones con: python generate.py --adventure 1 --saga 1")
        sys.exit(1)

    rules = load_rules()
    verbose = not args.quiet and not args.stats

    print("=" * 60)
    print("🔍 LittleFounders Lesson Validator")
    print("=" * 60)

    total_pass = 0
    total_fail = 0
    total_warn = 0

    if args.lesson:
        # Validar lección específica
        lesson_path = OUTPUT_DIR / args.lesson
        if not lesson_path.exists():
            print(f"❌ Archivo no encontrado: {lesson_path}")
            sys.exit(1)
        lesson = load_lesson(lesson_path)
        if lesson is None:
            print("❌ JSON inválido")
            sys.exit(1)
        result = validate_lesson(lesson, rules)
        print_result(result, verbose=True)
        sys.exit(0 if result.passed else 1)

    elif args.adventure:
        # Validar aventura (con filtros opcionales)
        search_dir = OUTPUT_DIR / f"adventure_{args.adventure}"
        if args.saga:
            search_dir = search_dir / f"saga_{args.saga}"
        if args.topic:
            search_dir = search_dir / f"topic_{args.topic}"

        if not search_dir.exists():
            print(f"❌ Directorio no encontrado: {search_dir}")
            sys.exit(1)

        p, f, w = validate_all_in_directory(search_dir, rules, verbose)
        total_pass, total_fail, total_warn = p, f, w

    elif args.all:
        # Validar todo
        p, f, w = validate_all_in_directory(OUTPUT_DIR, rules, verbose)
        total_pass, total_fail, total_warn = p, f, w

    else:
        parser.print_help()
        sys.exit(0)

    # Resumen
    total = total_pass + total_fail + total_warn
    print(f"\n{'='*60}")
    print("📊 Resumen de Validación")
    print(f"{'='*60}")
    print(f"  Total validadas:  {total}")
    print(f"  ✅ Pasaron:       {total_pass}")
    print(f"  ⚠️  Con warnings: {total_warn}")
    print(f"  ❌ Fallaron:      {total_fail}")
    if total > 0:
        quality_pct = (total_pass / total) * 100
        print(f"  📈 Calidad:       {quality_pct:.1f}%")
    print("=" * 60)

    sys.exit(0 if total_fail == 0 else 1)


if __name__ == "__main__":
    main()
