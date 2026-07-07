import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, User, Palette, LayoutGrid, Bell, LogOut, Trash2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useToast } from '@/hooks/use-toast';
import { useAdminSettings } from '@/hooks/useAdminSettings';

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

/** Section card with icon + title + subtitle, matching the corp design system. */
const Section: React.FC<{
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, children }) => (
  <div className="corp-panel p-6 md:p-7">
    <div className="flex items-center gap-3 mb-5">
      <div className="corp-icon-chip w-10 h-10">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="corp-h4">{title}</h2>
        <p className="corp-body-sm">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

/** A labelled row with a control on the right. */
const Row: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({
  label,
  description,
  children,
}) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="corp-subtitle-sm">{label}</p>
      {description && <p className="corp-body-sm mt-0.5">{description}</p>}
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
      {/* Page header */}
      <div className="corp-panel p-6 md:p-8 flex items-center gap-4">
        <div className="corp-icon-chip w-11 h-11 shrink-0">
          <SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div>
          <span className="corp-eyebrow">{t('layout.panelTitle')}</span>
          <h1 className="corp-display mt-1 text-xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {t('settings.title')}
          </h1>
          <p className="mt-1 corp-body-sm">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* Account */}
      <Section icon={User} title={t('settings.account.title')} subtitle={t('settings.account.subtitle')}>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white text-xl font-bold shadow-lg">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="corp-body font-bold truncate">
              {user.name || t('settings.account.unknown')}
            </p>
            <p className="corp-body-sm truncate">
              {user.email || t('settings.account.unknown')}
            </p>
          </div>
        </div>
        <Separator className="my-2" />
        <Row label={t('settings.account.role')}>
          <span className="corp-badge corp-badge--brand">
            {user.user_type || t('layout.role')}
          </span>
        </Row>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
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
      <Section icon={LayoutGrid} title={t('settings.panel.title')} subtitle={t('settings.panel.subtitle')}>
        <Row label={t('settings.panel.sidebarCollapsed')} description={t('settings.panel.sidebarCollapsedDesc')}>
          <Switch
            checked={sidebarCollapsed}
            onCheckedChange={toggleSidebarDefault}
            aria-label={t('settings.panel.sidebarCollapsed')}
          />
        </Row>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title={t('settings.notifications.title')} subtitle={t('settings.notifications.subtitle')}>
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
      <Section icon={Info} title={t('settings.session.title')} subtitle={t('settings.session.subtitle')}>
        <Row label={t('settings.session.version')}>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{version}</span>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.environment')}>
          <span className="corp-badge font-mono">
            {environment}
          </span>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.clearCache')} description={t('settings.session.clearCacheDesc')}>
          <button
            onClick={handleClearCache}
            className="corp-btn-secondary h-9 rounded-lg px-3 text-sm font-semibold inline-flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {t('settings.session.clearCache')}
          </button>
        </Row>
        <Separator className="my-1" />
        <Row label={t('settings.session.logout')} description={t('settings.session.logoutDesc')}>
          <button
            onClick={handleLogout}
            className="corp-btn-danger h-9 rounded-lg px-3 text-sm font-semibold inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {t('settings.session.logout')}
          </button>
        </Row>
      </Section>

      <p className="corp-caption pb-4">
        {t('settings.savedNote')}
      </p>
    </div>
  );
};

export default AdminSettings;
