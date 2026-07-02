#!/usr/bin/env python3
"""
Genera 47 lecciones de smoke-test (0-0-0-1 a 0-0-0-47).
Una lección por tipo canónico de ejercicio, para pruebas de renderizado individual.

Las lecciones tienen adventure_level=0 → invisibles en /learn.
Inserción directa vía SQLAlchemy (bypassea validación admin de adventure_level≥1).

Uso:
    python scripts/generate_smoke_tests.py                     # dry-run (solo genera JSONs)
    python scripts/generate_smoke_tests.py --commit --prod     # inserta en BD
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal  # noqa: E402
from models import Lesson         # noqa: E402

OUT_DIR = Path(__file__).parent.parent / "lesson_factory" / "test_lessons" / "smoke_tests"

# ── 47 canonical types in order ──
CANONICAL_TYPES = [
    "intro_narrative", "multiple_choice", "true_false", "tap_action",
    "matching_pairs", "sequencing", "coin_counter", "word_scramble",
    "fill_blank", "classification", "math_challenge", "estimation_slider",
    "interest_calculator", "spot_trap", "roleplay_chat", "story_mode",
    "risk_reward", "opportunity_cost", "comparison", "case_study",
    "decision_challenge", "price_detective", "market_reaction", "mindset_comparison",
    "salary_comparison", "credit_score", "impact_meter", "quiz_battle",
    "mystery_investment", "debt_strategy", "concept_builder", "budget_builder",
    "portfolio_builder", "goal_roadmap", "expense_timeline", "savings_race",
    "passive_income", "subscription_tracker", "emergency_fund", "bill_splitter",
    "tax_puzzle", "inflation_simulator", "shop_sim", "drag_drop",
    "sorting_buckets", "image_hotspot", "balance_scale",
]

ALWAYS_TRUE_TYPES = {
    "intro_narrative", "story_mode", "word_scramble", "matching_pairs",
    "savings_race", "emergency_fund", "debt_strategy", "portfolio_builder",
    "passive_income", "subscription_tracker", "tax_puzzle",
    "interest_calculator", "inflation_simulator", "impact_meter",
    "mindset_comparison", "coin_counter",
}

TYPES_REQUIRING_ANSWER = {
    "multiple_choice", "true_false", "fill_blank", "classification",
    "sequencing", "tap_action", "math_challenge", "roleplay_chat",
    "estimation_slider", "risk_reward", "concept_builder", "quiz_battle",
    "shop_sim", "price_detective", "bill_splitter", "budget_builder",
    "expense_timeline", "goal_roadmap", "mystery_investment",
    "opportunity_cost", "market_reaction", "salary_comparison", "spot_trap",
    "credit_score",
}

CHARACTER = "liruf"

BASIC_FEEDBACK = {"success": "¡Correcto! ✅", "error": "Intenta de nuevo 💡"}


def make_exercise(ex_type: str, idx: int) -> dict:
    """Return a minimal valid {type, character_code, content, correct_answer?, feedback}."""
    cid = f"smoke-{idx:02d}"

    # ── Narrative ──
    if ex_type == "intro_narrative":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {"transcript": f"Este es un ejercicio de prueba tipo {ex_type}."},
        }

    # ── Core Choice ──
    if ex_type == "multiple_choice":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "question": "¿Cuál es el tipo de este ejercicio?",
                "options": [
                    {"id": "a", "text": "multiple_choice"},
                    {"id": "b", "text": "true_false"},
                    {"id": "c", "text": "fill_blank"},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "true_false":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {"statement": "Este es un ejercicio true_false."},
            "correct_answer": {"isTrue": True},
            "feedback": BASIC_FEEDBACK,
        }

    # ── Core Interaction ──
    if ex_type == "tap_action":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "statement": "Toca los ítems correctos.",
                "items": [
                    {"id": "i1", "text": "Ítem correcto", "isTarget": True},
                    {"id": "i2", "text": "Ítem incorrecto", "isTarget": False},
                    {"id": "i3", "text": "Ítem correcto", "isTarget": True},
                ],
            },
            "correct_answer": {"targetIds": ["i1", "i3"]},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "matching_pairs":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "pairs": [
                    {"left": "Moneda", "right": "Clinc"},
                    {"left": "Billete", "right": "Silencio"},
                ],
            },
        }

    if ex_type == "sequencing":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Ordena los pasos correctamente.",
                "items": [
                    {"id": "s1", "text": "Paso 1"},
                    {"id": "s2", "text": "Paso 2"},
                    {"id": "s3", "text": "Paso 3"},
                ],
            },
            "correct_answer": {"sequence": ["s1", "s2", "s3"]},
            "feedback": BASIC_FEEDBACK,
        }

    # ── Counting / Text ──
    if ex_type == "coin_counter":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "targetAmount": 25,
                "coins_available": [
                    {"value": 1, "image": "🪙"},
                    {"value": 5, "image": "💵"},
                    {"value": 10, "image": "💶"},
                ],
            },
        }

    if ex_type == "word_scramble":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {"word": "DINERO", "hint": "Lo usamos para comprar cosas."},
        }

    if ex_type == "fill_blank":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "statement": "El ________ es un tipo de ejercicio de texto.",
            },
            "correct_answer": {"blanks": ["fill_blank"]},
            "feedback": BASIC_FEEDBACK,
        }

    # ── Classify ──
    if ex_type == "classification":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Clasifica cada ítem.",
                "categories": [
                    {"id": "catA", "text": "Categoría A"},
                    {"id": "catB", "text": "Categoría B"},
                ],
                "items": [
                    {"id": "i1", "text": "Ítem 1", "category": "catA"},
                    {"id": "i2", "text": "Ítem 2", "category": "catB"},
                    {"id": "i3", "text": "Ítem 3", "category": "catA"},
                ],
            },
            "correct_answer": {"classifications": {"i1": "catA", "i2": "catB", "i3": "catA"}},
            "feedback": BASIC_FEEDBACK,
        }

    # ── Numeric ──
    if ex_type == "math_challenge":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {"question": "¿Cuánto es 12 + 8?", "answer_format": "number"},
            "correct_answer": {"value": 20, "tolerance": 0.01},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "estimation_slider":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "problem": "Estima el resultado de 48 / 4.",
                "min": 0, "max": 30, "step": 1, "unit": "",
            },
            "correct_answer": {"value": 12, "tolerance": 2},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "interest_calculator":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Calcula el interés simple.",
                "parameters": {"principal": 100, "rate": 5, "time": 2},
            },
        }

    # ── Scenario Choice ──
    if ex_type == "spot_trap":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Encuentra las trampas.",
                "scenario": "Recibes varias ofertas. Algunas son trampas.",
                "messages": [
                    {"id": "m1", "text": "¡Gana 1 millón hoy!", "isTrap": True},
                    {"id": "m2", "text": "Ahorra 10% de tu mesada.", "isTrap": False},
                    {"id": "m3", "text": "Inversión segura 200% mensual.", "isTrap": True},
                ],
            },
            "correct_answer": {"trapIds": ["m1", "m3"]},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "roleplay_chat":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Un amigo te pide dinero prestado.",
                "options": [
                    {"id": "a", "text": "Prestarle con condiciones claras."},
                    {"id": "b", "text": "Decir que no tienes dinero."},
                    {"id": "c", "text": "Regalarle el dinero sin esperar nada."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "story_mode":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Eres un joven emprendedor que debe decidir cómo usar sus ahorros.",
                "choices": [
                    {"id": "a", "text": "Invertir en un negocio."},
                    {"id": "b", "text": "Guardar todo en el banco."},
                ],
            },
        }

    if ex_type == "risk_reward":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "decision": "¿Arriesgas o juegas seguro?",
                "scenario": "Tienes $100 para invertir.",
                "options": [
                    {"id": "safe1", "type": "safe", "text": "Guardar en alcancía", "reward": "+$0"},
                    {"id": "risk1", "type": "risk", "text": "Invertir en negocio", "reward": "+$20"},
                ],
            },
            "correct_answer": {"correctOptionId": "risk1"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "opportunity_cost":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Tienes $50. Puedes comprar un libro o un videojuego.",
                "options": [
                    {"id": "A", "text": "Libro (aprendes)"},
                    {"id": "B", "text": "Videojuego (diversión)"},
                ],
            },
            "correct_answer": {"correctOptionId": "A"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "comparison":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "question": "¿Qué opción conviene más?",
                "options": [
                    {"id": "A", "text": "Opción A: $10/mes"},
                    {"id": "B", "text": "Opción B: $100/año"},
                ],
            },
            "correct_answer": {"correctOptionId": "B"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "case_study":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Ana ahorró $500 en 6 meses. Quiere comprar una laptop de $800.",
                "options": [
                    {"id": "a", "text": "Seguir ahorrando 6 meses más."},
                    {"id": "b", "text": "Pedir un préstamo."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "decision_challenge":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Debes decidir entre dos trabajos de verano.",
                "options": [
                    {"id": "a", "text": "Trabajo A: $15/hora, 20 horas/semana."},
                    {"id": "b", "text": "Trabajo B: $12/hora, 30 horas/semana."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "price_detective":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "¿Qué producto tiene mejor precio por unidad?",
                "items": [
                    {"id": "p1", "name": "Jugo 1L", "price": 15, "quantity": 1, "unit": "L"},
                    {"id": "p2", "name": "Jugo 2L", "price": 24, "quantity": 2, "unit": "L"},
                ],
            },
            "correct_answer": {"correctOptionId": "p2"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "market_reaction":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Una noticia anuncia que el precio del limón subirá.",
                "options": [
                    {"id": "a", "text": "Comprar limones ahora."},
                    {"id": "b", "text": "Esperar a que bajen."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "mindset_comparison":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Compara dos mentalidades financieras.",
                "pair": {
                    "mindsetA": {"id": "A", "text": "Ahorrador: guarda 30% de todo ingreso."},
                    "mindsetB": {"id": "B", "text": "Gastador: gasta todo lo que gana."},
                },
            },
        }

    if ex_type == "salary_comparison":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Compara dos ofertas de trabajo.",
                "optionA": {"id": "A", "text": "Oferta A: $30,000/mes + seguro médico."},
                "optionB": {"id": "B", "text": "Oferta B: $35,000/mes sin seguro."},
            },
            "correct_answer": {"correctOptionId": "A"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "credit_score":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "¿Qué acción mejora más tu score crediticio?",
                "options": [
                    {"id": "a", "text": "Pagar todas tus deudas a tiempo."},
                    {"id": "b", "text": "No usar crédito nunca."},
                    {"id": "c", "text": "Pedir muchas tarjetas."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "impact_meter":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "budget": 100,
                "causes": [
                    {"id": "c1", "name": "Educación", "icon": "📚"},
                    {"id": "c2", "name": "Salud", "icon": "🏥"},
                    {"id": "c3", "name": "Ambiente", "icon": "🌳"},
                ],
            },
        }

    if ex_type == "quiz_battle":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "question": "¿Qué significa DCA?",
                "options": [
                    {"id": "a", "text": "Donar, Comprar, Ahorrar."},
                    {"id": "b", "text": "Deber, Correr, Avanzar."},
                ],
            },
            "correct_answer": {"correctOptionId": "a"},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "mystery_investment":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "totalCoins": 10,
                "boxes": [
                    {"id": "b1", "name": "Caja segura", "risk": "low", "minReturn": 1.1, "maxReturn": 1.3},
                    {"id": "b2", "name": "Caja riesgo medio", "risk": "medium", "minReturn": 0.8, "maxReturn": 1.8},
                    {"id": "b3", "name": "Caja sorpresa", "risk": "high", "minReturn": 0.2, "maxReturn": 3.0},
                ],
            },
            "correct_answer": {"correctOptionId": "b1"},
            "feedback": BASIC_FEEDBACK,
        }

    # ── Builder ──
    if ex_type == "debt_strategy":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Tienes dos deudas. ¿Cuál pagas primero?",
                "options": [
                    {"id": "A", "text": "Deuda con 25% de interés."},
                    {"id": "B", "text": "Deuda con 5% de interés."},
                ],
            },
        }

    if ex_type == "concept_builder":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Ordena los conceptos del más básico al más avanzado.",
                "items": [
                    {"id": "c1", "label": "Ahorrar"},
                    {"id": "c2", "label": "Invertir"},
                    {"id": "c3", "label": "Diversificar"},
                ],
            },
            "correct_answer": {"sequence": ["c1", "c2", "c3"]},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "budget_builder":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Distribuye tu ingreso mensual de $1,000.",
                "totalIncome": 1000,
                "categories": [
                    {"id": "needs", "name": "Necesidades", "allocated": 0, "target": 500},
                    {"id": "wants", "name": "Deseos", "allocated": 0, "target": 300},
                    {"id": "dca", "name": "DCA", "allocated": 0, "target": 200},
                ],
            },
            "correct_answer": {"allocation": {"needs": 500, "wants": 300, "dca": 200}},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "portfolio_builder":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Construye tu portafolio de inversión.",
                "options": [
                    {"id": "a", "text": "100% acciones."},
                    {"id": "b", "text": "60% acciones, 40% bonos."},
                ],
            },
        }

    if ex_type == "goal_roadmap":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Ordena las metas por prioridad.",
                "goals": [
                    {"id": "g1", "text": "Fondo de emergencia", "amount": 1000, "icon": "🛡️"},
                    {"id": "g2", "text": "Comprar bici", "amount": 500, "icon": "🚲"},
                    {"id": "g3", "text": "Viaje", "amount": 2000, "icon": "✈️"},
                ],
            },
            "correct_answer": {"sequence": ["g1", "g2", "g3"]},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "expense_timeline":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Ordena los gastos del más urgente al menos urgente.",
                "expenses": [
                    {"id": "e1", "name": "Renta", "amount": 1000, "priority": "urgent", "icon": "🏠"},
                    {"id": "e2", "name": "Netflix", "amount": 15, "priority": "can_wait", "icon": "📺"},
                    {"id": "e3", "name": "Super", "amount": 200, "priority": "important", "icon": "🛒"},
                ],
            },
            "correct_answer": {"order": ["e1", "e3", "e2"]},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "savings_race":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "goal": "Ahorrar $500 para una bici.",
                "strategies": [
                    {"id": "s1", "name": "Alcancía", "weeklyAmount": 10},
                    {"id": "s2", "name": "Trabajo extra", "weeklyAmount": 25},
                ],
            },
        }

    if ex_type == "passive_income":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "targetIncome": 500,
                "streams": [
                    {"id": "s1", "name": "Intereses banco", "monthlyIncome": 50},
                    {"id": "s2", "name": "Renta propiedad", "monthlyIncome": 300},
                    {"id": "s3", "name": "Dividendos", "monthlyIncome": 200},
                ],
            },
        }

    if ex_type == "subscription_tracker":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "subscriptions": [
                    {"id": "sub1", "name": "Streaming", "monthlyCost": 15},
                    {"id": "sub2", "name": "Gym", "monthlyCost": 30},
                ],
            },
        }

    if ex_type == "emergency_fund":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "initialFund": 5000,
                "events": [
                    {"id": "ev1", "text": "Se descompuso el auto.", "cost": 2000},
                    {"id": "ev2", "text": "Emergencia médica.", "cost": 3500},
                ],
            },
        }

    if ex_type == "bill_splitter":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Dividan la cuenta del restaurante.",
                "people": [
                    {"id": "p1", "name": "Ana"},
                    {"id": "p2", "name": "Luis"},
                    {"id": "p3", "name": "Sofía"},
                ],
                "items": [
                    {"id": "i1", "name": "Pizza", "price": 180},
                    {"id": "i2", "name": "Refrescos", "price": 60},
                ],
            },
            "correct_answer": {"splits": {"p1": 80, "p2": 80, "p3": 80}},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "tax_puzzle":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "puzzle": "Calcula el impuesto (16% IVA) sobre $1,000.",
                "options": [
                    {"id": "a", "text": "$160"},
                    {"id": "b", "text": "$16"},
                ],
            },
        }

    if ex_type == "inflation_simulator":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "product": "Canasta básica",
                "initialPrice": 1000,
                "inflationRate": 5,
                "years": 10,
            },
        }

    if ex_type == "shop_sim":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Compra productos sin exceder tu presupuesto de $30.",
                "budget": 30,
                "items": [
                    {"id": "p1", "name": "Leche", "price": 12},
                    {"id": "p2", "name": "Pan", "price": 8},
                    {"id": "p3", "name": "Huevos", "price": 15},
                ],
            },
            "correct_answer": {
                "validCombinations": [
                    ["p1"],
                    ["p2"],
                    ["p1", "p2"]
                ]
            },
            "feedback": BASIC_FEEDBACK,
        }

    # ── Spatial ──
    if ex_type == "drag_drop":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Arrastra cada ítem a su categoría.",
                "categories": [
                    {"id": "cat1", "text": "Ingreso"},
                    {"id": "cat2", "text": "Gasto"},
                ],
                "items": [
                    {"id": "i1", "text": "Salario"},
                    {"id": "i2", "text": "Renta"},
                ],
            },
            "correct_answer": {"classifications": {"i1": "cat1", "i2": "cat2"}},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "sorting_buckets":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Clasifica en los cubos correctos.",
                "categories": [
                    {"id": "b1", "text": "Ahorro"},
                    {"id": "b2", "text": "Inversión"},
                ],
                "items": [
                    {"id": "i1", "text": "Alcancía"},
                    {"id": "i2", "text": "Acciones"},
                ],
            },
            "correct_answer": {"classifications": {"i1": "b1", "i2": "b2"}},
            "feedback": BASIC_FEEDBACK,
        }

    if ex_type == "image_hotspot":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "instruction": "Selecciona los **gastos fijos** en este estado de cuenta (renta, servicios, suscripciones).",
                "imageUrl": "https://placehold.co/600x400/png",
                "hotspots": [
                    {"id": "h1", "x": 100, "y": 150, "radius": 30, "label": "Renta"},
                    {"id": "h2", "x": 300, "y": 200, "radius": 30, "label": "Netflix"},
                    {"id": "h3", "x": 200, "y": 100, "radius": 30, "label": "Cena restaurante"},
                ],
            },
            "correct_answer": {"hotspotIds": ["h1", "h2"]},
            "feedback": {
                "success": "¡Correcto! ✅ Renta y Netflix son gastos fijos.",
                "error": "Intenta de nuevo 💡 Los gastos fijos son pagos recurrentes."
            },
        }

    if ex_type == "balance_scale":
        return {
            "type": ex_type, "character_code": CHARACTER,
            "content": {
                "scenario": "Tienes $100. Puedes gastarlos hoy o invertirlos al 5% anual durante 5 años. ¿Cuál opción tiene más valor?",
                "left": {"label": "Gastar hoy", "value": 100},
                "right": {"label": "Invertir 5 años", "value": 128},
            },
            "correct_answer": {"condition": "right_heavy"},
            "feedback": {
                "success": "¡Correcto! ✅ $100 invertidos al 5% por 5 años = $128. El interés compuesto genera más valor.",
                "error": "Intenta de nuevo 💡 Recuerda: el interés compuesto hace crecer tu dinero con el tiempo."
            },
        }

    # ── Fallback ──
    return {
        "type": ex_type, "character_code": CHARACTER,
        "content": {"message": f"Smoke test for {ex_type}."},
    }


def build_lesson(idx: int, ex_type: str) -> dict:
    """Build a full LessonV2-compatible dict for lesson 0-0-0-{idx}."""
    idx_str = f"{idx:02d}"
    exercise = make_exercise(ex_type, idx)

    return {
        "lesson_code": f"0-0-0-{idx}",
        "title_es": f"Smoke Test: {ex_type}",
        "title_en": f"Smoke Test: {ex_type}",
        "description_es": f"Lección de prueba de renderizado para el tipo {ex_type}.",
        "description_en": f"Render smoke test for exercise type {ex_type}.",
        "duration": 2,
        "age_rate": "5-7",
        "points_reward": 10,
        "adventure_level": 0,
        "saga_level": 0,
        "topic_level": 0,
        "lesson_number": idx,
        "content_es": [exercise],
        "content_en": [exercise],
    }


def save_lessons_json(lessons: list[dict]) -> Path:
    """Write all lessons as individual JSON files. Returns the output directory."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for lesson in lessons:
        path = OUT_DIR / f"{lesson['lesson_code']}.json"
        path.write_text(json.dumps(lesson, ensure_ascii=False, indent=2), encoding="utf-8")
    return OUT_DIR


