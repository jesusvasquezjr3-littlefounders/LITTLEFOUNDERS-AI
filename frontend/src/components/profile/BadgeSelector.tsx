import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Trophy, Star, Target, Coins, BookOpen, Shield, Crown, Zap } from "lucide-react";

interface UserBadge {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  earned: boolean;
  rarity?: "common" | "rare" | "epic" | "legendary";
  earnedDate?: string;
}

interface BadgeSelectorProps {
  badges: UserBadge[];
  selectedBadges: number[];
  onBadgeToggle: (badgeId: number) => void;
  maxSelection?: number;
  disabled?: boolean;
}

export function BadgeSelector({
  badges,
  selectedBadges,
  onBadgeToggle,
  maxSelection = 3,
  disabled = false
}: BadgeSelectorProps) {
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case "rare": return "border-blue-400 bg-blue-50";
      case "epic": return "border-purple-400 bg-purple-50";
      case "legendary": return "border-yellow-400 bg-yellow-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getRarityLabel = (rarity?: string) => {
    switch (rarity) {
      case "rare": return "Raro";
      case "epic": return "Épico";
      case "legendary": return "Legendario";
      default: return "Común";
    }
  };

  const getProgressStats = () => {
    const totalBadges = badges.length;
    const earnedBadges = badges.filter(b => b.earned).length;
    const selectedCount = selectedBadges.length;
    
    return { totalBadges, earnedBadges, selectedCount };
  };

  const stats = getProgressStats();

  return (
    <div className="space-y-6">
      {/* Estadísticas de progreso */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stats.earnedBadges}</div>
              <div className="text-sm text-muted-foreground">Badges ganados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-secondary">{stats.totalBadges}</div>
              <div className="text-sm text-muted-foreground">Total disponibles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{stats.selectedCount}</div>
              <div className="text-sm text-muted-foreground">Seleccionados</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Progreso general</span>
              <span>{Math.round((stats.earnedBadges / stats.totalBadges) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(stats.earnedBadges / stats.totalBadges) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>Mis Logros</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona hasta {maxSelection} badges para mostrar en tu perfil
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badges.map((badge) => {
              const IconComponent = badge.icon;
              const isSelected = selectedBadges.includes(badge.id);
              const isEarned = badge.earned;
              
              return (
                <div
                  key={badge.id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20' 
                      : isEarned
                        ? 'border-border hover:border-primary/50 hover:bg-primary/5'
                        : 'border-border opacity-50'
                  } ${!isEarned ? 'cursor-not-allowed' : ''} ${disabled ? 'cursor-not-allowed' : ''}`}
                  onClick={() => !disabled && isEarned && onBadgeToggle(badge.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-full ${badge.color} bg-opacity-10 relative`}>
                      <IconComponent className={`w-6 h-6 ${badge.color}`} />
                      {badge.rarity && badge.rarity !== "common" && (
                        <div className="absolute -top-1 -right-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium truncate">{badge.name}</h3>
                        {isSelected && (
                          <Badge variant="secondary" className="text-xs">
                            Seleccionado
                          </Badge>
                        )}
                        {badge.rarity && badge.rarity !== "common" && (
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {getRarityLabel(badge.rarity)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                      {badge.earnedDate && (
                        <p className="text-xs text-muted-foreground">
                          Ganado el {new Date(badge.earnedDate).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                    {!isEarned && (
                      <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Información sobre badges */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <h3 className="font-medium">¿Cómo ganar más badges?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>Completa lecciones</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-green-500" />
                <span>Alcanza metas de ahorro</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Participa en actividades</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Los badges raros y épicos se desbloquean con logros especiales y dedicación.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
