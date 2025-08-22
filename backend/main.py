from fastapi import FastAPI, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Literal
import hashlib
import json
import os
from datetime import datetime, date
import uuid

app = FastAPI(title="LittleFounders Banking API", version="2.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React dev server
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File paths for storing data
USERS_FILE = "users.txt"
ACCOUNTS_FILE = "accounts.txt"
TRANSACTIONS_FILE = "transactions.txt"
TASKS_FILE = "tasks.txt"
GOALS_FILE = "goals.txt"

# Pydantic models for authentication
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

# Pydantic models for banking
class BankAccount(BaseModel):
    id: str
    user_id: str
    account_type: Literal["spend", "save", "emergency", "main"]
    balance: float
    percentage: int
    name: str
    description: str
    created_at: str

class Transaction(BaseModel):
    id: str
    user_id: str
    from_account: str
    to_account: Optional[str]
    amount: float
    transaction_type: Literal["deposit", "withdrawal", "transfer", "task_reward", "goal_contribution"]
    description: str
    category: Optional[str]
    status: Literal["pending", "completed", "failed"]
    created_at: str

class TaskModel(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    reward: float
    difficulty: Literal["easy", "medium", "hard"]
    status: Literal["available", "pending", "completed", "rejected"]
    age_range: str
    category: str
    created_at: str
    completed_at: Optional[str]

class SavingsGoal(BaseModel):
    id: str
    user_id: str
    name: str
    target_amount: float
    current_amount: float
    deadline: str
    category: str
    status: Literal["active", "completed", "paused"]
    parent_matching: bool
    interest_rate: float
    created_at: str

class VirtualCard(BaseModel):
    id: str
    user_id: str
    card_number: str
    holder_name: str
    expiry_date: str
    is_locked: bool
    daily_limit: float
    transaction_limit: float
    design_theme: str
    created_at: str

# Request models
class CreateTaskRequest(BaseModel):
    title: str
    description: str
    reward: float
    difficulty: Literal["easy", "medium", "hard"]
    age_range: str
    category: str

class CompleteTaskRequest(BaseModel):
    task_id: str

class CreateGoalRequest(BaseModel):
    name: str
    target_amount: float
    deadline: str
    category: str
    parent_matching: bool = False
    interest_rate: float = 0.05

class TransferRequest(BaseModel):
    from_account: str
    to_account: str
    amount: float
    description: str

class CardControlRequest(BaseModel):
    action: Literal["lock", "unlock", "update_limits", "change_design"]
    daily_limit: Optional[float] = None
    transaction_limit: Optional[float] = None
    design_theme: Optional[str] = None

# WebSocket manager for real-time notifications
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# Utility functions
def hash_password(password: str) -> str:
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())[:8]

def load_data(filename: str) -> List[dict]:
    """Load data from a file"""
    if not os.path.exists(filename):
        return []
    
    data = []
    try:
        with open(filename, 'r') as f:
            for line in f:
                line = line.strip()
                if line:
                    data.append(json.loads(line))
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []
    
    return data

def save_data(filename: str, data: dict):
    """Save data to a file"""
    try:
        with open(filename, 'a') as f:
            f.write(json.dumps(data, default=str) + '\n')
    except Exception as e:
        print(f"Error saving to {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save data to {filename}"
        )

def load_users():
    """Load users from the text file"""
    data = load_data(USERS_FILE)
    users = {}
    for item in data:
        users[item['email']] = item
    return users

def find_user_by_email(email: str):
    """Find a user by email"""
    users = load_users()
    return users.get(email)

def find_user_by_id(user_id: str):
    """Find a user by ID"""
    users = load_users()
    for user in users.values():
        if user['id'] == user_id:
            return user
    return None

def create_default_accounts(user_id: str):
    """Create default bank accounts for a new user"""
    accounts = [
        {
            "id": generate_id(),
            "user_id": user_id,
            "account_type": "main",
            "balance": 0.0,
            "percentage": 100,
            "name": "Cuenta Principal",
            "description": "Cuenta principal del usuario",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": generate_id(),
            "user_id": user_id,
            "account_type": "spend",
            "balance": 0.0,
            "percentage": 50,
            "name": "Gastar",
            "description": "Para compras y gastos diarios",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": generate_id(),
            "user_id": user_id,
            "account_type": "save",
            "balance": 0.0,
            "percentage": 40,
            "name": "Ahorrar",
            "description": "Para metas de ahorro a largo plazo",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": generate_id(),
            "user_id": user_id,
            "account_type": "emergency",
            "balance": 0.0,
            "percentage": 10,
            "name": "Emergencia",
            "description": "Fondo de emergencia",
            "created_at": datetime.now().isoformat()
        }
    ]
    
    for account in accounts:
        save_data(ACCOUNTS_FILE, account)
    
    return accounts

def create_default_card(user_id: str, user_name: str):
    """Create default virtual card for a new user"""
    card = {
        "id": generate_id(),
        "user_id": user_id,
        "card_number": f"•••• •••• •••• {generate_id()[:4].upper()}",
        "holder_name": user_name.upper(),
        "expiry_date": "12/28",
        "is_locked": False,
        "daily_limit": 50.0,
        "transaction_limit": 15.0,
        "design_theme": "default",
        "created_at": datetime.now().isoformat()
    }
    
    save_data("cards.txt", card)
    return card

# Authentication endpoints (existing + minor updates)
@app.get("/")
async def root():
    return {"message": "LittleFounders Banking API", "version": "2.0.0"}

@app.post("/auth/register", response_model=UserResponse)
async def register_user(user: UserRegister):
    """Register a new user with default banking setup"""
    
    # Check if user already exists
    if find_user_by_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash the password
    hashed_password = hash_password(user.password)
    
    # Create user data
    user_id = generate_id()
    user_data = {
        "id": user_id,
        "name": user.name,
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.now().isoformat()
    }
    
    # Save user to file
    save_data(USERS_FILE, user_data)
    
    # Create default banking setup
    create_default_accounts(user_id)
    create_default_card(user_id, user.name)
    
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

# Banking endpoints
@app.get("/banking/accounts/{user_id}")
async def get_user_accounts(user_id: str):
    """Get all accounts for a user"""
    accounts = load_data(ACCOUNTS_FILE)
    user_accounts = [acc for acc in accounts if acc['user_id'] == user_id]
    
    if not user_accounts:
        # Create default accounts if none exist
        user_accounts = create_default_accounts(user_id)
    
    return {"accounts": user_accounts}

@app.get("/banking/balance/{user_id}")
async def get_total_balance(user_id: str):
    """Get total balance across all accounts"""
    accounts = load_data(ACCOUNTS_FILE)
    user_accounts = [acc for acc in accounts if acc['user_id'] == user_id]
    
    total_balance = sum(float(acc.get('balance', 0)) for acc in user_accounts if acc['account_type'] != 'main')
    
    return {"total_balance": total_balance, "accounts": user_accounts}

@app.post("/banking/transfer")
async def transfer_money(transfer: TransferRequest):
    """Transfer money between accounts"""
    # Implementation would involve updating account balances and creating transaction records
    transaction_id = generate_id()
    transaction = {
        "id": transaction_id,
        "user_id": "temp_user",  # Would be extracted from auth
        "from_account": transfer.from_account,
        "to_account": transfer.to_account,
        "amount": transfer.amount,
        "transaction_type": "transfer",
        "description": transfer.description,
        "category": "transfer",
        "status": "completed",
        "created_at": datetime.now().isoformat()
    }
    
    save_data(TRANSACTIONS_FILE, transaction)
    
    return {"message": "Transfer completed", "transaction_id": transaction_id}

# Task management endpoints
@app.get("/banking/tasks/{user_id}")
async def get_user_tasks(user_id: str):
    """Get all tasks for a user"""
    tasks = load_data(TASKS_FILE)
    user_tasks = [task for task in tasks if task['user_id'] == user_id]
    
    # Add some default tasks if none exist
    if not user_tasks:
        default_tasks = [
            {
                "id": generate_id(),
                "user_id": user_id,
                "title": "Limpiar mi cuarto",
                "description": "Organizar juguetes y hacer la cama",
                "reward": 5.00,
                "difficulty": "easy",
                "status": "available",
                "age_range": "6-12",
                "category": "hogar",
                "created_at": datetime.now().isoformat(),
                "completed_at": None
            },
            {
                "id": generate_id(),
                "user_id": user_id,
                "title": "Ayudar con los platos",
                "description": "Lavar y secar los platos después de la cena",
                "reward": 8.00,
                "difficulty": "medium",
                "status": "available",
                "age_range": "8-15",
                "category": "hogar",
                "created_at": datetime.now().isoformat(),
                "completed_at": None
            }
        ]
        
        for task in default_tasks:
            save_data(TASKS_FILE, task)
        
        user_tasks = default_tasks
    
    return {"tasks": user_tasks}

@app.post("/banking/tasks")
async def create_task(task: CreateTaskRequest):
    """Create a new task"""
    task_data = {
        "id": generate_id(),
        "user_id": "temp_user",  # Would be extracted from auth
        "title": task.title,
        "description": task.description,
        "reward": task.reward,
        "difficulty": task.difficulty,
        "status": "available",
        "age_range": task.age_range,
        "category": task.category,
        "created_at": datetime.now().isoformat(),
        "completed_at": None
    }
    
    save_data(TASKS_FILE, task_data)
    
    return {"message": "Task created", "task": task_data}

@app.post("/banking/tasks/complete")
async def complete_task(request: CompleteTaskRequest):
    """Mark a task as completed and add reward to account"""
    # Implementation would involve updating task status and adding money to account
    return {"message": "Task completed successfully", "reward_added": True}

# Savings goals endpoints
@app.get("/banking/goals/{user_id}")
async def get_savings_goals(user_id: str):
    """Get all savings goals for a user"""
    goals = load_data(GOALS_FILE)
    user_goals = [goal for goal in goals if goal['user_id'] == user_id]
    
    return {"goals": user_goals}

@app.post("/banking/goals")
async def create_savings_goal(goal: CreateGoalRequest):
    """Create a new savings goal"""
    goal_data = {
        "id": generate_id(),
        "user_id": "temp_user",  # Would be extracted from auth
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": 0.0,
        "deadline": goal.deadline,
        "category": goal.category,
        "status": "active",
        "parent_matching": goal.parent_matching,
        "interest_rate": goal.interest_rate,
        "created_at": datetime.now().isoformat()
    }
    
    save_data(GOALS_FILE, goal_data)
    
    return {"message": "Savings goal created", "goal": goal_data}

# Virtual card endpoints
@app.get("/banking/card/{user_id}")
async def get_virtual_card(user_id: str):
    """Get virtual card for a user"""
    cards = load_data("cards.txt")
    user_card = next((card for card in cards if card['user_id'] == user_id), None)
    
    if not user_card:
        # Create default card if none exists
        user = find_user_by_id(user_id)
        if user:
            user_card = create_default_card(user_id, user['name'])
    
    return {"card": user_card}

@app.post("/banking/card/control/{user_id}")
async def control_virtual_card(user_id: str, request: CardControlRequest):
    """Control virtual card (lock/unlock, update limits, etc.)"""
    return {"message": f"Card {request.action} successful"}

# Transaction history
@app.get("/banking/transactions/{user_id}")
async def get_transaction_history(user_id: str):
    """Get transaction history for a user"""
    transactions = load_data(TRANSACTIONS_FILE)
    user_transactions = [tx for tx in transactions if tx['user_id'] == user_id]
    
    return {"transactions": user_transactions}

# Analytics endpoints
@app.get("/banking/analytics/{user_id}")
async def get_spending_analytics(user_id: str):
    """Get spending analytics and insights"""
    transactions = load_data(TRANSACTIONS_FILE)
    user_transactions = [tx for tx in transactions if tx['user_id'] == user_id]
    
    # Calculate spending by category
    spending_by_category = {}
    for tx in user_transactions:
        if tx['transaction_type'] in ['withdrawal', 'transfer'] and tx.get('category'):
            category = tx['category']
            spending_by_category[category] = spending_by_category.get(category, 0) + tx['amount']
    
    return {
        "spending_by_category": spending_by_category,
        "total_transactions": len(user_transactions),
        "achievements": [
            {"name": "Primera Meta Alcanzada", "unlocked": True},
            {"name": "Ahorrador Constante", "unlocked": True},
            {"name": "Gastos Inteligentes", "unlocked": False},
            {"name": "Inversor Junior", "unlocked": False}
        ]
    }

# WebSocket endpoint for real-time notifications
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Message: {data}", user_id)
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# Existing endpoints (unchanged)
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
        save_data(USERS_FILE, admin_user)
        print("Demo admin user created: admin@example.com / password123")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)