import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  target?: string;
  targetProgress?: number;
  variant: "revenue" | "customers" | "product" | "team";
  icon: React.ComponentType<{ className?: string }>;
}

const variantConfig = {
  revenue: {
    bgGradient: "bg-gradient-revenue",
    textColor: "text-revenue",
    lightBg: "bg-revenue-light",
  },
  customers: {
    bgGradient: "bg-gradient-customers",
    textColor: "text-customers",
    lightBg: "bg-customers-light",
  },
  product: {
    bgGradient: "bg-gradient-product",
    textColor: "text-product",
    lightBg: "bg-product-light",
  },
  team: {
    bgGradient: "bg-gradient-team",
    textColor: "text-team",
    lightBg: "bg-team-light",
  },
};

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  target,
  targetProgress,
  variant,
  icon: Icon,
}: KPICardProps) {
  const config = variantConfig[variant];
  const isPositive = change > 0;
  const isNegative = change < 0;

  const getTrendIcon = () => {
    if (isPositive) return TrendingUp;
    if (isNegative) return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon();

  // Traducción y adaptación amigable para niños
  const translatedTitles = {
    revenue: "Mis Ingresos",
    customers: "Usuarios Activos",
    product: "Progreso de Producto",
    team: "Mi Equipo",
  };

  const translatedChangeLabel = changeLabel === "vs mes anterior"
    ? "comparado con el mes pasado"
    : changeLabel;

  return (
    <Card className="relative overflow-hidden transition-[box-shadow,transform] duration-300 hover:shadow-medium hover:-translate-y-1 corp-card border-none">
      {/* Franja de color superior */}
      <div className={cn("absolute top-0 left-0 w-full h-1", config.bgGradient)} />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="corp-body-sm">
          {translatedTitles[variant] || title}
        </CardTitle>
        <div className={cn("p-2 rounded-lg", config.lightBg)}>
          <Icon className={cn("h-4 w-4", config.textColor)} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Valor principal */}
          <div className="corp-number-lg">{value}</div>

          {/* Indicador de cambio */}
          <div className="flex items-center space-x-2">
            <Badge
              variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"}
              className="flex items-center space-x-1"
            >
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(change)}%</span>
            </Badge>
            <span className="corp-caption">
              {isPositive && "¡Superaste el mes pasado! "}
              {isNegative && "Bajó respecto al mes anterior. "}
              {!isPositive && !isNegative && "Sin cambios."}
              {translatedChangeLabel}
            </span>
          </div>

          {/* Progreso hacia la meta */}
          {target && targetProgress !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between corp-caption">
                <span>Meta: {target}</span>
                <span className={config.textColor}>{targetProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn("h-2 rounded-full transition-[width] duration-500", config.bgGradient)}
                  style={{ width: `${Math.min(targetProgress, 100)}%` }}
                />
              </div>
              <div className="flex items-center space-x-1 corp-caption">
                <Target className="h-3 w-3" />
                <span>
                  {targetProgress >= 100
                    ? "¡Meta alcanzada, felicidades!"
                    : `¡Falta ${Math.round(100 - targetProgress)}% para lograr tu meta!`}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}