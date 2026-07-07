import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers, usePromoteUser, useDemoteUser } from '@/hooks/useAdminStats';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, ShieldPlus, ShieldMinus, TriangleAlert, Lock, Users } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  user_type: 'admin' | 'child' | 'universal' | 'tutor';
  is_active: boolean;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const { t } = useTranslation('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [promoteConfirmId, setPromoteConfirmId] = useState<string | null>(null);
  const [demoteConfirmId, setDemoteConfirmId] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockInput, setUnlockInput] = useState('');
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);

  const { data: usersData, isLoading } = useAdminUsers();
  const promoteUser = usePromoteUser();
  const demoteUser = useDemoteUser();

  const users = (usersData as User[] | undefined) || [];

  // Separate admins and other users
  const adminUsers = useMemo(() => users.filter((u) => u.user_type === 'admin'), [users]);
  const otherUsers = useMemo(() => users.filter((u) => u.user_type !== 'admin'), [users]);

  // Filter by search
  const filteredAdmins = useMemo(() => {
    if (!searchTerm) return adminUsers;
    const term = searchTerm.toLowerCase();
    return adminUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
    );
  }, [adminUsers, searchTerm]);

  const filteredOthers = useMemo(() => {
    if (!searchTerm) return otherUsers;
    const term = searchTerm.toLowerCase();
    return otherUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
    );
  }, [otherUsers, searchTerm]);

  const handlePromote = async (userId: string) => {
    try {
      await promoteUser.mutateAsync(userId);
      setPromoteConfirmId(null);
    } catch (error: any) {
      console.error('Promote error:', error);
      if (error.message && error.message.includes('403')) {
        alert(t('users.promoteErrorDomain'));
      } else {
        alert(t('common.error') + ': ' + error.message);
      }
      setPromoteConfirmId(null);
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await demoteUser.mutateAsync(userId);
      setDemoteConfirmId(null);
    } catch (error) {
      console.error('Demote error:', error);
    }
  };

  const getUserTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'admin':
        return 'corp-badge corp-badge--info';
      case 'tutor':
        return 'corp-badge';
      case 'universal':
        return 'corp-badge';
      case 'child':
        return 'corp-badge';
      default:
        return 'corp-badge';
    }
  };

  const getUserTypeLabel = (type: string): string => {
    switch (type) {
      case 'admin':
        return t('users.userTypeAdmin');
      case 'tutor':
        return t('users.userTypeTutor');
      case 'universal':
        return t('users.userTypeUniversal');
      case 'child':
        return t('users.userTypeChild');
      default:
        return type;
    }
  };

  const UserRow: React.FC<{
    user: User;
    showPromoteButton?: boolean;
  }> = ({ user, showPromoteButton }) => (
    <TableRow key={user.id} className={!user.is_active ? 'opacity-60' : ''}>
      <TableCell>
        <div>
          <p className="corp-subtitle-sm">{user.name}</p>
          <p className="corp-body-sm">{user.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`${getUserTypeBadgeClass(user.user_type)} capitalize`}>
            {getUserTypeLabel(user.user_type)}
          </span>
          {!user.is_active && (
            <span className="corp-badge">
              {t('users.inactive')}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
        {new Date(user.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-2">
          {showPromoteButton && user.user_type !== 'admin' && (
            <Dialog
              open={promoteConfirmId === user.id}
              onOpenChange={(open) => {
                if (!open) setPromoteConfirmId(null);
              }}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  onClick={() => setPromoteConfirmId(user.id)}
                  title={t('users.promoteToAdmin')}
                  className="corp-btn-ghost inline-flex items-center justify-center h-8 w-8 rounded-lg"
                >
                  <ShieldPlus className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="corp corp-dialog rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">
                    {t('users.promoteTitle')}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                    {t('users.promoteDescription', 'Promote "{{name}}" to admin? They will have full access to the admin panel.', {
                      name: user.name,
                    })}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setPromoteConfirmId(null)}
                    className="corp-btn-secondary h-10 rounded-xl px-4 text-sm font-semibold"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePromote(user.id)}
                    disabled={promoteUser.isPending}
                    className="corp-btn-primary h-10 rounded-xl px-4 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {promoteUser.isPending ? t('common.promoting') : t('users.promote')}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {user.user_type === 'admin' && (
            <Dialog
              open={demoteConfirmId === user.id}
              onOpenChange={(open) => {
                if (!open) setDemoteConfirmId(null);
              }}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  onClick={() => setDemoteConfirmId(user.id)}
                  title={t('users.demoteFromAdmin')}
                  className="corp-btn-ghost inline-flex items-center justify-center h-8 w-8 rounded-lg"
                >
                  <ShieldMinus className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="corp corp-dialog rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-white">
                    {t('users.demoteTitle')}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                    {t('users.demoteDescription', 'Demote "{{name}}" from admin? They will become a tutor and lose admin access.', {
                      name: user.name,
                    })}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setDemoteConfirmId(null)}
                    className="corp-btn-secondary h-10 rounded-xl px-4 text-sm font-semibold"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemote(user.id)}
                    disabled={demoteUser.isPending}
                    className="corp-btn-danger h-10 rounded-xl px-4 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {demoteUser.isPending ? t('common.demoting') : t('users.demote')}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 p-8 min-h-screen">
      {/* Page Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-wrap items-center gap-4">
        <div className="corp-icon-chip w-12 h-12 shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div className="text-left">
          <span className="corp-eyebrow">{t('users.subtitle')}</span>
          <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
            {t('users.title')}
          </h1>
        </div>
      </div>

      {/* Search */}
      <div className="corp-panel-subtle p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <Input
            placeholder={t('users.searchPlaceholder')}
            className="corp-input h-10 pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Users Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="corp-card p-6">
          <p className="corp-eyebrow">{t('users.totalUsers')}</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-12 bg-slate-200 dark:bg-slate-700" />
          ) : (
            <div className="mt-3 corp-number-lg">{users.length}</div>
          )}
        </div>
        <div className="corp-card p-6">
          <p className="corp-eyebrow">{t('users.admins')}</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-12 bg-slate-200 dark:bg-slate-700" />
          ) : (
            <div className="mt-3 corp-number-lg text-indigo-600 dark:text-indigo-300">{adminUsers.length}</div>
          )}
        </div>
        <div className="corp-card p-6">
          <p className="corp-eyebrow">{t('users.otherUsers')}</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-8 w-12 bg-slate-200 dark:bg-slate-700" />
          ) : (
            <div className="mt-3 corp-number-lg text-slate-600 dark:text-slate-400">{otherUsers.length}</div>
          )}
        </div>
      </div>

      {/* Admin Users Section */}
      <div className="corp-panel p-6">
        <h2 className="corp-display text-lg font-bold text-slate-900 dark:text-white">
          {t('users.administrators')} ({filteredAdmins.length})
        </h2>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          ) : filteredAdmins.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="corp-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('users.nameEmail')}</TableHead>
                    <TableHead>{t('users.type')}</TableHead>
                    <TableHead>{t('users.created')}</TableHead>
                    <TableHead className="text-center">{t('users.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.map((user) => (
                    <UserRow key={user.id} user={user} showPromoteButton={false} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="corp-empty py-8">
              {t('users.noAdminsFound')}
            </div>
          )}
        </div>
      </div>

      {/* Other Users Section */}
      <div className="corp-panel p-6">
        <h2 className="corp-display text-lg font-bold text-slate-900 dark:text-white">
          {t('users.otherUsersTitle')} ({filteredOthers.length})
        </h2>
        <div className="mt-4">
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-950/30 p-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/50 p-2">
                <TriangleAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-2">
                  {t('users.dangerZone')}
                </h4>
                <p className="text-sm font-medium text-red-600/90 dark:text-red-400/90">
                  {t('users.dangerZoneDescription')}
                </p>
              </div>
            </div>
          </div>

          {!isUnlocked ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 corp-panel-subtle">
              <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4">
                <Lock className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="max-w-md space-y-2 px-4">
                <h3 className="corp-h4">
                  {t('users.securityLock.title')}
                </h3>
                <p className="corp-body-sm">
                  {t('users.securityLock.description')}
                </p>
              </div>

              <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
                <DialogTrigger asChild>
                  <button type="button" className="corp-btn-secondary mt-4 h-10 rounded-xl px-4 text-sm font-semibold">
                    {t('users.securityLock.unlockButton')}
                  </button>
                </DialogTrigger>
                <DialogContent className="corp corp-dialog rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>{t('users.securityLock.unlockTitle')}</DialogTitle>
                    <DialogDescription>
                      {t('users.securityLock.unlockDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Input
                        placeholder={t('users.securityLock.placeholder', { phrase: t('users.securityLock.unlockPhrase') })}
                        value={unlockInput}
                        onChange={(e) => setUnlockInput(e.target.value.toUpperCase())}
                        className="corp-input h-10 text-center font-mono uppercase tracking-wider"
                      />
                      <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                        {t('users.securityLock.unlockPhrase')}: <span className="font-bold select-all">{t('users.securityLock.unlockPhrase')}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="corp-btn-primary w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={unlockInput !== t('users.securityLock.unlockPhrase')}
                      onClick={() => {
                        setIsUnlocked(true);
                        setShowUnlockDialog(false);
                        setUnlockInput('');
                      }}
                    >
                      {t('common.confirm')}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-200 dark:bg-slate-700" />
                ))}
              </div>
            ) : filteredOthers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="corp-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('users.nameEmail')}</TableHead>
                      <TableHead>{t('users.type')}</TableHead>
                      <TableHead>{t('users.created')}</TableHead>
                      <TableHead>{t('users.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOthers.map((user) => (
                      <UserRow key={user.id} user={user} showPromoteButton={true} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="corp-empty py-8">
                {t('users.noOtherUsersFound')}
              </div>
            )
          )}
        </div>
      </div>

      {/* User Roles Legend */}
      <div className="corp-panel p-6">
        <h2 className="corp-display text-base font-bold text-slate-900 dark:text-white">
          {t('users.userRoles')}
        </h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="corp-badge corp-badge--info">
              {t('users.userTypeAdmin')}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('users.adminDescription')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="corp-badge">
              {t('users.userTypeTutor')}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('users.tutorDescription')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="corp-badge">
              {t('users.userTypeUniversal')}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('users.universalDescription')}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="corp-badge">
              {t('users.userTypeChild')}
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('users.childDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