def upsert_lessons_db(lessons: list[dict], dry_run: bool) -> dict:
    stats = {"inserted": 0, "updated": 0, "errors": 0}
    db = SessionLocal()
    try:
        for data in lessons:
            code = data["lesson_code"]
            try:
                existing = db.query(Lesson).filter_by(lesson_code=code).one_or_none()
                fields = {
                    "lesson_code": code,
                    "title_es": data["title_es"],
                    "title_en": data["title_en"],
                    "description_es": data.get("description_es"),
                    "description_en": data.get("description_en"),
                    "duration": data.get("duration"),
                    "age_rate": data.get("age_rate"),
                    "points_reward": data.get("points_reward", 10),
                    "adventure_level": data["adventure_level"],
                    "saga_level": data["saga_level"],
                    "topic_level": data["topic_level"],
                    "lesson_number": data["lesson_number"],
                    "content_es": data["content_es"],
                    "content_en": data["content_en"],
                }
                if existing:
                    for k, v in fields.items():
                        setattr(existing, k, v)
                    stats["updated"] += 1
                else:
                    db.add(Lesson(**fields))
                    stats["inserted"] += 1
            except Exception as e:
                stats["errors"] += 1
                print(f"   ❌ {code}: {e}")
        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()
    return stats


def verify(db) -> None:
    """Show lessons with adventure_level=0."""
    from sqlalchemy import text
    rows = db.execute(text(
        "SELECT lesson_code, title_es, adventure_level FROM lessons WHERE adventure_level = 0 ORDER BY lesson_code"
    )).fetchall()
    print(f"\n📊 Lecciones con adventure_level=0: {len(rows)}")
    for r in rows:
        print(f"   {r[0]:12s}  aventura={r[2]}  {r[1]}")


