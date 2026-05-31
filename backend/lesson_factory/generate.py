#!/usr/bin/env python3
"""
LittleFounders Lesson Factory - Generator
==========================================
Genera lecciones de alta calidad usando DeepSeek API.
Las lecciones siguen los blueprints de curriculum y las reglas pedagógicas.

Uso:
    python generate.py --adventure 1 --saga 1 --topic 2        # Un topic específico
    python generate.py --adventure 1 --saga 1                  # Toda una saga
    python generate.py --adventure 1                           # Toda una aventura
    python generate.py --adventure 1 --dry-run                 # Ver plan sin generar
    python generate.py --resume                                # Continuar desde donde quedó

Variables de entorno requeridas:
    DEEPSEEK_API_KEY=sk-...

Opciones avanzadas:
    --model deepseek-chat      (default, rápido y eficiente - DeepSeek V3)
    --model deepseek-reasoner  (más lento pero mayor calidad - DeepSeek R1)
    --delay 2.0                (segundos entre llamadas a la API, default 1.5)
    --max-retries 3            (intentos por lección en caso de error)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

# ─── Configuración ───────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
CURRICULUM_DIR = BASE_DIR / "curriculum"
RULES_FILE = BASE_DIR / "pedagogy_rules.json"
OUTPUT_DIR = BASE_DIR.parent / "lesson_engine" / "littlefounders_lessons"

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# ─── Cargar configuración ────────────────────────────────────────────────────

def load_rules() -> dict:
    with open(RULES_FILE, encoding="utf-8") as f:
        return json.load(f)

def load_adventure(adventure_num: int) -> dict:
    path = CURRICULUM_DIR / f"adventure_{adventure_num}.json"
    if not path.exists():
        raise FileNotFoundError(f"Blueprint no encontrado: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)

# ─── Construcción de Prompts ─────────────────────────────────────────────────

LESSON_JSON_SCHEMA = """
El JSON de la lección DEBE tener exactamente esta estructura:
{
  "lesson_code": "A-S-T-L",        // adventure-saga-topic-lesson (ej: "1-1-2-3")
  "title_es": "Título en español",
  "title_en": "Title in English",
  "description_es": "Descripción breve en español (1 oración)",
  "description_en": "Brief description in English (1 sentence)",
  "duration": 4,                    // minutos estimados
  "age_rate": "5-7",               // rango de edad
  "points_reward": 10,
  "adventure_level": 1,
  "saga_level": 1,
  "topic_level": 2,
  "lesson_number": 3,
  "content_es": [ ...ejercicios ],
  "content_en": [ ...ejercicios ]
}

Cada ejercicio en content_es / content_en tiene esta forma según su tipo:

INTRO_NARRATIVE:
{
  "type": "intro_narrative",
  "character_code": "liruf",
  "content": {
    "transcript": "El texto que dice el personaje. DEBE seguir las reglas de longitud y vocabulario."
  }
}

MULTIPLE_CHOICE (para aventuras 1-3, máximo 3 opciones en aventura 1):
{
  "type": "multiple_choice",
  "character_code": "liruf",
  "content": {
    "question": "¿Pregunta clara y concreta?",
    "instruction": "Elige la respuesta correcta",
    "options": [
      {"id": "a", "text": "🪙 Opción A"},
      {"id": "b", "text": "📄 Opción B"},
      {"id": "c", "text": "🌳 Opción C"}
    ]
  },
  "correct_answer": {"correctOptionId": "a"},
  "feedback": {
    "success": "¡Correcto! [Explicación específica del concepto]",
    "error": "Casi lo tienes. [Pista amable que orienta sin dar la respuesta]"
  }
}

TRUE_FALSE:
{
  "type": "true_false",
  "character_code": "liruf",
  "content": {
    "statement": "Afirmación que el niño evaluará",
    "instruction": "¿Verdadero o Falso?"
  },
  "correct_answer": {"isTrue": true},
  "feedback": {
    "success": "¡Exacto! [Explicación]",
    "error": "Hmm, no exactamente. [Pista]"
  }
}

TAP_ACTION:
{
  "type": "tap_action",
  "character_code": "liruf",
  "content": {
    "statement": "Toca todos los [objetos objetivo]",
    "instruction": "Toca los que sean [criterio]",
    "items": [
      {"id": "i1", "text": "🪙 Moneda", "isTarget": true},
      {"id": "i2", "text": "🌳 Árbol", "isTarget": false},
      {"id": "i3", "text": "🪙 Moneda", "isTarget": true}
    ]
  },
  "correct_answer": {"targetIds": ["i1", "i3"]},
  "feedback": {
    "success": "¡Perfecto! Tocaste todos correctamente.",
    "error": "Mira bien, ¿cuáles son [criterio]? Intenta de nuevo."
  }
}

