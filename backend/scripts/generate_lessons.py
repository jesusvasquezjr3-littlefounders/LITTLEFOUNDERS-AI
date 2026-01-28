"""
LittleFounders - AI Lesson Generator
Uses Google Gemini API to generate lesson content from curriculum.yaml

Usage:
    python generate_lessons.py --saga 1-1 --topic 1-1-1
    python generate_lessons.py --saga 1-1 --all
"""

import yaml
import json
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai package not installed. Run: pip install google-generativeai")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    # Load .env from backend directory
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # python-dotenv is optional, can use system env vars

# Configuration
CURRICULUM_PATH = Path(__file__).parent.parent / "lesson_engine" / "curriculum.yaml"
OUTPUT_DIR = Path(__file__).parent.parent / "generated_lessons"
GEMINI_MODEL = "gemini-2.0-flash"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_curriculum() -> Dict:
    """Load the curriculum YAML file."""
    with open(CURRICULUM_PATH, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def get_topic_info(curriculum: Dict, topic_code: str) -> Optional[Dict]:
    """Find topic info by code (e.g., '1-1-1')."""
    for adventure in curriculum.get('adventures', []):
        for saga in adventure.get('sagas', []):
            for topic in saga.get('topics', []):
                if topic.get('code') == topic_code:
                    return {
                        'topic': topic,
                        'saga': saga,
                        'adventure': adventure
                    }
    return None


def get_saga_topics(curriculum: Dict, saga_code: str) -> List[Dict]:
    """Get all topics in a saga."""
    for adventure in curriculum.get('adventures', []):
        for saga in adventure.get('sagas', []):
            if saga.get('code') == saga_code:
                return [
                    {
                        'topic': topic,
                        'saga': saga,
                        'adventure': adventure
                    }
                    for topic in saga.get('topics', [])
                ]
    return []


def build_prompt(topic_info: Dict, lesson_number: int) -> str:
    """Build the Gemini prompt for lesson generation."""
    topic = topic_info['topic']
    saga = topic_info['saga']
    adventure = topic_info['adventure']
    
    exercise_types = topic.get('exercise_types', ['intro_narrative', 'multiple_choice'])
    
    prompt = f"""Eres un experto en educación financiera para niños y diseñador instruccional.
Tu tarea es crear una lección interactiva para la plataforma LittleFounders.

IMPORTANTE: Debes generar JSON que sea 100% compatible con el frontend. 
Sigue EXACTAMENTE los schemas proporcionados abajo.

# CONTEXTO DE LA PLATAFORMA
- Metodología: Micro-Learning (3-5 minutos por lección)
- Estilo: Gamificado tipo Duolingo  
- Target: Niños de {adventure['age_range']} años que se aburren fácilmente
- Personajes:
  - liruf: Dinosaurio verde, amigable, entusiasta, EXPLICA conceptos
  - dina: Dinosauria naranja, curiosa, hace PREGUNTAS, reacciona

# INFORMACIÓN DE LA LECCIÓN
- Aventura: {adventure['name']}
- Saga: {saga['name']} - {saga.get('subtitle', '')}
- Tema: {topic['name']}
- Descripción: {topic['description']}
- Lección #{lesson_number} de {topic.get('lessons_count', 5)}

# TIPOS DE EJERCICIOS DISPONIBLES
{json.dumps(exercise_types, indent=2)}

═══════════════════════════════════════════════════════════════
                    SCHEMAS DE EJERCICIOS
   ⚠️ SIGUE ESTOS SCHEMAS EXACTAMENTE - SIN VARIACIONES ⚠️
═══════════════════════════════════════════════════════════════

## 1️⃣ INTRO_NARRATIVE (Diálogo narrativo)
El personaje habla con el niño. No requiere interacción.

{{
  "type": "intro_narrative",
  "order_index": <número>,
  "character_code": "liruf" | "dina",
  "content": {{
    "transcript": "<Texto del diálogo, máximo 100 caracteres, emoji solo al final>"
  }},
  "feedback": {{"success": "¡Genial!"}},
  "points": 2
}}

─────────────────────────────────────────────────────────────

## 2️⃣ MULTIPLE_CHOICE (Selección múltiple)
Pregunta con 3 opciones, solo 1 correcta.
⚠️ IMPORTANTE: Las opciones NO deben tener emojis al inicio, solo texto limpio.

{{
  "type": "multiple_choice",
  "order_index": <número>,
  "character_code": "liruf" | "dina",
  "content": {{
    "question": "<Pregunta clara y corta, emoji al final> 🤔",
    "options": [
      {{"id": "a", "text": "Con picos como estrella"}},
      {{"id": "b", "text": "Redonda como un círculo"}},  
      {{"id": "c", "text": "Cuadrada como una caja"}}
    ]
  }},
  "correct_answer": {{
    "correctOptionId": "a" | "b" | "c"
  }},
  "feedback": {{
    "success": "<Mensaje de éxito> ✅",
    "error": "<Mensaje de error amigable> 💭"
  }},
  "points": 10
}}

─────────────────────────────────────────────────────────────

## 3️⃣ TAP_ACTION (Toca los correctos)
El niño debe tocar/seleccionar los items correctos.

{{
  "type": "tap_action",
  "order_index": <número>,
  "character_code": "liruf" | "dina",
  "content": {{
    "instruction": "<Instrucción clara: qué debe tocar>",
    "items": [
      {{"id": "t1", "emoji": "🪙", "isTarget": true}},
      {{"id": "t2", "emoji": "📄", "isTarget": false}},
      {{"id": "t3", "emoji": "🪙", "isTarget": true}},
      {{"id": "t4", "emoji": "💵", "isTarget": false}},
      {{"id": "t5", "emoji": "🪙", "isTarget": true}},
      {{"id": "t6", "emoji": "📜", "isTarget": false}}
    ]
  }},
  "feedback": {{
    "success": "<Mensaje de éxito>",
    "error": "<Mensaje de error amigable>"
  }},
  "points": 10
}}

NOTAS tap_action:
- items: Array de 4-6 elementos
- Cada item DEBE tener: id (string único), emoji (un emoji), isTarget (boolean)
- isTarget: true = el niño debe tocarlo, false = no debe tocarlo
- instruction: Describe claramente QUÉ debe tocar

─────────────────────────────────────────────────────────────

## 4️⃣ CLASSIFICATION (Clasificar en categorías)
El niño asigna cada item a una de 2 categorías.

{{
  "type": "classification",
  "order_index": <número>,
  "character_code": "liruf" | "dina",
  "content": {{
    "instruction": "<Instrucción: cómo clasificar los items>",
    "categories": [
      {{"id": "cat_a", "label": "Categoría A 🏷️"}},
      {{"id": "cat_b", "label": "Categoría B 🏷️"}}
    ],
    "items": [
      {{"id": "c1", "text": "🪙 Moneda dorada"}},
      {{"id": "c2", "text": "💵 Billete verde"}},
      {{"id": "c3", "text": "🪙 Moneda plateada"}},
      {{"id": "c4", "text": "💴 Billete amarillo"}}
    ]
  }},
  "correct_answer": {{
    "classifications": {{
      "c1": "cat_a",
      "c2": "cat_b",
      "c3": "cat_a",
      "c4": "cat_b"
    }}
  }},
  "feedback": {{
    "success": "<Mensaje de éxito>",
    "error": "<Mensaje de error amigable>"
  }},
  "points": 15
}}

NOTAS classification:
- categories: Exactamente 2 categorías con id y label
- items: Array de 3-5 items, cada uno con id y text (texto visible)
- correct_answer.classifications: Objeto que mapea cada item.id a su category.id correcto
- text de items: Incluye emoji + descripción corta para que sea visible

═══════════════════════════════════════════════════════════════
                    ESTRUCTURA DE LECCIÓN
═══════════════════════════════════════════════════════════════

Una lección de 3-5 minutos debe tener:
1. 2 intro_narrative (saludo + introducción) 
2. 3-4 ejercicios interactivos (mix de los tipos disponibles)
3. 1 intro_narrative final (felicitación/cierre)

TOTAL: 6-7 ejercicios

═══════════════════════════════════════════════════════════════
                    OUTPUT REQUERIDO
═══════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un JSON válido:

```json
{{
  "lesson": {{
    "code": "{topic['code']}-L{lesson_number}",
    "title": "<Título atractivo con emoji>",
    "description": "<Descripción breve de 1 línea>",
    "topic_code": "{topic['code']}",
    "difficulty": "Fácil",
    "estimated_duration_seconds": 240,
    "points_reward": 50,
    "xp_reward": 25
  }},
  "exercises": [
    <Array de ejercicios siguiendo los schemas de arriba>
  ]
}}
```

═══════════════════════════════════════════════════════════════
                    CHECKLIST FINAL
═══════════════════════════════════════════════════════════════

Antes de responder, verifica:
☐ JSON válido (sin errores de sintaxis)
☐ 6-7 ejercicios en total
☐ Solo 2 intro_narrative al inicio, 1 al final
☐ Cada transcript menor a 100 caracteres  
☐ tap_action items tienen: id, emoji, isTarget
☐ classification tiene correct_answer.classifications como objeto
☐ classification items tienen "text" (no "emoji")
☐ multiple_choice tiene correct_answer.correctOptionId
☐ ⚠️ EMOJIS SOLO AL FINAL de oraciones, NUNCA al inicio
☐ ⚠️ Opciones de multiple_choice son TEXTO LIMPIO sin emojis
☐ Lenguaje apropiado para niños de {adventure['age_range']} años

¡Genera la lección ahora!
"""
    return prompt


def generate_lesson(topic_info: Dict, lesson_number: int) -> Optional[Dict]:
    """Generate a single lesson using Google Gemini API."""
    # Configure Gemini API from environment variable
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("❌ Error: GEMINI_API_KEY not found in environment")
        print("   Add it to backend/.env or set: export GEMINI_API_KEY='your-key'")
        return None
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)
    
    prompt = build_prompt(topic_info, lesson_number)
    
    try:
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Try to parse JSON (handle markdown code blocks)
        if response_text.startswith('```'):
            # Remove markdown code block
            lines = response_text.split('\n')
            json_lines = []
            in_json = False
            for line in lines:
                if line.startswith('```json'):
                    in_json = True
                    continue
                elif line.startswith('```'):
                    in_json = False
                    continue
                if in_json:
                    json_lines.append(line)
            response_text = '\n'.join(json_lines)
        
        lesson_data = json.loads(response_text)
        return lesson_data
        
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        print(f"Response was: {response_text[:500]}...")
        return None
    except Exception as e:
        print(f"Error generating lesson: {e}")
        return None


