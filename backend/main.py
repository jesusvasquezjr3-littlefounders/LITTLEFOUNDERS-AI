from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import hashlib
import json
import os
from datetime import datetime

app = FastAPI(title="Operations Dashboard API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React dev server
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File path for storing user data
USERS_FILE = "users.txt"

# Pydantic models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: str

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
    return {"message": "Operations Dashboard API", "version": "1.0.0"}

@app.post("/auth/register", response_model=UserResponse)
async def register_user(user: UserRegister):
    """Register a new user"""
    
    # Check if user already exists
    if find_user_by_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_password = hash_password(user.password)
    
    # Create user data
    user_data = {
        "id": hashlib.md5(user.email.encode()).hexdigest()[:8],
        "name": user.name,
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.now().isoformat()
    }
    
    # Save user to file
    save_user(user_data)
    
    # Return user data (without password)
    return UserResponse(
        id=user_data["id"],
        name=user_data["name"],
        email=user_data["email"],
        created_at=user_data["created_at"]
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
            "created_at": user["created_at"]
        }
    }

@app.get("/auth/users")
async def get_users():
    """Get all users (for development/debugging - remove in production)"""
    users = load_users()
    # Remove passwords from response
    safe_users = []
    for email, user in users.items():
        safe_users.append({
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"]
        })
    return {"users": safe_users, "count": len(safe_users)}

# Add some demo users on startup
@app.on_event("startup")
async def create_demo_users():
    """Create demo users if none exist"""
    users = load_users()
    
    # Create admin user if it doesn't exist
    if "admin@example.com" not in users:
        admin_user = {
            "id": "admin001",
            "name": "Admin User",
            "email": "admin@example.com",
            "password": hash_password("password123"),
            "created_at": datetime.now().isoformat()
        }
        save_user(admin_user)
        print("Demo admin user created: admin@example.com / password123")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)