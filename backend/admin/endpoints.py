"""
backend/admin/endpoints.py
Todos los endpoints del admin panel, protegidos por require_admin.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from typing import Optional, List
from datetime import datetime
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

    # Contar ejercicios sumando longitudes de content_es
    lessons = db.query(Lesson.content_es).all()
    total_exercises = sum(
        len(l.content_es) if l.content_es and isinstance(l.content_es, list) else 0
        for l in lessons
    )

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
        editor = db.query(User.name).filter(User.id == entry.editor_user_id).scalar()
        recent_edits.append({
            "id": entry.id,
            "editor_user_id": entry.editor_user_id,
            "editor_name": editor,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "action": entry.action,
            "field_changed": entry.field_changed,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "metadata": entry.edit_metadata,
        })

    return {
        "total_lessons": total_lessons,
        "total_exercises": total_exercises,
        "total_characters": total_characters,
        "total_audio_segments": total_audio,
        "recent_edits": recent_edits,
        "lessons_by_adventure": lessons_by_adventure,
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
            "id": lesson.id,
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


@router.get("/lessons/{lesson_id}")
async def get_lesson(
    lesson_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Obtener lección completa con contenido JSON."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    return {
        "id": lesson.id,
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
    if data.content_es:
        errors = validate_exercises(data.content_es, "es")
        if errors:
            raise HTTPException(422, {"errors": errors, "language": "es"})
    if data.content_en:
        errors = validate_exercises(data.content_en, "en")
        if errors:
            raise HTTPException(422, {"errors": errors, "language": "en"})

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
        action="create",
        new_value={"lesson_code": data.lesson_code, "title_es": data.title_es},
        metadata={"lesson_code": data.lesson_code}
    )

    db.commit()
    db.refresh(lesson)

    return {
        "id": lesson.id,
        "lesson_code": lesson.lesson_code,
        "message": "Lección creada exitosamente"
    }


@router.put("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: int,
    data: LessonFullUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar lección (metadata + contenido)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Validar ejercicios si se proporcionan
    if data.content_es is not None:
        errors = validate_exercises(data.content_es, "es")
        if errors:
            raise HTTPException(422, {"errors": errors, "language": "es"})
    if data.content_en is not None:
        errors = validate_exercises(data.content_en, "en")
        if errors:
            raise HTTPException(422, {"errors": errors, "language": "en"})

    # Capturar estado anterior
    previous = {}
    update_data = data.model_dump(exclude_unset=True)
    for field in update_data:
        previous[field] = getattr(lesson, field, None)

    # Verificar si lesson_code cambia y ya existe
    if data.lesson_code and data.lesson_code != lesson.lesson_code:
        existing = db.query(Lesson).filter(
            Lesson.lesson_code == data.lesson_code,
            Lesson.id != lesson_id
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
        action="update",
        field_changed="full_update",
        previous_value=_serialize_for_json(previous),
        new_value=_serialize_for_json(update_data),
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    db.refresh(lesson)

    return {
        "id": lesson.id,
        "lesson_code": lesson.lesson_code,
        "message": "Lección actualizada exitosamente"
    }


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar lección (verificar dependencias)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Registrar antes de eliminar
    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
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


@router.post("/lessons/{lesson_id}/duplicate")
async def duplicate_lesson(
    lesson_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Duplicar una lección como plantilla."""
    original = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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
        action="create",
        new_value={"duplicated_from": lesson_id, "lesson_code": new_code},
        metadata={"original_lesson_code": base_code}
    )

    db.commit()
    db.refresh(new_lesson)

    return {
        "id": new_lesson.id,
        "lesson_code": new_lesson.lesson_code,
        "message": "Lección duplicada exitosamente"
    }


