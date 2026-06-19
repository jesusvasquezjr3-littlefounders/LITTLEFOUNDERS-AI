#!/usr/bin/env python3
"""
Render-compat check — cierra el hueco "gate-pass ≠ jugable".
=============================================================

El gate estructural valida LessonV2 (content = "dict no vacío", permisivo), pero NO
que la forma de `content`/`correct_answer` sea la que el renderer + el grader del
frontend realmente consumen. El piloto 2026-06-19 reveló que DeepSeek inventa formas
plausibles (price_detective→targetIds, quiz_battle→rounds[], budget_builder→categories{})
que el grador NO lee → cae en `return true` (TODA respuesta correcta, incl. la trampa)
o el renderer muestra una pantalla vacía.

Este módulo porta la lógica de consumibilidad de
`frontend/src/components/lessons/engine/hooks/useLessonState.ts` (validateAnswer +
extractCorrectId) para que una forma NO-consumible falle el gate. Es defensa en
profundidad: el lever principal es el contrato inyectado en el prompt
(`schema/render_contracts.json`), esto es la red de seguridad.
"""
from __future__ import annotations
from typing import Any

# Alias de id de respuesta que extractCorrectId() del grader reconoce (useLessonState.ts:49-144).
_ID_ALIASES = [
    "correctOptionId", "correctChoiceId", "correctId", "choiceId", "correctItemId", "selectedId",
    "correctProductId", "itemId", "correctTrapId", "trapId", "correctScenarioId", "correctScenario",
    "correctPlanId", "recommendedOptionId", "bestChoiceId", "bestOptionId", "preferredOption",
    "chosenOptionId", "correctMindsetId", "betterStrategyId", "correctOfferId", "correctResponseId",
    "bestResponseId", "optimalResponseId", "correctMessageId", "correctPathId", "correctStepId",
    "correctProfile", "correctOption", "correctChoice", "chosenOption", "betterOption",
    "correctMindset", "correctApproach", "selectedApproach", "betterMindsetId", "preferredOptionId",
    "optimalOptionId", "optimalChoice", "lowerRiskOptionId", "correctPortfolio", "correctPortfolioId",
    "chosenStrategy", "strategyWithHigherOpportunityCost", "optionId", "selectedOptionId",
    "selectedProductId", "selectedItemId", "preferredOffer", "chosenOffer", "selectedOffer",
    "correctMarket", "correctCity", "correctItem", "selectedPriceId", "selectedStoreId",
    "cheaperItemId", "correctCaseId", "correctPlan", "correctModel", "correctProject",
    "correctEntrepreneur", "bestScenarioId", "targetId", "correctStatementId", "incorrectStatementId",
    "incorrectPlanId", "incorrectOptionId", "incorrectStepId", "incorrectSegmentId", "incorrectLineId",
    "trapStepId", "trapSegmentId", "trapStatementId", "trapOptionId", "trapActionId", "trapPlanId",
    "trapCaseId", "trapScenarioId", "trapOfferId", "trapItemId", "correctReportId", "correctZoneId",
    "targetStepId", "targetPlanId", "trappedProfileId", "segmentId", "planId", "portfolioId",
    "decision", "isCorrect", "bestOffer",
]

# Familias de tipo (espejo del switch de validateAnswer).
_OPTION_TYPES = {
    "multiple_choice", "roleplay_chat", "risk_reward", "price_detective", "market_reaction",
    "debt_strategy", "tax_puzzle", "mindset_comparison", "opportunity_cost", "impact_meter",
    "case_real", "case_study", "decision_challenge", "salary_comparison", "comparison", "compare",
    "comparison_chart", "comparison_matrix", "comparison_slider", "comparison_table",
    "comparison_challenge", "decision_matrix", "story_mode",
}
# Tipos exploratorios: el grader devuelve `true` por diseño (simuladores sin respuesta única).
_EXPLORATORY_TYPES = {
    "bill_splitter", "subscription_tracker", "inflation_simulator", "savings_race",
    "interest_calculator", "mystery_investment", "emergency_fund", "passive_income",
    "estimation_slider", "credit_score", "portfolio_builder", "shop_sim",
    "intro_narrative", "matching_pairs", "match_pairs",
}


def _has_id(ca: Any) -> bool:
    if not isinstance(ca, dict):
        return False
    return any(ca.get(k) is not None for k in _ID_ALIASES)


def _has_multi(ca: Any) -> bool:
    if not isinstance(ca, dict):
        return False
    for k in ("correctOptionIds", "correctChoiceIds", "trueOptionIds"):
        if isinstance(ca.get(k), list) and ca[k]:
            return True
    return False


