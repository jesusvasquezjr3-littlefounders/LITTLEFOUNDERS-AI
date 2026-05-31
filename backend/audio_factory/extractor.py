"""
extractor.py — Extrae los fragmentos de texto a narrar de un ejercicio.

Usa DeepSeek para analizar el JSON del ejercicio y determinar qué texto
corresponde a cada target_field, sin inventar contenido nuevo.

Los campos de feedback (success/error) se extraen directamente del JSON
sin pasar por DeepSeek (siempre están en exercise.feedback.success/error).
"""

import json

from openai import OpenAI

import config

# Cliente DeepSeek (API compatible con OpenAI)
_client = OpenAI(
    api_key=config.DEEPSEEK_API_KEY,
    base_url=config.DEEPSEEK_BASE_URL,
)

# Prompt base del sistema
_SYSTEM_PROMPT = """You are a narration text extractor for "Little Founders", a financial literacy educational app for kids (ages 8-14).

Your task is to analyze an exercise JSON and extract the exact text that should be narrated aloud by the character voice.

RULES:
1. Extract ONLY text that already exists in the exercise JSON — never invent new content.
2. Return a flat JSON object mapping target_field → text_to_narrate.
3. Do NOT include option IDs, image URLs, numeric IDs, technical keys, or metadata.
4. If a field has no narration-worthy text, simply omit it from the output.
5. Keep the EXACT original text without paraphrasing or summarizing.
6. Return ONLY valid JSON, no markdown, no explanation.

TARGET FIELDS and what they represent:
- "main": General narration, character introduction, or transcript text (used in intro_narrative, story_mode, etc.)
- "question": The question being asked to the student
- "statement": A statement the student must evaluate (true/false exercises)
- "instruction": Instructions telling the student what to do

IMPORTANT: Do NOT extract feedback_success or feedback_error — those are handled separately.
"""

# Mapeo de tipo de ejercicio → campos relevantes en content
# Esto ayuda al modelo a saber dónde buscar el texto principal
_TYPE_HINTS: dict[str, str] = {
    "intro_narrative": "The main narration text is usually in content.transcript",
    "multiple_choice": "The question is in content.question; instructions in content.instruction",
    "true_false": "The statement is in content.statement; instructions in content.instruction",
    "tap_action": "The statement to tap/evaluate is in content.statement",
    "fill_blank": "Instructions are in content.instruction",
    "drag_drop": "Instructions are in content.instruction",
    "match_pairs": "Instructions are in content.instruction",
    "matching_pairs": "Instructions are in content.instruction",
    "classification": "Instructions are in content.instruction",
    "sorting_buckets": "Instructions are in content.instruction",
    "sequencing": "Instructions are in content.instruction",
    "story_mode": "The narrative text is in content.pages[*].text (extract the first page or intro text as 'main')",
    "math_challenge": "The question is in content.question; instructions in content.instruction",
    "word_scramble": "Instructions are in content.instruction; hint in content.hint",
    "estimation_slider": "The question is in content.question; instructions in content.instruction",
    "image_hotspot": "Instructions are in content.instruction",
    "comparison": "Instructions are in content.instruction",
    "concept_builder": "Instructions are in content.instruction",
    "roleplay_chat": "Context/intro is in content.context",
    "case_study": "The main narrative is in content.question or content.instruction",
    "case_real": "The main narrative is in content.question or content.instruction",
    "decision_challenge": "The question is in content.question",
    "decision_matrix": "Instructions are in content.instruction",
    "quiz_battle": "Instructions are in content.instruction",
}


def extract_text_segments(exercise: dict, lang: str) -> dict[str, str]:
    """
    Analiza el ejercicio y devuelve {target_field: texto_a_narrar}.

    El texto ya viene en el idioma correcto porque el caller obtiene el
    ejercicio desde la API con ?lang={lang}.

    Args:
        exercise: Objeto de ejercicio tal como lo devuelve el lesson engine API.
        lang: Código de idioma ('es' o 'en') — usado solo como contexto para el modelo.

    Returns:
        Dict de target_field → texto. Solo incluye campos con texto real.
        Siempre incluye feedback_success/feedback_error si existen en el ejercicio.
    """
    exercise_type: str = exercise.get("type", "unknown")
    content: dict = exercise.get("content", {})
    feedback = exercise.get("feedback")  # puede ser dict o None

    # ── 1. Extraer feedback directamente (no necesita DeepSeek) ────────────
    result: dict = {}

    if feedback and isinstance(feedback, dict):
        if feedback.get("success") and isinstance(feedback["success"], str):
            result["feedback_success"] = feedback["success"].strip()
        if feedback.get("error") and isinstance(feedback["error"], str):
            result["feedback_error"] = feedback["error"].strip()

    # ── 2. Llamada a DeepSeek para extraer main/question/statement/instruction ──
    type_hint = _TYPE_HINTS.get(exercise_type, "")
    user_message = f"""Exercise type: {exercise_type}
Language of the text: {lang}
{f'Hint: {type_hint}' if type_hint else ''}

Exercise JSON:
{json.dumps(content, ensure_ascii=False, indent=2)}

Extract the narration text for each applicable target_field (main, question, statement, instruction).
Return ONLY a JSON object."""

    try:
        response = _client.chat.completions.create(
            model=config.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.0,       # Determinista — no queremos creatividad aquí
            max_tokens=512,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        extracted: dict = json.loads(raw)

            # Filtrar solo campos válidos y con texto no vacío
        valid_content_fields = {"main", "question", "statement", "instruction"}
        for field, text in extracted.items():
            if field in valid_content_fields and isinstance(text, str) and text.strip():
                result[field] = text.strip()

    except json.JSONDecodeError as e:
        print(f"    [extractor] ⚠ JSON inválido de DeepSeek para tipo '{exercise_type}': {e}")
    except Exception as e:
        print(f"    [extractor] ⚠ Error al llamar DeepSeek para tipo '{exercise_type}': {e}")
        # Continúa — solo se pierde la narración de contenido; el feedback ya fue extraído

    return result
