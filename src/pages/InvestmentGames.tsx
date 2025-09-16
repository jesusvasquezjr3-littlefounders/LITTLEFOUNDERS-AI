import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Clock, Gamepad2 } from "lucide-react";

const InvestmentGames = () => {
  const navigate = useNavigate();

  const games = [
    {
      id: "lemonade-stand",
      title: "Emprende tu stand de limonada",
      description: "Aprende conceptos básicos de emprendimiento administrando tu propio puesto de limonadas. Gestiona ingredientes, precios y marketing.",
      icon: <Lightbulb className="w-8 h-8 text-yellow-500" />,
      available: true,
      route: "/lemonade-stand"
    },
    {
      id: "coming-soon",
      title: "Próximamente...",
      description: "Nuevo juego educativo financiero en desarrollo. ¡Mantente atento para descubrir nuevas aventuras de aprendizaje!",
      icon: <Clock className="w-8 h-8 text-gray-400" />,
      available: false,
      route: null
    }
  ];

  const handlePlayGame = (game: typeof games[0]) => {
    if (game.available && game.route) {
      navigate(game.route);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
            Aprende a Invertir
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Descubre el mundo de las inversiones y el emprendimiento a través de juegos educativos divertidos e interactivos.
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {games.map((game) => (
            <Card 
              key={game.id} 
              className={`group transition-all duration-300 hover:shadow-xl ${
                game.available 
                  ? 'hover:scale-[1.02] cursor-pointer border-border hover:border-orange-200' 
                  : 'opacity-75'
              }`}
            >
              <CardHeader className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    game.available 
                      ? 'bg-gradient-to-br from-orange-100 to-yellow-100' 
                      : 'bg-gray-100'
                  }`}>
                    {game.icon}
                  </div>
                </div>
                <div>
                  <CardTitle className={`text-xl ${
                    game.available ? 'text-foreground' : 'text-gray-500'
                  }`}>
                    {game.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    {game.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <Button
                  onClick={() => handlePlayGame(game)}
                  disabled={!game.available}
                  className={`w-full transition-all duration-200 ${
                    game.available
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  size="lg"
                >
                  {game.available ? (
                    <>
                      <Gamepad2 className="w-4 h-4 mr-2" />
                      ¡Jugar!
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

        {/* Tips Section */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-800 mb-2">
                    💡 Consejo para Padres
                  </h3>
                  <p className="text-orange-700 text-sm leading-relaxed">
                    Los juegos de inversión están diseñados para enseñar conceptos financieros básicos de manera divertida. 
                    Acompaña a tu hijo durante el juego y discutan juntos las decisiones tomadas para maximizar el aprendizaje.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InvestmentGames;