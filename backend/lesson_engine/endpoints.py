"""
Enduntos del Nuevo Motor de Lecciones (v2 - Flat i18n)
LittleFounders - 2026
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import HTTPException as _HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, defer

from database import get_db
from models import Character, CharacterGesture, Lesson, LessonAudioSegment, User, UserLessonProgress
from schemas import (
    AdventureWithProgress,
    CharacterResponse,
    LessonCompleteRequest,
    SagaWithProgress,
)


def _resolve_user(db, public_id: str):
    """Resolve a public UUID to internal user ID"""
    user = db.query(User).filter(User.public_id == public_id).first()
    if not user:
        raise _HTTPException(status_code=404, detail="User not found")
    return user

# Character code normalization map
CHARACTER_CODE_MAP = {
    'liruf': 'liruf',
    'dina': 'dina',
    'dr_rho': 'dr_rho',
    'zara_vex': 'zara_vex',
    'drrho': 'dr_rho',
    'zaravex': 'zara_vex',
    'DrRho': 'dr_rho',
    'ZaraVex': 'zara_vex',
    'dr rho': 'dr_rho',
    'zara vex': 'zara_vex'
}

def normalize_character_code(code: str) -> str:
    """Normalize character code to canonical format."""
    if not code:
        return 'liruf'
    # Try lowercase first, then original
    return CHARACTER_CODE_MAP.get(code.lower().strip(), CHARACTER_CODE_MAP.get(code, 'liruf'))

router = APIRouter(prefix="/lesson-engine", tags=["Lesson Engine"])

# HARDCODED ADVENTURE DATA - All 6 adventures aligned with frontend themes
ADVENTURES_DATA = [
    {
        "id": 1,
        "code": "archipelago",
        "title_key": "list.1.title",
        "description_key": "list.1.description",
        "age_range": "5-7",
        "theme_color": "#4dd0e1",
        "background_scene": "archipelago",
        "theme": "archipelago"
    },
    {
        "id": 2,
        "code": "forest",
        "title_key": "list.2.title",
        "description_key": "list.2.description",
        "age_range": "8-9",
        "theme_color": "#4caf50",
        "background_scene": "forest",
        "theme": "forest"
    },
    {
        "id": 3,
        "code": "city",
        "title_key": "list.3.title",
        "description_key": "list.3.description",
        "age_range": "10-12",
        "theme_color": "#ff7043",
        "background_scene": "city",
        "theme": "city"
    },
    {
        "id": 4,
        "code": "valley",
        "title_key": "list.4.title",
        "description_key": "list.4.description",
        "age_range": "13-14",
        "theme_color": "#ab47bc",
        "background_scene": "valley",
        "theme": "valley"
    },
    {
        "id": 5,
        "code": "kingdom",
        "title_key": "list.5.title",
        "description_key": "list.5.description",
        "age_range": "15-17",
        "theme_color": "#ffd54f",
        "background_scene": "kingdom",
        "theme": "kingdom"
    },
    {
        "id": 6,
        "code": "cosmos",
        "title_key": "list.6.title",
        "description_key": "list.6.description",
        "age_range": "18+",
        "theme_color": "#7e57c2",
        "background_scene": "cosmos",
        "theme": "cosmos"
    }
]

# i18n Fallback titles (Spanish defaults)
ADVENTURES_TITLES = {
    1: {"es": "El Archipiélago del Trueque", "en": "The Barter Archipelago"},
    2: {"es": "El Bosque de la Abundancia", "en": "The Forest of Abundance"},
    3: {"es": "La Ciudad Digital", "en": "The Digital City"},
    4: {"es": "El Valle de los Inventores", "en": "The Valley of Inventors"},
    5: {"es": "El Reino de los Titanes", "en": "The Realm of Titans"},
    6: {"es": "Cosmos Financiero", "en": "Financial Cosmos"}
}

# HARDCODED SAGA DATA per Adventure
SAGAS_DATA = {
    1: [
        {"id": 1, "code": "savings", "title_es": "Detectives del Tesoro", "title_en": "Treasure Detectives", "icon": "🔍"},
        {"id": 2, "code": "exchange", "title_es": "Mercaderes Mágicos", "title_en": "Magic Merchants", "icon": "🛒"},
        {"id": 3, "code": "money_forms", "title_es": "Formas del Dinero", "title_en": "Forms of Money", "icon": "💰"},
        {"id": 4, "code": "needs_wants", "title_es": "Necesidades y Deseos", "title_en": "Needs and Wants", "icon": "🎯"},
        {"id": 5, "code": "first_savings", "title_es": "Mi Primer Ahorro", "title_en": "My First Savings", "icon": "🏦"}
    ],
    2: [
        {"id": 1, "code": "growth", "title_es": "Crecimiento Natural", "title_en": "Natural Growth", "icon": "🌱"},
        {"id": 2, "code": "patience", "title_es": "El Arte de la Paciencia", "title_en": "The Art of Patience", "icon": "⏳"},
        {"id": 3, "code": "compound", "title_es": "Interés Compuesto", "title_en": "Compound Interest", "icon": "📈"},
        {"id": 4, "code": "goals", "title_es": "Metas de Ahorro", "title_en": "Savings Goals", "icon": "🎯"},
        {"id": 5, "code": "budget", "title_es": "Mi Primer Presupuesto", "title_en": "My First Budget", "icon": "📊"}
    ],
    3: [
        {"id": 1, "code": "digital_money", "title_es": "Dinero Digital", "title_en": "Digital Money", "icon": "💳"},
        {"id": 2, "code": "online_safety", "title_es": "Seguridad Online", "title_en": "Online Safety", "icon": "🔐"},
        {"id": 3, "code": "smart_shopping", "title_es": "Compras Inteligentes", "title_en": "Smart Shopping", "icon": "🛍️"},
        {"id": 4, "code": "entrepreneurship", "title_es": "Emprendimiento", "title_en": "Entrepreneurship", "icon": "💡"}
    ],
    4: [
        {"id": 1, "code": "investing", "title_es": "Introducción a Inversiones", "title_en": "Intro to Investing", "icon": "📊"},
        {"id": 2, "code": "risk", "title_es": "Riesgo y Recompensa", "title_en": "Risk and Reward", "icon": "⚖️"},
        {"id": 3, "code": "stocks", "title_es": "El Mercado de Valores", "title_en": "The Stock Market", "icon": "📈"},
        {"id": 4, "code": "diversification", "title_es": "Diversificación", "title_en": "Diversification", "icon": "🎨"}
    ],
    5: [
        {"id": 1, "code": "credit", "title_es": "Crédito y Deuda", "title_en": "Credit and Debt", "icon": "💳"},
        {"id": 2, "code": "taxes", "title_es": "Impuestos Básicos", "title_en": "Basic Taxes", "icon": "📝"},
        {"id": 3, "code": "insurance", "title_es": "Seguros", "title_en": "Insurance", "icon": "🛡️"},
        {"id": 4, "code": "retirement", "title_es": "Planificación para el Futuro", "title_en": "Planning for the Future", "icon": "🏠"}
    ],
    6: [
        {"id": 1, "code": "wealth", "title_es": "Construcción de Patrimonio", "title_en": "Building Wealth", "icon": "🏛️"},
        {"id": 2, "code": "passive", "title_es": "Ingresos Pasivos", "title_en": "Passive Income", "icon": "💰"},
        {"id": 3, "code": "legacy", "title_es": "Legado Financiero", "title_en": "Financial Legacy", "icon": "🌟"},
        {"id": 4, "code": "global", "title_es": "Finanzas Globales", "title_en": "Global Finance", "icon": "🌍"}
    ]
}

# Topics Data (Adventure, Saga) -> List of Topics
TOPICS_DATA = {
    (1, 1): [
        {"id": 1, "code": "basics", "title_es": "Conceptos Básicos", "title_en": "Basic Concepts"},
        {"id": 2, "code": "quiz", "title_es": "Prueba de Conocimiento", "title_en": "Knowledge Quiz"}
    ],
    (1, 2): [
        {"id": 1, "code": "market", "title_es": "El Mercado", "title_en": "The Market"},
        {"id": 2, "code": "trade", "title_es": "Intercambio", "title_en": "Trading"}
    ]
}

# =====================================================
# ADVENTURES ENDPOINTS (Adapted for new Schema)
# =====================================================

@router.get("/adventures", response_model=list[AdventureWithProgress])
async def get_adventures(
    user_public_id: str | None = None,
    lang: str = "es",
    db: Session = Depends(get_db)
):
    """
    Obtener aventuras (Datos estáticos + Progreso real de lecciones).
    """
    user_id = None
    if user_public_id:
        user_id = _resolve_user(db, user_public_id).id

    result = []

    for adv in ADVENTURES_DATA:
        # Count lessons for this adventure level (using level as ID)
        # OPTIMIZATION: Only fetch IDs, don't load full objects
        lesson_ids_result = db.query(Lesson.id).filter(Lesson.adventure_level == adv['id']).all()
        lesson_ids = [row[0] for row in lesson_ids_result]
        total_lessons = len(lesson_ids)

        completed_lessons = 0
        if user_id:
            if lesson_ids:
                completed_count = db.query(UserLessonProgress).filter(
                    UserLessonProgress.user_id == user_id,
                    UserLessonProgress.lesson_id.in_(lesson_ids),
                    UserLessonProgress.completed == True
                ).count()
                completed_lessons = completed_count

        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0

        # Get title from ADVENTURES_TITLES with i18n support
        titles = ADVENTURES_TITLES.get(adv['id'], {})
        title = titles.get(lang, titles.get('es', f"Adventure {adv['id']}"))
        description = f"Age {adv['age_range']}"  # Descriptions come from frontend i18n

        result.append(AdventureWithProgress(
            id=adv['id'],
            code=adv['code'],
            title=title,
            description=description,
            age_range=adv['age_range'],
            order_index=adv['id'],
            theme=adv['code'],  # Frontend uses code as theme (archipelago, forest, etc.)
            theme_color=adv['theme_color'],
            background_scene=adv['background_scene'],
            is_active=True,
            created_at=datetime.now(),
            total_sagas=len(SAGAS_DATA.get(adv['id'], [])),
            completed_sagas=0,
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_percent=round(progress_percent, 1)
        ))

    return result

@router.get("/adventures/{code}/sagas", response_model=list[SagaWithProgress])
async def get_adventure_sagas(
    code: str,
    user_public_id: str | None = None,
    db: Session = Depends(get_db)
):
    """Sagas Mocked but with real lesson progress"""
    user_id = None
    if user_public_id:
        user_id = _resolve_user(db, user_public_id).id

    # Find adventure ID
    adv = next((a for a in ADVENTURES_DATA if a['code'] == code), None)
    if not adv:
        raise HTTPException(status_code=404, detail="Adventure not found")

    sagas_list = SAGAS_DATA.get(adv['id'], [])

    result = []
    for saga in sagas_list:
        # Get lessons for this saga level
        lessons = db.query(Lesson).filter(
            Lesson.adventure_level == adv['id'],
            Lesson.saga_level == saga['id']
        ).all()

        total_lessons = len(lessons)
        completed_lessons = 0

        if user_id and lessons:
            lesson_ids = [l.id for l in lessons]
            completed_lessons = db.query(UserLessonProgress).filter(
                UserLessonProgress.user_id == user_id,
                UserLessonProgress.lesson_id.in_(lesson_ids),
                UserLessonProgress.completed == True
            ).count()

        progress_percent = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0

        result.append(SagaWithProgress(
            id=saga['id'],
            adventure_id=adv['id'],
            code=saga['code'],
            title=saga['title'],
            description="Saga description",
            order_index=saga['id'],
            icon=saga['icon'],
            is_active=True,
            created_at=datetime.now(),
            total_lessons=total_lessons,
            completed_lessons=completed_lessons,
            progress_percent=round(progress_percent, 1)
        ))

    return result

# =====================================================
# LESSONS ENDPOINTS (UPDATED FOR i18n JSON)
# =====================================================

@router.get("/lessons/{code}/play")
async def get_lesson_for_play(
    code: str,
    lang: str = "es",
    db: Session = Depends(get_db)
):
    """
    Retorna el JSON de la lección leyendo 'content_es' o 'content_en'.
    Adapta la respuesta para que LessonRunner la consuma.
    """
    lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
    if not lesson:
        # Try finding by old lesson_id column if distinct? No, verified model uses lesson_code
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Select language content
    if lang == 'en':
        title = lesson.title_en
        description = lesson.description_en
        content_array = lesson.content_en
    else:
        title = lesson.title_es
        description = lesson.description_es
        content_array = lesson.content_es

    # ─── Fetch audio segments for this lesson ───
    # Wrapped in try/except: a DB failure here must NOT crash the lesson.
    # The lesson is fully functional without audio — exercises just play silently.
    #
    # exercise_id in lesson_audio_segments is 0-based, matching the position
    # in content_es/content_en arrays (index 0 = first exercise, etc.).
    audio_by_exercise: dict[int, dict] = {}
    try:
        audio_segments = db.query(LessonAudioSegment).filter(
            LessonAudioSegment.lesson_id == lesson.id,
            LessonAudioSegment.language_code == lang,
            LessonAudioSegment.is_active == True
        ).all()

        # Resolve character codes for audio segments (single query, no N+1)
        audio_char_ids = {seg.character_id for seg in audio_segments if seg.character_id}
        audio_char_map: dict[int, str] = {}
        if audio_char_ids:
            chars = db.query(Character.id, Character.code).filter(Character.id.in_(audio_char_ids)).all()
            audio_char_map = {c.id: c.code for c in chars}

        # Build map: { exercise_index: { target_field: segment_data } }
        for seg in audio_segments:
            ex_id = seg.exercise_id
            if ex_id is None:
                continue
            # Defensive access: target_field column may not exist on very old deployments
            target = getattr(seg, 'target_field', None) or 'main'
            # Validate target_field — ignore segments with unrecognised targets
            valid_targets = {'main', 'statement', 'question', 'instruction', 'feedback_success', 'feedback_error'}
            if target not in valid_targets:
                target = 'main'
            audio_by_exercise.setdefault(ex_id, {})[target] = {
                "url": seg.audio_url or None,  # Ensure null not empty string
                "duration_ms": seg.duration_ms,
                "emotion": seg.emotion,
                "transcript": seg.transcript,
                "characterCode": audio_char_map.get(seg.character_id),
            }
    except Exception as e:
        # Audio query failed — log and continue with empty audio map.
        # The lesson will run without audio but is fully functional.
        print(f"[LessonEngine] Warning: could not load audio segments for lesson {lesson.id}: {e}")

    # Build Timeline from JSON array
    timeline = []
    if content_array and isinstance(content_array, list):
        for idx, ex in enumerate(content_array):
            # Normalize character code
            raw_char_code = ex.get('character_code')
            normalized_char_code = normalize_character_code(raw_char_code) if raw_char_code else None

            # Lookup audio segments for this exercise index (0-based).
            # Returns None if no segments exist — frontend handles null gracefully.
            raw_audio = audio_by_exercise.get(idx)
            exercise_audio = raw_audio if raw_audio else None

            # Inject ID and Order if missing
            ex_data = {
                "id": idx + 1, # Fake ID for frontend key
                "type": ex.get('type', 'unknown'),
                "character_code": normalized_char_code,  # Pass normalized character code
                "order_index": idx,
                "start_time_ms": 0, # Flat timeline
                "pause_at_ms": None,
                "points": 5, # Default pts
                "content": ex.get('content', {}),
                "correct_answer": ex.get('correct_answer'),
                "feedback": ex.get('feedback'),
                "audio": exercise_audio  # AudioSegmentMap: { main?: {...}, feedback_success?: {...}, ... }
            }

            timeline.append(ex_data)

    # Mock Saga/Adventure Info for display
    # We could look this up in ADVENTURES_DATA
    adv = next((a for a in ADVENTURES_DATA if a['id'] == lesson.adventure_level), {})

    # Get saga name
    saga_list = SAGAS_DATA.get(lesson.adventure_level, [])
    saga = next((s for s in saga_list if s['id'] == lesson.saga_level), {})
    saga_title = saga.get('title', f'Saga {lesson.saga_level}')

    # Get topic/theme name
    topic_list = TOPICS_DATA.get((lesson.adventure_level, lesson.saga_level), [])
    topic = next((t for t in topic_list if t['id'] == lesson.topic_level), {})
    topic_title = topic.get('title', f'Tema {lesson.topic_level}')

    return {
        "lesson": {
            "id": str(lesson.public_id),
            "code": lesson.lesson_code,
            "title": title,
            "description": description,
            "saga": saga_title,
            "saga_code": saga.get('code', 'detectives'),
            "adventure": adv.get('title', 'Aventura'),
            "adventure_code": adv.get('code', 'archipielago'),
            "topic": topic_title,
            "topic_code": topic.get('code', 'intro'),
            "language": lang
        },
        "meta": {
            "estimated_duration_seconds": lesson.duration or 180,  # duration already in seconds
            "points_reward": lesson.points_reward or 10,
            "xp_reward": 25
        },
        "timeline": timeline
    }

@router.get("/lessons/{code}/next")
async def get_next_lesson(code: str, db: Session = Depends(get_db)):
    """
    Devuelve el código de la siguiente lección en secuencia.
    Busca en orden: mismo topic → siguiente topic → siguiente saga.
    Retorna next_code=null e is_last=true si no hay siguiente.
    """
    lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # 1. Siguiente lección dentro del mismo topic
    next_lesson = db.query(Lesson).filter(
        Lesson.adventure_level == lesson.adventure_level,
        Lesson.saga_level == lesson.saga_level,
        Lesson.topic_level == lesson.topic_level,
        Lesson.lesson_number > lesson.lesson_number
    ).order_by(Lesson.lesson_number).first()

    # 2. Primera lección del siguiente topic (mismo saga)
    if not next_lesson:
        next_lesson = db.query(Lesson).filter(
            Lesson.adventure_level == lesson.adventure_level,
            Lesson.saga_level == lesson.saga_level,
            Lesson.topic_level > lesson.topic_level
        ).order_by(Lesson.topic_level, Lesson.lesson_number).first()

    # 3. Primera lección del siguiente saga (misma aventura)
    if not next_lesson:
        next_lesson = db.query(Lesson).filter(
            Lesson.adventure_level == lesson.adventure_level,
            Lesson.saga_level > lesson.saga_level
        ).order_by(Lesson.saga_level, Lesson.topic_level, Lesson.lesson_number).first()

    if not next_lesson:
        return {"next_code": None, "is_last": True}

    return {"next_code": next_lesson.lesson_code, "is_last": False}



def _get_token_user_optional(http_request: Request, db: Session) -> User | None:
    """
    Extracts the authenticated User from the Bearer token if present and valid.
    Returns None if no token or token is invalid — never raises.
    """
    auth_header = http_request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        from auth.utils import verify_token
        email = verify_token(token, None)
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except Exception:
        return None


@router.post("/lessons/{code}/complete")
async def complete_lesson(
    code: str,
    user_public_id: str,
    request: LessonCompleteRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    """Marcar lección completada y actualizar racha"""
    from datetime import date, timedelta

    from models import UserLearningStreak

    user = _resolve_user(db, user_public_id)

    # ── Bearer token cross-verification ──────────────────────────────────────
    # If the frontend sent an Authorization header, confirm the token identifies
    # the same user as `user_public_id`. This closes the race where a stale
    # public_id in localStorage (left over from a previous user's session that
    # didn't call signOut()) could record progress on the wrong account.
    token_user = _get_token_user_optional(http_request, db)
    if token_user is not None and str(token_user.public_id) != str(user.public_id):
        raise HTTPException(
            status_code=403,
            detail="Token user does not match user_public_id — request rejected"
        )
    user_id = user.id

    lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check progress
    progress = db.query(UserLessonProgress).filter(
        UserLessonProgress.user_id == user_id,
        UserLessonProgress.lesson_id == lesson.id
    ).first()

    first_time = not progress or not progress.completed
    points_earned = 0
    xp_earned = 0

    if not progress:
        progress = UserLessonProgress(
            user_id=user_id,
            lesson_id=lesson.id,
            started_at=datetime.now(),
            completed=False
        )
        db.add(progress)

    # Update progress
    progress.progress = 100
    progress.completed = True
    progress.completed_at = datetime.now()
    progress.score = max(progress.score or 0, request.score)

    # Calculate rewards
    if first_time:
        points_earned = lesson.points_reward or 10
        xp_earned = 25
        progress.points_earned = points_earned

    # Update time spent
    progress.time_spent_seconds = (progress.time_spent_seconds or 0) + (request.time_spent_seconds or 0)

    # ---------------------------------------------------------
    # STREAK LOGIC (timezone-aware via local_date from frontend)
    # ---------------------------------------------------------
    # Use client's local date if provided, fallback to server date
    if request.local_date:
        try:
            today = date.fromisoformat(request.local_date)
        except (ValueError, TypeError):
            today = date.today()
    else:
        today = date.today()

    # Save old streak BEFORE recalculating to determine if it was extended
    old_streak = user.current_streak or 0

    # 1. Record activity for today
    streak_entry = db.query(UserLearningStreak).filter(
        UserLearningStreak.user_id == user_id,
        func.date(UserLearningStreak.date) == today
    ).first()

    # was_first_today = True when this is the user's FIRST completion of the current day.
    # The frontend uses this flag to decide whether to show the streak celebration animation.
    # (Subsequent completions the same day keep the streak but don't re-trigger the animation.)
    was_first_today = streak_entry is None

    if not streak_entry:
        streak_entry = UserLearningStreak(
            user_id=user_id,
            date=datetime.combine(today, datetime.min.time()),
            lessons_completed=1,
            minutes_studied=request.time_spent_seconds // 60 if request.time_spent_seconds else 3,
            points_earned=points_earned
        )
        db.add(streak_entry)
        # CRITICAL: flush immediately so the new row is visible to the activity_dates query
        # below. The session is configured with autoflush=False (database.py), so without
        # an explicit flush the newly-added entry is not yet in the DB transaction and
        # today would be missing from activity_dates → current_streak = 0.
        db.flush()
    else:
        streak_entry.lessons_completed += 1
        streak_entry.minutes_studied += request.time_spent_seconds // 60 if request.time_spent_seconds else 3
        streak_entry.points_earned += points_earned

    # 2. Calculate current streak from activity history
    activity_dates = db.query(func.date(UserLearningStreak.date)).filter(
        UserLearningStreak.user_id == user_id
    ).distinct().order_by(func.date(UserLearningStreak.date).desc()).all()

    activity_dates = [d[0] for d in activity_dates]

    current_streak = 0
    if activity_dates and today in activity_dates:
        current_streak = 1
        check_date = today - timedelta(days=1)
        while check_date in activity_dates:
            current_streak += 1
            check_date -= timedelta(days=1)

    # 3. Update user streak
    user.current_streak = current_streak
    user.max_streak = max(user.max_streak or 0, current_streak)

    # streak_extended = streak actually increased (not just maintained by doing more lessons same day)
    streak_was_extended = current_streak > old_streak

    # Update user aggregate stats
    if first_time:
        user.lessons_completed = (user.lessons_completed or 0) + 1
        user.points_earned = (user.points_earned or 0) + points_earned
    minutes_this_session = (request.time_spent_seconds // 60) if request.time_spent_seconds else 0
    user.minutes_studied = (user.minutes_studied or 0) + minutes_this_session

    db.commit()

    db.refresh(user)  # Ensure we return the freshest values after commit

    return {
        "success": True,
        "points_earned": points_earned,
        "xp_earned": xp_earned,
        "new_streak": current_streak,
        "max_streak": user.max_streak or 0,
        "streak_extended": streak_was_extended,
        # was_first_today: True only on the first lesson of the calendar day (user's local date).
        # Frontend shows streak celebration animation only when this is True.
        "was_first_today": was_first_today,
        # last_activity_date: the user's local YYYY-MM-DD date for this activity.
        # Frontend stores this to compute the correct streak visual state (zero/inactive/active).
        "last_activity_date": today.isoformat(),
        "lessons_completed": user.lessons_completed or 0,
        "minutes_studied": user.minutes_studied or 0,
        "total_points": user.points_earned or 0,
    }

# =====================================================
# CHARACTERS (Kept compatible)
# =====================================================
@router.get("/characters", response_model=list[CharacterResponse])
async def get_characters(db: Session = Depends(get_db)):
    """Obtener todos los personajes activos."""
    characters = db.query(Character).filter(Character.is_active == True).all()
    return characters

@router.get("/characters/{code}")
async def get_character(code: str, db: Session = Depends(get_db)):
    character = db.query(Character).filter(Character.code == code).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    gestures = db.query(CharacterGesture).filter(
        CharacterGesture.character_id == character.id
    ).all()

    return {
        "id": str(character.public_id),
        "code": character.code,
        "name": character.name,
        "description": character.description,
        "gestures": [
            {"code": g.gesture_code, "duration_ms": g.duration_ms}
            for g in gestures
        ]
    }

# =====================================================
# USER STATS (Dashboard)
# =====================================================
@router.get("/users/{public_id}/stats")
async def get_user_lesson_stats(public_id: str, lang: str = "es", db: Session = Depends(get_db)):
    user = _resolve_user(db, public_id)
    user_id = user.id

    # Adventure progress with i18n
    adventure_progress = []
    for adv in ADVENTURES_DATA:
        # Count lessons
        adv_lessons = db.query(Lesson).filter(Lesson.adventure_level == adv['id']).all()
        total = len(adv_lessons)
        comp = 0
        if total > 0:
            l_ids = [l.id for l in adv_lessons]
            comp = db.query(UserLessonProgress).filter(
                UserLessonProgress.user_id == user_id,
                UserLessonProgress.lesson_id.in_(l_ids),
                UserLessonProgress.completed == True
            ).count()

        pct = (comp / total * 100) if total > 0 else 0
        title = ADVENTURES_TITLES.get(adv['id'], {}).get(lang, ADVENTURES_TITLES.get(adv['id'], {}).get('es', 'Adventure'))

        adventure_progress.append({
            "adventure_id": adv['id'],
            "adventure_title": title,
            "adventure_code": adv['code'],
            "total_lessons": total,
            "completed_lessons": comp,
            "progress_percent": round(pct, 1),
            "theme": adv.get('theme', 'archipelago'),
            "current_saga": "In Progress" if comp > 0 and comp < total else ("Completed" if comp == total else "Not Started")
        })

    return {
        "adventure_progress": adventure_progress,
        "total_xp": user.points_earned or 0,
        "current_streak": user.current_streak or 0,
        "max_streak": user.max_streak or 0,
        "lessons_completed": user.lessons_completed or 0,
        "minutes_studied": user.minutes_studied or 0,
        "lessons_this_week": 0,  # TODO: Calculate from streaks table
        "average_accuracy": 0.0,
        "lessons_needing_review": 0
    }

# =====================================================
# USER STREAK ENDPOINT
# =====================================================
@router.get("/users/{public_id}/streak")
async def get_user_streak(public_id: str, db: Session = Depends(get_db)):
    """Get user's streak information"""
    from datetime import date, timedelta

    from models import UserLearningStreak

    user = _resolve_user(db, public_id)
    user_id = user.id

    today = date.today()

    # Get last 7 days of activity
    week_ago = today - timedelta(days=6)
    recent_activity = db.query(UserLearningStreak).filter(
        UserLearningStreak.user_id == user_id,
        func.date(UserLearningStreak.date) >= week_ago
    ).order_by(UserLearningStreak.date.desc()).all()

    # Build activity calendar
    activity_days = []
    for i in range(7):
        check_date = today - timedelta(days=6-i)
        day_record = next((r for r in recent_activity if r.date.date() == check_date), None)
        activity_days.append({
            "date": check_date.isoformat(),
            "lessons": day_record.lessons_completed if day_record else 0,
            "minutes": day_record.minutes_studied if day_record else 0,
            "active": day_record is not None
        })

    # Check if user studied today
    studied_today = any(r.date.date() == today for r in recent_activity)

    return {
        "current_streak": user.current_streak or 0,
        "max_streak": user.max_streak or 0,
        "studied_today": studied_today,
        "week_activity": activity_days,
        "total_days_studied": len([d for d in activity_days if d["active"]])
    }