MATCHING_PAIRS:
{
  "type": "matching_pairs",
  "character_code": "liruf",
  "content": {
    "instruction": "Une cada cosa con su pareja",
    "pairs": [
      {"id": "p1", "left": "🪙 Moneda", "right": "Redonda"},
      {"id": "p2", "left": "💵 Billete", "right": "Rectangular"},
      {"id": "p3", "left": "🏦 Banco", "right": "Guardar dinero"}
    ]
  },
  "feedback": {
    "success": "¡Increíble! Uniste todo perfectamente.",
    "error": "Casi. Intenta de nuevo, piensa en las características de cada uno."
  }
}

SEQUENCING (máximo 3 items en aventura 1, hasta 5 en aventuras superiores):
{
  "type": "sequencing",
  "character_code": "liruf",
  "content": {
    "instruction": "Ordena los pasos en el orden correcto",
    "items": [
      {"id": "s1", "text": "1️⃣ Paso uno"},
      {"id": "s2", "text": "2️⃣ Paso dos"},
      {"id": "s3", "text": "3️⃣ Paso tres"}
    ]
  },
  "correct_answer": {"sequence": ["s1", "s2", "s3"]},
  "feedback": {
    "success": "¡Excelente! Ese es el orden correcto.",
    "error": "El orden no es ese. Piensa en qué pasa primero."
  }
}
"""

GOLD_STANDARD_EXAMPLE = """
=== EJEMPLO DE LECCIÓN DE MÁXIMA CALIDAD (Aventura 1, Saga 1, Topic 2, Lección 1) ===
CONCEPTO: Las monedas son redondas
ESTRUCTURA: intro_narrative → tap_action → true_false → intro_narrative