def main():
    p = argparse.ArgumentParser(description="Genera e inserta lecciones smoke-test 0-0-0-X")
    p.add_argument("--commit", action="store_true", help="Aplica cambios (sin esto = dry-run)")
    p.add_argument("--prod", action="store_true", help="Reconoce que la BD es producción")
    args = p.parse_args()

    print("=" * 60)
    print("🧪 LittleFounders — Smoke Test Lesson Generator")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Tipos canónicos: {len(CANONICAL_TYPES)}")

    lessons = [build_lesson(i + 1, t) for i, t in enumerate(CANONICAL_TYPES)]

    # ── Save JSONs ──
    out = save_lessons_json(lessons)
    print(f"📁 JSONs guardados en: {out}")

    # ── DB ──
    writing = args.commit
    if writing and not args.prod:
        print("\n🛑 --commit requiere --prod. Abortando para proteger los datos.")
        sys.exit(2)

    db = SessionLocal()
    try:
        if not writing:
            print("\n🧪 DRY-RUN (no se escribe en BD). Usa --commit --prod para insertar.")
        else:
            print(f"\n🚀 INSERTANDO en producción...")

        stats = upsert_lessons_db(lessons, dry_run=not writing)
        print(f"   inserciones: {stats['inserted']} · actualizaciones: {stats['updated']} · errores: {stats['errors']}")

        verify(db)

        if writing:
            print(f"\n✅ {stats['inserted']} lecciones nuevas insertadas, {stats['updated']} actualizadas.")
        else:
            print(f"\n✅ DRY-RUN completo: {stats['inserted']} se insertarían, {stats['updated']} se actualizarían.")
    finally:
        db.close()
    print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
