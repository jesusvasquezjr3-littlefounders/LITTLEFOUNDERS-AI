#!/usr/bin/env python3
"""
LittleFounders Lesson Import — UPSERT idempotente y seguro
==========================================================

Reemplaza el viejo wipe-and-reload (DELETE FROM lessons + user_lesson_progress)
por un UPSERT idempotente por `lesson_code` que PRESERVA `lessons.id` (y por
tanto los FK de `user_lesson_progress` — el progreso de los usuarios NO se borra).

Seguridad (bloqueador #1 de la auditoría):
  - DRY-RUN POR DEFECTO: sin --commit no escribe nada (reporta qué cambiaría).
  - Escribir requiere --commit Y --prod (no hay BD de staging separada; --prod es
    el reconocimiento explícito de que esto toca producción).
  - BACKUP automático de la tabla `lessons` antes de cualquier commit (--no-backup
    para omitir bajo tu propio riesgo).
  - El conteo esperado se deriva de la FUENTE (manifest o --source), no de un
    hardcode obsoleto; un mismatch ADVIERTE pero el upsert es seguro (no borra).
  - Validación ligera por lección; las inválidas se SALTAN y reportan (no abortan).

Uso:
    python scripts/import_lessons.py                     # DRY-RUN del corpus (manifest)
    python scripts/import_lessons.py --commit --prod     # aplica upsert a prod (con backup)
    python scripts/import_lessons.py --source lesson_factory/pilot_batch_v2  # publica un dir de la fábrica (dry-run)
    python scripts/import_lessons.py --source ... --require-approved --commit --prod
    python scripts/import_lessons.py --count             # cuenta lo que hay en la BD
    python scripts/import_lessons.py --verify            # verifica contra la fuente
    python scripts/import_lessons.py --backup-only out.json  # solo respalda

NOTA: la provenance (lf_meta) aún NO se persiste en la BD (requiere una migración
que añada una columna `provenance JSONB` a `lessons`). --require-approved usa
lf_meta.gate del archivo FUENTE para filtrar, aunque no se almacene todavía.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text  # noqa: E402

from database import SessionLocal  # noqa: E402
from models import Lesson  # noqa: E402

LESSONS_DIR = Path(__file__).parent.parent / "lesson_engine" / "littlefounders_lessons"
MANIFEST_FILE = LESSONS_DIR / "manifest.json"
BACKUP_DIR = Path(__file__).parent.parent / "backups"

# Campos del modelo Lesson que el upsert escribe (id/public_id/created_at se preservan).
UPSERT_FIELDS = (
    "title_es", "title_en", "description_es", "description_en", "duration",
    "age_rate", "points_reward", "adventure_level", "saga_level", "topic_level",
    "lesson_number", "content_es", "content_en",
)
REQUIRED_FIELDS = ("lesson_code", "title_es", "title_en", "adventure_level",
                   "saga_level", "topic_level", "lesson_number", "content_es", "content_en")


def load_manifest() -> dict:
    with open(MANIFEST_FILE, encoding="utf-8") as f:
        return json.load(f)


def _lesson_from_data(data: dict) -> dict:
    """Normaliza un dict de lección a los kwargs del modelo (subconjunto conocido)."""
    return {
        "lesson_code": data["lesson_code"],
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


def _validate(data: dict, require_approved: bool) -> str | None:
    """Devuelve un mensaje de error si la lección no es importable; None si OK."""
    for f in REQUIRED_FIELDS:
        if data.get(f) in (None, "", [], {}):
            return f"falta campo requerido '{f}'"
    if not isinstance(data.get("content_es"), list) or not isinstance(data.get("content_en"), list):
        return "content_es/content_en deben ser listas"
    if len(data["content_es"]) != len(data["content_en"]):
        return f"paridad ES/EN rota ({len(data['content_es'])} vs {len(data['content_en'])})"
    if require_approved:
        gate = (data.get("lf_meta") or {}).get("gate")
        if gate != "passed":
            return "no aprobada (lf_meta.gate != 'passed')"
    return None


def iter_source_lessons(manifest: dict | None, source_dir: Path | None, adventure_filter: int | None):
    """Itera dicts de lección desde un directorio (--source) o desde el manifest."""
    if source_dir is not None:
        for path in sorted(source_dir.rglob("*.json")):
            if path.name in ("manifest.json", "manifest.lock"):
                continue
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception as e:
                print(f"   ⚠ no se pudo leer {path.name}: {e}")
                continue
            if not isinstance(data, dict) or "lesson_code" not in data:
                continue
            if adventure_filter and int(str(data["lesson_code"]).split("-")[0]) != adventure_filter:
                continue
            yield data
    else:
        for info in manifest["lessons_index"]:
            code = info["lesson_code"]
            if adventure_filter and int(code.split("-")[0]) != adventure_filter:
                continue
            yield json.loads((LESSONS_DIR / info["file_path"]).read_text(encoding="utf-8"))


def _serialize_lesson(row: Lesson) -> dict:
    out = {"id": row.id, "public_id": str(row.public_id) if row.public_id else None,
           "lesson_code": row.lesson_code}
    for f in UPSERT_FIELDS:
        out[f] = getattr(row, f)
    for ts in ("created_at", "updated_at"):
        v = getattr(row, ts, None)
        out[ts] = v.isoformat() if v else None
    return out


def backup_lessons(db, out_path: Path) -> int:
    """Respalda toda la tabla `lessons` a un JSON. Devuelve el número de filas."""
    rows = db.query(Lesson).all()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"backed_up_at": datetime.now().isoformat(), "count": len(rows),
               "lessons": [_serialize_lesson(r) for r in rows]}
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"   💾 backup: {len(rows)} lecciones → {out_path}")
    return len(rows)


def upsert_lessons(db, lessons: list[dict], dry_run: bool, require_approved: bool) -> dict:
    """UPSERT idempotente por lesson_code. Actualiza in-place (preserva id) o inserta.
    En dry-run hace rollback al final y solo reporta."""
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "errors": 0}
    for data in lessons:
        err = _validate(data, require_approved)
        if err:
            stats["skipped"] += 1
            print(f"   ⏭️  {data.get('lesson_code', '???')}: {err}")
            continue
        try:
            fields = _lesson_from_data(data)
            existing = db.query(Lesson).filter_by(lesson_code=fields["lesson_code"]).one_or_none()
            if existing is not None:
                for k in UPSERT_FIELDS:
                    setattr(existing, k, fields[k])
                stats["updated"] += 1
            else:
                db.add(Lesson(**fields))
                stats["inserted"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"   ❌ {data.get('lesson_code', '???')}: {e}")
            db.rollback()
            raise
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return stats


def verify_import(db, expected: int | None = None, expected_by_adv: dict | None = None) -> bool:
    print("\n🔍 Verificando...")
    total = db.execute(text("SELECT COUNT(*) FROM lessons")).scalar()
    print(f"   Total en BD: {total}" + (f" (fuente: {expected})" if expected is not None else ""))
    ok = True
    if expected is not None and total != expected:
        print(f"   ⚠️  BD ({total}) != fuente ({expected}) — revisa (el upsert no borra, así que puede ser intencional)")
    res = db.execute(text("SELECT adventure_level, COUNT(*) FROM lessons GROUP BY adventure_level ORDER BY adventure_level"))
    for adv, count in res.fetchall():
        exp = (expected_by_adv or {}).get(adv)
        mark = "✅" if (exp is None or count == exp) else "⚠️"
        print(f"   {mark} Aventura {adv}: {count}" + (f"/{exp}" if exp else ""))
    dupes = db.execute(text("SELECT lesson_code, COUNT(*) c FROM lessons GROUP BY lesson_code HAVING COUNT(*)>1")).fetchall()
    if dupes:
        print(f"   ❌ {len(dupes)} lesson_code duplicados!")
        ok = False
    else:
        print("   ✅ Sin lesson_code duplicados")
    return ok


def count_lessons(db) -> int:
    total = db.execute(text("SELECT COUNT(*) FROM lessons")).scalar()
    print(f"\n📊 Lecciones en BD: {total}")
    for adv, count in db.execute(text("SELECT adventure_level, COUNT(*) FROM lessons GROUP BY adventure_level ORDER BY adventure_level")).fetchall():
        print(f"   Aventura {adv}: {count}")
    return total


def main():
    p = argparse.ArgumentParser(description="Import/upsert seguro de lecciones LittleFounders")
    p.add_argument("--source", help="directorio con lecciones JSON a publicar (default: corpus del manifest)")
    p.add_argument("--adventure", type=int, help="filtrar a una aventura (1-6)")
    p.add_argument("--commit", action="store_true", help="aplica los cambios (sin esto = DRY-RUN)")
    p.add_argument("--prod", action="store_true", help="reconoce que la BD configurada es PRODUCCIÓN (requerido para escribir)")
    p.add_argument("--require-approved", action="store_true", help="solo importa lecciones con lf_meta.gate=='passed'")
    p.add_argument("--no-backup", action="store_true", help="omite el backup previo (no recomendado)")
    p.add_argument("--verify", action="store_true", help="solo verifica contra la fuente")
    p.add_argument("--count", action="store_true", help="solo cuenta lo que hay en la BD")
    p.add_argument("--backup-only", help="solo respalda la tabla lessons al path dado y termina")
    args = p.parse_args()

    print("=" * 60)
    print("🏫 LittleFounders — Import/Upsert seguro de lecciones")
    print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    source_dir = Path(args.source).resolve() if args.source else None
    if source_dir and not source_dir.exists():
        print(f"❌ --source no existe: {source_dir}"); sys.exit(1)
    if source_dir is None and not MANIFEST_FILE.exists():
        print(f"❌ manifest no encontrado: {MANIFEST_FILE}"); sys.exit(1)

    db = SessionLocal()
    try:
        if args.count:
            count_lessons(db); return
        if args.backup_only:
            backup_lessons(db, Path(args.backup_only)); return

        manifest = None if source_dir else load_manifest()
        lessons = list(iter_source_lessons(manifest, source_dir, args.adventure))
        src_desc = f"--source {source_dir.name}" if source_dir else f"manifest ({manifest['total_lessons']} declaradas)"
        print(f"📖 Fuente: {src_desc} → {len(lessons)} lecciones leídas")

        expected = len(lessons)
        by_adv = {}
        for d in lessons:
            by_adv[d.get("adventure_level", int(str(d["lesson_code"]).split("-")[0]))] = \
                by_adv.get(d.get("adventure_level", int(str(d["lesson_code"]).split("-")[0])), 0) + 1

        if args.verify:
            verify_import(db, expected, by_adv); return

        # ── Guardas de escritura ──
        writing = args.commit
        if writing and not args.prod:
            print("\n🛑 --commit requiere --prod (no hay BD de staging separada; --prod reconoce "
                  "que la BD configurada es PRODUCCIÓN). Abortando para proteger los datos.")
            sys.exit(2)
        if writing and not args.no_backup:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_lessons(db, BACKUP_DIR / f"lessons_backup_{ts}.json")
        if not writing:
            print("\n🧪 DRY-RUN (no se escribe nada). Usa --commit --prod para aplicar.")

        print(f"\n🚀 {'APLICANDO upsert' if writing else 'Simulando upsert'}"
              f"{' [solo aprobadas]' if args.require_approved else ''}...")
        stats = upsert_lessons(db, lessons, dry_run=not writing, require_approved=args.require_approved)
        print(f"\n   inserciones: {stats['inserted']} · actualizaciones: {stats['updated']} · "
              f"saltadas: {stats['skipped']} · errores: {stats['errors']}")

        if writing:
            verify_import(db, None, by_adv)
            print(f"\n✅ Upsert aplicado. ({stats['inserted']} nuevas, {stats['updated']} actualizadas)")
        else:
            print(f"\n✅ DRY-RUN completo: {stats['inserted']} se insertarían, {stats['updated']} se actualizarían, "
                  f"{stats['skipped']} se saltarían. Nada escrito.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
    print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
