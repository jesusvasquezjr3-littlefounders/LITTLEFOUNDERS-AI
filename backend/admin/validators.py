"""
backend/admin/validators.py
Validadores JSON por tipo de ejercicio.
Aseguran que la estructura de cada ejercicio sea compatible con el LessonRunner.
"""
from typing import List, Optional


# Los 40 tipos válidos de ejercicio
VALID_EXERCISE_TYPES = [
    # Grupo 1 — Fundación (11 tipos)
    "intro_narrative", "multiple_choice", "true_false", "fill_blank",
    "classification", "matching_pairs", "sequencing", "tap_action",
    "story_mode", "math_challenge", "word_scramble",
    # Grupo 2 — Interactivos (5 tipos)
    "roleplay_chat", "estimation_slider", "risk_reward",
    "concept_builder", "quiz_battle",
    # Grupo 3 — Economía & Presupuesto (7 tipos)
    "shop_sim", "coin_counter", "price_detective", "bill_splitter",
    "budget_builder", "expense_timeline", "subscription_tracker",
    # Grupo 4 — Ahorro & Inversión (9 tipos)
    "savings_race", "emergency_fund", "goal_roadmap",
    "interest_calculator", "portfolio_builder", "mystery_investment",
    "passive_income", "opportunity_cost", "market_reaction",
    # Grupo 5 — Avanzados (8 tipos)
    "inflation_simulator", "credit_score", "debt_strategy",
    "tax_puzzle", "salary_comparison", "spot_trap",
    "impact_meter", "mindset_comparison",
]


# Campos requeridos en content por tipo
REQUIRED_CONTENT_FIELDS = {
    "intro_narrative": ["transcript"],
    "multiple_choice": ["question", "options"],
    "true_false": ["statement"],
    "fill_blank": ["segments", "options"],
    "classification": ["items", "categories"],
    "matching_pairs": ["pairs"],
    "sequencing": ["items"],
    "tap_action": ["items"],
    "story_mode": ["pages"],
    "math_challenge": ["question"],
    "word_scramble": ["word"],
    "roleplay_chat": ["dialogue", "choices"],
    "estimation_slider": ["min", "max"],
    "risk_reward": ["question", "risk_options"],
    "concept_builder": ["question", "concepts"],
    "quiz_battle": ["questions"],
    "shop_sim": ["budget", "products"],
    "coin_counter": ["targetAmount", "coins_available"],
    "price_detective": ["products"],
    "bill_splitter": ["people", "items"],
    "budget_builder": ["budget", "items"],
    "expense_timeline": ["expenses"],
    "subscription_tracker": [],
    "savings_race": ["goal", "strategies"],
    "emergency_fund": ["initialFund", "events"],
    "goal_roadmap": ["goals"],
    "interest_calculator": [],
    "portfolio_builder": ["assets"],
    "mystery_investment": ["totalCoins", "boxes"],
    "passive_income": ["streams", "targetIncome"],
    "opportunity_cost": ["options"],
    "market_reaction": ["options"],
    "inflation_simulator": ["product"],
    "credit_score": ["initialScore", "scenarios"],
    "debt_strategy": ["debts", "monthlyPayment"],
    "tax_puzzle": ["pieces"],
    "salary_comparison": ["offers"],
    "spot_trap": ["messages"],
    "impact_meter": ["budget", "causes"],
    "mindset_comparison": ["scenario"],
}

# Tipos que requieren correct_answer
TYPES_REQUIRING_CORRECT_ANSWER = [
    "multiple_choice", "true_false", "fill_blank", "classification",
    "sequencing", "tap_action", "math_challenge", "roleplay_chat",
    "estimation_slider", "risk_reward", "concept_builder", "quiz_battle",
    "shop_sim", "price_detective", "bill_splitter", "budget_builder",
    "expense_timeline", "goal_roadmap", "mystery_investment",
    "opportunity_cost", "market_reaction", "salary_comparison", "spot_trap",
    "credit_score",
]

# Tipos siempre verdaderos (exploratorios/educativos, no requieren correct_answer)
ALWAYS_TRUE_TYPES = [
    "intro_narrative", "story_mode", "word_scramble", "matching_pairs",
    "savings_race", "emergency_fund", "debt_strategy", "portfolio_builder",
    "passive_income", "subscription_tracker", "tax_puzzle",
    "interest_calculator", "inflation_simulator", "impact_meter",
    "mindset_comparison", "coin_counter",
]


def validate_exercise(exercise: dict, language: str = "es") -> List[str]:
    """
    Valida un ejercicio individual.
    Retorna lista de errores. Lista vacía = ejercicio válido.
    """
    errors = []

    # Validar tipo
    ex_type = exercise.get("type")
    if not ex_type:
        errors.append("Falta el campo 'type'")
        return errors

    if ex_type not in VALID_EXERCISE_TYPES:
        errors.append(f"Tipo de ejercicio no válido: '{ex_type}'. Tipos válidos: {', '.join(VALID_EXERCISE_TYPES[:10])}...")
        return errors

    # Validar content
    content = exercise.get("content")
    if not content:
        errors.append(f"[{ex_type}] Falta el campo 'content'")
        return errors

    if not isinstance(content, dict):
        errors.append(f"[{ex_type}] 'content' debe ser un objeto/dict")
        return errors

    # Validar campos requeridos en content
    required_fields = REQUIRED_CONTENT_FIELDS.get(ex_type, [])
    for field in required_fields:
        if field not in content:
            errors.append(f"[{ex_type}] Falta campo requerido en content: '{field}'")

    # Validar correct_answer si es requerido
    if ex_type in TYPES_REQUIRING_CORRECT_ANSWER:
        correct_answer = exercise.get("correct_answer")
        if correct_answer is None:
            # Solo advertencia, no error fatal
            pass  # Algunos tipos pueden no tenerlo en draft

    # Validaciones específicas por tipo
    if ex_type == "multiple_choice" and content.get("options"):
        options = content["options"]
        if not isinstance(options, list) or len(options) < 2:
            errors.append(f"[{ex_type}] 'options' debe tener al menos 2 opciones")
        for opt in options:
            if not isinstance(opt, dict) or "id" not in opt or "text" not in opt:
                errors.append(f"[{ex_type}] Cada opción debe tener 'id' y 'text'")
                break

    if ex_type == "true_false":
        correct = exercise.get("correct_answer")
        if correct and "isTrue" not in correct:
            errors.append(f"[{ex_type}] correct_answer debe tener 'isTrue' (boolean)")

    if ex_type == "classification" and content.get("categories"):
        categories = content["categories"]
        if not isinstance(categories, list) or len(categories) < 2:
            errors.append(f"[{ex_type}] 'categories' debe tener al menos 2 categorías")

    if ex_type == "sequencing" and content.get("items"):
        items = content["items"]
        if not isinstance(items, list) or len(items) < 2:
            errors.append(f"[{ex_type}] 'items' debe tener al menos 2 elementos")

    return errors


def validate_exercises(exercises: List[dict], language: str = "es") -> List[str]:
    """
    Valida un arreglo completo de ejercicios.
    Retorna lista de errores acumulados.
    """
    all_errors = []

    if not isinstance(exercises, list):
        return ["El contenido debe ser un arreglo de ejercicios"]

    for i, exercise in enumerate(exercises):
        errors = validate_exercise(exercise, language)
        for error in errors:
            all_errors.append(f"Ejercicio #{i + 1}: {error}")

    return all_errors
