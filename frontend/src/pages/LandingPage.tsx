import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  Zap,
  BookOpen,
  Brain,
  Menu,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePostHog } from "@/hooks/usePostHog";
import { DinoCharacter } from "../components/demo/DinoCharacter";
import { DinaCharacter } from "../components/demo/DinaCharacter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { trackEvent } = usePostHog();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [wordIndex, setWordIndex] = useState(0);
  const rotatorWords = ["Niños", "Adolescentes", "Adultos"];

  const [ctaWordIndex, setCtaWordIndex] = useState(0);
  const ctaWords = ["founder", "empresario", "CEO", "líder", "emprendedor"];

  const [dinaExpr, setDinaExpr] = useState<'neutral' | 'wink'>('neutral');

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatorWords.length);
      setCtaWordIndex((prev) => (prev + 1) % ctaWords.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDinaExpr((prev) => (prev === 'neutral' ? 'wink' : 'neutral'));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTrackClick = (location: string) => {
    trackEvent(`landing_click_${location}`, {
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-pink-100 selection:text-pink-900">

      {/* --- NAVIGATION --- */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled || mobileMenuOpen ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/logo-sized.png" alt="LittleFounders" className="h-10 w-auto object-contain" />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#problem" className="text-gray-600 hover:text-pink-600 font-medium transition-colors">¿Por qué?</a>
              <a href="#features" className="text-gray-600 hover:text-pink-600 font-medium transition-colors">Lecciones</a>
              <a href="#faq" className="text-gray-600 hover:text-pink-600 font-medium transition-colors">Dudas</a>
              <Button asChild variant="ghost" onClick={() => handleTrackClick('login_nav')}>
                <Link to="/login" className="text-gray-700 hover:bg-gray-100">Ingresar</Link>
              </Button>
              <Button asChild onClick={() => handleTrackClick('cta_nav')} className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all rounded-full px-6">
                <Link to="/demo">Probar Gratis</Link>
              </Button>
            </div>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden text-gray-700" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-gray-100 p-4 flex flex-col gap-4 shadow-xl">
            <a href="#problem" className="text-lg font-medium text-gray-700 py-2 border-b border-gray-50" onClick={() => setMobileMenuOpen(false)}>¿Por qué?</a>
            <a href="#features" className="text-lg font-medium text-gray-700 py-2 border-b border-gray-50" onClick={() => setMobileMenuOpen(false)}>Lecciones</a>
            <a href="#faq" className="text-lg font-medium text-gray-700 py-2 border-b border-gray-50" onClick={() => setMobileMenuOpen(false)}>Preguntas Frecuentes</a>
            <div className="flex flex-col gap-3 mt-2">
              <Button asChild variant="outline" className="w-full justify-center" onClick={() => handleTrackClick('login_mobile')}>
                <Link to="/login">Ingresar</Link>
              </Button>
              <Button asChild className="w-full justify-center bg-pink-600 hover:bg-pink-700 text-white" onClick={() => handleTrackClick('cta_mobile')}>
                <Link to="/demo">¡Comenzar!</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      {/* Goal: Win the first 5 seconds. Clear Value Prop + Visual Delight */}
      <header className="relative pt-24 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">

        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

            {/* Copy (Left) */}
            <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 text-pink-700 text-sm font-bold animate-fade-in-up">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                </span>
                Nueva Beta Abierta
              </div>

              <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.1] tracking-tight">
                El <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">Simulador de Startup</span> para <span className="inline-block relative">
                  <span key={wordIndex} className="animate-fade-in-up inline-block text-pink-600">
                    {rotatorWords[wordIndex]}.
                  </span>
                </span>
              </h1>

              <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed">
                Aprende <b>finanzas reales</b> construyendo un negocio virtual. Sin teoría aburrida, solo diversión práctica.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                <Button asChild size="lg" className="w-full sm:w-auto px-8 py-7 text-xl rounded-2xl bg-gray-900 hover:bg-gray-800 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all group" onClick={() => handleTrackClick('cta_hero')}>
                  <Link to="/demo">
                    Probar Demo
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <p className="text-sm text-gray-500 font-medium">✨ No requiere tarjeta • Acceso inmediato</p>
              </div>
            </div>

            {/* Visual (Right) - Characters */}
            {/* Hidden on mobile to save space, visible on desktop */}
            <div className="hidden lg:flex flex-1 w-full relative h-[600px] items-center justify-end pointer-events-none">
              {/* Decorative Circle Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-100 to-purple-100 rounded-full scale-125 translate-x-20 opacity-50" style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%' }}></div>

              {/* Dina - BACK (Larger, Z-0) */}
              <div className="absolute bottom-0 -right-20 w-[650px] h-[650px] z-0 animate-float pointer-events-auto opacity-90" style={{ animationDelay: '1.5s' }}>
                <DinaCharacter expression={dinaExpr} className="drop-shadow-2xl" />
              </div>

              {/* Dinosaur (Liruf) - FRONT (Smaller, Z-20) - Grounded */}
              <div className="absolute bottom-0 right-64 w-[400px] h-[400px] z-20 animate-float pointer-events-auto" style={{ animationDelay: '0s' }}>
                <DinoCharacter mood="happy" className="drop-shadow-2xl" bubblePosition="hero" showBubble={false} currentText="" />
              </div>

            </div>

          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-gray-400 hidden lg:block">
          <ChevronDown className="w-8 h-8 opacity-50" />
        </div>
      </header>


      {/* --- SCAR TISSUE / PROBLEM SECTION --- */}
      {/* Goal: Problem -> Agitation using a relatable story. "Objection handling". */}
      <section id="problem" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16">

          <div className="space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900">
              La escuela enseña Álgebra... <br />
              <span className="text-gray-400 decoration-gray-300 line-through decoration-4">pero nadie enseña Dinero.</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Es la historia de siempre: graduarse sabiendo resolver <i>trinomios cuadrados perfectos</i>, pero sin saber cómo funciona una tarjeta de crédito, un presupuesto o una inversión.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-2xl">📉</div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Desinformación</h3>
              <p className="text-gray-600">Los niños aprenden sobre dinero de TikTok o amigos, llenándose de mitos peligrosos.</p>
            </div>
            <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-2xl">😟</div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Estrés Futuro</h3>
              <p className="text-gray-600">El dinero es la causa #1 de estrés en adultos. No dejes que sea el de tus hijos.</p>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-2xl">💤</div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Clases Aburridas</h3>
              <p className="text-gray-600">Los cursos tradicionales son PDFs aburridos que los niños odian leer.</p>
            </div>
          </div>

        </div>
      </section>


      {/* --- TRANSFORMATION / SOLUTION --- */}
      <section className="py-24 bg-gray-900 text-white relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-8">
              <div className="inline-block px-4 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold text-sm tracking-wide uppercase">
                La Solución LittleFounders
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
                No es una clase.<br />
                Es una <span className="text-blue-400">Aventura</span>.
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                Utilizamos el "Aprendizaje Basado en Simulación". Aprende finanzas jugando con simuladores interactivos y desafíos emocionantes).
              </p>
              <ul className="space-y-4">
                {[
                  "Aprende cometiendo errores virtuales (no reales)",
                  "Descubre el poder del ahorro con herramientas visuales y metas alcanzables",
                  "Contenido educativo diseñado específicamente para cada edad y nivel"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-lg">
                    <CheckCircle2 className="text-green-400 w-6 h-6 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Just a visual representation of "Fun" */}
            <div className="flex-1 flex justify-center">
              <div className="relative w-full max-w-md aspect-square bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl rotate-3 flex items-center justify-center shadow-2xl border border-white/10">
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-4xl shadow-xl animate-bounce">
                  💡
                </div>
                <div className="text-center p-8">
                  <span className="text-8xl mb-4 block">🎮</span>
                  <p className="text-2xl font-bold">Aprender Jugando</p>
                  <p className="text-white/60 mt-2">100% Interactivo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* --- FEATURE SHOWCASE (LECCIONES) --- */}
      {/* Goal: Show, Don't Just Tell. Use a placeholder for the GIF requested. */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Mira cómo funciona</h2>
            <p className="text-xl text-gray-600">Todo el contenido está diseñado para ser visual, intuitivo y digerible en sesiones cortas.</p>
          </div>

          {/* The "Laptop" Frame for the GIF */}
          <div className="relative mx-auto max-w-5xl">
            <div className="relative rounded-t-3xl bg-gray-900 p-2 md:p-4 shadow-2xl border-b-0">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 mb-4 px-4 pt-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div className="ml-4 bg-gray-800 rounded-full px-4 py-1 text-xs text-gray-400 flex-1 text-center font-mono">
                  https://littlefounders.ai//lecciones
                </div>
              </div>

              {/* SCREEN CONTENT - GIF SHOWCASE */}
              <div className="bg-white rounded-xl overflow-hidden aspect-video relative flex items-center justify-center group cursor-pointer border-4 border-gray-800">
                <img
                  src="/assets/demo-lessons.gif"
                  alt="Demostración de Lecciones LittleFounders"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback in case user hasn't uploaded the file yet
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.className = "absolute inset-0 bg-gray-100 flex flex-col items-center justify-center text-gray-400";
                      placeholder.innerHTML = `
                        <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        <p class="font-medium text-lg">GIF de Navegación de Lecciones</p>
                        <p class="text-sm">Pon tu archivo en: public/assets/demo-lessons.gif</p>
                      `;
                      parent.appendChild(placeholder);
                    }
                  }}
                />

                {/* Optional: Overlay "Play" button feel */}
                <div className="absolute w-20 h-20 bg-pink-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[20px] border-l-white border-b-[10px] border-b-transparent ml-1"></div>
                </div>
              </div>
            </div>
            {/* Laptop base */}
            <div className="h-4 md:h-6 bg-gray-800 rounded-b-xl mx-4 md:mx-10 shadow-xl"></div>
          </div>

          {/* Grid of details below */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto text-pink-600">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl">Sin Palabrería</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Contenido directo. Eliminamos la paja académica para ir a lo que importa.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl">A tu Ritmo</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Lecciones de 5 minutos. Perfectas para la atención moderna.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto text-purple-600">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl">Espacio Seguro</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Entorno cerrado, moderado y diseñado para menores.</p>
            </div>
          </div>
        </div>
      </section>




      {/* --- FAQ SECTION --- */}
      {/* Handle Objections directly. */}
      <section id="faq" className="py-24 bg-pink-50/50">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Preguntas Frecuentes</h2>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-white border-none rounded-2xl shadow-sm px-4">
              <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline hover:text-pink-600">¿Para qué edades es?</AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Está diseñado principalmente para niños y adolescentes de <strong>5 a 17 años</strong>. Sin embargo, muchos adultos nos han dicho que también aprenden mucho con las bases.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white border-none rounded-2xl shadow-sm px-4">
              <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline hover:text-pink-600">¿Es seguro para mis hijos?</AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Absolutamente. No hay chat abierto con desconocidos, no hay publicidad externa, y todos los datos están encriptados.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white border-none rounded-2xl shadow-sm px-4">
              <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline hover:text-pink-600">¿Tiene costo?</AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Actualmente estamos en una <strong>Beta Abierta Gratuita</strong>. Puedes registrarte y usar todas las funciones sin costo. En el futuro tendremos planes premium, pero siempre habrá una capa gratuita.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white border-none rounded-2xl shadow-sm px-4">
              <AccordionTrigger className="text-lg font-medium text-gray-800 hover:no-underline hover:text-pink-600">¿Necesito supervisar a mi hijo mientras juega?</AccordionTrigger>
              <AccordionContent className="text-gray-600">
                No es necesario, la plataforma es autodidacta. Sin embargo, tenemos un "Panel de Padres" donde puedes ver su progreso y te damos tips para conversar sobre lo que aprendieron.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>


      {/* --- CTA / FOOTER --- */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-8">
            Tu hijo podría ser el próximo <br />
            <span className="inline-block relative">
              <span key={ctaWordIndex} className="animate-fade-in-up inline-block text-pink-600">
                {ctaWords[ctaWordIndex]}.
              </span>
            </span>
          </h2>
          <p className="text-xl text-gray-500 mb-10 max-w-xl mx-auto">
            Dale las herramientas que la escuela no le da. Empieza hoy, es gratis y toma 30 segundos.
          </p>
          <Button asChild size="lg" className="px-12 py-8 text-2xl rounded-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-2xl hover:shadow-pink-500/25 transition-all transform hover:scale-105" onClick={() => handleTrackClick('cta_bottom')}>
            <Link to="/demo">
              Comenzar Aventura Gratis
            </Link>
          </Button>
          <p className="mt-6 text-sm text-gray-400">Sin compromiso. Cancela cuando quieras.</p>
        </div>
      </section>

      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80 grayscale hover:grayscale-0 transition-all">
            <img src="/logo-sized.png" alt="LittleFounders" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link to="#" className="hover:text-gray-900">Términos</Link>
            <Link to="#" className="hover:text-gray-900">Privacidad</Link>
            <Link to="#" className="hover:text-gray-900">Contacto</Link>
          </div>
          <div className="text-sm text-gray-400">
            © 2025 littlefounders.ai
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