@router.get("/users/{public_id}/next-lesson")
async def get_user_next_global_lesson(public_id: str, db: Session = Depends(get_db)):
    """
    Get the absolute next lesson the user should play globally.
    Finds the highest completed lesson and returns the strictly next one.
    If no lessons completed, returns the very first lesson of the app.
    """
    user = _resolve_user(db, public_id)

    # Get the highest completed lesson
    last_completed = db.query(Lesson).join(
        UserLessonProgress, Lesson.id == UserLessonProgress.lesson_id
    ).filter(
        UserLessonProgress.user_id == user.id,
        UserLessonProgress.completed == True
    ).order_by(
        Lesson.adventure_level.desc(),
        Lesson.saga_level.desc(),
        Lesson.topic_level.desc(),
        Lesson.lesson_number.desc()
    ).first()

    if not last_completed:
        # User hasn't completed any lessons, return very first lesson (1-1-1-1)
        first_lesson = db.query(Lesson).order_by(
            Lesson.adventure_level,
            Lesson.saga_level,
            Lesson.topic_level,
            Lesson.lesson_number
        ).first()
        if not first_lesson:
            raise HTTPException(status_code=404, detail="No lessons found in database")
        return {"next_code": first_lesson.lesson_code, "is_last": False}

    # Find the strictly next lesson after the last completed one
    # Same logic as get_next_lesson

    # 1. Next in same topic
    next_lesson = db.query(Lesson).filter(
        Lesson.adventure_level == last_completed.adventure_level,
        Lesson.saga_level == last_completed.saga_level,
        Lesson.topic_level == last_completed.topic_level,
        Lesson.lesson_number > last_completed.lesson_number
    ).order_by(Lesson.lesson_number).first()

    # 2. First in next topic
    if not next_lesson:
        next_lesson = db.query(Lesson).filter(
            Lesson.adventure_level == last_completed.adventure_level,
            Lesson.saga_level == last_completed.saga_level,
            Lesson.topic_level > last_completed.topic_level
        ).order_by(Lesson.topic_level, Lesson.lesson_number).first()

    # 3. First in next saga
    if not next_lesson:
        next_lesson = db.query(Lesson).filter(
            Lesson.adventure_level == last_completed.adventure_level,
            Lesson.saga_level > last_completed.saga_level
        ).order_by(Lesson.saga_level, Lesson.topic_level, Lesson.lesson_number).first()

    # 4. First in next adventure
    if not next_lesson:
        next_lesson = db.query(Lesson).filter(
            Lesson.adventure_level > last_completed.adventure_level
        ).order_by(Lesson.adventure_level, Lesson.saga_level, Lesson.topic_level, Lesson.lesson_number).first()

    if not next_lesson:
        # They finished the entire game!
        return {"next_code": None, "is_last": True}

    return {"next_code": next_lesson.lesson_code, "is_last": False}

