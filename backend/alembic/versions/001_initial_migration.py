"""Initial migration with users and tasks

Revision ID: 001
Revises: 
Create Date: 2024-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Crear tabla de usuarios
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password', sa.String(), nullable=False),
        sa.Column('user_type', sa.Enum('TUTOR', 'CHILD', 'SPONSOR', name='usertype'), nullable=False),
        sa.Column('birth_date', sa.String(), nullable=True),
        sa.Column('gender', sa.Enum('MASCULINO', 'FEMENINO', 'OTRO', name='gender'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('tutor_email', sa.String(), nullable=True),
        sa.Column('lessons_completed', sa.Integer(), nullable=True),
        sa.Column('minutes_studied', sa.Integer(), nullable=True),
        sa.Column('points_earned', sa.Integer(), nullable=True),
        sa.Column('child_email', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Crear tabla de tareas
    op.create_table('tasks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.Enum('CHORES', 'EDUCATION', 'SOCIAL', 'BONUS', name='taskcategory'), nullable=False),
        sa.Column('difficulty', sa.Enum('EASY', 'MEDIUM', 'HARD', name='taskdifficulty'), nullable=False),
        sa.Column('reward', sa.Float(), nullable=False),
        sa.Column('time_estimate', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('is_important', sa.Boolean(), nullable=True),
        sa.Column('status', sa.Enum('ASSIGNED', 'PENDING', 'COMPLETED', 'REJECTED', name='taskstatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('assigned_by_id', sa.String(), nullable=False),
        sa.Column('assigned_to_id', sa.String(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('photo_evidence_url', sa.String(), nullable=True),
        sa.Column('original_task_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tasks_id'), 'tasks', ['id'], unique=False)

    # Crear tabla de historial de tareas
    op.create_table('task_history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('task_id', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('performed_by_id', sa.String(), nullable=False),
        sa.Column('performed_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['performed_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_task_history_id'), 'task_history', ['id'], unique=False)

    # Crear tabla de recompensas
    op.create_table('rewards',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('task_id', sa.String(), nullable=False),
        sa.Column('child_id', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('paid_by_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['child_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['paid_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rewards_id'), 'rewards', ['id'], unique=False)

    # Crear tabla de configuración familiar
    op.create_table('family_settings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tutor_id', sa.String(), nullable=False),
        sa.Column('weekly_allowance', sa.Float(), nullable=True),
        sa.Column('task_completion_goal', sa.Integer(), nullable=True),
        sa.Column('auto_approve_photos', sa.Boolean(), nullable=True),
        sa.Column('require_photo_evidence', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['tutor_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_family_settings_id'), 'family_settings', ['id'], unique=False)

def downgrade() -> None:
    # Eliminar tablas en orden inverso
    op.drop_index(op.f('ix_family_settings_id'), table_name='family_settings')
    op.drop_table('family_settings')
    
    op.drop_index(op.f('ix_rewards_id'), table_name='rewards')
    op.drop_table('rewards')
    
    op.drop_index(op.f('ix_task_history_id'), table_name='task_history')
    op.drop_table('task_history')
    
    op.drop_index(op.f('ix_tasks_id'), table_name='tasks')
    op.drop_table('tasks')
    
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    
    # Eliminar tipos enum
    op.execute('DROP TYPE IF EXISTS taskstatus')
    op.execute('DROP TYPE IF EXISTS taskdifficulty')
    op.execute('DROP TYPE IF EXISTS taskcategory')
    op.execute('DROP TYPE IF EXISTS gender')
    op.execute('DROP TYPE IF EXISTS usertype')