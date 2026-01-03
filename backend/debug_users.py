from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import User, UserType
from config import settings

# Construct DB URL manually since settings object doesn't have it pre-computed
sqlalchemy_database_url = f"postgresql://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}"
engine = create_engine(sqlalchemy_database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("\n--- CHECKING USERS ---")
    users = db.query(User).all()
    if not users:
        print("No users found in database.")
    
    for u in users:
        print(f"ID: {u.id} | Name: {u.name} | Email: {u.email} | Type: {u.user_type} (Type of value: {type(u.user_type)})")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
