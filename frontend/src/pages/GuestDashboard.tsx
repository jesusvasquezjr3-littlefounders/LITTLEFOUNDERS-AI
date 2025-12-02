import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, Lightbulb, Home } from "lucide-react";

const GuestDashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ¡Bienvenido a LittleFounders!
          </h1>
          <p className="text-lg text-muted-foreground">
            Explora lecciones y el área de emprendimiento sin registrarte.
          </p>
        </div>

        {/* Quick access cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" />
                Inicio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta es una vista de demostración del panel para niños.
              </p>
              <Button asChild className="w-full">
                <Link to="/guest-dashboard">Permanecer en inicio</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Lecciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Explora nuestro framework de lecciones por edades.
              </p>
              <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-purple-600">
                <Link to="/lecciones-guest">Ir a Lecciones</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-orange-500" />
                Emprendimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conoce nuestros juegos y actividades de emprendimiento.
              </p>
              <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-yellow-500">
                <Link to="/emprendimiento-guest">Ir a Emprendimiento</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Auth prompts */}
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            ¿Te gusta lo que ves?{" "}
            <Link to="/register" className="text-primary underline">
              Regístrate
            </Link>{" "}
            o{" "}
            <Link to="/login" className="text-primary underline">
              inicia sesión
            </Link>{" "}
            para guardar tu progreso.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default GuestDashboard;

