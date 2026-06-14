import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, User, Palette, LayoutGrid, Bell, LogOut, Trash2, Info } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useToast } from '@/hooks/use-toast';
import { useAdminSettings } from '@/hooks/useAdminSettings';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'admin_sidebar_collapsed';

interface AdminUser {
  name?: string;
  email?: string;
  user_type?: string;
}

function getAdminUser(): AdminUser {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') as AdminUser;
  } catch {
    return {};
  }
}

/** Literal class map so Tailwind JIT can see every color (no dynamic strings). */
const SECTION_COLORS = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500' },
} as const;

type SectionColor = keyof typeof SECTION_COLORS;

/** Section card with icon + title + subtitle, matching the admin design system. */
const Section: React.FC<{
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color?: SectionColor;
  children: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, color = 'indigo', children }) => (
  <GlassPanel variant="subtle" className="p-6 md:p-7">
    <div className="flex items-center gap-3 mb-5">
      <div className={cn('p-2 rounded-xl', SECTION_COLORS[color].bg)}>
        <Icon className={cn('h-5 w-5', SECTION_COLORS[color].text)} />
      </div>
      <div>
        <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
    {children}
  </GlassPanel>
);

/** A labelled row with a control on the right. */
const Row: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({
  label,
  description,
  children,
}) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</p>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

export const AdminSettings: React.FC = () => {
  const { t } = useTranslation('admin');
  const { toast } = useToast();
  const { settings, update } = useAdminSettings();
  const user = getAdminUser();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(SIDEBAR_KEY) || 'false');
    } catch {
      return false;
    }
  });

  const toggleSidebarDefault = (value: boolean) => {
    setSidebarCollapsed(value);
    localStorage.setItem(SIDEBAR_KEY, JSON.stringify(value));
  };

  const handleClearCache = () => {
    // Preserve auth so the admin stays logged in.
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    localStorage.clear();
    if (token) localStorage.setItem('token', token);
    if (userStr) localStorage.setItem('user', userStr);
    toast({ title: t('settings.session.clearCacheDone') });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const initial = (user.name || 'A').charAt(0).toUpperCase();
  const version = (import.meta.env.VITE_APP_VERSION as string | undefined) || '1.0.0';
  const environment = import.meta.env.MODE;

  return (
    <div className="space-y-6 p-2 md:p-4 max-w-3xl mx-auto">
      {/* Premium header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex items-center gap-4 border border-indigo-500/10 dark:border-indigo-500/5 shadow-2xl">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-indigo-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0 relative z-10">
          <SettingsIcon className="w-5 h-5 md:w-7 md:h-7 text-white" />
        </div>
        <div className="relative z-10">
          <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-1">
            {t('settings.title')}
          </h1>
          <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* Account */}
      <Section icon={User} title={t('settings.account.title')} subtitle={t('settings.account.subtitle')} color="blue">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xl font-black shadow-lg">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-slate-900 dark:text-white truncate">
              {user.name || t('settings.account.unknown')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {user.email || t('settings.account.unknown')}
            </p>
          </div>
        </div>
        <Separator className="my-2" />
        <Row label={t('settings.account.role')}>
          <span className="rounded-lg bg-indigo-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {user.user_type || t('layout.role')}
          </span>
        </Row>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')} color="purple">
        <Row label={t('settings.appearance.theme')}>
          <ThemeToggle />
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.appearance.language')}>
          <LanguageSelector variant="pill" />
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.appearance.reduceMotion')} description={t('settings.appearance.reduceMotionDesc')}>
          <Switch
            checked={settings.reduceMotion}
            onCheckedChange={(v) => update({ reduceMotion: v })}
            aria-label={t('settings.appearance.reduceMotion')}
          />
        </Row>
      </Section>

      {/* Panel */}
      <Section icon={LayoutGrid} title={t('settings.panel.title')} subtitle={t('settings.panel.subtitle')} color="green">
        <Row label={t('settings.panel.sidebarCollapsed')} description={t('settings.panel.sidebarCollapsedDesc')}>
          <Switch
            checked={sidebarCollapsed}
            onCheckedChange={toggleSidebarDefault}
            aria-label={t('settings.panel.sidebarCollapsed')}
          />
        </Row>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title={t('settings.notifications.title')} subtitle={t('settings.notifications.subtitle')} color="amber">
        <Row label={t('settings.notifications.showBadge')} description={t('settings.notifications.showBadgeDesc')}>
          <Switch
            checked={settings.showNotifBadge}
            onCheckedChange={(v) => update({ showNotifBadge: v })}
            aria-label={t('settings.notifications.showBadge')}
          />
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.notifications.sound')} description={t('settings.notifications.soundDesc')}>
          <Switch
            checked={settings.notifSound}
            onCheckedChange={(v) => update({ notifSound: v })}
            aria-label={t('settings.notifications.sound')}
          />
        </Row>
      </Section>

      {/* Session & data */}
      <Section icon={Info} title={t('settings.session.title')} subtitle={t('settings.session.subtitle')} color="rose">
        <Row label={t('settings.session.version')}>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{version}</span>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.environment')}>
          <span className="rounded-lg bg-slate-500/10 px-3 py-1 font-mono text-xs text-slate-600 dark:text-slate-300">
            {environment}
          </span>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.clearCache')} description={t('settings.session.clearCacheDesc')}>
          <Button onClick={handleClearCache} variant="outline" size="sm" className="gap-2 font-bold">
            <Trash2 className="h-4 w-4" />
            {t('settings.session.clearCache')}
          </Button>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.logout')} description={t('settings.session.logoutDesc')}>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="gap-2 font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/40"
          >
            <LogOut className="h-4 w-4" />
            {t('settings.session.logout')}
          </Button>
        </Row>
      </Section>

      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 pb-4">
        {t('settings.savedNote')}
      </p>
    </div>
  );
};

export default AdminSettings;