@router.post("/lessons/{lesson_id}/validate")
async def validate_lesson(
    lesson_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Validar estructura JSON sin guardar."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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

@router.post("/lessons/{lesson_id}/exercises")
async def add_exercise(
    lesson_id: int,
    exercise_es: ExerciseCreate,
    exercise_en: Optional[ExerciseCreate] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Agregar ejercicio al final de ambos idiomas."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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
        action="update",
        field_changed="add_exercise",
        previous_value={"content_es_length": len(prev_es), "content_en_length": len(prev_en)},
        new_value={"added_type": exercise_es.type, "index": len(prev_es)},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": "Ejercicio agregado", "index": len(prev_es)}


@router.put("/lessons/{lesson_id}/exercises/{index}")
async def update_exercise(
    lesson_id: int,
    index: int,
    exercise_es: ExerciseUpdate,
    exercise_en: Optional[ExerciseUpdate] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar ejercicio por índice (0-based)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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
        action="update",
        field_changed=f"exercise_{index}",
        previous_value={"es": prev_es, "en": prev_en},
        new_value={"es": content_es[index], "en": content_en[index] if index < len(content_en) else None},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": f"Ejercicio #{index} actualizado"}


@router.delete("/lessons/{lesson_id}/exercises/{index}")
async def delete_exercise(
    lesson_id: int,
    index: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar ejercicio por índice."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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
        action="delete",
        field_changed=f"exercise_{index}",
        previous_value={"es": prev_es, "en": prev_en},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": f"Ejercicio #{index} eliminado"}


@router.put("/lessons/{lesson_id}/exercises/reorder")
async def reorder_exercises(
    lesson_id: int,
    data: ExerciseReorder,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reordenar ejercicios (nuevo arreglo de índices)."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
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
        action="reorder",
        field_changed="exercises",
        previous_value={"order": prev_order},
        new_value={"order": data.new_order},
        metadata={"lesson_code": lesson.lesson_code}
    )

    db.commit()
    return {"message": "Ejercicios reordenados exitosamente"}


@router.put("/lessons/{lesson_id}/exercises")
async def update_all_exercises(
    lesson_id: int,
    content_es: List[dict],
    content_en: List[dict],
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Actualizar arreglo completo de ejercicios."""
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lección no encontrada")

    # Validar
    errors_es = validate_exercises(content_es, "es")
    if errors_es:
        raise HTTPException(422, {"errors": errors_es, "language": "es"})
    errors_en = validate_exercises(content_en, "en")
    if errors_en:
        raise HTTPException(422, {"errors": errors_en, "language": "en"})

    prev = {"content_es": lesson.content_es, "content_en": lesson.content_en}
    lesson.content_es = content_es
    lesson.content_en = content_en

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="lesson",
        entity_id=lesson.id,
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
            "id": char.id,
            "code": char.code,
            "name": char.name,
            "description": char.description,
            "default_appearance": char.default_appearance,
            "is_active": char.is_active,
            "created_at": char.created_at.isoformat() if char.created_at else None,
            "gestures": [
                {
                    "id": g.id,
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
        action="create",
        new_value={"code": data.code, "name": data.name},
    )

    db.commit()
    db.refresh(character)
    return {"id": character.id, "code": character.code, "message": "Personaje creado"}


@router.put("/characters/{character_id}")
async def update_character(
    character_id: int,
    data: CharacterUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Editar personaje."""
    character = db.query(Character).filter(Character.id == character_id).first()
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
        action="update",
        previous_value=previous,
        new_value=update_data,
    )

    db.commit()
    return {"message": "Personaje actualizado"}


@router.post("/characters/{character_id}/gestures", status_code=201)
async def add_gesture(
    character_id: int,
    data: GestureCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Agregar gesto a un personaje."""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    gesture = CharacterGesture(
        character_id=character_id,
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
        new_value={"gesture_code": data.gesture_code, "character_id": character_id},
    )

    db.commit()
    return {"id": gesture.id, "message": "Gesto creado"}


@router.put("/characters/{character_id}/gestures/{gesture_id}")
async def update_gesture(
    character_id: int,
    gesture_id: int,
    data: GestureUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Editar gesto."""
    gesture = db.query(CharacterGesture).filter(
        CharacterGesture.id == gesture_id,
        CharacterGesture.character_id == character_id
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


@router.delete("/characters/{character_id}/gestures/{gesture_id}")
async def delete_gesture(
    character_id: int,
    gesture_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar gesto."""
    gesture = db.query(CharacterGesture).filter(
        CharacterGesture.id == gesture_id,
        CharacterGesture.character_id == character_id
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
    lesson_id: Optional[int] = Query(None),
    character_code: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Listar audios con filtros."""
    query = db.query(LessonAudioSegment).filter(LessonAudioSegment.is_active == True)

    if lesson_id:
        query = query.filter(LessonAudioSegment.lesson_id == lesson_id)
    if language:
        query = query.filter(LessonAudioSegment.language_code == language)
    if character_code:
        char = db.query(Character).filter(Character.code == character_code).first()
        if char:
            query = query.filter(LessonAudioSegment.character_id == char.id)

    total = query.count()
    offset = (page - 1) * page_size
    segments = query.order_by(desc(LessonAudioSegment.id)).offset(offset).limit(page_size).all()

    items = []
    for seg in segments:
        items.append({
            "id": seg.id,
            "lesson_id": seg.lesson_id,
            "exercise_id": seg.exercise_id,
            "character_id": seg.character_id,
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
    lesson_id: Optional[int] = Form(None),
    exercise_index: Optional[int] = Form(None),
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
            storage_path = f"uploads/{admin.id}/{timestamp}_{file.filename or 'audio'}.{ext}"
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

    segment = LessonAudioSegment(
        lesson_id=lesson_id,
        exercise_id=exercise_index,
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

    return {"id": segment.id, "audio_url": audio_url, "message": "Audio subido exitosamente"}


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
                f"lessons/{request.lesson_id or 'drafts'}/"
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

    # Obtener character_id
    character_id = None
    char = db.query(Character).filter(Character.code == request.character_code).first()
    if char:
        character_id = char.id

    segment = LessonAudioSegment(
        lesson_id=request.lesson_id,
        exercise_id=request.exercise_index,
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
        "id": segment.id,
        "audio_url": audio_url,
        "message": "Audio generado exitosamente"
    }


@router.delete("/audio/{audio_id}")
async def delete_audio(
    audio_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Eliminar audio (soft delete)."""
    segment = db.query(LessonAudioSegment).filter(LessonAudioSegment.id == audio_id).first()
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
    entity_id: Optional[int] = Query(None),
    editor_user_id: Optional[int] = Query(None),
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
        query = query.filter(ContentEditHistory.entity_id == entity_id)
    if editor_user_id:
        query = query.filter(ContentEditHistory.editor_user_id == editor_user_id)
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
        editor_name = db.query(User.name).filter(User.id == entry.editor_user_id).scalar()
        items.append({
            "id": entry.id,
            "editor_user_id": entry.editor_user_id,
            "editor_name": editor_name,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "action": entry.action,
            "field_changed": entry.field_changed,
            "previous_value": entry.previous_value,
            "new_value": entry.new_value,
            "metadata": entry.edit_metadata,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/history/entity/{entity_type}/{entity_id}")
async def get_entity_history(
    entity_type: str,
    entity_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Historial de una entidad específica."""
    entries = db.query(ContentEditHistory).filter(
        ContentEditHistory.entity_type == entity_type,
        ContentEditHistory.entity_id == entity_id,
    ).order_by(desc(ContentEditHistory.created_at)).all()

    items = []
    for entry in entries:
        editor_name = db.query(User.name).filter(User.id == entry.editor_user_id).scalar()
        items.append({
            "id": entry.id,
            "editor_user_id": entry.editor_user_id,
            "editor_name": editor_name,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "action": entry.action,
            "field_changed": entry.field_changed,
            "previous_value": entry.previous_value,
            "new_value": entry.new_value,
            "metadata": entry.edit_metadata,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        })

    return items


@router.post("/history/{history_id}/rollback")
async def rollback_history(
    history_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revertir a un estado anterior."""
    try:
        entity = rollback_edit(db, history_id, admin.id)
        db.commit()
        return {"message": "Restauración exitosa", "entity_id": entity.id}
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
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "user_type": u.user_type,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/users/{user_id}/promote")
async def promote_to_admin(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Promover usuario a admin."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    if user.user_type == UserType.ADMIN.value:
        raise HTTPException(400, "El usuario ya es admin")

    prev_type = user.user_type
    user.user_type = UserType.ADMIN.value

    record_edit(
        db=db,
        editor_user_id=admin.id,
        entity_type="user",
        entity_id=user.id,
        action="update",
        field_changed="user_type",
        previous_value={"user_type": prev_type},
        new_value={"user_type": UserType.ADMIN.value},
    )

    db.commit()
    return {"message": f"Usuario {user.name} promovido a admin"}


@router.post("/users/{user_id}/demote")
async def demote_from_admin(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revocar rol admin."""
    user = db.query(User).filter(User.id == user_id).first()
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
