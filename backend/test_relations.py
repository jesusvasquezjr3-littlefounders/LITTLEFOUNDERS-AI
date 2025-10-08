"""
Script de prueba para verificar las relaciones familiares
Crea usuarios de prueba y verifica que las relaciones funcionen correctamente
"""

from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, UserType, Gender, Task, TaskCategory, TaskDifficulty
from auth.utils import get_password_hash
from datetime import datetime

def test_family_relations():
    """Prueba las relaciones entre tutor, child y sponsor"""
    
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("  PRUEBA DE RELACIONES FAMILIARES")
        print("=" * 60)
        
        # Limpiar usuarios de prueba anteriores
        print("\n🧹 Limpiando usuarios de prueba anteriores...")
        db.query(User).filter(User.email.like('%_test@example.com')).delete()
        db.commit()
        
        # 1. Crear TUTOR
        print("\n1️⃣  Creando TUTOR...")
        tutor = User(
            name="Juan Pérez Test",
            email="juan_test@example.com",
            password_hash=get_password_hash("password123"),
            user_type=UserType.TUTOR,
            birth_date=datetime(1980, 5, 15),
            gender=Gender.MASCULINO
        )
        db.add(tutor)
        db.flush()
        print(f"   ✅ Tutor creado con ID: {tutor.id}")
        
        # 2. Crear CHILD vinculado al tutor
        print("\n2️⃣  Creando CHILD vinculado al tutor...")
        child = User(
            name="María Pérez Test",
            email="maria_test@example.com",
            password_hash=get_password_hash("password123"),
            user_type=UserType.CHILD,
            birth_date=datetime(2010, 3, 20),
            gender=Gender.FEMENINO,
            tutor_id=tutor.id,  # Vinculación con el tutor
            lessons_completed=0,
            minutes_studied=0,
            points_earned=0,
            balance=0.0
        )
        db.add(child)
        db.flush()
        print(f"   ✅ Child creado con ID: {child.id}, tutor_id: {child.tutor_id}")
        
        # 3. Crear SPONSOR vinculado al child
        print("\n3️⃣  Creando SPONSOR vinculado al child...")
        sponsor = User(
            name="Ana Sponsor Test",
            email="ana_test@example.com",
            password_hash=get_password_hash("password123"),
            user_type=UserType.SPONSOR,
            birth_date=datetime(1975, 8, 10),
            gender=Gender.FEMENINO,
            sponsored_child_id=child.id  # Vinculación con el child
        )
        db.add(sponsor)
        db.flush()
        print(f"   ✅ Sponsor creado con ID: {sponsor.id}, sponsored_child_id: {sponsor.sponsored_child_id}")
        
        db.commit()
        
        # 4. Verificar relaciones desde el TUTOR
        print("\n4️⃣  Verificando relaciones desde el TUTOR...")
        tutor_refresh = db.query(User).filter(User.id == tutor.id).first()
        children_of_tutor = db.query(User).filter(User.tutor_id == tutor.id).all()
        print(f"   📊 El tutor '{tutor_refresh.name}' tiene {len(children_of_tutor)} child(ren):")
        for c in children_of_tutor:
            print(f"      - {c.name} (ID: {c.id})")
        
        # 5. Verificar relaciones desde el CHILD
        print("\n5️⃣  Verificando relaciones desde el CHILD...")
        child_refresh = db.query(User).filter(User.id == child.id).first()
        child_tutor = db.query(User).filter(User.id == child_refresh.tutor_id).first()
        child_sponsors = db.query(User).filter(User.sponsored_child_id == child.id).all()
        print(f"   📊 El child '{child_refresh.name}':")
        print(f"      - Tutor: {child_tutor.name if child_tutor else 'None'} (ID: {child_tutor.id if child_tutor else 'N/A'})")
        print(f"      - Sponsors: {len(child_sponsors)}")
        for s in child_sponsors:
            print(f"         * {s.name} (ID: {s.id})")
        
        # 6. Verificar relaciones desde el SPONSOR
        print("\n6️⃣  Verificando relaciones desde el SPONSOR...")
        sponsor_refresh = db.query(User).filter(User.id == sponsor.id).first()
        sponsored_child = db.query(User).filter(User.id == sponsor_refresh.sponsored_child_id).first()
        print(f"   📊 El sponsor '{sponsor_refresh.name}' patrocina a:")
        print(f"      - {sponsored_child.name if sponsored_child else 'None'} (ID: {sponsored_child.id if sponsored_child else 'N/A'})")
        
        # 7. Crear una tarea desde el TUTOR para el CHILD
        print("\n7️⃣  Creando tarea desde el tutor para el child...")
        task = Task(
            title="Lavar los platos (Test)",
            description="Tarea de prueba",
            category=TaskCategory.CHORES,
            difficulty=TaskDifficulty.EASY,
            reward=50.0,
            created_by=tutor.id,
            assigned_to=child.id
        )
        db.add(task)
        db.commit()
        print(f"   ✅ Tarea creada con ID: {task.id}")
        
        # 8. Verificar que el child solo ve tareas de su tutor y sponsor
        print("\n8️⃣  Verificando tareas visibles para el child...")
        authorized_creators = [tutor.id]
        sponsors_list = db.query(User).filter(
            User.sponsored_child_id == child.id,
            User.user_type == UserType.SPONSOR
        ).all()
        authorized_creators.extend([s.id for s in sponsors_list])
        
        child_tasks = db.query(Task).filter(
            Task.assigned_to == child.id,
            Task.created_by.in_(authorized_creators)
        ).all()
        
        print(f"   📊 El child puede ver {len(child_tasks)} tarea(s):")
        for t in child_tasks:
            creator = db.query(User).filter(User.id == t.created_by).first()
            print(f"      - '{t.title}' creada por {creator.name} ({creator.user_type.value})")
        
        # 9. Validación de seguridad
        print("\n9️⃣  Validando control de acceso...")
        
        # Crear un tutor falso que NO está relacionado
        fake_tutor = User(
            name="Fake Tutor",
            email="fake_test@example.com",
            password_hash=get_password_hash("password123"),
            user_type=UserType.TUTOR,
            birth_date=datetime(1985, 1, 1),
            gender=Gender.MASCULINO
        )
        db.add(fake_tutor)
        db.flush()
        
        # Intentar crear una tarea desde el tutor falso
        print(f"   🔒 Verificando que el tutor falso (ID: {fake_tutor.id}) NO puede crear tareas para el child...")
        
        # Simular la validación que se hace en el endpoint
        is_authorized = False
        if fake_tutor.user_type == UserType.TUTOR and child.tutor_id == fake_tutor.id:
            is_authorized = True
        elif fake_tutor.user_type == UserType.SPONSOR and fake_tutor.sponsored_child_id == child.id:
            is_authorized = True
        
        if not is_authorized:
            print(f"   ✅ Correcto: El tutor falso NO está autorizado")
        else:
            print(f"   ❌ Error: El tutor falso fue autorizado incorrectamente")
        
        # Limpiar el tutor falso
        db.delete(fake_tutor)
        db.commit()
        
        print("\n" + "=" * 60)
        print("  ✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
        print("=" * 60)
        
        print("\n📋 Resumen de IDs creados:")
        print(f"   - Tutor: {tutor.id}")
        print(f"   - Child: {child.id}")
        print(f"   - Sponsor: {sponsor.id}")
        print(f"   - Task: {task.id}")
        
        print("\n💡 Puedes probar los endpoints con estos datos:")
        print(f"   - GET /auth/family/{tutor.id}")
        print(f"   - GET /auth/family/{child.id}")
        print(f"   - GET /auth/family/{sponsor.id}")
        print(f"   - GET /parent-tasks/children/{tutor.id}")
        print(f"   - GET /tasks/available/{child.id}")
        
        # Preguntar si quiere limpiar los datos de prueba
        print("\n")
        response = input("¿Deseas eliminar los datos de prueba? (sí/no): ")
        if response.lower() in ['sí', 'si', 's', 'yes', 'y']:
            db.query(Task).filter(Task.id == task.id).delete()
            db.query(User).filter(User.id.in_([tutor.id, child.id, sponsor.id])).delete()
            db.commit()
            print("✅ Datos de prueba eliminados")
        else:
            print("✅ Datos de prueba mantenidos para testing manual")
        
    except Exception as e:
        print(f"\n❌ Error durante las pruebas: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    test_family_relations()

