import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, BookOpen, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { AssetImg } from "@/components/ui/AssetImg";

interface GameCard {
  id: string;
  path: string;
  titleKey: string;
  subtitleKey: string;
  gif: string;
  fallbackEmojis: string[];
  accentColor: string;
  ageGroup: '5-7' | '8-9' | '10-12';
  descriptionKey: string;
}

// Paths relative to the game-assets private bucket
const NAM_VS_YUM_GIF = '2-nam-vs-yum-game/pictures/2-nam-vs-yum-game.gif';
const NECTAR_GIF = '1-the-small-entrepreneur/pictures/1-the-small-entrepreneur.gif';
const PAPER_DETECTIVE_GIF = '3-paper-detective/pictures/paper-detective.gif';
const PAPER_COIN_GIF = '7-paper-coin/pictures/paper-coin.gif';
const HACKER_DEFENSE_GIF = '13-hacker-defense/pictures/hacker-defense.gif';
const CHRONO_BLOOM_GIF = '8-chronobloom/pictures/chronobloom.gif';

const ALL_GAMES: GameCard[] = [
  {
    id: 'nam-vs-yum',
    path: '/games/nam-vs-yum',
    titleKey: 'games:namVsYum.title',
    subtitleKey: 'games:namVsYum.subtitle',
    gif: NAM_VS_YUM_GIF,
    fallbackEmojis: ['🦎', 'VS', '👾'],
    accentColor: 'green',
  
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
  
    ageGroup: '8-9',
    descriptionKey: 'paperCoin',
  },
  {
    id: 'hacker-defense',
    path: '/games/hacker-defense',
    titleKey: 'games:hackerDefense.title',
    subtitleKey: 'games:hackerDefense.subtitle',
    gif: HACKER_DEFENSE_GIF,
    fallbackEmojis: ['🔐', '🛡️', '💻'],
    accentColor: 'green',
  
    ageGroup: '10-12',
    descriptionKey: 'hackerDefense',
  },
  {
    id: 'chronobloom',
    path: '/games/chronobloom',
    titleKey: 'games:chronoBloom.title',
    subtitleKey: 'games:chronoBloom.subtitle',
    gif: CHRONO_BLOOM_GIF,
    fallbackEmojis: ['🌱', '⏳', '💰'],
    accentColor: 'emerald',
  
    ageGroup: '8-9',
    descriptionKey: 'chronoBloom',
  },
];

export default function GamesPage() {
  const Layout = DashboardLayout;
  const { t } = useTranslation(['games', 'common']);
  const navigate = useNavigate();
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
    if (ageGroup === '5-7') return 'ages5to7';
    if (ageGroup === '8-9') return 'ages8to9';
    return 'ages10to12';
  };

  // Helper to get coming soon key
  const getComingSoonKey = (ageGroup: string): string => {
    if (ageGroup === '5-7') return 'comingSoon5to7';
    if (ageGroup === '8-9') return 'comingSoon8to9';
    return 'comingSoon10to12';
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 animate-in fade-in slide-in-from-top-4 duration-700">
        {/* Premium Header Section */}
        <div className="corp-panel relative mb-6 md:mb-10 px-5 py-5 md:px-7 md:py-6">
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10">
            <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl md:rounded-2xl shrink-0">
              <Gamepad2 className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </div>
            <div className="text-left">
              <span className="corp-eyebrow">{t('common:app_name')}</span>
              <h1 className="corp-display mt-1 text-xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight mb-1">
                {t('games:listing.title')}
              </h1>
              <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-tight">
                {t('games:listing.subtitle')}
              </p>
            </div>
          </div>
        </div>

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
              {games.map((game) => (
                <div key={game.id} className="group relative">
                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <button
                        onClick={() => navigate(game.path)}
                        className={cn(
                          "relative overflow-hidden rounded-3xl w-full",
                          "liquid-glass",
                          "transition-all duration-300",
                          "active:scale-[0.98]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          "text-left h-full flex flex-col",
                        )}
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
                          <AssetImg
                            assetPath={game.gif}
                            alt={t(game.titleKey)}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            draggable={false}
                            fallback={
                              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-900">
                                <div className="flex items-center gap-4">
                                  <span className="text-4xl">{game.fallbackEmojis[0]}</span>
                                  <span className="text-2xl font-bold text-white/60">{game.fallbackEmojis[1]}</span>
                                  <span className="text-4xl">{game.fallbackEmojis[2]}</span>
                                </div>
                                <p className="text-white/40 text-xs font-medium px-4 text-center">
                                  {t(game.titleKey)}
                                </p>
                              </div>
                            }
                          />

                          {/* Play overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                            <div className={cn(
                              "w-14 h-14 rounded-full flex items-center justify-center",
                              "bg-indigo-500 shadow-lg shadow-indigo-500/40",
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
                      className="w-80 p-0 overflow-hidden border border-white/10 shadow-2xl z-50 bg-slate-900"
                    >
                      {/* Decorative top bar — corp brand accent */}
                      <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />

                      <div className="p-4 space-y-3">
                        <h4 className="font-bold text-base text-white leading-tight">
                          {t(game.titleKey)}
                        </h4>

                        <p className="text-sm text-slate-300 leading-relaxed">
                          {t(`games:gameDescriptions.${game.descriptionKey}.summary`)}
                        </p>

                        <div className="space-y-2.5 pt-2 border-t border-white/5">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 p-1 rounded-md bg-indigo-500/20">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="corp-eyebrow text-indigo-300">
                                {t('common:whatItTeaches')}
                              </span>
                              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 font-medium">
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
                "relative rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10",
                "flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 text-center",
                "bg-slate-50 dark:bg-[#0d1426]",
                "overflow-hidden",
                "aspect-square sm:aspect-auto sm:min-h-[180px] md:min-h-[200px]"
              )}>
                <div className="corp-icon-chip w-12 h-12 sm:w-16 sm:h-16 mb-1 sm:mb-2">
                  <Gamepad2 className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-1 px-2">
                  <p className="corp-eyebrow">
                    {t(`games:ageGroups.${getComingSoonKey(ageGroup)}`)}
                  </p>
                  <div className="flex gap-1 justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></div>
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