{
  "lesson_code": "1-1-2-1",
  "title_es": "Las Monedas Son Redondas",
  "title_en": "Coins Are Round",
  "description_es": "Descubre por qué las monedas tienen forma de círculo",
  "description_en": "Discover why coins are shaped like circles",
  "duration": 3,
  "age_rate": "5-7",
  "points_reward": 10,
  "adventure_level": 1,
  "saga_level": 1,
  "topic_level": 2,
  "lesson_number": 1,
  "content_es": [
    {
      "type": "intro_narrative",
      "character_code": "liruf",
      "content": {
        "transcript": "¡Hola amigo! Soy Liruf. 🦕 Hoy encontré algo brillante en la arena. ¡Mira! Son redondas como una pizza pequeñita. ¿Sabes qué son?"
      }
    },
    {
      "type": "tap_action",
      "character_code": "liruf",
      "content": {
        "statement": "🪙 Toca todos los círculos",
        "instruction": "Toca las figuras redondas",
        "items": [
          {"id": "i1", "text": "⭕ Círculo", "isTarget": true},
          {"id": "i2", "text": "🟥 Cuadrado", "isTarget": false},
          {"id": "i3", "text": "🔵 Círculo", "isTarget": true},
          {"id": "i4", "text": "🔺 Triángulo", "isTarget": false}
        ]
      },
      "correct_answer": {"targetIds": ["i1", "i3"]},
      "feedback": {
        "success": "¡Muy bien! Las monedas son redondas como esos círculos. 🎉",
        "error": "Mira bien. Las monedas son como pelotas planas. ¿Cuáles son redondas?"
      }
    },
    {
      "type": "true_false",
      "character_code": "liruf",
      "content": {
        "statement": "🪙 Las monedas tienen forma de círculo",
        "instruction": "¿Es verdad o no?"
      },
      "correct_answer": {"isTrue": true},
      "feedback": {
        "success": "¡Correcto! Las monedas son redondas, como el sol. ☀️",
        "error": "Hmm, piénsalo bien. ¿Cómo es una moneda si la ves desde arriba?"
      }
    },
    {
      "type": "intro_narrative",
      "character_code": "liruf",
      "content": {
        "transcript": "¡Lo lograste! 🌟 Ahora sabes que las monedas son redondas. En la próxima lección descubriremos qué forma tienen los billetes. ¡Hasta pronto, explorador!"
      }
    }
  ],
  "content_en": [
    {
      "type": "intro_narrative",
      "character_code": "liruf",
      "content": {
        "transcript": "Hi friend! I'm Liruf. 🦕 Today I found something shiny in the sand. Look! They're round like tiny pizzas. Do you know what they are?"
      }
    },
    {
      "type": "tap_action",
      "character_code": "liruf",
      "content": {
        "statement": "🪙 Tap all the circles",
        "instruction": "Tap the round shapes",
        "items": [
          {"id": "i1", "text": "⭕ Circle", "isTarget": true},
          {"id": "i2", "text": "🟥 Square", "isTarget": false},
          {"id": "i3", "text": "🔵 Circle", "isTarget": true},
          {"id": "i4", "text": "🔺 Triangle", "isTarget": false}
        ]
      },
      "correct_answer": {"targetIds": ["i1", "i3"]},
      "feedback": {
        "success": "Great job! Coins are round just like those circles. 🎉",
        "error": "Look carefully. Coins are like flat balls. Which ones are round?"
      }
    },
    {
      "type": "true_false",
      "character_code": "liruf",
      "content": {
        "statement": "🪙 Coins have the shape of a circle",
        "instruction": "True or False?"
      },
      "correct_answer": {"isTrue": true},
      "feedback": {
        "success": "Correct! Coins are round, just like the sun. ☀️",
        "error": "Hmm, think again. What does a coin look like when you look at it from above?"
      }
    },
    {
      "type": "intro_narrative",
      "character_code": "liruf",
      "content": {
        "transcript": "You did it! 🌟 Now you know that coins are round. In the next lesson we'll discover what shape bills have. See you soon, explorer!"
      }
    }
  ]
}
=== FIN EJEMPLO ===
"""

def build_system_prompt(adventure_rules: dict, character_info: dict, rules_md_principles: dict) -> str:
    char_name = adventure_rules.get("primary_character", "liruf")
    char = character_info.get(char_name, {})
    lang_rules = adventure_rules.get("language_rules", {})
    content_rules = adventure_rules.get("content_rules", {})
    activity_constraints = adventure_rules.get("activity_constraints", {})
    allowed_types = activity_constraints.get("allowed_types", [])
    ex_range = activity_constraints.get("exercises_per_lesson", {"min": 8, "max": 12})
    min_objectives = activity_constraints.get("required_objectives_min", 3)
    phases_required = activity_constraints.get("required_phases_coverage", [])

    non_negotiables = "\n".join(f"  • {x}" for x in rules_md_principles.get("non_negotiables", []))
    forbidden_principles = "\n".join(f"  • {x}" for x in rules_md_principles.get("forbidden", []))
    cognitive_steps = "\n".join(
        f"  {s['step']}. {s['name']} — {s['purpose']}"
        for s in rules_md_principles.get("cognitive_structure_per_concept", [])
    )
    objectives_list = rules_md_principles.get("required_exercise_objectives", {}).get("objectives", [])
    objectives_formatted = "\n".join(
        f"  • {o['name']} ({o['id']}): usar tipos como {', '.join(o['example_types'])}"
        for o in objectives_list
    )

    return f"""Eres un experto en diseño curricular de educación financiera para niños y jóvenes. Trabajas para LittleFounders, la app que enseña educación financiera de forma progresiva, desde los 5 años hasta la vida adulta.

TU ROL: Generar lecciones de la MÁXIMA calidad pedagógica posible, al nivel de Duolingo o Khan Academy. Cada lección debe ser digna de ser usada en un aula real, sin modificaciones. Cantidad: {ex_range['min']}–{ex_range['max']} ejercicios por lección (NO menos). La lección entera toma 4–8 minutos al estudiante.

==========================================================================
PRINCIPIOS NO NEGOCIABLES (Estándar RULES.md v1.2)
==========================================================================
Cada lección DEBE:
{non_negotiables}

Cada lección NUNCA debe:
{forbidden_principles}

==========================================================================
ESTRUCTURA COGNITIVA DE CADA CONCEPTO NUEVO (las 5 preguntas)
==========================================================================
Todo concepto nuevo en la lección DEBE cubrir estas 5 preguntas mediante los ejercicios (no necesariamente en uno solo — distribuido entre varios):

{cognitive_steps}

Los intro_narrative y los feedback son los principales vehículos para 1, 2 y 5.
Las actividades interactivas cubren 3 y 4.

==========================================================================
DIVERSIDAD DE OBJETIVOS DE EJERCICIO (mínimo {min_objectives} de estos 5 por lección)
==========================================================================
{objectives_formatted}

==========================================================================
PERSONAJE NARRADOR DE ESTA AVENTURA: {char_name.upper()}
==========================================================================
- Nombre: {char.get('name', char_name)}
- Personalidad: {char.get('personality', '')}
- Tono: siempre coherente con la personalidad del personaje
- Aparece en character_code de intro_narratives y en feedback

