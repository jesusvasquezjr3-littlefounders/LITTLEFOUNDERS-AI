import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, RefreshCw, ExternalLink, Maximize2, Minimize2,
  AlertTriangle, Loader2, ArrowLeft, MonitorPlay,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Single source of truth for the external analytics dashboard URL. */
export const ADMIN_ANALYTICS_URL = 'https://lf-analytics-production-669d.up.railway.app/';

/**
 * The dashboard is Metabase, which serves `X-Frame-Options: DENY` +
 * `frame-ancestors 'none'`, so embedding is blocked by the browser. The page is
 * therefore "launcher-first": it opens Analytics in a new tab by default, and
 * still offers an opt-in embed attempt (short timeout) for environments where
 * framing might be allowed.
 */
const EMBED_TIMEOUT_MS = 4500;

type Mode = 'launcher' | 'embed';

export const AdminAnalytics: React.FC = () => {
  const { t } = useTranslation('admin');
  const [mode, setMode] = useState<Mode>('launcher');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  // Arm the embed-load timeout whenever we (re)mount the iframe in embed mode.
  useEffect(() => {
    if (mode !== 'embed') return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setLoaded((isLoaded) => {
        if (!isLoaded) {
          setFailed(true);
          setEmbedBlocked(true);
        }
        return isLoaded;
      });
    }, EMBED_TIMEOUT_MS);
    return clearTimer;
  }, [mode, reloadKey]);

  // ESC exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const openExternal = useCallback(
    () => window.open(ADMIN_ANALYTICS_URL, '_blank', 'noopener,noreferrer'),
    [],
  );

  const startEmbed = () => {
    setLoaded(false);
    setFailed(false);
    setMode('embed');
    setReloadKey((k) => k + 1);
  };

  const backToLauncher = () => {
    clearTimer();
    setFullscreen(false);
    setMode('launcher');
  };

  const reloadEmbed = () => {
    setLoaded(false);
    setFailed(false);
    setReloadKey((k) => k + 1);
  };

  const handleLoad = () => {
    clearTimer();
    setLoaded(true);
    setFailed(false);
    setEmbedBlocked(false);
  };

  const iframe = (
    <iframe
      key={reloadKey}
      src={ADMIN_ANALYTICS_URL}
      title={t('analytics.title')}
      onLoad={handleLoad}
      className="w-full h-full border-0 bg-white dark:bg-slate-950"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="fullscreen; clipboard-read; clipboard-write"
    />
  );

  const loadingOverlay = !loaded && !failed && (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="corp-eyebrow">
        {t('analytics.embedAttempt')}
      </p>
    </div>
  );

  const fallbackOverlay = failed && (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div className="corp-panel max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 dark:bg-amber-500/10">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="corp-display text-lg font-bold text-slate-900 dark:text-white mb-2">{t('analytics.loadErrorTitle')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('analytics.loadErrorBody')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={openExternal} className="corp-btn-primary h-10 px-5 rounded-xl gap-2 text-sm font-semibold">
            <ExternalLink className="h-4 w-4" />
            {t('analytics.openButton')}
          </Button>
          <Button onClick={backToLauncher} className="corp-btn-secondary h-10 px-5 rounded-xl gap-2 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" />
            {t('analytics.backToLauncher')}
          </Button>
        </div>
      </div>
    </div>
  );

  // ── Fullscreen embed ─────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-[#070b14]">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-4 py-2">
          <div className="flex items-center gap-2 corp-eyebrow">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            {t('analytics.title')}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openExternal} size="sm" className="corp-btn-ghost h-9 px-3 rounded-xl gap-2 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">{t('analytics.openExternal')}</span>
            </Button>
            <Button onClick={() => setFullscreen(false)} size="sm" className="corp-btn-secondary h-9 px-3 rounded-xl gap-2 text-sm font-semibold">
              <Minimize2 className="h-4 w-4" />
              {t('analytics.exitFullscreen')}
            </Button>
          </div>
        </div>
        <div className="relative flex-1">
          {loadingOverlay}
          {fallbackOverlay}
          {iframe}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full p-2 md:p-4">
      {/* Header */}
      <div className="corp-panel p-5 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-row items-center gap-4 md:gap-5">
          <div className="corp-icon-chip w-10 h-10 md:w-14 md:h-14 shrink-0">
            <BarChart3 className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <div className="text-left">
            <span className="corp-eyebrow">{t('analytics.subtitle')}</span>
            <h1 className="corp-display mt-1 text-xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              {t('analytics.title')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {mode === 'embed' && (
            <>
              <Button onClick={backToLauncher} size="sm" className="corp-btn-secondary h-10 px-4 gap-2 rounded-xl text-sm font-semibold">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t('analytics.backToLauncher')}</span>
              </Button>
              <Button onClick={reloadEmbed} size="sm" className="corp-btn-secondary h-10 px-4 gap-2 rounded-xl text-sm font-semibold">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">{t('analytics.refresh')}</span>
              </Button>
              <Button onClick={() => setFullscreen(true)} size="sm" className="corp-btn-secondary h-10 px-4 gap-2 rounded-xl text-sm font-semibold">
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('analytics.fullscreen')}</span>
              </Button>
            </>
          )}
          <Button onClick={openExternal} size="sm" className="corp-btn-primary h-10 px-4 gap-2 rounded-xl text-sm font-semibold flex-1 md:flex-none">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">{t('analytics.openExternal')}</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      {mode === 'launcher' ? (
        <div className="corp-panel flex-1 min-h-[420px] flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center">
            <div className="corp-icon-chip mx-auto mb-5 w-16 h-16">
              <BarChart3 className="h-8 w-8" />
            </div>
            <h2 className="corp-display text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('analytics.launcherTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('analytics.launcherBody')}</p>

            {embedBlocked && (
              <div className="mx-auto mb-6 flex items-center gap-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-left">{t('analytics.embedBlockedNote')}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={openExternal} size="lg" className="corp-btn-primary h-12 px-6 gap-2 rounded-xl text-sm font-semibold w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                {t('analytics.openButton')}
              </Button>
              <Button onClick={startEmbed} size="lg" className="corp-btn-secondary h-12 px-6 gap-2 rounded-xl text-sm font-semibold w-full sm:w-auto">
                <MonitorPlay className="h-4 w-4" />
                {t('analytics.tryEmbed')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="corp-panel relative flex-1 min-h-[600px] overflow-hidden p-0">
          {loadingOverlay}
          {fallbackOverlay}
          {iframe}
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
