import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Flag, PencilLine, Megaphone, CheckCheck, Inbox, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAdminAlerts, type AdminAlertKind } from '@/hooks/useAdminAlerts';
import { useAdminSettings } from '@/hooks/useAdminSettings';

const KIND_ICON: Record<AdminAlertKind, React.ElementType> = {
  report: Flag,
  edit: PencilLine,
  broadcast: Megaphone,
};

const KIND_COLOR: Record<AdminAlertKind, string> = {
  report: 'text-amber-500 bg-amber-500/10',
  edit: 'text-blue-500 bg-blue-500/10',
  broadcast: 'text-indigo-500 bg-indigo-500/10',
};

/** Short relative-time formatter (locale-aware, no external deps). */
function useRelativeTime() {
  const { i18n } = useTranslation();
  return (iso: string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const mins = Math.round(diff / 60000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language || 'es', { numeric: 'auto' });
    if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
    const hrs = Math.round(mins / 60);
    if (Math.abs(hrs) < 24) return rtf.format(-hrs, 'hour');
    const days = Math.round(hrs / 24);
    return rtf.format(-days, 'day');
  };
}

/** Plays a short, self-contained beep via the Web Audio API (no asset needed). */
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — ignore */
  }
}

export const AdminNotificationBell: React.FC = () => {
  const { t } = useTranslation('admin');
  const { alerts, unreadCount, seen, markAllSeen, dismiss, isLoading } = useAdminAlerts();
  const { settings } = useAdminSettings();
  const [open, setOpen] = useState(false);
  const relative = useRelativeTime();

  // Play a sound when the unread count rises (after the first render).
  const prevUnread = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnread.current !== null && unreadCount > prevUnread.current && settings.notifSound) {
      playBeep();
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, settings.notifSound]);

  const showBadge = settings.showNotifBadge && unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={t('alerts.title')}
        >
          <Bell className="h-5 w-5" />
          {showBadge && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="corp-h4">{t('alerts.title')}</p>
            <p className="corp-caption">
              {unreadCount > 0 ? t('alerts.unreadOther', { count: unreadCount }) : t('alerts.subtitle')}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllSeen} className="gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <CheckCheck className="h-3.5 w-3.5" />
              {t('alerts.markAll')}
            </Button>
          )}
        </div>
        <Separator />

        {/* List */}
        <ScrollArea className="max-h-[320px]">
          {isLoading && alerts.length === 0 ? (
            <div className="px-4 py-10 text-center corp-caption uppercase tracking-widest">
              {t('alerts.loading')}
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="corp-caption uppercase tracking-widest">{t('alerts.empty')}</p>
            </div>
          ) : (
            <ul className="py-1">
              {alerts.map((alert) => {
                const Icon = KIND_ICON[alert.kind];
                const isUnread = !seen.has(alert.id);
                return (
                  <li key={alert.id}>
                    <Link
                      to={alert.href}
                      onClick={() => {
                        dismiss(alert.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60',
                        isUnread && 'bg-indigo-50/50 dark:bg-indigo-900/10',
                      )}
                    >
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', KIND_COLOR[alert.kind])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate corp-body font-bold">{alert.title}</p>
                        <p className="corp-caption">
                          {alert.meta} · {relative(alert.time)}
                        </p>
                      </div>
                      {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between px-2 py-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs font-bold">
            <Link to="/admin/reports" onClick={() => setOpen(false)}>
              <Flag className="h-3.5 w-3.5" />
              {t('alerts.viewReports')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs font-bold">
            <Link to="/admin/notifications" onClick={() => setOpen(false)}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t('alerts.compose')}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AdminNotificationBell;
