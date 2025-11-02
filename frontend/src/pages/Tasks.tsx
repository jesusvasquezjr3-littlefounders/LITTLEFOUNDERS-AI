import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TasksSystem } from "@/components/banking/TasksSystem";

const Tasks = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mis Tareas</h1>
            <p className="text-muted-foreground">
              Completa tareas y gana dinero virtual para tus ahorros
            </p>
          </div>
        </div>

        {/* Tasks System */}
        <TasksSystem />
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
