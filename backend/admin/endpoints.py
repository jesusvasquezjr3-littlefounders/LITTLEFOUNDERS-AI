"""
backend/admin/endpoints.py
Todos los endpoints del admin panel, protegidos por require_admin.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, Date, cast
from typing import Optional, List
from datetime import datetime, timedelta
import json
import time
import os

from database import get_db
from models import (
    User, UserType, Lesson, Character, CharacterGesture,
    ContentEditHistory, LessonAudioSegment
)
from admin.permissions import require_admin
from admin.schemas import (
    LessonFullCreate, LessonFullUpdate, LessonResponse, LessonListItem,
    LessonListResponse, ExerciseCreate, ExerciseUpdate, ExerciseReorder,
    CharacterCreate, CharacterUpdate, CharacterResponse,
    GestureCreate, GestureUpdate,
    AudioGenerateRequest, AudioResponse,
    HistoryEntry, HistoryListResponse, RollbackRequest,
    AdminStats, AdminUserResponse
)
from admin.services import record_edit, rollback_edit
from admin.validators import validate_exercises, VALID_EXERCISE_TYPES
from admin.error_messages import (
    format_validation_error_response,
    translate_errors_to_english,
    format_validation_error_detail
)

router = APIRouter(prefix="/admin", tags=["Admin Panel"])


# ──────────────────────────────────────────────
# DASHBOARD / STATS
# ──────────────────────────────────────────────

@router.get("/stats")
async def get_admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Estadísticas generales del contenido."""
    total_lessons = db.query(func.count(Lesson.id)).scalar() or 0

    total_exercises = db.query(func.sum(func.jsonb_array_length(Lesson.content_es))).scalar() or 0

    total_characters = db.query(func.count(Character.id)).scalar() or 0
    total_audio = db.query(func.count(LessonAudioSegment.id)).scalar() or 0

    # Lecciones por aventura
    adventure_counts = db.query(
        Lesson.adventure_level,
        func.count(Lesson.id)
    ).group_by(Lesson.adventure_level).all()
    lessons_by_adventure = {level: count for level, count in adventure_counts}

    # Últimas 10 ediciones
    recent_entries = db.query(ContentEditHistory).order_by(
        desc(ContentEditHistory.created_at)
    ).limit(10).all()

    recent_edits = []
    for entry in recent_entries:
        editor = db.query(User).filter(User.id == entry.editor_user_id).first()
        recent_edits.append({
            "id": str(entry.public_id),
            "editor_public_id": str(editor.public_id) if editor else None,
            "editor_name": editor.name if editor else None,
            "entity_type": entry.entity_type,
            "entity_id": str(entry.entity_public_id) if entry.entity_public_id else None,
            "action": entry.action,
            "field_changed": entry.field_changed,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "metadata": entry.edit_metadata,
        })

    # Actividad diaria por usuario (últimos 365 días)
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    
    daily_query = db.query(
        cast(ContentEditHistory.created_at, Date).label('date'),
        ContentEditHistory.editor_user_id,
        func.count(ContentEditHistory.id).label('count')
    ).filter(
        ContentEditHistory.created_at >= one_year_ago
    ).group_by(
        cast(ContentEditHistory.created_at, Date),
        ContentEditHistory.editor_user_id
    ).all()

    # Get admin names map
    admin_users = db.query(User.id, User.name).filter(User.user_type == 'admin').all()
    user_names = {u.id: u.name for u in admin_users}

    # Transform to [{date: "YYYY-MM-DD", "Alice": 5, "Bob": 2}, ...]
    activity_map = {}
    for date_val, user_id, count in daily_query:
        date_str = str(date_val)
        if date_str not in activity_map:
            activity_map[date_str] = {"date": date_str}
        
        user_name = user_names.get(user_id, f"User {user_id}")
        # Key must be unique per user. Using name.
        # If collisions, append ID? For now assume names distinct enough or acceptable overlap.
        activity_map[date_str][user_name] = count

    # Fill generic structure for existing users if convenient, but sparse is fine for Recharts if we map keys.
    # Actually, for "Github style", we might just want total count per day for the heatmap, 
    # and maybe a breakdown for tooltips.
    # But user asked for "contributions by admin user".
    # I'll return the array sorted by date.
    daily_activity = sorted(list(activity_map.values()), key=lambda x: x['date'])

    return {
        "total_lessons": total_lessons,
        "total_exercises": total_exercises,
        "total_characters": total_characters,
        "total_audio_segments": total_audio,
        "recent_edits": recent_edits,
        "lessons_by_adventure": lessons_by_adventure,
        "daily_activity": daily_activity,
    }


# ──────────────────────────────────────────────
# LECCIONES — CRUD
# ──────────────────────────────────────────────