==========================================================================
REGLAS DE LENGUAJE (ABSOLUTAS - NO NEGOCIABLES)
==========================================================================
- Máximo {lang_rules.get('max_words_per_sentence', 15)} palabras por oración
- Estilo: {lang_rules.get('required_style', 'Claro y apropiado para la edad')}
- Emojis: {"OBLIGATORIO en cada opción y en los narrativos" if lang_rules.get('use_emojis') else "No usar emojis"}
- Palabras PROHIBIDAS: {', '.join(lang_rules.get('forbidden_words', []))}
- Términos técnicos: SIEMPRE definirlos en contexto la primera vez que aparecen. Jerga sin definición = ERROR GRAVE.

==========================================================================
TIPOS DE ACTIVIDAD PERMITIDOS EN ESTA AVENTURA
==========================================================================
{json.dumps(allowed_types, ensure_ascii=False, indent=2)}

==========================================================================
CALIDAD DEL FEEDBACK (crítico)
==========================================================================
Feedback de error:
  • {rules_md_principles.get('feedback_quality', {}).get('error_feedback_must', '')}
  • Tono: {content_rules.get('feedback_error_tone', 'Constructivo')}
  • NUNCA decir solo "incorrecto", "equivocado" o "mal". Siempre explicar CONCEPTUALMENTE por qué.

Feedback de éxito:
  • {rules_md_principles.get('feedback_quality', {}).get('success_feedback_must', '')}
  • Tono: {content_rules.get('feedback_success_tone', 'Motivador')}
  • Reforzar el concepto aprendido citándolo explícitamente. NO solo "¡Bien!".

==========================================================================
ESTRUCTURA DE LECCIÓN (DUOLINGO-STYLE, {ex_range['min']}–{ex_range['max']} EJERCICIOS)
==========================================================================
La lección debe combinar estas fases. Ejemplo de secuencia completa:

1. CONECTAR (intro_narrative): El personaje presenta el escenario. 1 bloque.
2. ¿POR QUÉ IMPORTA? (intro_narrative O multiple_choice reflexivo): Motivación del concepto. 1 bloque.
3. ¿QUÉ ES? (intro_narrative O matching_pairs O classification): Definición operativa. 1–2 bloques.
4. ¿CÓMO SE USA? (multiple_choice, tap_action, math_challenge, etc.): Aplicación guiada. 2–3 bloques.
5. PRACTICAR (actividades varias cumpliendo objetivos Calcular/Comparar/Decidir): 2–4 bloques.
6. REFORZAR (variación del concepto con ejercicio distinto a los previos): 1–2 bloques.
7. ¿QUÉ ERROR EVITAR? (true_false con malentendido común O spot_trap): 1 bloque.
8. APLICAR EN CONTEXTO NUEVO (story_mode O roleplay_chat O budget_builder): 1–2 bloques para A3+.
9. ¿CON QUÉ SE RELACIONA? (intro_narrative de conexión con conceptos previos/siguientes): 1 bloque para A3+.
10. CERRAR (intro_narrative): El personaje celebra, resume en 1 oración, genera expectativa.

Fases obligatorias para esta aventura: {', '.join(phases_required) if phases_required else 'todas las anteriores'}

CALIDAD EXIGIDA:
- Foco: UN concepto central específico. Pueden derivarse sub-ideas, pero todo gira en torno al concepto central.
- Las opciones de respuesta deben ser CLARAMENTE distintas entre sí. Sin ambigüedad.
- Los escenarios deben ser CONCRETOS y COTIDIANOS para la edad objetivo.
- Nunca usar "Lorem ipsum" ni placeholders. Todo contenido real y pedagógico.
- Las traducciones al inglés deben ser NATURALES, no literales (adaptación cultural cuando aplique).
- Los IDs de opciones/items deben ser únicos dentro de la lección (i1, i2, a, b, c, p1, p2, s1, s2, etc.).
- Evitar dos ejercicios idénticos del mismo tipo seguidos (ej: no dos true_false consecutivos a menos que uno sea "¿qué error evitar?").
- Al menos 1 ejercicio debe forzar al estudiante a DECIDIR entre alternativas con criterios (no solo reconocer).

