import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Trophy, Star, Target, Coins, BookOpen, Shield, Crown, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UserBadge {
  id: number;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  earned: boolean;
  rarity?: "common" | "rare" | "epic" | "legendary";
  earnedDate?: string;
  translationKey?: string;
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
  const { t, i18n } = useTranslation('profile');
  const { t: commonT } = useTranslation('common');

  const getRarityLabel = (rarity?: string) => {
    return t(`rarity.${rarity || 'common'}`);
  };

  const getProgressStats = () => {
    const totalBadges = badges.length;
    const earnedBadges = badges.filter(b => b.earned).length;
    const selectedCount = selectedBadges.length;

    return { totalBadges, earnedBadges, selectedCount };
  };

  const stats = getProgressStats();

  // Helper to format date based on current language
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES');
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas de progreso */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stats.earnedBadges}</div>
              <div className="text-sm text-muted-foreground">{t('stats.earned_badges')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-secondary">{stats.totalBadges}</div>
              <div className="text-sm text-muted-foreground">{t('stats.total_available')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{stats.selectedCount}</div>
              <div className="text-sm text-muted-foreground">{t('stats.selected')}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>{t('stats.general_progress')}</span>
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
            <span>{t('sections.my_achievements')}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {/* Hard to translate this specific interpolation without changing source structure, but let's try */}
            {i18n.language === 'en'
              ? `Select up to ${maxSelection} badges to display on your profile`
              : `Selecciona hasta ${maxSelection} badges para mostrar en tu perfil`}
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
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${isSelected
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
                            {t('stats.selected')}
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
                          {/* We could use t('time.earned_on', { date: ... }) but simpler for now */}
                          {i18n.language === 'en' ? 'Earned on ' : 'Ganado el '}
                          {formatDate(badge.earnedDate)}
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
            <h3 className="font-medium">{t('stats.how_to_earn')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>{badges.find(b => b.translationKey === 'dedicated_student')?.name || 'Lecciones'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-green-500" />
                <span>{badges.find(b => b.translationKey === 'goal_reached')?.name || 'Metas'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Actividades</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('stats.earn_desc')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
