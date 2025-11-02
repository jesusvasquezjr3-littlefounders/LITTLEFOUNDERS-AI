import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ParentTasksSystem } from "@/components/banking/ParentTasksSystem";

const ParentTasks = () => {
  // Obtener información del usuario desde localStorage o contexto
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {user?.user_type === 'tutor' ? 'Gestión de Tareas - Padre/Tutor' : 
               user?.user_type === 'sponsor' ? 'Gestión de Tareas - Patrocinador' : 
               'Gestión de Tareas'}
            </h1>
            <p className="text-muted-foreground">
              Asigna tareas, supervisa el progreso y aprueba las actividades completadas
            </p>
          </div>
        </div>

        {/* Parent Tasks System */}
        <ParentTasksSystem user={user} />
      </div>
    </DashboardLayout>
  );
};

export default ParentTasks;
