import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SavingsGoals } from "@/components/banking/SavingsGoals";

const Savings = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mis Ahorros</h1>
            <p className="text-muted-foreground">
              Establece metas de ahorro y alcanza tus objetivos financieros
            </p>
          </div>
        </div>

        {/* Main Content */}
        <SavingsGoals />
      </div>
    </DashboardLayout>
  );
};

export default Savings;