==========================================================================
FORMATO DE SALIDA
==========================================================================
- Responder ÚNICAMENTE con el JSON de la lección.
- Sin markdown, sin bloques ```, sin explicaciones adicionales.
- El JSON debe ser válido y parseable directamente.
- Usar comillas dobles siempre.
- content_es y content_en: MISMA cantidad de ejercicios, MISMOS tipos, MISMO orden.

{LESSON_JSON_SCHEMA}

{GOLD_STANDARD_EXAMPLE}
"""

def build_lesson_prompt(
    adventure: int,
    saga: int,
    topic_data: dict,
    lesson_blueprint: dict,
    lesson_num: int,
    adventure_rules: dict,
) -> str:
    topic_concept = topic_data.get("concept_es", topic_data.get("concept", ""))
    topic_vocab = topic_data.get("key_vocabulary_es", [])
    topic_prior = topic_data.get("prior_knowledge_es", "Lo aprendido en lecciones anteriores")
    topic_objective = topic_data.get("learning_objective_es", "")
    topic_title = topic_data.get("title_es", "")
    topic_number = topic_data.get("topic_number", 1)

    activity_sequence = lesson_blueprint.get("activity_sequence", ["intro_narrative", "multiple_choice", "true_false", "intro_narrative"])
    micro_objective = lesson_blueprint.get("micro_objective_es", f"Aprender sobre {topic_title}")
    scenario = lesson_blueprint.get("scenario_es", f"Liruf está en una aventura relacionada con {topic_concept}")
    key_interaction = lesson_blueprint.get("key_interaction_es", "Actividad principal del concepto")
    character = adventure_rules.get("primary_character", "liruf")

    age_range = adventure_rules.get("age_range", "5-7")
    lang_rules = adventure_rules.get("language_rules", {})
    activity_constraints = adventure_rules.get("activity_constraints", {})
    use_emojis = lang_rules.get("use_emojis", False)
    max_words = lang_rules.get("max_words_per_sentence", 15)
    ex_range = activity_constraints.get("exercises_per_lesson", {"min": 8, "max": 12})
    min_objectives = activity_constraints.get("required_objectives_min", 3)

    return f"""Genera la siguiente lección para LittleFounders con calidad Duolingo.

DATOS DE LA LECCIÓN:
- lesson_code: "{adventure}-{saga}-{topic_number}-{lesson_num}"
- adventure_level: {adventure}
- saga_level: {saga}
- topic_level: {topic_number}
- lesson_number: {lesson_num}
- age_rate: "{age_range}"

CONTEXTO DEL TÓPICO:
- Tópico: "{topic_title}"
- Concepto completo del tópico: "{topic_concept}"
- Objetivo general del tópico: "{topic_objective}"
- Conocimiento previo del estudiante: "{topic_prior}"
- Vocabulario clave del tópico: {json.dumps(topic_vocab, ensure_ascii=False)}

ESTA LECCIÓN ESPECÍFICA:
- Objetivo micro (LO QUE SE APRENDE EN ESTA LECCIÓN ÚNICAMENTE): "{micro_objective}"
- Escenario / contexto narrativo: "{scenario}"
- Interacción principal: "{key_interaction}"
- Secuencia de actividades sugerida (puedes expandirla): {json.dumps(activity_sequence)}
- Personaje narrador: "{character}"

=== REQUISITOS CUANTITATIVOS (NO negociables) ===
1. CANTIDAD DE EJERCICIOS: mínimo {ex_range['min']}, máximo {ex_range['max']}. Menos = rechazo.
2. DIVERSIDAD DE OBJETIVOS: mínimo {min_objectives} objetivos distintos cubiertos (Reconocer, Calcular, Comparar, Decidir, Aplicar).
3. La lección DEBE empezar con intro_narrative (Conectar) y terminar con intro_narrative (Cerrar).
4. Al menos UN ejercicio debe requerir DECISIÓN con criterios múltiples (no solo reconocimiento).
5. Al menos UN ejercicio debe cubrir "¿qué error evitar?" — un malentendido común del concepto.

=== REQUISITOS CUALITATIVOS (NO negociables) ===
6. Esta lección enseña la micro-habilidad: "{micro_objective}". Todo contenido gira en torno a esto.
7. Oraciones de MÁXIMO {max_words} palabras. Sin excepciones.
8. {"OBLIGATORIO usar emojis en opciones y narrativos." if use_emojis else "NO usar emojis."}
9. Feedback de ERROR: NUNCA dice solo "incorrecto" o "equivocado". SIEMPRE explica CONCEPTUALMENTE por qué la respuesta elegida no funciona, con una pista orientativa.
10. Feedback de SUCCESS: cita el concepto explícitamente, no solo "¡Bien!".
11. Términos técnicos: si aparece cualquiera, DEFINIRLO en contexto la primera vez (una frase que lo explique).
12. El cierre (último intro_narrative) celebra el logro Y menciona qué viene después.
13. Generar TANTO content_es COMO content_en. El inglés debe sonar natural, no traducción literal.
14. Los IDs de opciones/items deben ser únicos dentro de la lección (i1, i2, a, b, c, p1, etc.).
15. content_es y content_en: MISMA cantidad de ejercicios, MISMOS tipos, MISMO orden.

=== ESTRUCTURA COGNITIVA EXIGIDA ===
La lección debe cubrir estas 5 preguntas sobre el concepto (distribuidas entre los ejercicios):
  a. ¿POR QUÉ IMPORTA? → en intro_narrative o pregunta reflexiva
  b. ¿QUÉ ES? → en definición explícita o matching/classification
  c. ¿CÓMO SE USA? → en la actividad principal de aplicación
  d. ¿QUÉ ERROR EVITAR? → en true_false o spot_trap sobre malentendido común
  e. ¿CON QUÉ SE RELACIONA? → en intro_narrative de conexión con otros conceptos (A3+)

Genera el JSON completo de la lección ahora:"""


# ─── Llamada a la API de DeepSeek ────────────────────────────────────────────

def call_deepseek(
    system_prompt: str,
    user_prompt: str,
    model: str = "deepseek-chat",
    api_key: str = "",
    max_retries: int = 3,
) -> str | None:
    """Llama a la API de DeepSeek y retorna el contenido de la respuesta."""
    import urllib.error
    import urllib.request

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 8192,
        "stream": False,
    }

    data = json.dumps(payload).encode("utf-8")

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(DEEPSEEK_API_URL, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=300) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            if e.code == 429:
                wait_time = 30 * attempt
                print(f"      Rate limit. Esperando {wait_time}s...")
                time.sleep(wait_time)
            elif e.code == 402:
                print("      ❌ Sin créditos en DeepSeek. Recarga tu cuenta.")
                sys.exit(1)
            else:
                print(f"      HTTP {e.code}: {error_body[:200]}")
                if attempt == max_retries:
                    return None
                time.sleep(5 * attempt)
        except Exception as e:
            print(f"      Error (intento {attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                return None
            time.sleep(5 * attempt)

    return None


def parse_lesson_json(raw_content: str) -> dict | None:
    """Extrae y parsea el JSON de la respuesta del modelo."""
    # Limpiar posibles markdown bloques
    content = raw_content.strip()

    # Remover bloques ```json ... ```
    content = re.sub(r"```(?:json)?\s*", "", content)
    content = re.sub(r"```\s*$", "", content, flags=re.MULTILINE)
    content = content.strip()

    # Intentar parsear directamente
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Buscar el primer objeto JSON válido
    start = content.find("{")
    end = content.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(content[start:end])
        except json.JSONDecodeError as e:
            print(f"      JSON inválido: {e}")
            print(f"      Fragmento problemático: {content[start:start+200]}...")
            return None

    return None


