from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import SavingsGoal, Transaction, User, TransactionType
from schemas import (
    SavingsGoalCreate,
    SavingsGoalUpdate,
    SavingsGoalResponse,
    TransactionCreate,
    TransactionResponse
)
from auth.permissions import verify_family_access, verify_ownership

router = APIRouter(prefix="/savings", tags=["Savings"])


@router.post("/goals", response_model=SavingsGoalResponse)
async def create_savings_goal(goal: SavingsGoalCreate, user_id: int, db: Session = Depends(get_db)):
    """Create a new savings goal"""
    db_goal = SavingsGoal(
        user_id=user_id,
        title=goal.title,
        description=goal.description,
        target_amount=goal.target_amount,
        deadline=goal.deadline,
        image_url=goal.image_url
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.get("/goals/{user_id}", response_model=List[SavingsGoalResponse])
async def get_savings_goals(user_id: int, requester_id: int, db: Session = Depends(get_db)):
    """Get all savings goals for a user (with family access control)"""
    # Verify family access
    verify_family_access(db, requester_id, user_id, allow_self=True)
    
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.user_id == user_id,
        SavingsGoal.is_active == True
    ).all()
    return goals


@router.put("/goals/{goal_id}", response_model=SavingsGoalResponse)
async def update_savings_goal(goal_id: int, goal_update: SavingsGoalUpdate, requester_id: int, db: Session = Depends(get_db)):
    """Update a savings goal (owner only)"""
    db_goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Verify ownership
    verify_ownership(db, requester_id, db_goal.user_id, "savings goal")
    
    if goal_update.current_amount is not None:
        db_goal.current_amount = goal_update.current_amount
    if goal_update.is_active is not None:
        db_goal.is_active = goal_update.is_active
    
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.post("/deposit")
async def deposit_to_savings(
    user_id: int,
    goal_id: int,
    amount: float,
    db: Session = Depends(get_db)
):
    """Deposit money to a savings goal (owner only)"""
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Verify goal ownership
    verify_ownership(db, user_id, goal.user_id, "savings goal")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Update goal and user balance
    goal.current_amount += amount
    user.balance -= amount
    
    # Create transaction
    transaction = Transaction(
        user_id=user_id,
        transaction_type=TransactionType.DEPOSIT,
        amount=amount,
        description=f"Depósito a meta: {goal.title}",
        category="savings"
    )
    db.add(transaction)
    db.commit()
    
    return {"message": "Deposit successful", "new_goal_amount": goal.current_amount}


@router.post("/withdraw")
async def withdraw_from_savings(
    user_id: int,
    goal_id: int,
    amount: float,
    db: Session = Depends(get_db)
):
    """Withdraw money from a savings goal (owner only)"""
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Verify goal ownership
    verify_ownership(db, user_id, goal.user_id, "savings goal")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if goal.current_amount < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds in savings goal")
    
    # Update goal and user balance
    goal.current_amount -= amount
    user.balance += amount
    
    # Create transaction
    transaction = Transaction(
        user_id=user_id,
        transaction_type=TransactionType.WITHDRAWAL,
        amount=amount,
        description=f"Retiro de meta: {goal.title}",
        category="savings"
    )
    db.add(transaction)
    db.commit()
    
    return {"message": "Withdrawal successful", "new_goal_amount": goal.current_amount}


@router.get("/transactions/{user_id}", response_model=List[TransactionResponse])
async def get_transactions(user_id: int, requester_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Get transaction history for a user (with family access control)"""
    # Verify family access
    verify_family_access(db, requester_id, user_id, allow_self=True)
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == user_id
    ).order_by(Transaction.created_at.desc()).limit(limit).all()
    return transactions


@router.delete("/goals/{goal_id}")
async def delete_savings_goal(goal_id: int, requester_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a savings goal (owner only)"""
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    
    # Verify ownership
    verify_ownership(db, requester_id, goal.user_id, "savings goal")
    
    goal.is_active = False
    db.commit()
    return {"message": "Savings goal deleted"}
