"""
Migration script to add created_by and assigned_to columns to savings_goals table
Run this script once to update the existing database schema
"""

import sys
from sqlalchemy import text
from database import engine, SessionLocal


def migrate_savings_goals():
    """Add created_by and assigned_to columns to savings_goals table"""
    
    db = SessionLocal()
    
    try:
        print("🔄 Starting migration for savings_goals table...")
        
        # Check if columns already exist
        check_columns_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'savings_goals' 
            AND column_name IN ('created_by', 'assigned_to')
        """)
        
        result = db.execute(check_columns_query)
        existing_columns = [row[0] for row in result]
        
        # Add created_by column if it doesn't exist
        if 'created_by' not in existing_columns:
            print("  ➕ Adding 'created_by' column...")
            
            # First add the column as nullable
            add_created_by = text("""
                ALTER TABLE savings_goals 
                ADD COLUMN created_by INTEGER
            """)
            db.execute(add_created_by)
            db.commit()
            
            # Set created_by = user_id for existing records
            print("  📝 Populating 'created_by' with existing user_id values...")
            update_created_by = text("""
                UPDATE savings_goals 
                SET created_by = user_id 
                WHERE created_by IS NULL
            """)
            db.execute(update_created_by)
            db.commit()
            
            # Now make it NOT NULL and add foreign key
            print("  🔗 Adding NOT NULL constraint and foreign key...")
            alter_created_by = text("""
                ALTER TABLE savings_goals 
                ALTER COLUMN created_by SET NOT NULL
            """)
            db.execute(alter_created_by)
            
            add_fk_created_by = text("""
                ALTER TABLE savings_goals 
                ADD CONSTRAINT fk_savings_goals_created_by 
                FOREIGN KEY (created_by) REFERENCES users(id)
            """)
            db.execute(add_fk_created_by)
            db.commit()
            
            print("  ✅ 'created_by' column added successfully")
        else:
            print("  ℹ️  'created_by' column already exists, skipping...")
        
        # Add assigned_to column if it doesn't exist
        if 'assigned_to' not in existing_columns:
            print("  ➕ Adding 'assigned_to' column...")
            
            add_assigned_to = text("""
                ALTER TABLE savings_goals 
                ADD COLUMN assigned_to INTEGER
            """)
            db.execute(add_assigned_to)
            
            add_fk_assigned_to = text("""
                ALTER TABLE savings_goals 
                ADD CONSTRAINT fk_savings_goals_assigned_to 
                FOREIGN KEY (assigned_to) REFERENCES users(id)
            """)
            db.execute(add_fk_assigned_to)
            db.commit()
            
            print("  ✅ 'assigned_to' column added successfully")
        else:
            print("  ℹ️  'assigned_to' column already exists, skipping...")
        
        print("\n✅ Migration completed successfully!")
        print("\nSummary:")
        print("  - created_by: ADDED (NOT NULL, references users)")
        print("  - assigned_to: ADDED (NULLABLE, references users)")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("  SAVINGS GOALS TABLE MIGRATION")
    print("=" * 60)
    print()
    
    response = input("This will modify the savings_goals table. Continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        migrate_savings_goals()
    else:
        print("\n❌ Migration cancelled by user")
        sys.exit(0)

