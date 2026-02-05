"""
LittleFounders - Manual Golden Lesson Seeder
Loads all golden_lesson_*.json files from backend/data/ and inserts/updates them in the DB.
"""
import json
import sys
from pathlib import Path
from sqlalchemy.orm import Session

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal
from models import Lesson

DATA_DIR = Path(__file__).parent.parent / "data"

def seed_golden_lesson(db: Session, lesson_path: Path):
    if not lesson_path.exists():
        print(f"❌ Error: File not found at {lesson_path}")
        return

    try:
        with open(lesson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        code = data['lesson_code']
        print(f"📦 Loading Golden Lesson {code}...")

        # Find or Create
        lesson = db.query(Lesson).filter(Lesson.lesson_code == code).first()
        if not lesson:
            print(f"🆕 Creating new record for {code}")
            lesson = Lesson(lesson_code=code)
            db.add(lesson)
        else:
            print(f"♻️  Updating existing record for {code}")
        
        # Update Fields (Mirroring structure)
        lesson.title_es = data.get('title_es')
        lesson.title_en = data.get('title_en')
        lesson.description_es = data.get('description_es')
        lesson.description_en = data.get('description_en')
        lesson.duration = data.get('duration')
        lesson.age_rate = data.get('age_rate')
        lesson.points_reward = data.get('points_reward')
        lesson.adventure_level = data.get('adventure_level')
        lesson.saga_level = data.get('saga_level')
        lesson.topic_level = data.get('topic_level')
        lesson.lesson_number = data.get('lesson_number')
        
        # JSON Content
        lesson.content_es = data.get('content_es', data.get('exercises', []))
        lesson.content_en = data.get('content_en', data.get('exercises', []))
        
        db.commit()
        print(f"✅ SUCCESS: Golden Lesson {code} Seeded!")
        print(f"   ES Items: {len(lesson.content_es)}")
        print(f"   EN Items: {len(lesson.content_en)}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding lesson {lesson_path.name}: {e}")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # Find all golden_lesson_*.json files
        lesson_files = sorted(DATA_DIR.glob("golden_lesson_*.json"))
        
        if not lesson_files:
            print(f"❌ No golden_lesson_*.json files found in {DATA_DIR}")
        else:
            print(f"Found {len(lesson_files)} lesson file(s) to import\n")
            for lesson_file in lesson_files:
                seed_golden_lesson(db, lesson_file)
                print()  # Blank line between lessons
    finally:
        db.close()
