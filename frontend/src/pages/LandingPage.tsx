import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Shield,
  ArrowRight,
  Sparkles,
  Star,
  Gamepad2,
  PiggyBank,
  BookOpen,
  Heart,
  ChevronDown,
  Play,
  Award,
  Target,
  Globe
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePostHog } from "@/hooks/usePostHog";

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const { trackEvent } = usePostHog();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSection(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginClick = () => {
    trackEvent('landing_login_clicked', {
      timestamp: new Date().toISOString()
    });
  };

  const handleRegisterClick = () => {
    trackEvent('landing_register_clicked', {
      timestamp: new Date().toISOString()
    });
  };

  const features = [
    {
      icon: Gamepad2,
      title: "Juegos Divertidos",
      description: "Aprende finanzas jugando con simuladores interactivos y desafíos emocionantes",
      color: "from-pink-500 to-rose-500"
    },
    {
      icon: PiggyBank,
      title: "Ahorro Inteligente",
      description: "Descubre el poder del ahorro con herramientas visuales y metas alcanzables",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: BookOpen,
      title: "Lecciones Adaptadas",
      description: "Contenido educativo diseñado específicamente para cada edad y nivel",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Shield,
      title: "100% Seguro",
      description: "Plataforma protegida y supervisada para la tranquilidad de los padres",
      color: "from-purple-500 to-violet-500"
    }
  ];

  const stats = [
    { number: "2,847", label: "Pequeños Fundadores", icon: Users },
    { number: "$20K+", label: "Monedas Ganadas", icon: Star },
    { number: "100%", label: "Seguro", icon: Shield },
    { number: "24/7", label: "Ayuda Disponible", icon: Heart }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Sticky Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="/logo-main.png" 
                alt="Little Founders" 
                className="h-10 w-auto"
              />
              <span className={`text-2xl font-bold transition-colors ${
                isScrolled ? 'text-gray-900' : 'text-white'
              }`}>
                Little Founders
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" className={isScrolled ? 'text-gray-700' : 'text-white'}>
                <Link to="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white">
                <Link to="/register">¡Empezar Ahora!</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-20 h-20 bg-pink-400/20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-32 h-32 bg-purple-400/20 rounded-full blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-blue-400/20 rounded-full blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            {/* Badge */}
            <Badge className="px-6 py-3 text-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0 shadow-lg">
              <Sparkles className="w-5 h-5 mr-2" />
              ¡La educación financiera nunca fue tan divertida!
            </Badge>

            {/* Main Logo */}
            <div className="space-y-6">
              <div className="flex justify-center">
                <img 
                  src="/logo-hero.png" 
                  alt="Little Founders" 
                  className="h-48 md:h-64 lg:h-96 w-auto drop-shadow-2xl"
                />
              </div>
              
              <p className="text-2xl md:text-3xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-medium">
                La plataforma donde los niños aprenden sobre dinero, 
                <span className="text-pink-600 font-bold"> ahorran</span>, 
                <span className="text-purple-600 font-bold"> invierten</span> y se convierten en 
                <span className="text-blue-600 font-bold"> pequeños empresarios</span>
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
               <Button 
                 asChild 
                 size="lg" 
                 className="px-12 py-6 text-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-cyan-500 hover:to-blue-600 hover:shadow-cyan-500/50 text-white shadow-2xl hover:shadow-2xl transform hover:scale-110 hover:-translate-y-2 transition-all duration-500 animate-pulse-glow"
                 onClick={handleRegisterClick}
               >
                 <Link to="/register">
                   <Play className="w-6 h-6 mr-3" />
                   ¡Comenzar Aventura!
                   <ArrowRight className="w-6 h-6 ml-3" />
                 </Link>
               </Button>
               
               <Button 
                 asChild 
                 variant="outline" 
                 size="lg" 
                 className="px-12 py-6 text-2xl border-2 border-purple-300 text-purple-700 hover:bg-gradient-to-r hover:from-green-500 hover:to-emerald-600 hover:text-white hover:border-transparent hover:shadow-green-500/50 shadow-xl hover:shadow-2xl transform hover:scale-110 hover:-translate-y-2 transition-all duration-500"
                 onClick={handleLoginClick}
               >
                 <Link to="/login">
                   Ya tengo cuenta
                 </Link>
               </Button>
            </div>

            {/* Scroll Indicator */}
            <div className="pt-16 animate-bounce">
              <ChevronDown className="w-8 h-8 text-gray-400 mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              ¿Por qué elegir <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">Little Founders</span>?
            </h2>
            <p className="text-2xl text-gray-600 max-w-3xl mx-auto">
              Transformamos el aprendizaje financiero en una experiencia mágica y divertida
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-500 cursor-pointer ${
                  activeSection === index ? 'ring-4 ring-pink-500/50 scale-105' : ''
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
                <CardHeader className="text-center relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-pink-600 group-hover:to-purple-600 transition-all duration-300">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <CardDescription className="text-lg text-gray-600 text-center leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-gradient-to-r from-pink-500 to-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-white mb-6">
              Números que nos enorgullecen
            </h2>
            <p className="text-2xl text-pink-100">
              Únete a miles de familias que ya confían en nosotros
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="text-center group"
              >
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/30 transition-all duration-300">
                  <stat.icon className="w-10 h-10 text-white" />
                </div>
                <div className="text-5xl font-black text-white mb-2 group-hover:scale-110 transition-transform duration-300">
                  {stat.number}
                </div>
                <div className="text-xl text-pink-100 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <h2 className="text-6xl font-bold text-gray-900">
              ¿Listo para comenzar tu 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600"> aventura financiera</span>?
            </h2>
            
            <p className="text-2xl text-gray-600 leading-relaxed">
              Únete a Little Founders hoy y descubre un mundo donde aprender sobre dinero es divertido, 
              seguro y emocionante. ¡Tu futuro financiero te está esperando!
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
               <Button 
                 asChild 
                 size="lg" 
                 className="px-16 py-8 text-3xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-yellow-500 hover:to-orange-600 hover:shadow-yellow-500/50 text-white shadow-2xl hover:shadow-2xl transform hover:scale-125 hover:-translate-y-3 transition-all duration-500 animate-pulse-glow"
                 onClick={handleRegisterClick}
               >
                 <Link to="/register">
                   <Award className="w-8 h-8 mr-4" />
                   ¡Empezar Ahora!
                   <ArrowRight className="w-8 h-8 ml-4" />
                 </Link>
               </Button>
            </div>

            <div className="flex items-center justify-center space-x-8 pt-12">
              <div className="flex items-center space-x-2 text-gray-600">
                <Shield className="w-6 h-6 text-green-500" />
                <span className="text-lg">100% Seguro</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Globe className="w-6 h-6 text-blue-500" />
                <span className="text-lg">Acceso 24/7</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Target className="w-6 h-6 text-purple-500" />
                <span className="text-lg">Resultados Garantizados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center items-center space-x-3 mb-6">
            <img 
              src="/logo-main.png" 
              alt="Little Founders" 
              className="h-12 w-auto"
            />
            <span className="text-3xl font-bold">Little Founders</span>
          </div>
          <p className="text-xl text-gray-400 mb-8">
            Educando a la próxima generación de emprendedores financieros
          </p>
          <div className="flex justify-center space-x-8 text-gray-400">
            <span>© 2025 Little Founders</span>
            <span>•</span>
            <span>Privacidad</span>
            <span>•</span>
            <span>Términos</span>
            <span>•</span>
            <span>Contacto</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;