# ─── Gestión de Salida ───────────────────────────────────────────────────────

def get_output_path(lesson_code: str) -> Path:
    """Retorna la ruta de salida para un lesson_code dado."""
    parts = lesson_code.split("-")
    if len(parts) != 4:
        raise ValueError(f"lesson_code inválido: {lesson_code}")
    adv, saga, topic, lesson = parts
    path = OUTPUT_DIR / f"adventure_{adv}" / f"saga_{saga}" / f"topic_{topic}"
    path.mkdir(parents=True, exist_ok=True)
    return path / f"lesson_{lesson}.json"


def lesson_exists(lesson_code: str) -> bool:
    """Verifica si una lección ya fue generada."""
    try:
        return get_output_path(lesson_code).exists()
    except ValueError:
        return False


def save_lesson(lesson_data: dict) -> Path:
    """Guarda una lección en el sistema de archivos."""
    code = lesson_data["lesson_code"]
    path = get_output_path(code)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(lesson_data, f, ensure_ascii=False, indent=2)
    return path


def update_manifest(lesson_data: dict):
    """Agrega o actualiza una entrada en el manifest.json con file lock para procesos paralelos."""
    import fcntl
    manifest_path = OUTPUT_DIR / "manifest.json"
    lock_path = OUTPUT_DIR / "manifest.lock"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    code = lesson_data["lesson_code"]
    adv, saga, topic, lesson = code.split("-")
    file_path = f"adventure_{adv}/saga_{saga}/topic_{topic}/lesson_{lesson}.json"
    entry = {
        "lesson_code": code,
        "file_path": file_path,
        "title_es": lesson_data.get("title_es", ""),
        "adventure_level": lesson_data.get("adventure_level"),
        "saga_level": lesson_data.get("saga_level"),
        "topic_level": lesson_data.get("topic_level"),
        "lesson_number": lesson_data.get("lesson_number"),
    }

    with open(lock_path, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            if manifest_path.exists():
                with open(manifest_path, encoding="utf-8") as f:
                    manifest = json.load(f)
            else:
                manifest = {"total_lessons": 0, "generated_at": datetime.now().isoformat(), "lessons_index": []}

            existing = next((i for i, x in enumerate(manifest["lessons_index"]) if x["lesson_code"] == code), None)
            if existing is not None:
                manifest["lessons_index"][existing] = entry
            else:
                manifest["lessons_index"].append(entry)

            manifest["total_lessons"] = len(manifest["lessons_index"])
            manifest["last_updated"] = datetime.now().isoformat()

            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


# ─── Lógica de Generación ────────────────────────────────────────────────────

def generate_lesson(
    adventure_num: int,
    saga_num: int,
    topic_data: dict,
    lesson_blueprint: dict,
    lesson_num: int,
    rules: dict,
    model: str,
    api_key: str,
    max_retries: int,
    dry_run: bool = False,
) -> bool:
    """Genera y guarda una lección. Retorna True si tuvo éxito."""
    topic_number = topic_data["topic_number"]
    lesson_code = f"{adventure_num}-{saga_num}-{topic_number}-{lesson_num}"

    if lesson_exists(lesson_code):
        print(f"  ⏭️  {lesson_code} — ya existe, omitiendo")
        return True

    micro_obj = lesson_blueprint.get("micro_objective_es", "Aprender el concepto")
    print(f"  🎯 {lesson_code} — {micro_obj[:60]}...")

    if dry_run:
        print(f"       [DRY RUN] Se generaría con: {model}")
        return True

    adventure_rules = rules["adventures"][str(adventure_num)]
    character_info = rules["characters"]
    rules_md_principles = rules.get("rules_md_principles", {})

    system_prompt = build_system_prompt(adventure_rules, character_info, rules_md_principles)
    user_prompt = build_lesson_prompt(
        adventure_num, saga_num, topic_data, lesson_blueprint, lesson_num, adventure_rules
    )

    raw_content = call_deepseek(system_prompt, user_prompt, model, api_key, max_retries)
    if not raw_content:
        print("       ❌ Sin respuesta de la API")
        return False

    lesson_data = parse_lesson_json(raw_content)
    if not lesson_data:
        print("       ❌ JSON inválido en respuesta")
        # Guardar la respuesta raw para debug
        debug_path = OUTPUT_DIR / "debug" / f"{lesson_code}_raw.txt"
        debug_path.parent.mkdir(parents=True, exist_ok=True)
        debug_path.write_text(raw_content, encoding="utf-8")
        return False

    # Asegurar campos críticos
    lesson_data["lesson_code"] = lesson_code
    lesson_data["adventure_level"] = adventure_num
    lesson_data["saga_level"] = saga_num
    lesson_data["topic_level"] = topic_number
    lesson_data["lesson_number"] = lesson_num
    lesson_data["age_rate"] = adventure_rules.get("age_range", adventure_rules.get("age_rate", ""))

    saved_path = save_lesson(lesson_data)
    update_manifest(lesson_data)
    print(f"       ✅ Guardado en {saved_path.relative_to(BASE_DIR.parent)}")
    return True


def generate_topic(
    adventure_num: int,
    saga_data: dict,
    topic_data: dict,
    rules: dict,
    model: str,
    api_key: str,
    delay: float,
    max_retries: int,
    dry_run: bool,
) -> tuple[int, int]:
    """Genera todas las lecciones de un topic. Retorna (éxitos, fallos)."""
    topic_number = topic_data["topic_number"]
    topic_title = topic_data.get("title_es", f"Topic {topic_number}")
    saga_num = saga_data["saga_number"]
    lessons_count = topic_data.get("lessons_count", 9)
    lesson_blueprints = topic_data.get("lesson_blueprints", [])

    print(f"\n  📖 Topic {topic_number}: {topic_title} ({lessons_count} lecciones)")

    success = 0
    failure = 0

    for lesson_num in range(1, lessons_count + 1):
        # Buscar blueprint específico o generar uno genérico
        blueprint = next((b for b in lesson_blueprints if b.get("lesson_number") == lesson_num), {})

        # Si no hay blueprint, crear uno básico basado en el concepto del topic
        if not blueprint:
            activity_constraints = rules["adventures"][str(adventure_num)].get("activity_constraints", {})
            allowed = activity_constraints.get("allowed_types", ["intro_narrative", "multiple_choice", "true_false"])
            # Rotar actividades de forma inteligente
            cycle_idx = (lesson_num - 1) % 4
            activity_sequences = [
                ["intro_narrative", "tap_action", "true_false", "intro_narrative"],
                ["intro_narrative", "multiple_choice", "matching_pairs", "intro_narrative"],
                ["intro_narrative", "true_false", "multiple_choice", "intro_narrative"],
                ["intro_narrative", "matching_pairs", "tap_action", "intro_narrative"],
            ]
            # Filtrar solo tipos permitidos
            sequence = [t for t in activity_sequences[cycle_idx] if t in allowed or t == "intro_narrative"]
            if len(sequence) < 3:
                sequence = ["intro_narrative", "multiple_choice", "true_false", "intro_narrative"]

            blueprint = {
                "lesson_number": lesson_num,
                "micro_objective_es": f"Profundizar en: {topic_data.get('concept_es', topic_title)} (lección {lesson_num} de {lessons_count})",
                "activity_sequence": sequence,
                "scenario_es": f"Liruf continúa explorando el concepto de {topic_title}",
                "key_interaction_es": f"Practicar el concepto de {topic_title} desde una nueva perspectiva",
            }

        ok = generate_lesson(
            adventure_num, saga_num, topic_data, blueprint, lesson_num,
            rules, model, api_key, max_retries, dry_run
        )

        if ok:
            success += 1
        else:
            failure += 1

        if not dry_run and lesson_num < lessons_count:
            time.sleep(delay)

    return success, failure


def generate_saga(
    adventure_data: dict,
    saga_data: dict,
    rules: dict,
    model: str,
    api_key: str,
    delay: float,
    max_retries: int,
    dry_run: bool,
    topic_filter: int | None = None,
) -> tuple[int, int]:
    """Genera todas las lecciones de una saga."""
    adventure_num = adventure_data["adventure"]
    saga_num = saga_data["saga_number"]
    saga_title = saga_data.get("title_es", f"Saga {saga_num}")
    topics_target = saga_data.get("lessons_target", 96)

    print(f"\n{'='*60}")
    print(f"🗺️  Saga {saga_num}: {saga_title} (objetivo: {topics_target} lecciones)")
    print(f"{'='*60}")

    total_success = 0
    total_failure = 0

    for topic_data in saga_data["topics"]:
        if topic_filter and topic_data["topic_number"] != topic_filter:
            continue

        s, f = generate_topic(
            adventure_num, saga_data, topic_data, rules,
            model, api_key, delay, max_retries, dry_run
        )
        total_success += s
        total_failure += f

    return total_success, total_failure


# ─── CLI Principal ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="LittleFounders Lesson Generator")
    parser.add_argument("--adventure", type=int, required=True, help="Número de aventura (1-6)")
    parser.add_argument("--saga", type=int, help="Número de saga (opcional)")
    parser.add_argument("--topic", type=int, help="Número de topic (opcional)")
    parser.add_argument("--model", default="deepseek-chat", choices=["deepseek-chat", "deepseek-reasoner"],
                        help="Modelo DeepSeek a usar")
    parser.add_argument("--delay", type=float, default=1.5, help="Segundos entre llamadas API")
    parser.add_argument("--max-retries", type=int, default=3, help="Reintentos por lección")
    parser.add_argument("--dry-run", action="store_true", help="Ver plan sin llamar a la API")
    parser.add_argument("--resume", action="store_true", help="Saltar lecciones ya generadas")
    args = parser.parse_args()

    # API Key
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key and not args.dry_run:
        print("❌ Falta DEEPSEEK_API_KEY en variables de entorno.")
        print("   Ejecuta: export DEEPSEEK_API_KEY=sk-...")
        sys.exit(1)

    print("=" * 60)
    print("🏫 LittleFounders Lesson Factory")
    print("=" * 60)
    print(f"📚 Aventura: {args.adventure}")
    if args.saga:
        print(f"🗺️  Saga: {args.saga}")
    if args.topic:
        print(f"📖 Topic: {args.topic}")
    print(f"🤖 Modelo: {args.model}")
    print(f"⏱️  Delay entre llamadas: {args.delay}s")
    print(f"🔄 Max reintentos: {args.max_retries}")
    print(f"🏃 Dry run: {args.dry_run}")
    print(f"📁 Salida: {OUTPUT_DIR}")
    print()

    # Cargar datos
    rules = load_rules()
    adventure_data = load_adventure(args.adventure)

    start_time = time.time()
    total_success = 0
    total_failure = 0

    for saga_data in adventure_data["sagas"]:
        if args.saga and saga_data["saga_number"] != args.saga:
            continue

        s, f = generate_saga(
            adventure_data, saga_data, rules,
            args.model, api_key, args.delay, args.max_retries, args.dry_run,
            topic_filter=args.topic,
        )
        total_success += s
        total_failure += f

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"✅ Completado en {elapsed:.1f}s")
    print(f"   Generadas: {total_success}")
    print(f"   Fallidas:  {total_failure}")
    if not args.dry_run:
        manifest_path = OUTPUT_DIR / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path) as f:
                manifest = json.load(f)
            print(f"   Total en manifest: {manifest['total_lessons']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
