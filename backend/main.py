from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine
from . import models

# Import routers
from .auth.endpoints import router as auth_router
from .dashboard.endpoints import router as dashboard_router
from .tasks.endpoints import router as tasks_router
from .parent_tasks.endpoints import router as parent_tasks_router
from .savings.endpoints import router as savings_router
from .store.endpoints import router as store_router
from .lecciones.endpoints import router as lecciones_router
from .lecciones_v2.endpoints import router as lecciones_v2_router
from .investment_games.endpoints import router as investment_games_router

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Include routers
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(tasks_router)
app.include_router(parent_tasks_router)
app.include_router(savings_router)
app.include_router(store_router)
app.include_router(lecciones_router)
app.include_router(lecciones_v2_router)
app.include_router(investment_games_router)

@app.get("/")
async def root():
    return {
        "message": "LittleFounders API",
        "version": settings.api_version,
        "status": "running"
    }

# File path for storing user data
USERS_FILE = "users.txt"

# Pydantic models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    user_type: str  # "tutor", "child", "sponsor" 
    birth_date: Optional[str] = None
    gender: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    user_type: str
    created_at: str

class RegistrationData(BaseModel):
    tutor: dict
    child: dict
    sponsor: Optional[dict] = None

# Utility functions
def hash_password(password: str) -> str:
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    """Load users from the text file"""
    if not os.path.exists(USERS_FILE):
        return {}
    
    users = {}
    try:
        with open(USERS_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    user_data = json.loads(line)
                    users[user_data['email']] = user_data
    except Exception as e:
        print(f"Error loading users: {e}")
        return {}
    
    return users

def save_user(user_data: dict):
    """Save a user to the text file"""
    try:
        with open(USERS_FILE, 'a') as f:
            f.write(json.dumps(user_data) + '\n')
    except Exception as e:
        print(f"Error saving user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save user data"
        )

def find_user_by_email(email: str):
    """Find a user by email"""
    users = load_users()
    return users.get(email)

# API Routes
@app.get("/")
async def root():
    return {"message": "LittleFounders API", "version": "1.0.0"}

@app.post("/auth/register", response_model=dict)
async def register_family(registration_data: RegistrationData):
    """Register a complete family (tutor, child, optional sponsor)"""
    
    try:
        # Register tutor
        tutor_data = registration_data.tutor
        if find_user_by_email(tutor_data['email']):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tutor email already registered"
            )
        
        tutor_user = {
            "id": hashlib.md5(tutor_data['email'].encode()).hexdigest()[:8],
            "name": tutor_data['name'],
            "email": tutor_data['email'],
            "password": hash_password(tutor_data['password']),
            "user_type": "tutor",
            "birth_date": tutor_data.get('birth_date'),
            "gender": tutor_data.get('gender'),
            "created_at": datetime.now().isoformat()
        }
        save_user(tutor_user)
        
        # Register child
        child_data = registration_data.child
        if find_user_by_email(child_data['email']):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Child email already registered"
            )
        
        child_user = {
            "id": hashlib.md5(child_data['email'].encode()).hexdigest()[:8],
            "name": child_data['name'],
            "email": child_data['email'],
            "password": hash_password(child_data['password']),
            "user_type": "child",
            "birth_date": child_data.get('birth_date'),
            "gender": child_data.get('gender'),
            "tutor_email": tutor_data['email'],  # Link to tutor
            "created_at": datetime.now().isoformat(),
            "lessons_completed": 0,
            "minutes_studied": 0,
            "points_earned": 0
        }
        save_user(child_user)
        
        # Register sponsor if provided
        sponsor_user = None
        if registration_data.sponsor:
            sponsor_data = registration_data.sponsor
            if find_user_by_email(sponsor_data['email']):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sponsor email already registered"
                )
            
            sponsor_user = {
                "id": hashlib.md5(sponsor_data['email'].encode()).hexdigest()[:8],
                "name": sponsor_data['name'],
                "email": sponsor_data['email'],
                "password": hash_password(sponsor_data['password']),
                "user_type": "sponsor",
                "birth_date": sponsor_data.get('birth_date'),
                "gender": sponsor_data.get('gender'),
                "child_email": child_data['email'],  # Link to child
                "created_at": datetime.now().isoformat()
            }
            save_user(sponsor_user)
        
        return {
            "message": "Family registration successful",
            "tutor": {
                "id": tutor_user["id"],
                "name": tutor_user["name"],
                "email": tutor_user["email"],
                "user_type": tutor_user["user_type"]
            },
            "child": {
                "id": child_user["id"],
                "name": child_user["name"],
                "email": child_user["email"],
                "user_type": child_user["user_type"]
            },
            "sponsor": sponsor_user and {
                "id": sponsor_user["id"],
                "name": sponsor_user["name"],
                "email": sponsor_user["email"],
                "user_type": sponsor_user["user_type"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register family"
        )

@app.post("/auth/login", response_model=dict)
async def login_user(credentials: UserLogin):
    """Login a user"""
    
    # Find user
    user = find_user_by_email(credentials.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    hashed_password = hash_password(credentials.password)
    if user["password"] != hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Return user data (without password) and success message
    return {
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "user_type": user["user_type"],
            "created_at": user["created_at"],
            "lessons_completed": user.get("lessons_completed", 0),
            "minutes_studied": user.get("minutes_studied", 0),
            "points_earned": user.get("points_earned", 0)
        }
    }

@app.get("/auth/users")
async def get_users():
    """Get all users (for development/debugging - remove in production)"""
    users = load_users()
    # Remove passwords from response
    safe_users = []
    for email, user in users.items():
        safe_user = {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "user_type": user["user_type"],
            "created_at": user["created_at"]
        }
        if user["user_type"] == "child":
            safe_user.update({
                "lessons_completed": user.get("lessons_completed", 0),
                "minutes_studied": user.get("minutes_studied", 0),
                "points_earned": user.get("points_earned", 0)
            })
        safe_users.append(safe_user)
    return {"users": safe_users, "count": len(safe_users)}

# Add some demo users on startup
@app.on_event("startup")
async def create_demo_users():
    """Create demo users if none exist"""
    users = load_users()
    
    # Create demo tutor if it doesn't exist
    if "tutor@demo.com" not in users:
        tutor_user = {
            "id": "tutor001",
            "name": "María González",
            "email": "tutor@demo.com",
            "password": hash_password("password123"),
            "user_type": "tutor",
            "birth_date": "1985-03-15",
            "gender": "femenino",
            "created_at": datetime.now().isoformat()
        }
        save_user(tutor_user)
        print("Demo tutor created: tutor@demo.com / password123")
    
    # Create demo child if it doesn't exist
    if "nino@demo.com" not in users:
        child_user = {
            "id": "child001",
            "name": "Carlos González",
            "email": "nino@demo.com",
            "password": hash_password("password123"),
            "user_type": "child",
            "birth_date": "2015-07-22",
            "gender": "masculino",
            "tutor_email": "tutor@demo.com",
            "created_at": datetime.now().isoformat(),
            "lessons_completed": 5,
            "minutes_studied": 120,
            "points_earned": 250
        }
        save_user(child_user)
        print("Demo child created: nino@demo.com / password123")
    
    # Create demo sponsor if it doesn't exist
    if "patrocinador@demo.com" not in users:
        sponsor_user = {
            "id": "sponsor001",
            "name": "Roberto Martínez",
            "email": "patrocinador@demo.com",
            "password": hash_password("password123"),
            "user_type": "sponsor",
            "birth_date": "1980-11-08",
            "gender": "masculino",
            "child_email": "nino@demo.com",
            "created_at": datetime.now().isoformat()
        }
        save_user(sponsor_user)
        print("Demo sponsor created: patrocinador@demo.com / password123")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)