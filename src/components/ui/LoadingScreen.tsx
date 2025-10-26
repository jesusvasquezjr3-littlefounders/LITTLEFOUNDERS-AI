import { Card, CardContent } from "@/components/ui/card";

interface LoadingScreenProps {
  title: string;
  description: string;
  loadingMessage: string;
  icon?: React.ReactNode;
  className?: string;
}

export function LoadingScreen({ 
  title, 
  description, 
  loadingMessage, 
  icon,
  className = ""
}: LoadingScreenProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className="p-8 text-center">
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            {icon || (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            )}
            <h2 className="text-2xl font-bold">{loadingMessage}</h2>
            <p className="text-muted-foreground max-w-md">
              Por favor espera un momento mientras cargamos tu información...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente específico para banca digital
export function BankingLoadingScreen() {
  return (
    <LoadingScreen
      title="Banca Digital"
      description="Verificando estado de activación..."
      loadingMessage="Verificando Acceso"
    />
  );
}

// Componente específico para metas de ahorro
export function SavingsLoadingScreen() {
  return (
    <LoadingScreen
      title="Mis Metas de Ahorro"
      description="Cargando tus metas de ahorro..."
      loadingMessage="Cargando Metas de Ahorro"
    />
  );
}

// Componente específico para lecciones
export function LessonsLoadingScreen() {
  return (
    <LoadingScreen
      title="Educación Financiera LittleFounders"
      description="Cargando lecciones y progreso..."
      loadingMessage="Cargando Lecciones"
    />
  );
}