# =====================================================
# LESSONS BY TOPIC (For catalog navigation)
# =====================================================
@router.get("/lessons/by-adventure/{adventure_id}")
async def get_lessons_by_adventure(
    adventure_id: int,
    saga_id: int | None = None,
    topic_id: int | None = None,
    user_public_id: str | None = None,
    lang: str = "es",
    db: Session = Depends(get_db)
):
    """Get lessons filtered by adventure/saga/topic with progress"""
    user_id = None
    if user_public_id:
        user_id = _resolve_user(db, user_public_id).id
    query = db.query(Lesson).filter(Lesson.adventure_level == adventure_id)

    if saga_id:
        query = query.filter(Lesson.saga_level == saga_id)
    if topic_id:
        query = query.filter(Lesson.topic_level == topic_id)

    # OPTIMIZATION: Defer loading heavy content columns
    lessons = query.options(
        defer(Lesson.content_es),
        defer(Lesson.content_en)
    ).order_by(
        Lesson.saga_level,
        Lesson.topic_level,
        Lesson.lesson_number
    ).all()

    # Get progress if user_id provided
    progress_map = {}
    if user_id:
        lesson_ids = [l.id for l in lessons]
        if lesson_ids:
            progress_records = db.query(UserLessonProgress).filter(
                UserLessonProgress.user_id == user_id,
                UserLessonProgress.lesson_id.in_(lesson_ids)
            ).all()
            progress_map = {p.lesson_id: p for p in progress_records}

    result = []
    for lesson in lessons:
        prog = progress_map.get(lesson.id)

        # Resolve Topic Title
        topic_list = TOPICS_DATA.get((lesson.adventure_level, lesson.saga_level), [])
        topic = next((t for t in topic_list if t['id'] == lesson.topic_level), {})
        # Map fields based on language
        if lang == 'en':
            topic_title = topic.get('title_en', f"Topic {lesson.topic_level}")
        else:
            topic_title = topic.get('title_es', f"Tema {lesson.topic_level}")

        result.append({
            "id": str(lesson.public_id),
            "code": lesson.lesson_code,
            "title": lesson.title_en if lang == "en" else lesson.title_es,
            "description": lesson.description_en if lang == "en" else lesson.description_es,
            "adventure_level": lesson.adventure_level,
            "saga_level": lesson.saga_level,
            "topic_level": lesson.topic_level,
            "topic_title": topic_title,
            "lesson_number": lesson.lesson_number,
            "duration": lesson.duration,
            "points_reward": lesson.points_reward,
            "completed": prog.completed if prog else False,
            "progress": prog.progress if prog else 0,
            "score": prog.score if prog else 0
        })

    return {
        "adventure_id": adventure_id,
        "total_lessons": len(result),
        "completed_lessons": sum(1 for l in result if l["completed"]),
        "lessons": result
    }