def _exercise_issue(ex: dict, idx: int, lang: str) -> str | None:
    """Devuelve un mensaje si el ejercicio NO es consumible por el motor; None si está OK."""
    t = ex.get("type")
    content = ex.get("content") or {}
    ca = ex.get("correct_answer")

    # Tipos exploratorios / de consumo: el grader siempre acepta → no exigimos correct_answer.
    if t in _EXPLORATORY_TYPES:
        return None

    if t in _OPTION_TYPES:
        if _has_id(ca) or _has_multi(ca):
            return None
        return (f"[{lang}#{idx}] '{t}' sin id de respuesta consumible — el grader caería en "
                f"'return true' (toda respuesta correcta). Usa correct_answer.correctOptionId.")

    if t == "true_false":
        if _has_id(ca) or (isinstance(ca, dict) and ca.get("isTrue") is not None):
            return None
        return f"[{lang}#{idx}] 'true_false' sin correct_answer.isTrue ni id."

    if t == "quiz_battle":
        has_q = isinstance(content.get("questions"), list) and content["questions"]
        has_single = content.get("question") and isinstance(content.get("options"), list) and content["options"]
        if has_q or has_single:
            return None
        return (f"[{lang}#{idx}] 'quiz_battle' sin content.questions[] ni content.question+options[] "
                f"(¿usaste rounds[]?) — el renderer muestra 'Sin preguntas disponibles'.")

    if t == "budget_builder":
        if _has_id(ca):
            return None
        if isinstance(ca, dict):
            if (ca.get("allocation") or ca.get("allocations")
                    or (ca.get("minCategory") and ca.get("minAmount") is not None)
                    or ca.get("isValid") or ca.get("isValidAllocation") or ca.get("isValidBudget")):
                return None
            # claves numéricas directas {c1: 100, ...}
            if any(isinstance(v, (int, float)) for k, v in ca.items()
                   if k not in ("feedback", "success", "error")):
                return None
        return (f"[{lang}#{idx}] 'budget_builder' sin correct_answer consumible "
                f"(usa allocation:{{catId:monto}}) — categories{{}}/values{{}} NO se leen → 'return true'.")

    if t == "spot_trap":
        if isinstance(ca, dict):
            for k in ("trapIds", "correctTrapIds", "correctTraps", "targetIds", "correctOptionIds",
                      "redFlagIds", "trapsFound", "trapSegmentIds", "trapLineIds"):
                if isinstance(ca.get(k), list) and ca[k]:
                    return None
            if _has_id(ca):
                return None
        # fallback: items con isTrap en algún contenedor
        for key in ("scenarios", "messages", "plans", "statements", "items", "segments", "options", "traps"):
            arr = content.get(key)
            if isinstance(arr, list) and any(isinstance(s, dict) and (s.get("isTrap") or s.get("isCorrect")) for s in arr):
                return None
        return f"[{lang}#{idx}] 'spot_trap' sin trapIds[] ni items marcados isTrap."

    if t == "classification":
        if isinstance(ca, (dict, list)) and ca:
            return None
        items = content.get("items")
        if isinstance(items, list) and any(isinstance(i, dict) and (i.get("correctCategory") or i.get("correctCategoryId")) for i in items):
            return None
        return f"[{lang}#{idx}] 'classification' sin mapa itemId→categoryId ni items[].correctCategory."

    if t in ("sequencing", "concept_builder", "goal_roadmap"):
        if isinstance(ca, dict):
            if any(ca.get(k) for k in ("sequence", "correctSequence", "order", "correctOrder")):
                return None
            if t == "concept_builder" and any(ca.get(k) for k in (
                    "correctOptionIds", "selectedIds", "componentIds", "correctComponentIds",
                    "essentialIds", "correctConceptIds", "requiredIds", "correctIds")):
                return None
        if isinstance(content.get("items"), list) and content["items"]:
            return None
        if isinstance(content.get("correct_sequence"), list) and content["correct_sequence"]:
            return None
        return f"[{lang}#{idx}] '{t}' sin secuencia correcta (correct_answer.sequence)."

    if t == "tap_action":
        items = content.get("items")
        if isinstance(items, list) and any(isinstance(i, dict) and i.get("isTarget") for i in items):
            return None
        if isinstance(ca, dict) and isinstance(ca.get("targetIds"), list) and ca["targetIds"]:
            return None
        return f"[{lang}#{idx}] 'tap_action' sin items[].isTarget ni correct_answer.targetIds."

    if t == "fill_blank":
        if isinstance(ca, dict) and ca:
            return None
        if isinstance(ca, (list, str)) and ca:
            return None
        if isinstance(content.get("blanks"), list) and content["blanks"]:
            return None
        return f"[{lang}#{idx}] 'fill_blank' sin respuestas esperadas (correct_answer.blanks/values)."

    if t == "math_challenge":
        if isinstance(ca, dict) and ca:
            return None
        return f"[{lang}#{idx}] 'math_challenge' sin correct_answer (value/answer/correctOptionId)."

    # Otros tipos (word_scramble, coin_counter, expense_timeline, etc.): no chequeo específico aquí.
    return None


def render_compat_issues(lesson: dict) -> list[str]:
    """Lista de ejercicios cuya forma el motor NO puede renderizar/calificar de verdad.
    Revisa SOLO content_es (la paridad de tipo ya la garantiza el merge bilingüe)."""
    issues: list[str] = []
    for i, ex in enumerate(lesson.get("content_es", []) or []):
        if isinstance(ex, dict):
            msg = _exercise_issue(ex, i, "es")
            if msg:
                issues.append(msg)
    return issues
