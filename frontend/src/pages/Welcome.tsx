import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Users,
  BarChart3,
  Shield,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";


const Welcome = () => {
  const handleLoginClick = () => {
    // Navigate to login
  };

  const handleRegisterClick = () => {
    // Navigate to register
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-customers/5 to-revenue/5"></div>

        <div className="relative flex flex-col items-center justify-center min-h-screen px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <Badge variant="outline" className="px-4 py-2 text-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                LittleFounders AI
              </Badge>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                Bienvenido a{" "}
                <span className="bg-gradient-to-r from-primary to-customers bg-clip-text text-transparent">
                  LittleFounders
                </span>
                <br />
                AI
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Aprende sobre finanzas, ahorra, y gestiona tu propio dinero mientras te diviertes con juegos,
                retos y actividades pensadas especialmente para niños y niñas como tú.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
              <Card className="border-0 shadow-medium bg-revenue-light/50">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-revenue text-revenue-foreground rounded-lg flex items-center justify-center mx-auto mb-2">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">Tu progreso</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Observa cómo avanzas con estadísticas divertidas y coloridas a medida que completas misiones y aprendes a manejar tu dinero.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-medium bg-customers-light/50">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-customers text-customers-foreground rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Users className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">Descubre y comparte</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Aprende junto a otros pequeños fundadores, comparte logros y explora el maravilloso mundo de las finanzas.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-medium bg-product-light/50">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-product text-product-foreground rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Shield className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">Seguro y fácil</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Tu seguridad es lo más importante. Aprende en un espacio protegido y amigable, diseñado especialmente para ti.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="px-8 py-6 text-lg bg-gradient-to-r from-primary to-customers hover:opacity-90">
                <Link to="/login">
                  Iniciar Sesión
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="px-8 py-6 text-lg">
                <Link to="/register">
                  ¡Crear mi cuenta!
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="pt-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-revenue">2,847</div>
                  <div className="text-sm text-muted-foreground">Pequeños fundadores</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-customers">$20K</div>
                  <div className="text-sm text-muted-foreground">Monedas ganadas</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-product">100%</div>
                  <div className="text-sm text-muted-foreground">Seguro</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-team">24/7</div>
                  <div className="text-sm text-muted-foreground">Ayuda disponible</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;