@router.get("/lessons")
async def list_lessons(
    adventure_level: Optional[int] = Query(None, ge=1, le=6),
    saga_level: Optional[int] = Query(None),
    topic_level: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("updated_at"),
    sort_dir: str = Query("desc"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Listar lecciones con filtros y paginación."""
    query = db.query(Lesson)

    # Filtros
    if adventure_level:
        query = query.filter(Lesson.adventure_level == adventure_level)
    if saga_level:
        query = query.filter(Lesson.saga_level == saga_level)
    if topic_level:
        query = query.filter(Lesson.topic_level == topic_level)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Lesson.title_es.ilike(search_pattern)) |
            (Lesson.title_en.ilike(search_pattern)) |
            (Lesson.description_es.ilike(search_pattern)) |
            (Lesson.lesson_code.ilike(search_pattern))
        )

    # Total antes de paginar
    total = query.count()

    # Ordenamiento
    sort_column = getattr(Lesson, sort_by, Lesson.updated_at)
    if sort_dir == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    # Paginación
    offset = (page - 1) * page_size
    lessons = query.offset(offset).limit(page_size).all()

    items = []
    for lesson in lessons:
        items.append({
            "public_id": str(lesson.public_id),
            "lesson_code": lesson.lesson_code,
            "title_es": lesson.title_es,
            "title_en": lesson.title_en,
            "adventure_level": lesson.adventure_level,
            "saga_level": lesson.saga_level,
            "topic_level": lesson.topic_level,
            "lesson_number": lesson.lesson_number,
            "points_reward": lesson.points_reward,
            "duration": lesson.duration,
            "exercise_count_es": len(lesson.content_es) if lesson.content_es and isinstance(lesson.content_es, list) else 0,
            "exercise_count_en": len(lesson.content_en) if lesson.content_en and isinstance(lesson.content_en, list) else 0,
            "updated_at": lesson.updated_at.isoformat() if lesson.updated_at else (lesson.created_at.isoformat() if lesson.created_at else None),
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/lessons/{lesson_id_or_uuid}")
async def get_lesson(
    lesson_id_or_uuid: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Obtener lección completa con contenido JSON (Vía public_id o id numérico)."""
    # Intentar por public_id (UUID)
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    return {
        "public_id": str(lesson.public_id),
        "lesson_code": lesson.lesson_code,
        "title_es": lesson.title_es,
        "title_en": lesson.title_en,
        "description_es": lesson.description_es,
        "description_en": lesson.description_en,
        "duration": lesson.duration,
        "age_rate": lesson.age_rate,
        "points_reward": lesson.points_reward,
        "adventure_level": lesson.adventure_level,
        "saga_level": lesson.saga_level,
        "topic_level": lesson.topic_level,
        "lesson_number": lesson.lesson_number,
        "content_es": lesson.content_es or [],
        "content_en": lesson.content_en or [],
        "created_at": lesson.created_at.isoformat() if lesson.created_at else None,
        "updated_at": lesson.updated_at.isoformat() if lesson.updated_at else (lesson.created_at.isoformat() if lesson.created_at else None),
    }


@router.post("/lessons", status_code=201)
async def create_lesson(
    data: LessonFullCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Crear nueva lección."""
    # Verificar que el código no exista
    existing = db.query(Lesson).filter(Lesson.lesson_code == data.lesson_code).first()
    if existing:
        raise HTTPException(400, f"Ya existe una lección con código '{data.lesson_code}'")

    # Validar ejercicios si se proporcionan
    # Solo validar si content tiene elementos (no validar listas vacías)
    errors_es = []
    errors_en = []

    if data.content_es and len(data.content_es) > 0:
        errors_es = validate_exercises(data.content_es, "es")

    if data.content_en and len(data.content_en) > 0:
        errors_en = validate_exercises(data.content_en, "en")

    if errors_es or errors_en:
        errors_en_translated = translate_errors_to_english(errors_es) if not errors_en else errors_en
        detail_msg = format_validation_error_detail(errors_es, errors_en_translated)
        error_body = format_validation_error_response(errors_es, errors_en_translated)
        raise HTTPException(status_code=422, detail=detail_msg, headers={"X-Validation-Errors": json.dumps(error_body)})

    lesson = Lesson(
        lesson_code=data.lesson_code,
        title_es=data.title_es,
        title_en=data.title_en,
        description_es=data.description_es,
        description_en=data.description_en,
        duration=data.duration,
        age_rate=data.age_rate,
        points_reward=data.points_reward,
        adventure_level=data.adventure_level,
        saga_level=data.saga_level,
        topic_level=data.topic_level,
        lesson_number=data.lesson_number,
        content_es=data.content_es or [],
        content_en=data.content_en or [],
    )
    db.add(lesson)
    db.flush()  # Get ID before commit

    # Registrar en historial
    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="create",
        new_value={"lesson_code": data.lesson_code, "title_es": data.title_es},
        metadata={"lesson_code": data.lesson_code}
    )

    db.commit()
    db.refresh(lesson)

    return {
        "public_id": str(lesson.public_id),
        "lesson_code": lesson.lesson_code,
        "message": "Lección creada exitosamente"
    }


@router.put("/lessons/{lesson_id_or_uuid}")
async def update_lesson(
    lesson_id_or_uuid: str,
    data: LessonFullUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar lección (Vía public_id o id numérico)."""
    # Intentar por public_id (UUID)
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Validar ejercicios si se proporcionan
    # Solo validar si content tiene elementos (no validar listas vacías)
    errors_es = []
    errors_en = []

    if data.content_es is not None and len(data.content_es) > 0:
        errors_es = validate_exercises(data.content_es, "es")

    if data.content_en is not None and len(data.content_en) > 0:
        errors_en = validate_exercises(data.content_en, "en")

    if errors_es or errors_en:
        errors_en_translated = translate_errors_to_english(errors_es) if not errors_en else errors_en
        detail_msg = format_validation_error_detail(errors_es, errors_en_translated)
        error_body = format_validation_error_response(errors_es, errors_en_translated)
        raise HTTPException(status_code=422, detail=detail_msg, headers={"X-Validation-Errors": json.dumps(error_body)})

    # Capturar estado anterior
    previous = {}
    update_data = data.model_dump(exclude_unset=True)
    for field in update_data:
        previous[field] = getattr(lesson, field, None)

    # Verificar si lesson_code cambia y ya existe
    if data.lesson_code and data.lesson_code != lesson.lesson_code:
        existing = db.query(Lesson).filter(
            Lesson.lesson_code == data.lesson_code,
        Lesson.id != lesson.id
    ).first()
        if existing:
            raise HTTPException(400, f"Ya existe otra lección con código '{data.lesson_code}'")

    # Aplicar cambios
    for field, value in update_data.items():
        setattr(lesson, field, value)

    # Registrar en historial
    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="update",
        field_changed="full_update",
        previous_value=_serialize_for_json(previous),
        new_value=_serialize_for_json(update_data),
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    db.refresh(lesson)

    return {
        "public_id": str(lesson.public_id),
        "lesson_code": lesson.lesson_code,
        "message": "Lección actualizada exitosamente"
    }


@router.delete("/lessons/{lesson_id_or_uuid}")
async def delete_lesson(
    lesson_id_or_uuid: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar lección (Vía public_id o id numérico)."""
    # Intentar por public_id (UUID) primero
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    # Fallback a ID numérico
    if not lesson and lesson_id_or_uuid.isdigit():
        lesson = db.query(Lesson).filter(Lesson.id == int(lesson_id_or_uuid)).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Registrar antes de eliminar
    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="delete",
        previous_value={
            "lesson_code": lesson.lesson_code,
            "title_es": lesson.title_es,
            "title_en": lesson.title_en,
            "content_es": lesson.content_es,
            "content_en": lesson.content_en,
            "adventure_level": lesson.adventure_level,
            "saga_level": lesson.saga_level,
            "topic_level": lesson.topic_level,
            "lesson_number": lesson.lesson_number,
            "points_reward": lesson.points_reward,
            "duration": lesson.duration,
            "age_rate": lesson.age_rate,
            "description_es": lesson.description_es,
            "description_en": lesson.description_en,
        },
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.delete(lesson)
    db.commit()

    return {"message": "Lección eliminada exitosamente"}


@router.post("/lessons/{lesson_id_or_uuid}/duplicate")
async def duplicate_lesson(
    lesson_id_or_uuid: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Duplicar una lección (Vía public_id o id numérico)."""
    # Intentar por public_id (UUID) primero
    original = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    # Intentar por public_id (UUID)
    original = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    if not original:
        raise HTTPException(404, "Lección original no encontrada")

    # Generar nuevo código
    base_code = original.lesson_code
    suffix = 1
    new_code = f"{base_code}-copy{suffix}"
    while db.query(Lesson).filter(Lesson.lesson_code == new_code).first():
        suffix += 1
        new_code = f"{base_code}-copy{suffix}"

    new_lesson = Lesson(
        lesson_code=new_code,
        title_es=f"{original.title_es} (Copia)",
        title_en=f"{original.title_en} (Copy)",
        description_es=original.description_es,
        description_en=original.description_en,
        duration=original.duration,
        age_rate=original.age_rate,
        points_reward=original.points_reward,
        adventure_level=original.adventure_level,
        saga_level=original.saga_level,
        topic_level=original.topic_level,
        lesson_number=original.lesson_number,
        content_es=original.content_es or [],
        content_en=original.content_en or [],
    )
    db.add(new_lesson)
    db.flush()

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=new_lesson.id,
        entity_public_id=str(new_lesson.public_id),
        new_value={"duplicated_from_public_id": str(original.public_id), "lesson_code": new_code},
        metadata={"original_lesson_code": base_code}
    )

    db.commit()
    db.refresh(new_lesson)

    return {
        "public_id": str(new_lesson.public_id),
        "lesson_code": new_lesson.lesson_code,
        "message": "Lección duplicada exitosamente"
    }


@router.post("/lessons/{lesson_id_or_uuid}/validate")
async def validate_lesson(
    lesson_id_or_uuid: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Validar estructura JSON (Vía public_id)."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    errors_es = validate_exercises(lesson.content_es or [], "es")
    errors_en = validate_exercises(lesson.content_en or [], "en")

    is_valid = len(errors_es) == 0 and len(errors_en) == 0

    return {
        "is_valid": is_valid,
        "errors_es": errors_es,
        "errors_en": errors_en,
        "exercise_count_es": len(lesson.content_es or []),
        "exercise_count_en": len(lesson.content_en or []),
    }


# ──────────────────────────────────────────────
# EJERCICIOS (dentro de una lección)
# ──────────────────────────────────────────────

@router.post("/lessons/{lesson_id_or_uuid}/exercises")
async def add_exercise(
    lesson_id_or_uuid: str,
    exercise_es: ExerciseCreate,
    exercise_en: Optional[ExerciseCreate] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Agregar ejercicio al final de ambos idiomas."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Construir ejercicio
    ex_es = {
        "type": exercise_es.type,
        "content": exercise_es.content,
    }
    if exercise_es.correct_answer:
        ex_es["correct_answer"] = exercise_es.correct_answer
    if exercise_es.feedback:
        ex_es["feedback"] = exercise_es.feedback
    if exercise_es.character_code:
        ex_es["character_code"] = exercise_es.character_code

    # Para EN, usar la versión EN si se proporciona, o clonar ES
    if exercise_en:
        ex_en = {
            "type": exercise_en.type,
            "content": exercise_en.content,
        }
        if exercise_en.correct_answer:
            ex_en["correct_answer"] = exercise_en.correct_answer
        if exercise_en.feedback:
            ex_en["feedback"] = exercise_en.feedback
        if exercise_en.character_code:
            ex_en["character_code"] = exercise_en.character_code
    else:
        ex_en = ex_es.copy()

    # Capturar estado previo
    prev_es = list(lesson.content_es or [])
    prev_en = list(lesson.content_en or [])

    # Agregar
    new_es = prev_es + [ex_es]
    new_en = prev_en + [ex_en]
    lesson.content_es = new_es
    lesson.content_en = new_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="update",
        field_changed="add_exercise",
        previous_value={"content_es_length": len(prev_es), "content_en_length": len(prev_en)},
        new_value={"added_type": exercise_es.type, "index": len(prev_es)},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": "Ejercicio agregado", "index": len(prev_es)}


@router.put("/lessons/{lesson_id_or_uuid}/exercises/{index}")
async def update_exercise(
    lesson_id_or_uuid: str,
    index: int,
    exercise_es: ExerciseUpdate,
    exercise_en: Optional[ExerciseUpdate] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar ejercicio por índice (0-based)."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    content_es = list(lesson.content_es or [])
    content_en = list(lesson.content_en or [])

    if index < 0 or index >= len(content_es):
        raise HTTPException(400, f"Índice {index} fuera de rango (0-{len(content_es) - 1})")

    prev_es = content_es[index].copy()
    prev_en = content_en[index].copy() if index < len(content_en) else {}

    # Actualizar ES
    update_fields = exercise_es.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        content_es[index][field] = value

    # Actualizar EN
    if exercise_en:
        update_fields_en = exercise_en.model_dump(exclude_unset=True)
        if index < len(content_en):
            for field, value in update_fields_en.items():
                content_en[index][field] = value

    lesson.content_es = content_es
    lesson.content_en = content_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="update",
        field_changed=f"exercise_{index}",
        previous_value={"es": prev_es, "en": prev_en},
        new_value={"es": content_es[index], "en": content_en[index] if index < len(content_en) else None},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": f"Ejercicio #{index} actualizado"}


@router.delete("/lessons/{lesson_id_or_uuid}/exercises/{index}")
async def delete_exercise(
    lesson_id_or_uuid: str,
    index: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar ejercicio por índice."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    content_es = list(lesson.content_es or [])
    content_en = list(lesson.content_en or [])

    if index < 0 or index >= len(content_es):
        raise HTTPException(400, f"Índice {index} fuera de rango")

    prev_es = content_es[index]
    prev_en = content_en[index] if index < len(content_en) else None

    content_es.pop(index)
    if index < len(content_en):
        content_en.pop(index)

    lesson.content_es = content_es
    lesson.content_en = content_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="delete",
        field_changed=f"exercise_{index}",
        previous_value={"es": prev_es, "en": prev_en},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": f"Ejercicio #{index} eliminado"}


@router.put("/lessons/{lesson_id_or_uuid}/exercises/reorder")
async def reorder_exercises(
    lesson_id_or_uuid: str,
    data: ExerciseReorder,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reordenar ejercicios (nuevo arreglo de índices)."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    content_es = list(lesson.content_es or [])
    content_en = list(lesson.content_en or [])

    if sorted(data.new_order) != list(range(len(content_es))):
        raise HTTPException(400, "El nuevo orden debe contener todos los índices existentes")

    prev_order = list(range(len(content_es)))
    new_content_es = [content_es[i] for i in data.new_order]
    new_content_en = [content_en[i] for i in data.new_order if i < len(content_en)]

    lesson.content_es = new_content_es
    lesson.content_en = new_content_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="reorder",
        field_changed="exercises",
        previous_value={"order": prev_order},
        new_value={"order": data.new_order},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": "Ejercicios reordenados exitosamente"}


@router.put("/lessons/{lesson_id_or_uuid}/exercises")
async def update_all_exercises(
    lesson_id_or_uuid: str,
    content_es: List[dict],
    content_en: List[dict],
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar arreglo completo de ejercicios."""
    lesson = db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id_or_uuid).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Validar - Solo si hay ejercicios para validar
    errors_es = []
    errors_en = []

    if content_es and len(content_es) > 0:
        errors_es = validate_exercises(content_es, "es")

    if content_en and len(content_en) > 0:
        errors_en = validate_exercises(content_en, "en")

    if errors_es or errors_en:
        errors_en_translated = translate_errors_to_english(errors_es) if not errors_en else errors_en
        detail_msg = format_validation_error_detail(errors_es, errors_en_translated)
        error_body = format_validation_error_response(errors_es, errors_en_translated)
        raise HTTPException(status_code=422, detail=detail_msg, headers={"X-Validation-Errors": json.dumps(error_body)})

    prev = {"content_es": lesson.content_es, "content_en": lesson.content_en}
    lesson.content_es = content_es
    lesson.content_en = content_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
        entity_public_id=str(lesson.public_id),
        action="update",
        field_changed="full_content",
        previous_value=prev,
        new_value={"content_es": content_es, "content_en": content_en},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": "Contenido actualizado exitosamente"}


# ──────────────────────────────────────────────
# PERSONAJES — CRUD
# ──────────────────────────────────────────────

@router.get("/characters")
async def list_characters(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Listar todos los personajes con sus gestos."""
    characters = db.query(Character).all()
    result = []
    for char in characters:
        gestures = db.query(CharacterGesture).filter(
            CharacterGesture.character_id == char.id
        ).all()
        result.append({
            "public_id": str(char.public_id),
            "code": char.code,
            "name": char.name,
            "description": char.description,
            "default_appearance": char.default_appearance,
            "is_active": char.is_active,
            "created_at": char.created_at.isoformat() if char.created_at else None,
            "gestures": [
                {
                    "id": g.gesture_code,
                    "gesture_code": g.gesture_code,
                    "animation_data": g.animation_data,
                    "duration_ms": g.duration_ms,
                }
                for g in gestures
            ]
        })
    return result


@router.post("/characters", status_code=201)
async def create_character(
    data: CharacterCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Crear nuevo personaje."""
    existing = db.query(Character).filter(Character.code == data.code).first()
    if existing:
        raise HTTPException(400, f"Ya existe un personaje con código '{data.code}'")

    character = Character(
        code=data.code,
        name=data.name,
        description=data.description,
        default_appearance=data.default_appearance,
    )
    db.add(character)
    db.flush()

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="character",
        entity_id=character.id,
        entity_public_id=str(character.public_id),
        action="create",
        new_value={"code": data.code, "name": data.name},
    )

    db.commit()
    db.refresh(character)
    return {"public_id": str(character.public_id), "code": character.code, "message": "Personaje creado"}


@router.put("/characters/{character_id_or_uuid}")
async def update_character(
    character_id_or_uuid: str,
    data: CharacterUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Editar personaje (Vía public_id)."""
    character = db.query(Character).filter(func.cast(Character.public_id, String) == character_id_or_uuid).first()
    
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    previous = {k: getattr(character, k) for k in update_data}

    for field, value in update_data.items():
        setattr(character, field, value)

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="character",
        entity_id=character.id,
        entity_public_id=str(character.public_id),
        action="update",
        previous_value=previous,
        new_value=update_data,
    )

    db.commit()
    return {"message": "Personaje actualizado"}


@router.post("/characters/{character_id_or_uuid}/gestures", status_code=201)
async def add_gesture(
    character_id_or_uuid: str,
    data: GestureCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Agregar gesto (Vía public_id)."""
    character = db.query(Character).filter(func.cast(Character.public_id, String) == character_id_or_uuid).first()
    
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    gesture = CharacterGesture(
        character_id=character.id,
        gesture_code=data.gesture_code,
        animation_data=data.animation_data,
        duration_ms=data.duration_ms,
    )
    db.add(gesture)
    db.flush()

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="gesture",
        entity_id=gesture.id,
        action="create",
        new_value={"gesture_code": data.gesture_code, "character_public_id": str(character.public_id)},
    )

    db.commit()
    return {"id": gesture.gesture_code, "message": "Gesto creado"}


@router.put("/characters/{character_code}/gestures/{gesture_code}")
async def update_gesture(
    character_code: str,
    gesture_code: str,
    data: GestureUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Editar gesto (vía character_code + gesture_code)."""
    character = db.query(Character).filter(Character.code == character_code).first()
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    gesture = db.query(CharacterGesture).filter(
        CharacterGesture.character_id == character.id,
        CharacterGesture.gesture_code == gesture_code
    ).first()
    if not gesture:
        raise HTTPException(404, "Gesto no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    previous = {k: getattr(gesture, k) for k in update_data}

    for field, value in update_data.items():
        setattr(gesture, field, value)

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="gesture",
        entity_id=gesture.id,
        action="update",
        previous_value=previous,
        new_value=update_data,
    )

    db.commit()
    return {"message": "Gesto actualizado"}


@router.delete("/characters/{character_code}/gestures/{gesture_code}")
async def delete_gesture(
    character_code: str,
    gesture_code: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar gesto (vía character_code + gesture_code)."""
    character = db.query(Character).filter(Character.code == character_code).first()
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    gesture = db.query(CharacterGesture).filter(
        CharacterGesture.character_id == character.id,
        CharacterGesture.gesture_code == gesture_code
    ).first()
    if not gesture:
        raise HTTPException(404, "Gesto no encontrado")

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="gesture",
        entity_id=gesture.id,
        action="delete",
        previous_value={
            "gesture_code": gesture.gesture_code,
            "animation_data": gesture.animation_data,
            "duration_ms": gesture.duration_ms,
        },
    )

    db.delete(gesture)
    db.commit()
    return {"message": "Gesto eliminado"}


# ──────────────────────────────────────────────
# AUDIO
# ──────────────────────────────────────────────

@router.get("/audio")
async def list_audio(
    lesson_id: Optional[str] = Query(None),    # accepts lesson_code or lesson public_id
    character_id: Optional[str] = Query(None),  # accepts character_code
    language: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Listar audios con filtros."""
    query = db.query(LessonAudioSegment).filter(LessonAudioSegment.is_active == True)

    if lesson_id:
        # Accept lesson_code or lesson public_id
        lesson = (
            db.query(Lesson).filter(Lesson.lesson_code == lesson_id).first()
            or db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_id).first()
        )
        if lesson:
            query = query.filter(LessonAudioSegment.lesson_id == lesson.id)
    if language:
        query = query.filter(LessonAudioSegment.language_code == language)
    if character_id:
        # Accept character_code as identifier
        char = db.query(Character).filter(Character.code == character_id).first()
        if char:
            query = query.filter(LessonAudioSegment.character_id == char.id)

    total = query.count()
    offset = (page - 1) * page_size
    segments = query.order_by(desc(LessonAudioSegment.id)).offset(offset).limit(page_size).all()

    # Pre-fetch character codes and lesson codes for response (avoids N+1)
    char_ids = {seg.character_id for seg in segments if seg.character_id}
    seg_lesson_ids = {seg.lesson_id for seg in segments if seg.lesson_id}
    char_code_map: dict = {}
    lesson_code_map: dict = {}
    if char_ids:
        chars = db.query(Character.id, Character.code).filter(Character.id.in_(char_ids)).all()
        char_code_map = {c.id: c.code for c in chars}
    if seg_lesson_ids:
        lessons = db.query(Lesson.id, Lesson.lesson_code).filter(Lesson.id.in_(seg_lesson_ids)).all()
        lesson_code_map = {l.id: l.lesson_code for l in lessons}

    items = []
    for seg in segments:
        items.append({
            "public_id": str(seg.public_id),
            "lesson_code": lesson_code_map.get(seg.lesson_id),
            "exercise_id": seg.exercise_id,
            "target_field": getattr(seg, 'target_field', 'main') or 'main',
            "character_code": char_code_map.get(seg.character_id),
            "audio_url": seg.audio_url,
            "transcript": seg.transcript,
            "emotion": seg.emotion,
            "language_code": seg.language_code,
            "source": seg.source,
            "tags": seg.tags or [],
            "is_active": seg.is_active,
            "duration_ms": seg.duration_ms,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/audio/upload")
async def upload_audio(
    file: UploadFile = File(...),
    lesson_public_id: Optional[str] = Form(None),  # lesson public UUID or lesson_code
    exercise_index: Optional[int] = Form(None),
    target_field: str = Form("main"),  # main, statement, question, instruction, feedback_success, feedback_error
    character_code: Optional[str] = Form(None),
    language: str = Form("es"),
    tags: str = Form("[]"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Subir archivo de audio (multipart/form-data)."""
    allowed_types = ["audio/wav", "audio/mpeg", "audio/ogg", "audio/mp3", "audio/x-wav"]
    if file.content_type not in allowed_types:
        raise HTTPException(400, f"Tipo no soportado: {file.content_type}. Permitidos: {allowed_types}")

    audio_data = await file.read()
    if len(audio_data) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(400, "Archivo demasiado grande (máximo 50MB)")

    # Resolve lesson internal id from public_id or lesson_code
    resolved_lesson_id = None
    if lesson_public_id:
        lesson = (
            db.query(Lesson).filter(func.cast(Lesson.public_id, String) == lesson_public_id).first()
            or db.query(Lesson).filter(Lesson.lesson_code == lesson_public_id).first()
        )
        if lesson:
            resolved_lesson_id = lesson.id

    # Obtener character_id
    character_id = None
    if character_code:
        char = db.query(Character).filter(Character.code == character_code).first()
        if char:
            character_id = char.id

    # Intentar subir a Supabase Storage
    audio_url = None
    try:
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        if supabase_url and supabase_key:
            supabase = create_client(supabase_url, supabase_key)
            timestamp = int(time.time())
            ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav"
            storage_path = f"uploads/{str(admin.public_id)}/{timestamp}_{file.filename or 'audio'}.{ext}"
            supabase.storage.from_("littlefounders-audio").upload(
                storage_path, audio_data, {"content-type": file.content_type}
            )
            audio_url = supabase.storage.from_("littlefounders-audio").get_public_url(storage_path)
    except Exception as e:
        print(f"[ADMIN] Error uploading to Supabase Storage: {e}")
        # Continuar sin URL - se puede agregar después

    # Guardar metadata en BD
    try:
        parsed_tags = json.loads(tags) if tags else []
    except json.JSONDecodeError:
        parsed_tags = []

    # Validar target_field
    valid_targets = {'main', 'statement', 'question', 'instruction', 'feedback_success', 'feedback_error'}
    if target_field not in valid_targets:
        target_field = 'main'

    segment = LessonAudioSegment(
        lesson_id=resolved_lesson_id,
        exercise_id=exercise_index,
        target_field=target_field,
        character_id=character_id,
        audio_url=audio_url,
        transcript="",
        emotion="neutral",
        order_index=exercise_index or 0,
        language_code=language,
        source="uploaded",
        uploaded_by=admin.id,
        tags=parsed_tags,
    )
    db.add(segment)
    db.flush()

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="audio",
        entity_id=segment.id,
        action="create",
        new_value={"audio_url": audio_url, "filename": file.filename},
    )
    db.commit()

    return {"public_id": str(segment.public_id), "audio_url": audio_url, "message": "Audio subido exitosamente"}


@router.post("/audio/generate")
async def generate_audio_tts(
    request: AudioGenerateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Generar audio automáticamente con LF Audio Engine (TTS)."""
    try:
        from scripts.lf_audio_client import LFAudioClient
        client = LFAudioClient()
        audio_data = client.generate(
            text=request.text,
            character=request.character_code,
            emotion=request.emotion,
            language_code=request.language_code,
        )
    except ImportError:
        raise HTTPException(501, "LF Audio Engine no disponible en este entorno")
    except Exception as e:
        raise HTTPException(500, f"Error al generar audio: {str(e)}")

    if not audio_data:
        raise HTTPException(500, "Error al generar audio con LF Audio Engine")

    # Subir a Supabase Storage
    audio_url = None
    try:
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        if supabase_url and supabase_key:
            supabase = create_client(supabase_url, supabase_key)
            storage_path = (
                f"lessons/{request.lesson_public_id or 'drafts'}/"
                f"{request.exercise_index or 0}_{request.character_code}_{request.emotion}.wav"
            )
            try:
                supabase.storage.from_("littlefounders-audio").remove([storage_path])
            except:
                pass
            supabase.storage.from_("littlefounders-audio").upload(
                storage_path, audio_data, {"content-type": "audio/wav"}
            )
            audio_url = supabase.storage.from_("littlefounders-audio").get_public_url(storage_path)
    except Exception as e:
        print(f"[ADMIN] Error uploading generated audio: {e}")

    # Resolve lesson internal id from lesson_public_id
    resolved_lesson_id = None
    if request.lesson_public_id:
        lesson = (
            db.query(Lesson).filter(func.cast(Lesson.public_id, String) == request.lesson_public_id).first()
            or db.query(Lesson).filter(Lesson.lesson_code == request.lesson_public_id).first()
        )
        if lesson:
            resolved_lesson_id = lesson.id

    # Obtener character_id
    character_id = None
    char = db.query(Character).filter(Character.code == request.character_code).first()
    if char:
        character_id = char.id

    # Validar target_field
    valid_targets = {'main', 'statement', 'question', 'instruction', 'feedback_success', 'feedback_error'}
    req_target = getattr(request, 'target_field', 'main') or 'main'
    if req_target not in valid_targets:
        req_target = 'main'

    segment = LessonAudioSegment(
        lesson_id=resolved_lesson_id,
        exercise_id=request.exercise_index,
        target_field=req_target,
        character_id=character_id,
        audio_url=audio_url,
        transcript=request.text,
        emotion=request.emotion,
        order_index=request.exercise_index or 0,
        language_code=request.language_code,
        source="generated",
        uploaded_by=admin.id,
    )
    db.add(segment)
    db.commit()

    return {
        "public_id": str(segment.public_id),
        "audio_url": audio_url,
        "message": "Audio generado exitosamente"
    }


@router.delete("/audio/{audio_id_or_uuid}")
async def delete_audio(
    audio_id_or_uuid: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar audio (Vía public_id)."""
    segment = db.query(LessonAudioSegment).filter(func.cast(LessonAudioSegment.public_id, String) == audio_id_or_uuid).first()
    
    if not segment:
        raise HTTPException(404, "Audio no encontrado")

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="audio",
        entity_id=segment.id,
        action="delete",
        previous_value={"audio_url": segment.audio_url, "transcript": segment.transcript},
    )

    segment.is_active = False
    db.commit()
    return {"message": "Audio eliminado"}


# ──────────────────────────────────────────────
# HISTORIAL
# ──────────────────────────────────────────────

@router.get("/history")
async def list_history(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),   # accepts entity_public_id (UUID string)
    user_id: Optional[str] = Query(None),       # accepts editor public_id (UUID string)
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Historial global con paginación y filtros."""
    query = db.query(ContentEditHistory)

    if entity_type:
        query = query.filter(ContentEditHistory.entity_type == entity_type)
    if entity_id:
        query = query.filter(ContentEditHistory.entity_public_id == entity_id)
    if user_id:
        editor_user = db.query(User).filter(func.cast(User.public_id, String) == user_id).first()
        if editor_user:
            query = query.filter(ContentEditHistory.editor_user_id == editor_user.id)
    if action:
        query = query.filter(ContentEditHistory.action == action)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(ContentEditHistory.created_at >= dt)
        except:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(ContentEditHistory.created_at <= dt)
        except:
            pass

    total = query.count()
    offset = (page - 1) * page_size
    entries = query.order_by(desc(ContentEditHistory.created_at)).offset(offset).limit(page_size).all()

    items = []
    for entry in entries:
        editor = db.query(User).filter(User.id == entry.editor_user_id).first()
        items.append({
            "id": str(entry.public_id),
            "editor_public_id": str(editor.public_id) if editor else None,
            "editor_name": editor.name if editor else None,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_public_id or "",
            "action": entry.action,
            "field_changed": entry.field_changed,
            "previous_value": entry.previous_value,
            "new_value": entry.new_value,
            "metadata": entry.edit_metadata,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/history/entity/{entity_type}/{entity_public_id}")
async def get_entity_history(
    entity_type: str,
    entity_public_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Historial de una entidad específica (vía entity_public_id)."""
    entries = db.query(ContentEditHistory).filter(
        ContentEditHistory.entity_type == entity_type,
        ContentEditHistory.entity_public_id == entity_public_id,
    ).order_by(desc(ContentEditHistory.created_at)).all()

    items = []
    for entry in entries:
        editor = db.query(User).filter(User.id == entry.editor_user_id).first()
        items.append({
            "id": str(entry.public_id),
            "editor_public_id": str(editor.public_id) if editor else None,
            "editor_name": editor.name if editor else None,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_public_id or "",
            "action": entry.action,
            "field_changed": entry.field_changed,
            "previous_value": entry.previous_value,
            "new_value": entry.new_value,
            "metadata": entry.edit_metadata,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        })

    return items


@router.post("/history/{history_public_id}/rollback")
async def rollback_history(
    history_public_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revertir a un estado anterior (vía history public_id)."""
    history_entry = db.query(ContentEditHistory).filter(
        func.cast(ContentEditHistory.public_id, String) == history_public_id
    ).first()
    if not history_entry:
        raise HTTPException(404, "Entrada de historial no encontrada")
    try:
        entity = rollback_edit(db, history_entry.id, admin.id)
        db.commit()
        entity_public_id = str(entity.public_id) if hasattr(entity, 'public_id') else None
        return {"message": "Restauración exitosa", "entity_public_id": entity_public_id}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ──────────────────────────────────────────────
# USUARIOS ADMIN
# ──────────────────────────────────────────────

@router.get("/users")
async def list_admin_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Listar todos los usuarios (con foco en admins)."""
    users = db.query(User).order_by(
        # Admins primero
        desc(User.user_type == UserType.ADMIN.value),
        User.name
    ).limit(100).all()

    return [
        {
            "id": str(u.public_id), # Map public_id to id for frontend compatibility
            "name": u.name,
            "email": u.email,
            "user_type": u.user_type,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/users/{public_id}/promote")
async def promote_to_admin(
    public_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Promover usuario a admin."""
    user = db.query(User).filter(User.public_id == public_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    if user.user_type == UserType.ADMIN.value:
        raise HTTPException(400, "El usuario ya es admin")

    # Domain- **Dashboard Integrity & Performance**: Admin Dashboard statistics and recent activity now use secure identifiers. Additionally, the stats query was optimized using native Postgres `jsonb_array_length`, preventing database timeouts and locks by avoiding massive data transfers.
    if not user.email or not user.email.endswith("@littlefounders.ai"):
        raise HTTPException(
            status_code=403,
            detail="Solo correos con el dominio @littlefounders.ai pueden ser administradores."
        )

    prev_type = user.user_type
    user.user_type = UserType.ADMIN.value

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        entity_public_id=str(user.public_id),
        action="update",
        field_changed="user_type",
        previous_value={"user_type": prev_type},
        new_value={"user_type": UserType.ADMIN.value},
    )

    db.commit()
    return {"message": f"Usuario {user.name} promovido a admin"}


@router.post("/users/{public_id}/demote")
async def demote_from_admin(
    public_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revocar rol admin."""
    user = db.query(User).filter(User.public_id == public_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    if user.id == admin.id:
        raise HTTPException(400, "No puedes revocar tu propio rol de admin")

    if user.user_type != UserType.ADMIN.value:
        raise HTTPException(400, "El usuario no es admin")

    user.user_type = UserType.UNIVERSAL.value

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        entity_public_id=str(user.public_id),
        action="update",
        field_changed="user_type",
        previous_value={"user_type": UserType.ADMIN.value},
        new_value={"user_type": UserType.UNIVERSAL.value},
    )

    db.commit()
    return {"message": f"Rol admin revocado para {user.name}"}


# ──────────────────────────────────────────────
# UTILIDADES
# ──────────────────────────────────────────────

@router.get("/exercise-types")
async def get_exercise_types(
    admin: User = Depends(require_admin),
):
    """Retorna la lista de los 40 tipos de ejercicio válidos."""
    return {"types": VALID_EXERCISE_TYPES}


def _serialize_for_json(obj):
    """Helper para serializar valores antes de guardar en historial JSONB."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {k: _serialize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_for_json(i) for i in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj
