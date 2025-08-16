import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "¡Bienvenid@ de vuelta!",
          description: "Has iniciado sesión y ya puedes seguir aprendiendo y jugando.",
        });
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        toast({
          title: "No pudimos iniciar sesión",
          description: data.detail || "Correo o contraseña incorrectos. ¡Intenta de nuevo!",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No pudimos conectar con el servidor. Intenta más tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="¡Hola de nuevo!"
      description="Inicia sesión y sigue aprendiendo sobre el dinero de una forma divertida."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campo de correo */}
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Escribe tu correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* Campo de contraseña */}
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Escribe tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Botón de enviar */}
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-primary to-customers hover:opacity-90"
          disabled={isLoading}
        >
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>

        {/* Separador */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">o</span>
          </div>
        </div>

        {/* Enlace para crear cuenta */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            ¿Todavía no tienes cuenta?{" "}
            <Link 
              to="/register" 
              className="font-medium text-primary hover:underline"
            >
              ¡Crea una ahora!
            </Link>
          </p>
        </div>

        {/* Demo Credentials, puedes eliminarlo o personalizarlo */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Demo: admin@example.com / password123
          </p>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;