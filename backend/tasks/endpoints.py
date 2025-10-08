from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
from models import Task, UserTask, User, Transaction, TransactionType
from schemas import TaskCreate, TaskResponse, TaskComplete, TaskApproval

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task (for parents)"""
    db_task = Task(
        title=task.title,
        description=task.description,
        category=task.category,
        difficulty=task.difficulty,
        reward=task.reward,
        time_estimate=task.time_estimate,
        due_date=task.due_date,
        is_first_dibs=task.is_first_dibs,
        created_by=task.created_by if hasattr(task, 'created_by') else 1,
        assigned_to=task.assigned_to
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/available/{user_id}")
async def get_available_tasks(user_id: int, db: Session = Depends(get_db)):
    """Get all available tasks for a child (only from their tutor and sponsor)"""
    # Get the child user
    child = db.query(User).filter(User.id == user_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get authorized creators (tutor and sponsor)
    authorized_creators = []
    if child.tutor_id:
        authorized_creators.append(child.tutor_id)
    
    # Get sponsor(s) who have this child as sponsored_child_id
    sponsors = db.query(User).filter(
        User.sponsored_child_id == user_id,
        User.user_type == "sponsor"
    ).all()
    for sponsor in sponsors:
        authorized_creators.append(sponsor.id)
    
    # Get tasks created by authorized users
    query = db.query(Task).filter(
        Task.assigned_to == user_id,
        Task.is_active == True
    )
    
    # Only filter by authorized creators if there are any
    if authorized_creators:
        query = query.filter(Task.created_by.in_(authorized_creators))
    
    tasks = query.all()
    
    # Get task completion status
    task_data = []
    for task in tasks:
        user_task = db.query(UserTask).filter(
            UserTask.task_id == task.id,
            UserTask.user_id == user_id
        ).first()
        
        # Get creator info
        creator = db.query(User).filter(User.id == task.created_by).first()
        
        task_data.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "category": task.category.value,
            "difficulty": task.difficulty.value,
            "reward": task.reward,
            "time_estimate": task.time_estimate,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "is_first_dibs": task.is_first_dibs,
            "created_by": creator.name if creator else "Unknown",
            "created_by_type": creator.user_type.value if creator else None,
            "is_completed": user_task.is_completed if user_task else False,
            "is_approved": user_task.is_approved if user_task else None,
            "photo_evidence": user_task.photo_evidence if user_task else None
        })
    
    return {"tasks": task_data}


@router.post("/complete")
async def complete_task(task_complete: TaskComplete, user_id: int, db: Session = Depends(get_db)):
    """Mark a task as completed by a child"""
    task = db.query(Task).filter(Task.id == task_complete.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user_task exists
    user_task = db.query(UserTask).filter(
        UserTask.task_id == task_complete.task_id,
        UserTask.user_id == user_id
    ).first()
    
    if not user_task:
        # Create new user_task
        user_task = UserTask(
            user_id=user_id,
            task_id=task_complete.task_id,
            is_completed=True,
            completed_date=datetime.now(),
            photo_evidence=task_complete.photo_evidence
        )
        db.add(user_task)
    else:
        # Update existing
        user_task.is_completed = True
        user_task.completed_date = datetime.now()
        user_task.photo_evidence = task_complete.photo_evidence
    
    db.commit()
    return {"message": "Task marked as completed", "task_id": task.id}


@router.post("/approve")
async def approve_task(approval: TaskApproval, db: Session = Depends(get_db)):
    """Approve or reject a completed task (for parents)"""
    user_task = db.query(UserTask).filter(UserTask.id == approval.user_task_id).first()
    if not user_task:
        raise HTTPException(status_code=404, detail="User task not found")
    
    user_task.is_approved = approval.is_approved
    user_task.approval_date = datetime.now()
    
    if approval.is_approved:
        # Get the task to get the reward amount
        task = db.query(Task).filter(Task.id == user_task.task_id).first()
        user = db.query(User).filter(User.id == user_task.user_id).first()
        
        if task and user:
            # Add reward to user's balance
            user.balance += task.reward
            
            # Create transaction
            transaction = Transaction(
                user_id=user.id,
                transaction_type=TransactionType.REWARD,
                amount=task.reward,
                description=f"Recompensa por tarea: {task.title}",
                category="task_reward"
            )
            db.add(transaction)
    
    db.commit()
    return {"message": "Task approval updated", "approved": approval.is_approved}


@router.get("/completed/{user_id}")
async def get_completed_tasks(user_id: int, db: Session = Depends(get_db)):
    """Get all completed tasks for a user"""
    completed_tasks = db.query(Task, UserTask).join(UserTask).filter(
        UserTask.user_id == user_id,
        UserTask.is_completed == True
    ).all()
    
    return {
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "reward": task.reward,
                "completed_date": user_task.completed_date.isoformat() if user_task.completed_date else None,
                "is_approved": user_task.is_approved,
                "photo_evidence": user_task.photo_evidence
            }
            for task, user_task in completed_tasks
        ]
    }


@router.delete("/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.is_active = False
    db.commit()
    return {"message": "Task deleted"}


@router.get("/debug/all-tasks")
async def debug_all_tasks(db: Session = Depends(get_db)):
    """Debug endpoint to see all tasks in the database"""
    tasks = db.query(Task).all()
    user_tasks = db.query(UserTask).all()
    
    return {
        "total_tasks": len(tasks),
        "total_user_tasks": len(user_tasks),
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "created_by": task.created_by,
                "assigned_to": task.assigned_to,
                "is_active": task.is_active,
                "created_at": task.created_at.isoformat() if task.created_at else None
            }
            for task in tasks
        ],
        "user_tasks": [
            {
                "id": ut.id,
                "user_id": ut.user_id,
                "task_id": ut.task_id,
                "is_completed": ut.is_completed
            }
            for ut in user_tasks
        ]
    }


@router.get("/debug/user/{user_id}")
async def debug_user_info(user_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to see user info and their family relationships"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get authorized creators
    authorized_creators = []
    if user.tutor_id:
        authorized_creators.append(user.tutor_id)
    
    sponsors = db.query(User).filter(
        User.sponsored_child_id == user_id,
        User.user_type == "sponsor"
    ).all()
    for sponsor in sponsors:
        authorized_creators.append(sponsor.id)
    
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "user_type": user.user_type.value,
            "tutor_id": user.tutor_id,
            "sponsored_child_id": user.sponsored_child_id
        },
        "authorized_creators": authorized_creators,
        "tasks_assigned_to_user": db.query(Task).filter(Task.assigned_to == user_id).count(),
        "user_tasks_count": db.query(UserTask).filter(UserTask.user_id == user_id).count()
    }
