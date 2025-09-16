import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Store, Clock, PlayCircle } from "lucide-react";

const InvestmentGames = () => {
  const navigate = useNavigate();
  
  const games = [
    {
      id: "lemonade-stand",
      title: "Emprende tu stand de limonada",
      description: "Aprende los fundamentos del emprendimiento administrando tu propio puesto de limonadas. Gestiona inventario, precios y clima para maximizar ganancias.",
      icon: Store,
      status: "available",
      difficulty: "Principiante",
      duration: "15-20 min",
      skills: ["Presupuesto", "Inventario", "Ganancias"],
      color: "bg-gradient-to-br from-yellow-400 to-orange-500"
    },
    {
      id: "crypto-adventure",
      title: "Próximamente...",
      description: "¡Nuevas aventuras de inversión están en camino! Mantente atento para más juegos educativos que te enseñarán sobre el mundo financiero.",
      icon: Clock,
      status: "coming-soon",
      difficulty: "Intermedio",
      duration: "Próximamente",
      skills: ["Próximamente"],
      color: "bg-gradient-to-br from-gray-400 to-gray-600"
    }
  ];

  const handlePlayGame = (gameId: string) => {
    if (gameId === "lemonade-stand") {
      navigate("/lemonade-stand");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Lightbulb className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Aprende a Invertir
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descubre el mundo de los negocios y la inversión a través de juegos divertidos y educativos
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {games.map((game) => (
            <Card 
              key={game.id} 
              className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-lg ${game.color}`}>
                      <game.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{game.title}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge 
                          variant={game.status === "available" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {game.status === "available" ? "Disponible" : "Próximamente"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {game.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <CardDescription className="text-sm leading-relaxed">
                  {game.description}
                </CardDescription>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{game.duration}</span>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">
                      Aprenderás sobre:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {game.skills.map((skill, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs bg-muted"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handlePlayGame(game.id)}
                  disabled={game.status !== "available"}
                  className="w-full mt-4"
                  size="lg"
                >
                  {game.status === "available" ? (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Jugar Ahora
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      Próximamente
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="text-center bg-muted/50 rounded-lg p-6 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            ¿Por qué aprender con juegos?
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Los juegos educativos te permiten experimentar situaciones reales sin riesgo, 
            ayudándote a desarrollar habilidades financieras de manera divertida y práctica.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InvestmentGames;