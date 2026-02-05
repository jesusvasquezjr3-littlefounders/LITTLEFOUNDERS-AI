"""
Script to DELETE ALL LESSONS from the database.
CRITICAL: This deletes all lessons, exercises, audio references, and USER PROGRESS.
Use with caution.

Usage: python scripts/clear_all_lessons.py
"""

import sys
import os
from pathlib import Path
from typing import List

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal
from models import (
    Lesson, Exercise, LessonAudioSegment, 
    LessonTranslation, ExerciseTranslation, AudioSegmentTranslation,
    UserLessonProgress, UserExerciseProgress
)
from sqlalchemy import text

# Try to import supabase client wrapper if available, or raw supabase
try:
    from supabase import create_client
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    supabase = None
    print("⚠️ Supabase client not available (pip install supabase). skipping storage cleanup.")

def clear_lessons():
    db = SessionLocal()
    print("🔥 PREPARING TO PURGE ALL LESSON DATA...")
    
    # 1. Harvest Audio URLs for Storage Cleanup
    audio_urls = []
    try:
        segments = db.query(LessonAudioSegment.audio_url).all()
        translations = db.query(AudioSegmentTranslation.audio_url).all()
        
        # Extract URLs
        all_urls = [s[0] for s in segments if s[0]] + [t[0] for t in translations if t[0]]
        
        # Parse bucket and path
        # URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        files_to_delete = {} # bucket -> list of paths
        
        for url in all_urls:
            if "supabase.co" in url and "/storage/v1/object/public/" in url:
                parts = url.split("/storage/v1/object/public/")
                if len(parts) > 1:
                    path_part = parts[1] # e.g. lesson-audios/folder/file.mp3
                    bucket = path_part.split("/")[0]
                    file_path = "/".join(path_part.split("/")[1:])
                    
                    if bucket not in files_to_delete:
                        files_to_delete[bucket] = []
                    files_to_delete[bucket].append(file_path)
        
        print(f"📦 Found {len(all_urls)} audio files to remove from storage.")
        
        # Remove files from Supabase Storage
        if supabase:
            for bucket, paths in files_to_delete.items():
                print(f"   🗑 Removing {len(paths)} files from bucket '{bucket}'...")
                # Batch delete (max 100/request usually? check limits. Safety: 50 at a time)
                batch_size = 50
                for i in range(0, len(paths), batch_size):
                    batch = paths[i:i+batch_size]
                    try:
                        supabase.storage.from_(bucket).remove(batch)
                    except Exception as e:
                        print(f"      ❌ Storage delete error: {e}")
        else:
            print("⚠️ Skipping storage cleanup (No Supabase client)")
            
    except Exception as e:
        print(f"⚠️ Error preparing storage cleanup: {e}")

    # 2. Database Cleanup 
    try:
        # Delete reverse dependency order
        print("🧹 Deleting User Progress...")
        db.query(UserExerciseProgress).delete()
        db.query(UserLessonProgress).delete()
        
        print("🧹 Deleting Translations...")
        db.query(ExerciseTranslation).delete()
        db.query(AudioSegmentTranslation).delete()
        db.query(LessonTranslation).delete()

        print("🧹 Deleting Content...")
        db.query(Exercise).delete()
        db.query(LessonAudioSegment).delete()
        
        print("🧹 Deleting Lessons...")
        count = db.query(Lesson).delete()
        
        db.commit()
        print(f"✅ SUCCESSFULLY DELETED {count} LESSONS and all related data.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Database error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("Are you SURE you want to delete ALL lessons? (yes/no): ")
    if confirm.lower() == "yes":
        clear_lessons()
    else:
        print("Cancelled.")
