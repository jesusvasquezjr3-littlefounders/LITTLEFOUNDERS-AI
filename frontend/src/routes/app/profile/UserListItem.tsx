import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/ui';

/** Shape returned by every followers/following/blocked list endpoint. */
export interface ListedUser {
  userId: string;
  displayName: string;
  username: string | null;
  avatarOptions: Record<string, unknown>;
  isTutor: boolean;
}

/** One row in a followers/following/blocked list — avatar, name, @handle, optional action slot. */
export function UserListItem({ user, tutorLabel, action }: { user: ListedUser; tutorLabel: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2.5 transition-colors duration-150 hover:bg-surface-sunken">
      <Link
        to={user.username ? `/@${user.username}` : '#'}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar options={user.avatarOptions} seed={user.userId} className="h-12 w-12 shrink-0 bg-surface-sunken" />
        <div className="min-w-0">
          <p className="lf-label truncate text-content">{user.displayName}</p>
          <div className="flex items-center gap-2">
            {user.username && <p className="lf-caption truncate text-content-muted">@{user.username}</p>}
            {user.isTutor && <Badge className="bg-success-soft text-success-strong">{tutorLabel}</Badge>}
          </div>
        </div>
      </Link>
      {action}
    </div>
  );
}
