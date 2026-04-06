import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers, usePromoteUser, useDemoteUser } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassPanel } from '@/components/ui/GlassPanel';
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

  const getUserTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'admin':
        return 'default';
      case 'tutor':
        return 'secondary';
      case 'universal':
        return 'outline';
      case 'child':
        return 'outline';
      default:
        return 'outline';
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
    <TableRow key={user.id} className={`border-slate-200 dark:border-slate-700 ${!user.is_active ? 'opacity-60' : ''} hover:bg-slate-50 dark:hover:bg-slate-800`}>
      <TableCell>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{user.name}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={getUserTypeBadgeVariant(user.user_type)} className="capitalize bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
            {getUserTypeLabel(user.user_type)}
          </Badge>
          {!user.is_active && (
            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              {t('users.inactive')}
            </Badge>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPromoteConfirmId(user.id)}
                  title={t('users.promoteToAdmin')}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <ShieldPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
                  <Button
                    variant="outline"
                    onClick={() => setPromoteConfirmId(null)}
                    className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => handlePromote(user.id)}
                    disabled={promoteUser.isPending}
                  >
                    {promoteUser.isPending ? t('common.promoting') : t('users.promote')}
                  </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDemoteConfirmId(user.id)}
                  title={t('users.demoteFromAdmin')}
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                >
                  <ShieldMinus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
                  <Button
                    variant="outline"
                    onClick={() => setDemoteConfirmId(null)}
                    className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDemote(user.id)}
                    disabled={demoteUser.isPending}
                  >
                    {demoteUser.isPending ? t('common.demoting') : t('users.demote')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 p-8 bg-white dark:bg-slate-900 min-h-screen">
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-blue-500/10 dark:border-blue-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-blue-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10">
              <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-blue-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <Users className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('users.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('users.subtitle')}
                  </p>
              </div>
          </div>
      </div>

      {/* Search */}
      <GlassPanel variant="subtle" className="p-0 border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="px-4 py-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
            <Input
              placeholder={t('users.searchPlaceholder')}
              className="pl-10 h-12 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-2 border-transparent focus:border-blue-500/50 transition-all rounded-xl shadow-inner text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </GlassPanel>

      {/* Users Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('users.totalUsers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-700" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</div>
            )}
          </CardContent>
        </GlassPanel>
        <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('users.admins')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-700" />
            ) : (
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{adminUsers.length}</div>
            )}
          </CardContent>
        </GlassPanel>
        <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('users.otherUsers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12 bg-slate-200 dark:bg-slate-700" />
            ) : (
              <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{otherUsers.length}</div>
            )}
          </CardContent>
        </GlassPanel>
      </div>

      {/* Admin Users Section */}
      <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">
            {t('users.administrators')} ({filteredAdmins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          ) : filteredAdmins.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="text-slate-900 dark:text-white">{t('users.nameEmail')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('users.type')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('users.created')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white text-center">{t('users.actions')}</TableHead>
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
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              {t('users.noAdminsFound')}
            </p>
          )}
        </CardContent>
      </GlassPanel>

      {/* Other Users Section */}
      <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-yellow-400 dark:border-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.3)] dark:shadow-[0_0_20px_rgba(250,204,21,0.15)]">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">
            {t('users.otherUsersTitle')} ({filteredOthers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/30 p-4 shadow-[0_0_15px_rgba(239,68,68,0.2)] dark:shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/50">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/50 p-2">
                <TriangleAlert className="h-6 w-6 text-red-600 dark:text-red-500 animate-pulse" />
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
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
              <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4">
                <Lock className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="max-w-md space-y-2 px-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('users.securityLock.title')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('users.securityLock.description')}
                </p>
              </div>

              <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mt-4">
                    {t('users.securityLock.unlockButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
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
                        className="text-center font-mono uppercase tracking-wider"
                      />
                      <p className="text-xs text-center text-muted-foreground">
                        {t('users.securityLock.unlockPhrase')}: <span className="font-bold select-all">{t('users.securityLock.unlockPhrase')}</span>
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={unlockInput !== t('users.securityLock.unlockPhrase')}
                      onClick={() => {
                        setIsUnlocked(true);
                        setShowUnlockDialog(false);
                        setUnlockInput('');
                      }}
                    >
                      {t('common.confirm')}
                    </Button>
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
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="text-slate-900 dark:text-white">{t('users.nameEmail')}</TableHead>
                      <TableHead className="text-slate-900 dark:text-white">{t('users.type')}</TableHead>
                      <TableHead className="text-slate-900 dark:text-white">{t('users.created')}</TableHead>
                      <TableHead className="text-slate-900 dark:text-white">{t('users.actions')}</TableHead>
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
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                {t('users.noOtherUsersFound')}
              </p>
            )
          )}
        </CardContent>
      </GlassPanel>

      {/* User Roles Legend */}
      <GlassPanel variant="default" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base text-slate-900 dark:text-white">
            {t('users.userRoles')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                {t('users.userTypeAdmin')}
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('users.adminDescription')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                {t('users.userTypeTutor')}
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('users.tutorDescription')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                {t('users.userTypeUniversal')}
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('users.universalDescription')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                {t('users.userTypeChild')}
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('users.childDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </GlassPanel>
    </div>
  );
};

export default AdminUsers;