def save_lesson(lesson_data: Dict, topic_code: str, lesson_number: int):
    """Save generated lesson to JSON file."""
    filename = f"{topic_code}-L{lesson_number}.json"
    filepath = OUTPUT_DIR / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(lesson_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Saved: {filepath}")
    return filepath


def generate_topic_lessons(topic_code: str, lesson_numbers: Optional[List[int]] = None):
    """Generate all lessons for a topic."""
    curriculum = load_curriculum()
    topic_info = get_topic_info(curriculum, topic_code)
    
    if not topic_info:
        print(f"❌ Topic not found: {topic_code}")
        return
    
    topic = topic_info['topic']
    total_lessons = topic.get('lessons_count', 5)
    
    if lesson_numbers is None:
        lesson_numbers = list(range(1, total_lessons + 1))
    
    print(f"\n📚 Generating lessons for: {topic['name']}")
    print(f"   Code: {topic_code}")
    print(f"   Total: {len(lesson_numbers)} lessons\n")
    
    for lesson_num in lesson_numbers:
        print(f"🔄 Generating lesson {lesson_num}/{total_lessons}...")
        
        lesson_data = generate_lesson(topic_info, lesson_num)
        
        if lesson_data:
            save_lesson(lesson_data, topic_code, lesson_num)
        else:
            print(f"❌ Failed to generate lesson {lesson_num}")


def generate_saga_lessons(saga_code: str):
    """Generate all lessons for all topics in a saga."""
    curriculum = load_curriculum()
    topics = get_saga_topics(curriculum, saga_code)
    
    if not topics:
        print(f"❌ Saga not found: {saga_code}")
        return
    
    print(f"\n🗺️ Generating saga: {saga_code}")
    print(f"   Topics: {len(topics)}\n")
    
    for topic_info in topics:
        topic_code = topic_info['topic']['code']
        generate_topic_lessons(topic_code)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate lessons using Google Gemini AI')
    parser.add_argument('--topic', type=str, help='Topic code (e.g., 1-1-1)')
    parser.add_argument('--saga', type=str, help='Saga code (e.g., 1-1)')
    parser.add_argument('--lesson', type=int, help='Specific lesson number')
    parser.add_argument('--all', action='store_true', help='Generate all lessons in saga/topic')
    parser.add_argument('--list', action='store_true', help='List curriculum structure')
    
    args = parser.parse_args()
    
    # API key is now configured directly in the script
    # No need to check environment variables
    print("🔑 Using Gemini API with configured key")
    
    if args.list:
        curriculum = load_curriculum()
        print("\n📚 CURRICULUM STRUCTURE\n")
        for adv in curriculum.get('adventures', []):
            print(f"🌍 {adv['code']}: {adv['name']} ({adv['age_range']})")
            for saga in adv.get('sagas', []):
                print(f"   📖 {saga['code']}: {saga['name']}")
                for topic in saga.get('topics', []):
                    print(f"      📝 {topic['code']}: {topic['name']} ({topic.get('lessons_count', 5)} lessons)")
        return
    
    if args.topic:
        if args.lesson:
            generate_topic_lessons(args.topic, [args.lesson])
        else:
            generate_topic_lessons(args.topic)
    elif args.saga:
        if args.all:
            generate_saga_lessons(args.saga)
        else:
            print("Use --all to generate all topics in saga, or specify --topic")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
