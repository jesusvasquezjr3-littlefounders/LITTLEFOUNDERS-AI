import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const ASSET_BASE = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/2-nam-vs-yum-game';
const NAM_VS_YUM_GIF = `${ASSET_BASE}/pictures/2-nam-vs-yum-game.gif`;
const NECTAR_GIF = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/1-the-small-entrepreneur/pictures/1-the-small-entrepreneur.gif';
const PAPER_DETECTIVE_GIF = 'https://xxpsyormxalqjcbomiwe.supabase.co/storage/v1/object/public/game-assets/3-paper-detective/pictures/paper-detective.gif';

export default function GamesPage() {
  const { t } = useTranslation(['games', 'common']);
  const navigate = useNavigate();
  const [gifError, setGifError] = useState(false);
  const [nectarGifError, setNectarGifError] = useState(false);
  const [detectiveGifError, setDetectiveGifError] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-4 duration-700">
        {/* Header Section */}
        <div className="relative mb-8 p-5 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600/10 via-orange-500/5 to-red-600/10 border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-sm">
          {/* Decorative Background Icon */}
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
            <Gamepad2 className="w-32 h-32 rotate-12" />
          </div>

          <div className="flex flex-col md:flex-row items-center gap-5 relative z-10">
            <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl shadow-xl shadow-orange-500/30 transform -rotate-3 transition-transform duration-300">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-500 via-red-500 to-indigo-600 bg-clip-text text-transparent mb-1">
                {t('games:listing.title')}
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 font-medium max-w-2xl leading-relaxed">
                {t('games:listing.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Separator Decorative Line */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {t('games:listing.availableChallenges')}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent"></div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Ñam vs. Yum Card */}
          <button
            onClick={() => navigate('/games/nam-vs-yum')}
            className={cn(
              "group relative overflow-hidden rounded-3xl",
              "bg-card border border-border/50",
              "transition-all duration-300",
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-purple-500/10",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "text-left w-full h-full flex flex-col",
            )}
          >
            {/* Square Preview */}
            <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
              {!gifError ? (
                <img
                  src={NAM_VS_YUM_GIF}
                  alt={t('games:namVsYum.title')}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setGifError(true)}
                  draggable={false}
                  loading="eager"
                />
              ) : (
                /* Fallback if GIF fails to load */
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-green-900/60 via-slate-900 to-purple-900/60">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🦎</span>
                    <span className="text-2xl font-bold text-white/60">VS</span>
                    <span className="text-4xl">👾</span>
                  </div>
                  <p className="text-white/40 text-xs font-medium">
                    {t('games:namVsYum.title')}
                  </p>
                </div>
              )}

              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center",
                  "bg-green-500 shadow-lg shadow-green-500/40",
                  "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
                  "transition-all duration-300",
                )}>
                  <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                </div>
              </div>

              {/* Title Overlay for 1:1 look */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <h3 className="font-bold text-lg text-white leading-tight">
                  {t('games:namVsYum.title')}
                </h3>
                <p className="text-xs text-white/70 line-clamp-1">
                  {t('games:namVsYum.subtitle')}
                </p>
              </div>
            </div>
          </button>

          {/* Néctar de las Sombras Card */}
          <button
            onClick={() => navigate('/games/nectar-de-las-sombras')}
            className={cn(
              "group relative overflow-hidden rounded-3xl",
              "bg-card border border-border/50",
              "transition-all duration-300",
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-indigo-500/10",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "text-left w-full h-full flex flex-col",
            )}
          >
            {/* Square Preview */}
            <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
              {!nectarGifError ? (
                <img
                  src={NECTAR_GIF}
                  alt={t('games:nectar.title')}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setNectarGifError(true)}
                  draggable={false}
                  loading="eager"
                />
              ) : (
                /* Fallback if GIF fails to load */
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-indigo-900/60 via-slate-900 to-indigo-900/60">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🍋</span>
                    <span className="text-2xl font-bold text-white/60">&</span>
                    <span className="text-4xl">💎</span>
                  </div>
                  <p className="text-white/40 text-xs font-medium px-4 text-center">
                    {t('games:nectar.title')}
                  </p>
                </div>
              )}

              {/* Play overlay on hover */}
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

              {/* Title Overlay for 1:1 look */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <h3 className="font-bold text-lg text-white leading-tight">
                  {t('games:nectar.title')}
                </h3>
                <p className="text-xs text-white/70 line-clamp-1">
                  {t('games:nectar.subtitle')}
                </p>
              </div>
            </div>
          </button>

          {/* Paper Detective Card */}
          <button
            onClick={() => navigate('/games/paper-detective')}
            className={cn(
              "group relative overflow-hidden rounded-3xl",
              "bg-card border border-border/50",
              "transition-all duration-300",
              "hover:scale-[1.03] hover:shadow-xl hover:shadow-amber-500/10",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "text-left w-full h-full flex flex-col",
            )}
          >
            {/* Square Preview */}
            <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
              {!detectiveGifError ? (
                <img
                  src={PAPER_DETECTIVE_GIF}
                  alt={t('games:paperDetective.title')}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => setDetectiveGifError(true)}
                  draggable={false}
                  loading="eager"
                />
              ) : (
                /* Fallback if GIF fails to load */
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-amber-900/60 via-slate-900 to-amber-900/60">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🔍</span>
                    <span className="text-2xl font-bold text-white/60">&</span>
                    <span className="text-4xl">💰</span>
                  </div>
                  <p className="text-white/40 text-xs font-medium px-4 text-center">
                    {t('games:paperDetective.title')}
                  </p>
                </div>
              )}

              {/* Play overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center",
                  "bg-amber-500 shadow-lg shadow-amber-500/40",
                  "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
                  "transition-all duration-300",
                )}>
                  <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
                </div>
              </div>

              {/* Title Overlay for 1:1 look */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <h3 className="font-bold text-lg text-white leading-tight">
                  {t('games:paperDetective.title')}
                </h3>
                <p className="text-xs text-white/70 line-clamp-1">
                  {t('games:paperDetective.subtitle')}
                </p>
              </div>
            </div>
          </button>

          {/* Coming Soon Card (Square 1:1) */}
          <div className={cn(
            "relative aspect-square rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800",
            "flex flex-col items-center justify-center gap-4 p-6 text-center",
            "bg-slate-50/50 dark:bg-slate-900/50",
            "group overflow-hidden transition-all duration-300"
          )}>
            <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-8 h-8 text-slate-400 dark:text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('games:listing.comingSoon')}
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
    </DashboardLayout>
  );
}
