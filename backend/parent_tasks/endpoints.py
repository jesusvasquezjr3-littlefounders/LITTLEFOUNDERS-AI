from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Task, UserTask, User
from schemas import TaskCreate, TaskResponse

router = APIRouter(prefix="/parent-tasks", tags=["Parent Tasks"])


@router.post("/", response_model=TaskResponse)
async def create_task_for_child(task: TaskCreate, parent_id: int, db: Session = Depends(get_db)):
    """Create and assign a task to a child (parent functionality)"""
    # Verify parent exists
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # Verify parent is a tutor or sponsor
    if parent.user_type.value not in ["tutor", "sponsor"]:
        raise HTTPException(status_code=403, detail="Only tutors and sponsors can create tasks")
    
    # Verify the child is related to this parent
    if task.assigned_to:
        child = db.query(User).filter(User.id == task.assigned_to).first()
        if not child:
            raise HTTPException(status_code=404, detail="Child not found")
        
        # Check if parent is authorized to assign tasks to this child
        is_authorized = False
        if parent.user_type.value == "tutor" and child.tutor_id == parent_id:
            is_authorized = True
        elif parent.user_type.value == "sponsor" and parent.sponsored_child_id == child.id:
            is_authorized = True
        
        if not is_authorized:
            raise HTTPException(
                status_code=403, 
                detail="You can only create tasks for your registered children"
            )
    
    db_task = Task(
        title=task.title,
        description=task.description,
        category=task.category,
        difficulty=task.difficulty,
        reward=task.reward,
        time_estimate=task.time_estimate,
        due_date=task.due_date,
        is_first_dibs=task.is_first_dibs,
        created_by=parent_id,
        assigned_to=task.assigned_to
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Create UserTask entry
    if task.assigned_to:
        user_task = UserTask(
            user_id=task.assigned_to,
            task_id=db_task.id
        )
        db.add(user_task)
        db.commit()
    
    return db_task


@router.get("/children/{parent_id}")
async def get_parent_children(parent_id: int, db: Session = Depends(get_db)):
    """Get all children associated with a parent (tutor or sponsor)"""
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    children = []
    
    # If parent is a TUTOR, get children by tutor_id
    if parent.user_type.value == "tutor":
        children = db.query(User).filter(User.tutor_id == parent_id).all()
    # If parent is a SPONSOR, get the sponsored child
    elif parent.user_type.value == "sponsor":
        if parent.sponsored_child_id:
            child = db.query(User).filter(User.id == parent.sponsored_child_id).first()
            if child:
                children = [child]
    
    return {
        "children": [
            {
                "id": child.id,
                "name": child.name,
                "email": child.email,
                "balance": child.balance,
                "points_earned": child.points_earned,
                "lessons_completed": child.lessons_completed
            }
            for child in children
        ]
    }


@router.get("/pending-approvals/{parent_id}")
async def get_pending_approvals(parent_id: int, db: Session = Depends(get_db)):
    """Get all tasks pending approval created by this parent"""
    pending_tasks = db.query(Task, UserTask, User).join(
        UserTask, Task.id == UserTask.task_id
    ).join(
        User, UserTask.user_id == User.id
    ).filter(
        Task.created_by == parent_id,
        UserTask.is_completed == True,
        UserTask.is_approved == None
    ).all()
    
    return {
        "tasks": [
            {
                "user_task_id": user_task.id,
                "task_id": task.id,
                "title": task.title,
                "description": task.description,
                "reward": task.reward,
                "child_name": user.name,
                "child_id": user.id,
                "completed_date": user_task.completed_date.isoformat() if user_task.completed_date else None,
                "photo_evidence": user_task.photo_evidence
            }
            for task, user_task, user in pending_tasks
        ]
    }


@router.get("/child-tasks/{child_id}")
async def get_child_tasks(child_id: int, db: Session = Depends(get_db)):
    """Get all tasks for a specific child"""
    tasks = db.query(Task, UserTask).outerjoin(
        UserTask, (Task.id == UserTask.task_id) & (UserTask.user_id == child_id)
    ).filter(
        Task.assigned_to == child_id,
        Task.is_active == True
    ).all()
    
    return {
        "tasks": [
            {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "category": task.category.value,
                "difficulty": task.difficulty.value,
                "reward": task.reward,
                "is_completed": user_task.is_completed if user_task else False,
                "is_approved": user_task.is_approved if user_task else None,
                "due_date": task.due_date.isoformat() if task.due_date else None
            }
            for task, user_task in tasks
        ]
    }
