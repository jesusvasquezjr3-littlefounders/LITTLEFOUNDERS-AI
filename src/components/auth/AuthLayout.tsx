import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  showBackToWelcome?: boolean;
}

export function AuthLayout({ children, title, description, showBackToWelcome = true }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-customers/3 to-revenue/3"></div>
      
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Badge variant="outline" className="px-3 py-1">
              <Zap className="w-4 h-4 mr-2" />
              LittleFoundera AI
            </Badge>
            
            {showBackToWelcome && (
              <div>
                <Link 
                  to="/welcome" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Regresar al Inicio
                </Link>
              </div>
            )}
          </div>

          {/* Auth Card */}
          <Card className="border-0 shadow-large">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              {children}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Una pagina segura para los pequeños fundadores</p>
          </div>
        </div>
      </div>
    </div>
  );
}