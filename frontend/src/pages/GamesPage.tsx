import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AssetImg } from "@/components/ui/AssetImg";

interface GameCard {
  id: string;
  path: string;
  titleKey: string;
  subtitleKey: string;
  gif: string;
  fallbackEmojis: string[];
  ageGroup: '5-7' | '8-9' | '10-12';
  descriptionKey: string;
}

const NAM_VS_YUM_GIF = '2-nam-vs-yum-game/pictures/2-nam-vs-yum-game.gif';
const NECTAR_GIF = '1-the-small-entrepreneur/pictures/1-the-small-entrepreneur.gif';
const PAPER_DETECTIVE_GIF = '3-paper-detective/pictures/paper-detective.gif';
const PAPER_COIN_GIF = '7-paper-coin/pictures/paper-coin.gif';
const HACKER_DEFENSE_GIF = '13-hacker-defense/pictures/hacker-defense.gif';
const CHRONO_BLOOM_GIF = '8-chronobloom/pictures/chronobloom.gif';

const ALL_GAMES: GameCard[] = [
  { id: 'nam-vs-yum', path: '/games/nam-vs-yum', titleKey: 'games:namVsYum.title', subtitleKey: 'games:namVsYum.subtitle', gif: NAM_VS_YUM_GIF, fallbackEmojis: ['🦎', 'VS', '👾'], ageGroup: '5-7', descriptionKey: 'namVsYum' },
  { id: 'nectar', path: '/games/nectar-of-shadows', titleKey: 'games:nectar.title', subtitleKey: 'games:nectar.subtitle', gif: NECTAR_GIF, fallbackEmojis: ['🍋', '&', '💎'], ageGroup: '5-7', descriptionKey: 'nectar' },
  { id: 'paper-detective', path: '/games/paper-detective', titleKey: 'games:paperDetective.title', subtitleKey: 'games:paperDetective.subtitle', gif: PAPER_DETECTIVE_GIF, fallbackEmojis: ['🔍', '&', '💰'], ageGroup: '5-7', descriptionKey: 'paperDetective' },
  { id: 'paper-coin', path: '/games/paper-coin', titleKey: 'games:paperCoin.title', subtitleKey: 'games:paperCoin.subtitle', gif: PAPER_COIN_GIF, fallbackEmojis: ['🪙', '⚔️', '🏪'], ageGroup: '8-9', descriptionKey: 'paperCoin' },
  { id: 'hacker-defense', path: '/games/hacker-defense', titleKey: 'games:hackerDefense.title', subtitleKey: 'games:hackerDefense.subtitle', gif: HACKER_DEFENSE_GIF, fallbackEmojis: ['🔐', '🛡️', '💻'], ageGroup: '10-12', descriptionKey: 'hackerDefense' },
  { id: 'chronobloom', path: '/games/chronobloom', titleKey: 'games:chronoBloom.title', subtitleKey: 'games:chronoBloom.subtitle', gif: CHRONO_BLOOM_GIF, fallbackEmojis: ['🌱', '⏳', '💰'], ageGroup: '8-9', descriptionKey: 'chronoBloom' },
];

export default function GamesPage() {
  const { t } = useTranslation(['games', 'common']);
  const navigate = useNavigate();

  const gamesByAge = ALL_GAMES.reduce((acc, game) => {
    if (!acc[game.ageGroup]) acc[game.ageGroup] = [];
    acc[game.ageGroup].push(game);
    return acc;
  }, {} as Record<string, typeof ALL_GAMES>);

  const getAgeGroupHeaderKey = (ageGroup: string): string => {
    if (ageGroup === '5-7') return 'ages5to7';
    if (ageGroup === '8-9') return 'ages8to9';
    return 'ages10to12';
  };

  const getComingSoonKey = (ageGroup: string): string => {
    if (ageGroup === '5-7') return 'comingSoon5to7';
    if (ageGroup === '8-9') return 'comingSoon8to9';
    return 'comingSoon10to12';
  };

  return (
    <div className="corp max-w-6xl mx-auto pb-16 px-4 pt-8 animate-in fade-in duration-300">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="corp-h1">
          {t('games:listing.title')}
        </h1>
        <p className="mt-2 corp-body">
          {t('games:listing.subtitle')}
        </p>
      </div>

      {/* ── Games grouped by age ───────────────────────────────────── */}
      {Object.entries(gamesByAge).map(([ageGroup, games]) => (
        <div key={ageGroup} className="mb-12 last:mb-0">
          {/* Age group header */}
          <div className="flex items-center gap-4 mb-6">
            <span className="corp-eyebrow whitespace-nowrap">
              {t(`games:ageGroups.${getAgeGroupHeaderKey(ageGroup)}`)}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {games.map((game) => (
              <div key={game.id} className="group relative">
                <HoverCard openDelay={300}>
                  <HoverCardTrigger asChild>
                    <button
                      onClick={() => navigate(game.path)}
                      className={cn(
                        "relative overflow-hidden rounded-[2.5rem] w-full bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)]",
                        "transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        "hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.3)] hover:border-slate-300 dark:hover:border-white/20",
                        "active:scale-[0.97]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                        "text-left h-full flex flex-col cursor-pointer"
                      )}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
                        <AssetImg
                          assetPath={game.gif}
                          alt={t(game.titleKey)}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          draggable={false}
                          fallback={
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-900">
                              <div className="flex items-center gap-4">
                                <span className="text-4xl">{game.fallbackEmojis[0]}</span>
                                <span className="text-2xl font-bold text-white/60">{game.fallbackEmojis[1]}</span>
                                <span className="text-4xl">{game.fallbackEmojis[2]}</span>
                              </div>
                              <p className="corp-caption text-white/40 px-4 text-center">{t(game.titleKey)}</p>
                            </div>
                          }
                        />

                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-[background-color] duration-200 ease-out">
                          <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center bg-indigo-600",
                            "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100",
                            "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                          )}>
                            <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                          </div>
                        </div>

                        {/* Title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                          <h3 className="corp-h4 text-white leading-tight">{t(game.titleKey)}</h3>
                          <p className="corp-caption text-white/70 line-clamp-1">{t(game.subtitleKey)}</p>
                        </div>
                      </div>
                    </button>
                  </HoverCardTrigger>

                  <HoverCardContent
                    side="top"
                    align="center"
                    className="w-80 p-0 overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl z-50 bg-white dark:bg-[#0d1426] rounded-2xl"
                  >
                    <div className="p-4 space-y-3">
                      <h4 className="corp-h4">{t(game.titleKey)}</h4>
                      <p className="corp-body-sm">
                        {t(`games:gameDescriptions.${game.descriptionKey}.summary`)}
                      </p>
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 p-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="corp-eyebrow">{t('common:whatItTeaches')}</span>
                            <p className="corp-caption leading-tight mt-0.5 font-medium">
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

            {/* Coming soon */}
            <div className={cn(
              "rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10",
              "flex flex-col items-center justify-center gap-3 p-4 text-center",
              "bg-slate-50 dark:bg-white/5 aspect-square"
            )}>
              <div className="corp-icon-chip w-12 h-12">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="corp-eyebrow">{t(`games:ageGroups.${getComingSoonKey(ageGroup)}`)}</p>
                <div className="flex gap-1 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
