#!/usr/bin/env python3
"""
LittleFounders Lesson Import Script
Imports 3,072 lessons from JSON files to PostgreSQL database.

Usage:
    python scripts/import_lessons.py              # Full import
    python scripts/import_lessons.py --verify     # Verify after import
    python scripts/import_lessons.py --count      # Just count existing lessons
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from database import SessionLocal
from models import Lesson

# Constants
LESSONS_DIR = Path(__file__).parent.parent / "lesson_engine" / "littlefounders_lessons"
MANIFEST_FILE = LESSONS_DIR / "manifest.json"

# Expected counts per adventure
EXPECTED_COUNTS = {
    1: 480,
    2: 480,
    3: 480,
    4: 480,
    5: 576,
    6: 576
}
TOTAL_EXPECTED = 3072


def load_manifest():
    """Load the lessons manifest."""
    with open(MANIFEST_FILE, encoding='utf-8') as f:
        return json.load(f)


def load_lesson_file(file_path: str) -> dict:
    """Load a single lesson JSON file."""
    full_path = LESSONS_DIR / file_path
    with open(full_path, encoding='utf-8') as f:
        return json.load(f)


def clear_existing_data(db):
    """Delete existing lessons and user progress."""
    print("\n🗑️  Clearing existing data...")

    # Delete user progress first (FK constraint)
    result = db.execute(text("DELETE FROM user_lesson_progress"))
    print(f"   Deleted {result.rowcount} user_lesson_progress records")

    # Delete lessons
    result = db.execute(text("DELETE FROM lessons"))
    print(f"   Deleted {result.rowcount} lesson records")

    db.commit()
    print("   ✅ Existing data cleared")


def import_lessons(db, manifest: dict, adventure_filter: int = None):
    """Import lessons from manifest."""
    lessons_index = manifest['lessons_index']

    # Group by adventure
    adventures = {}
    for lesson_info in lessons_index:
        code = lesson_info['lesson_code']
        adventure_num = int(code.split('-')[0])
        if adventure_filter and adventure_num != adventure_filter:
            continue
        if adventure_num not in adventures:
            adventures[adventure_num] = []
        adventures[adventure_num].append(lesson_info)

    total_imported = 0

    for adv_num in sorted(adventures.keys()):
        lessons_list = adventures[adv_num]
        print(f"\n📚 Importing Adventure {adv_num} ({len(lessons_list)} lessons)...")

        for i, lesson_info in enumerate(lessons_list):
            try:
                # Load full lesson data
                lesson_data = load_lesson_file(lesson_info['file_path'])

                # Create Lesson object
                lesson = Lesson(
                    lesson_code=lesson_data['lesson_code'],
                    title_es=lesson_data['title_es'],
                    title_en=lesson_data['title_en'],
                    description_es=lesson_data.get('description_es'),
                    description_en=lesson_data.get('description_en'),
                    duration=lesson_data.get('duration'),
                    age_rate=lesson_data.get('age_rate'),
                    points_reward=lesson_data.get('points_reward', 10),
                    adventure_level=lesson_data['adventure_level'],
                    saga_level=lesson_data['saga_level'],
                    topic_level=lesson_data['topic_level'],
                    lesson_number=lesson_data['lesson_number'],
                    content_es=lesson_data['content_es'],
                    content_en=lesson_data['content_en']
                )

                db.add(lesson)
                total_imported += 1

                # Progress indicator
                if (i + 1) % 100 == 0:
                    print(f"   ... {i + 1}/{len(lessons_list)} processed")

            except Exception as e:
                print(f"   ❌ Error importing {lesson_info['lesson_code']}: {e}")
                db.rollback()
                raise

        # Commit after each adventure
        db.commit()
        print(f"   ✅ Adventure {adv_num} complete: {len(lessons_list)} lessons")

    return total_imported


def verify_import(db):
    """Verify the import was successful."""
    print("\n🔍 Verifying import...")

    # Total count
    result = db.execute(text("SELECT COUNT(*) FROM lessons"))
    total = result.scalar()
    print(f"   Total lessons in database: {total}")

    if total != TOTAL_EXPECTED:
        print(f"   ⚠️  Expected {TOTAL_EXPECTED}, got {total}")
        return False

    # Count per adventure
    for adv in range(1, 7):
        result = db.execute(text(f"SELECT COUNT(*) FROM lessons WHERE adventure_level = {adv}"))
        count = result.scalar()
        expected = EXPECTED_COUNTS[adv]
        status = "✅" if count == expected else "❌"
        print(f"   {status} Adventure {adv}: {count}/{expected}")

    # Check for duplicates
    result = db.execute(text("""
        SELECT lesson_code, COUNT(*) as cnt 
        FROM lessons 
        GROUP BY lesson_code 
        HAVING COUNT(*) > 1
    """))
    dupes = result.fetchall()
    if dupes:
        print(f"   ❌ Found {len(dupes)} duplicate lesson codes!")
        return False
    print("   ✅ No duplicate lesson codes")

    # Sample lesson test
    result = db.execute(text("SELECT lesson_code, title_es FROM lessons LIMIT 1"))
    sample = result.fetchone()
    if sample:
        print(f"   ✅ Sample lesson: {sample[0]} - {sample[1]}")

    print("\n✅ Verification complete!")
    return True


def count_lessons(db):
    """Just count existing lessons."""
    result = db.execute(text("SELECT COUNT(*) FROM lessons"))
    total = result.scalar()
    print(f"\n📊 Current lessons in database: {total}")

    for adv in range(1, 7):
        result = db.execute(text(f"SELECT COUNT(*) FROM lessons WHERE adventure_level = {adv}"))
        count = result.scalar()
        print(f"   Adventure {adv}: {count}")

    return total


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Import LittleFounders lessons')
    parser.add_argument('--verify', action='store_true', help='Verify import only')
    parser.add_argument('--count', action='store_true', help='Count existing lessons')
    parser.add_argument('--adventure', type=int, help='Import single adventure (1-6)')
    parser.add_argument('--no-clear', action='store_true', help='Skip clearing existing data')
    args = parser.parse_args()

    print("=" * 60)
    print("🏫 LittleFounders Lesson Import Script")
    print("=" * 60)
    print(f"📁 Lessons directory: {LESSONS_DIR}")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check lessons directory exists
    if not LESSONS_DIR.exists():
        print(f"❌ Lessons directory not found: {LESSONS_DIR}")
        sys.exit(1)

    if not MANIFEST_FILE.exists():
        print(f"❌ Manifest file not found: {MANIFEST_FILE}")
        sys.exit(1)

    db = SessionLocal()

    try:
        if args.count:
            count_lessons(db)
            return

        if args.verify:
            verify_import(db)
            return

        # Full import
        print("\n📖 Loading manifest...")
        manifest = load_manifest()
        print(f"   Total lessons in manifest: {manifest['total_lessons']}")

        if not args.no_clear:
            clear_existing_data(db)

        print("\n🚀 Starting import...")
        total = import_lessons(db, manifest, args.adventure)

        print(f"\n✅ Import complete! {total} lessons imported.")

        # Verify
        verify_import(db)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    print(f"\n⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
