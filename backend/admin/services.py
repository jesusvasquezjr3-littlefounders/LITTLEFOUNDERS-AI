"""
backend/admin/services.py
Lógica para registrar automáticamente cada cambio en el historial.
"""
from sqlalchemy.orm import Session
from models import ContentEditHistory, Lesson, Character, CharacterGesture


def record_edit(
    db: Session,
    editor_user_id: int,
    entity_type: str,
    entity_id: int,
    action: str,
    field_changed: str = None,
    previous_value=None,
    new_value=None,
    metadata: dict = None
):
    """
    Registra una edición en el historial.
    Llamar ANTES de aplicar el cambio para capturar previous_value.
    """
    entry = ContentEditHistory(
        editor_user_id=editor_user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        field_changed=field_changed,
        previous_value=previous_value,
        new_value=new_value,
        edit_metadata=metadata
    )
    db.add(entry)
    # No hacer commit aquí — se hace en el endpoint junto con el cambio real


def rollback_edit(db: Session, history_entry_id: int, admin_user_id: int):
    """
    Restaura el estado anterior de una entidad usando el historial.
    1. Lee el previous_value del history entry
    2. Aplica ese valor a la entidad original
    3. Registra la restauración como nuevo entry con action='rollback'
    """
    entry = db.query(ContentEditHistory).filter(
        ContentEditHistory.id == history_entry_id
    ).first()

    if not entry:
        raise ValueError("Entrada de historial no encontrada")
    if entry.previous_value is None:
        raise ValueError("No se puede restaurar: sin valor anterior")

    model_map = {
        "lesson": Lesson,
        "character": Character,
        "gesture": CharacterGesture,
    }

    Model = model_map.get(entry.entity_type)
    if not Model:
        raise ValueError(f"Tipo de entidad desconocido: {entry.entity_type}")

    entity = db.query(Model).filter(Model.id == entry.entity_id).first()
    if not entity:
        raise ValueError(f"{entry.entity_type} con ID {entry.entity_id} no encontrado")

    # Capturar estado actual antes de restaurar
    current_value = {}
    if entry.field_changed and entry.field_changed != "full_update":
        current_value[entry.field_changed] = getattr(entity, entry.field_changed, None)
    else:
        for key, val in entry.previous_value.items():
            current_value[key] = getattr(entity, key, None)

    # Aplicar restauración
    if entry.field_changed and entry.field_changed in entry.previous_value:
        setattr(entity, entry.field_changed, entry.previous_value[entry.field_changed])
    else:
        for key, val in entry.previous_value.items():
            if hasattr(entity, key):
                setattr(entity, key, val)

    # Registrar rollback en historial
    record_edit(
        db=db,
        editor_user_id=admin_user_id,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        action="rollback",
        field_changed=entry.field_changed,
        previous_value=current_value,
        new_value=entry.previous_value,
        edit_metadata={"rolled_back_from_history_id": entry.id}
    )

    return entity
