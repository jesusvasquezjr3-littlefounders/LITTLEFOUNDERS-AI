"""
LittleFounders - Lesson Importer
Imports generated lesson JSON files into Supabase database

Usage:
    python import_lessons.py --file generated_lessons/1-1-1-L1.json
    python import_lessons.py --dir generated_lessons/
    python import_lessons.py --topic 1-1-1
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from database import SessionLocal
from models import Lesson, Exercise, Saga


GENERATED_LESSONS_DIR = Path(__file__).parent.parent / "generated_lessons"


def get_saga_id(db: Session, saga_code: str) -> Optional[int]:
    """Get saga ID from code."""
    saga = db.query(Saga).filter(Saga.code == saga_code).first()
    return saga.id if saga else None


def import_lesson_file(db: Session, filepath: Path) -> bool:
    """Import a single lesson JSON file into the database."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        lesson_data = data.get('lesson', {})
        exercises_data = data.get('exercises', [])
        
        if not lesson_data or not exercises_data:
            print(f"❌ Invalid lesson structure in {filepath}")
            return False
        
        # Extract saga code from topic code (e.g., 1-1-1 -> 1-1)
        topic_code = lesson_data.get('topic_code', '')
        saga_code = '-'.join(topic_code.split('-')[:2])
        
        saga_id = get_saga_id(db, saga_code)
        if not saga_id:
            print(f"⚠️ Saga not found: {saga_code} - Creating without saga")
        
        # Check if lesson already exists
        existing = db.query(Lesson).filter(
            Lesson.lesson_id == lesson_data['code']
        ).first()
        
        if existing:
            print(f"⚠️ Lesson already exists: {lesson_data['code']} - Updating...")
            lesson = existing
            # Update existing lesson
            lesson.title = lesson_data.get('title', '')
            lesson.description = lesson_data.get('description', '')
            lesson.difficulty = lesson_data.get('difficulty', 'Fácil')
            lesson.points_reward = lesson_data.get('points_reward', 10)
            lesson.xp_reward = lesson_data.get('xp_reward', 25)
            lesson.estimated_duration_seconds = lesson_data.get('estimated_duration_seconds', 180)
            
            # Delete existing exercises
            db.query(Exercise).filter(Exercise.lesson_id == lesson.id).delete()
        else:
            # Create new lesson
            lesson = Lesson(
                lesson_id=lesson_data['code'],
                title=lesson_data.get('title', ''),
                description=lesson_data.get('description', ''),
                saga_id=saga_id,
                difficulty=lesson_data.get('difficulty', 'Fácil'),
                points_reward=lesson_data.get('points_reward', 10),
                xp_reward=lesson_data.get('xp_reward', 25),
                estimated_duration_seconds=lesson_data.get('estimated_duration_seconds', 180),
                order_index=int(lesson_data['code'].split('-L')[-1]) if '-L' in lesson_data['code'] else 1
            )
            db.add(lesson)
            db.flush()  # Get lesson ID
        
        # Add exercises
        for ex_data in exercises_data:
            exercise = Exercise(
                lesson_id=lesson.id,
                exercise_type=ex_data.get('type', 'intro_narrative'),
                character_code=ex_data.get('character_code', 'liruf'),
                order_index=ex_data.get('order_index', 1),
                content=ex_data.get('content', {}),
                correct_answer=ex_data.get('correct_answer'),
                feedback=ex_data.get('feedback', {}),
                points=ex_data.get('points', 5)
            )
            db.add(exercise)
        
        db.commit()
        print(f"✅ Imported: {lesson_data['code']} - {lesson_data.get('title', 'No title')}")
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error importing {filepath}: {e}")
        return False


def import_directory(db: Session, dirpath: Path) -> Dict[str, int]:
    """Import all lesson JSON files from a directory."""
    stats = {'success': 0, 'failed': 0}
    
    json_files = list(dirpath.glob("*.json"))
    print(f"\n📂 Found {len(json_files)} lesson files in {dirpath}\n")
    
    for filepath in sorted(json_files):
        if import_lesson_file(db, filepath):
            stats['success'] += 1
        else:
            stats['failed'] += 1
    
    return stats


def import_topic_lessons(db: Session, topic_code: str) -> Dict[str, int]:
    """Import all lessons for a specific topic."""
    pattern = f"{topic_code}-L*.json"
    files = list(GENERATED_LESSONS_DIR.glob(pattern))
    
    stats = {'success': 0, 'failed': 0}
    print(f"\n📚 Importing lessons for topic: {topic_code}")
    print(f"   Found {len(files)} lesson files\n")
    
    for filepath in sorted(files):
        if import_lesson_file(db, filepath):
            stats['success'] += 1
        else:
            stats['failed'] += 1
    
    return stats


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Import generated lessons to database')
    parser.add_argument('--file', type=str, help='Single JSON file to import')
    parser.add_argument('--dir', type=str, help='Directory with JSON files')
    parser.add_argument('--topic', type=str, help='Topic code to import (e.g., 1-1-1)')
    parser.add_argument('--dry-run', action='store_true', help='Validate without importing')
    
    args = parser.parse_args()
    
    db = SessionLocal()
    
    try:
        if args.file:
            filepath = Path(args.file)
            if not filepath.exists():
                print(f"❌ File not found: {filepath}")
                return
            import_lesson_file(db, filepath)
            
        elif args.dir:
            dirpath = Path(args.dir)
            if not dirpath.is_dir():
                print(f"❌ Directory not found: {dirpath}")
                return
            stats = import_directory(db, dirpath)
            print(f"\n📊 Import complete: {stats['success']} success, {stats['failed']} failed")
            
        elif args.topic:
            stats = import_topic_lessons(db, args.topic)
            print(f"\n📊 Import complete: {stats['success']} success, {stats['failed']} failed")
            
        else:
            parser.print_help()
            
    finally:
        db.close()


if __name__ == "__main__":
    main()
