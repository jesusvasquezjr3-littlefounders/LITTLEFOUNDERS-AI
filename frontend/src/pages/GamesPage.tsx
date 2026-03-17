import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, BookOpen, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";

interface GamesPageProps {
  isDemo?: boolean;
  Layout?: React.ComponentType<{ children: React.ReactNode }>;
}

interface GameCard {
  id: string;
  path: string;
  titleKey: string;
  subtitleKey: string;
  gif: string;
  fallbackEmojis: string[];
  accentColor: string;
  isDemo: boolean;
  ageGroup: '5-7' | '8-9';
  descriptionKey: string;
}

const ASSET_BASE = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/2-nam-vs-yum-game';
const NAM_VS_YUM_GIF = `${ASSET_BASE}/pictures/2-nam-vs-yum-game.gif`;
const NECTAR_GIF = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/1-the-small-entrepreneur/pictures/1-the-small-entrepreneur.gif';
const PAPER_DETECTIVE_GIF = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/3-paper-detective/pictures/paper-detective.gif';
const PAPER_COIN_GIF = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/7-paper-coin/pictures/paper-coin.gif';

const ALL_GAMES: GameCard[] = [
  {
    id: 'nam-vs-yum',
    path: '/games/nam-vs-yum',
    titleKey: 'games:namVsYum.title',
    subtitleKey: 'games:namVsYum.subtitle',
    gif: NAM_VS_YUM_GIF,
    fallbackEmojis: ['🦎', 'VS', '👾'],
    accentColor: 'green',
    isDemo: true,
    ageGroup: '5-7',
    descriptionKey: 'namVsYum',
  },
  {
    id: 'nectar',
    path: '/games/nectar-of-shadows',
    titleKey: 'games:nectar.title',
    subtitleKey: 'games:nectar.subtitle',
    gif: NECTAR_GIF,
    fallbackEmojis: ['🍋', '&', '💎'],
    accentColor: 'indigo',
    isDemo: true,
    ageGroup: '5-7',
    descriptionKey: 'nectar',
  },
  {
    id: 'paper-detective',
    path: '/games/paper-detective',
    titleKey: 'games:paperDetective.title',
    subtitleKey: 'games:paperDetective.subtitle',
    gif: PAPER_DETECTIVE_GIF,
    fallbackEmojis: ['🔍', '&', '💰'],
    accentColor: 'amber',
    isDemo: true,
    ageGroup: '5-7',
    descriptionKey: 'paperDetective',
  },
  {
    id: 'paper-coin',
    path: '/games/paper-coin',
    titleKey: 'games:paperCoin.title',
    subtitleKey: 'games:paperCoin.subtitle',
    gif: PAPER_COIN_GIF,
    fallbackEmojis: ['🪙', '⚔️', '🏪'],
    accentColor: 'yellow',
    isDemo: true,
    ageGroup: '8-9',
    descriptionKey: 'paperCoin',
  },
];

