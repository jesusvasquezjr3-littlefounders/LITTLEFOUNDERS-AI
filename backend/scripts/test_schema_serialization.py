"""
test_schema_serialization.py
────────────────────────────
Guard script to catch Pydantic v2 type mismatch issues BEFORE they hit production.

Run with:  python3 backend/scripts/test_schema_serialization.py

What it tests:
  - Every Pydantic response schema that uses `from_attributes = True`
  - Both direct instantiation AND ORM-mode validation (model_validate)
  - Realistic mock objects that mirror what SQLAlchemy actually returns
    (uuid.UUID objects, datetime objects, list/dict from JSON columns, etc.)

Context: Pydantic v2 is strict — it will NOT coerce uuid.UUID → str, or
Python enum objects → str automatically. Mismatches cause 500 errors at
runtime that also strip CORS headers, making them look like CORS bugs.
"""

import sys
import uuid
from datetime import datetime

# ── Mock ORM objects (simulates SQLAlchemy ORM row returns) ──────────────

class MockUser:
    id = 1
    public_id = uuid.uuid4()   # SQLAlchemy PG_UUID(as_uuid=True) → uuid.UUID
    name = "Guadalupe"
    email = "g@littlefounders.ai"
    user_type = "universal"
    created_at = datetime.now()
    lessons_completed = 10
    minutes_studied = 30
    points_earned = 200
    current_streak = 5
    balance = 150.0
    avatar_config = {"skin": "light", "hair": "dark"}
    username = "guada"
    preferred_language = "es"
    auth_provider = "email"
    birth_date = None
    gender = "female"

class MockAdminUser:
    id = 2
    name = "Admin"
    email = "admin@lf.ai"
    user_type = "admin"
    is_active = True
    created_at = datetime.now()

class MockLesson:
    id = 1
    lesson_code = "1-1-1-1"
    title_es = "Título en español"
    title_en = "Title in English"
    description_es = None
    description_en = None
    duration = 300
    age_rate = "6-12"
    points_reward = 10
    adventure_level = 1
    saga_level = 1
    topic_level = 1
    lesson_number = 1
    content_es = [{"type": "intro", "text": "Hola"}]
    content_en = [{"type": "intro", "text": "Hello"}]
    created_at = datetime.now()
    updated_at = datetime.now()
    exercise_count_es = 3
    exercise_count_en = 3

class MockAudioSegment:
    id = 1
    lesson_id = 5
    exercise_id = 3
    character_id = 1
    audio_url = "https://cdn.lf.ai/audio.mp3"
    transcript = "¡Hola, explorador!"
    emotion = "happy"
    language_code = "es"
    source = "generated"
    tags = ["lesson", "intro"]  # JSON column returns list
    is_active = True

class MockAdventure:
    id = 1
    code = "ADV-1"
    title = "Aventura 1"
    description = "Description"
    age_range = "6-12"
    order_index = 0
    theme_color = "#FF5733"
    background_scene = "island"
    is_active = True
    created_at = datetime.now()

class MockSaga:
    id = 1
    code = "SG-1"
    title = "Saga 1"
    description = None
    order_index = 0
    icon = "🏝️"
    adventure_id = 1
    is_active = True
    created_at = datetime.now()

class MockCharacter:
    id = 1
    code = "liruf"
    name = "Liruf"
    description = "El guía"


# ── Run Tests ────────────────────────────────────────────────────────────

def run_tests():
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    errors = []
    passes = []

    def test(label, fn):
        try:
            fn()
            passes.append(label)
        except Exception as e:
            errors.append(f"{label}: {type(e).__name__}: {e}")

    # ── auth/schemas.py ──────────────────────────────────────────────────
    from auth.schemas import UserResponse

    def test_user_direct():
        r = UserResponse(
            id=1, public_id=uuid.uuid4(), name="T", email="t@t.com",
            user_type="universal", created_at=datetime.now()
        )
        import json
        parsed = json.loads(r.model_dump_json())
        assert isinstance(parsed["public_id"], str), "public_id must be str in JSON"
        assert len(parsed["public_id"]) == 36

    def test_user_orm():
        r = UserResponse.model_validate(MockUser(), from_attributes=True)
        import json
        parsed = json.loads(r.model_dump_json())
        assert isinstance(parsed["public_id"], str)

    test("UserResponse — direct instantiation", test_user_direct)
    test("UserResponse — ORM mode (model_validate)", test_user_orm)

    # ── admin/schemas.py ─────────────────────────────────────────────────
    from admin.schemas import (
        AdminUserResponse,
        AudioResponse,
        LessonResponse,
    )

    test("AdminUserResponse — direct", lambda: AdminUserResponse(
        id=1, name="T", email="t@t.com", user_type="admin", is_active=True
    ).model_dump_json())

    test("AdminUserResponse — ORM mode", lambda:
        AdminUserResponse.model_validate(MockAdminUser(), from_attributes=True).model_dump_json())

    test("admin.LessonResponse — direct", lambda: LessonResponse(
        id=1, lesson_code="1-1-1-1", title_es="T", title_en="T",
        adventure_level=1, saga_level=1, topic_level=1, lesson_number=1,
        points_reward=10, content_es=[], content_en=[]
    ).model_dump_json())

    test("admin.LessonResponse — ORM mode", lambda:
        LessonResponse.model_validate(MockLesson(), from_attributes=True).model_dump_json())

    test("AudioResponse — ORM mode (list tags from JSON column)", lambda:
        AudioResponse.model_validate(MockAudioSegment(), from_attributes=True).model_dump_json())

    # ── schemas.py ───────────────────────────────────────────────────────
    from schemas import (
        AdventureResponse,
        SagaResponse,
    )
    from schemas import (
        CharacterResponse as EngineCharacterResponse,
    )

    test("AdventureResponse — ORM mode", lambda:
        AdventureResponse.model_validate(MockAdventure(), from_attributes=True).model_dump_json())

    test("SagaResponse — ORM mode", lambda:
        SagaResponse.model_validate(MockSaga(), from_attributes=True).model_dump_json())

    test("CharacterResponse (engine) — ORM mode", lambda:
        EngineCharacterResponse.model_validate(MockCharacter(), from_attributes=True).model_dump_json())

    # ── Summary ──────────────────────────────────────────────────────────
    print()
    print("=" * 55)
    print("  SCHEMA SERIALIZATION GUARD — RESULTS")
    print("=" * 55)
    for p in passes:
        print(f"  ✅ {p}")
    for e in errors:
        print(f"  ❌ {e}")
    print()
    if errors:
        print(f"  FAILED: {len(errors)} schema(s) have Pydantic v2 type mismatches!")
        print("  Fix these before deploying to avoid silent 500 errors.")
        sys.exit(1)
    else:
        print(f"  ALL {len(passes)} TESTS PASSED — schemas are Pydantic v2 compatible ✓")
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