export default function GamesPage({ isDemo = false, Layout = DashboardLayout }: GamesPageProps) {
  const { t } = useTranslation(['games', 'common', 'demo']);
  const navigate = useNavigate();
  const [gifError, setGifError] = useState(false);
  const [nectarGifError, setNectarGifError] = useState(false);
  const [detectiveGifError, setDetectiveGifError] = useState(false);

  // Group games by age group
  const gamesByAge = ALL_GAMES.reduce((acc, game) => {
    if (!acc[game.ageGroup]) {
      acc[game.ageGroup] = [];
    }
    acc[game.ageGroup].push(game);
    return acc;
  }, {} as Record<string, typeof ALL_GAMES>);

  // Helper to get age group label from game description
  const getAgeGroupLabel = (descriptionKey: string): string => {
    const ageGroupKey = t(`games:gameDescriptions.${descriptionKey}.ageGroup`) as string;
    return t(`games:ageGroups.${ageGroupKey}`);
  };

  // Helper to convert age group key for header
  const getAgeGroupHeaderKey = (ageGroup: string): string => {
    return ageGroup === '5-7' ? 'ages5to7' : 'ages8to9';
  };

  // Helper to get coming soon key
  const getComingSoonKey = (ageGroup: string): string => {
    return ageGroup === '5-7' ? 'comingSoon5to7' : 'comingSoon8to9';
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 animate-in fade-in slide-in-from-top-4 duration-700">
        {isDemo && <DemoBanner message={t('demo:demo_banner.games')} />}
        {/* Header Section */}
        <GlassPanel variant="gradient" gradient="indigo" className="relative mb-6 md:mb-10 p-4 md:p-6 overflow-hidden">
          {/* Decorative Background Icon */}
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
            <Gamepad2 className="w-32 h-32 rotate-12" />
          </div>

          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10">
            <div className="p-2 md:p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl md:rounded-2xl shadow-xl shadow-orange-500/30 transform -rotate-3 transition-transform duration-300 shrink-0">
              <Gamepad2 className="w-5 h-5 md:w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-lg md:text-3xl font-black md:font-bold tracking-tight bg-gradient-to-r from-orange-500 via-red-500 to-indigo-600 bg-clip-text text-transparent mb-0.5 uppercase md:normal-case">
                {t('games:listing.title')}
              </h1>
              <p className="text-[10px] md:text-base text-slate-600 dark:text-slate-300 font-bold md:font-medium max-w-2xl leading-tight md:leading-relaxed">
                {t('games:listing.subtitle')}
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Games grouped by age */}
        {Object.entries(gamesByAge).map(([ageGroup, games]) => (
          <div key={ageGroup} className="mb-10 last:mb-0">
            {/* Age Group Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-700 to-transparent"></div>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                {t(`games:ageGroups.${getAgeGroupHeaderKey(ageGroup)}`)}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-700 to-transparent"></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
              {games.filter(g => !isDemo || g.isDemo).map((game) => (
                <div key={game.id} className="group relative">
                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <button
                        onClick={() => navigate(game.path)}
                        className={cn(
                          "relative overflow-hidden rounded-3xl w-full",
                          "liquid-glass",
                          "transition-all duration-300",
                          "hover:scale-[1.03] hover:shadow-xl hover:shadow-purple-500/10",
                          "active:scale-[0.98]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          "text-left h-full flex flex-col",
                        )}
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                          <img
                            src={game.gif}
                            alt={t(game.titleKey)}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            draggable={false}
                            loading="eager"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />

                          {/* Fallback */}
                          <div className="hidden w-full h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-900">
                            <div className="flex items-center gap-4">
                              <span className="text-4xl">{game.fallbackEmojis[0]}</span>
                              <span className="text-2xl font-bold text-white/60">{game.fallbackEmojis[1]}</span>
                              <span className="text-4xl">{game.fallbackEmojis[2]}</span>
                            </div>
                            <p className="text-white/40 text-xs font-medium px-4 text-center">
                              {t(game.titleKey)}
                            </p>
                          </div>

                          {/* Play overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                            <div className={cn(
                              "w-14 h-14 rounded-full flex items-center justify-center",
                              `bg-${game.accentColor}-500 shadow-lg shadow-${game.accentColor}-500/40`,
                              "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
                              "transition-all duration-300",
                            )}>
                              <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                            </div>
                          </div>

                          {/* Title Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                            <h3 className="font-bold text-lg text-white leading-tight">
                              {t(game.titleKey)}
                            </h3>
                            <p className="text-xs text-white/70 line-clamp-1">
                              {t(game.subtitleKey)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </HoverCardTrigger>

                    <HoverCardContent 
                      side="top" 
                      align="center" 
                      className="w-80 p-0 overflow-hidden border-2 border-white/10 shadow-2xl z-50 backdrop-blur-xl bg-slate-900/95"
                    >
                      {/* Decorative top bar with game's accent color */}
                      <div className={cn(
                        "h-2 w-full",
                        `bg-${game.accentColor}-500`
                      )} />
                      
                      <div className="p-4 space-y-3">
                        <h4 className="font-black text-base text-white leading-tight">
                          {t(game.titleKey)}
                        </h4>

                        <p className="text-sm text-slate-300 leading-relaxed font-bold">
                          {t(`games:gameDescriptions.${game.descriptionKey}.summary`)}
                        </p>

                        <div className="space-y-2.5 pt-2 border-t border-white/5">
                          <div className="flex items-start gap-2.5">
                            <div className={cn(
                              "mt-0.5 p-1 rounded-md",
                              `bg-${game.accentColor}-500/20`
                            )}>
                              <BookOpen className={cn("w-3.5 h-3.5", `text-${game.accentColor}-400`)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                `text-${game.accentColor}-400`
                              )}>
                                {t('common:whatItTeaches')}
                              </span>
                              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 font-medium italic">
                                {t(`games:gameDescriptions.${game.descriptionKey}.teaches`)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              ))}

              {/* Coming Soon Card - Within each age group */}
              <div className={cn(
                "relative rounded-2xl sm:rounded-3xl border-2 border-dashed border-white/20 dark:border-white/5",
                "flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 text-center",
                "shadow-xl backdrop-blur-sm bg-gradient-to-br from-slate-600/10 via-slate-500/5 to-slate-400/10",
                "group overflow-hidden transition-all duration-300",
                "aspect-square sm:aspect-auto sm:min-h-[180px] md:min-h-[200px]"
              )}>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-1 sm:mb-2 group-hover:scale-110 transition-transform">
                  <Gamepad2 className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400 dark:text-slate-600" />
                </div>
                <div className="space-y-1 px-2">
                  <p className="text-[10px] sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">
                    {t(`games:ageGroups.${getComingSoonKey(ageGroup)}`)}
                  </p>
                  <div className="flex gap-1 justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse [animation-delay:200ms]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse [animation-delay:400ms]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
