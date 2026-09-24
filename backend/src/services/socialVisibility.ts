import { z } from 'zod';
import { getRolesForGate } from './insights.js';
import { getVerifiedGuardiansOfKid, hasCurrentSocialApproval, type ListedUser } from './supabaseRest.js';

/** E.1: outsiders need a current, explicitly approved active relationship. */
export async function mayDiscoverProfile(viewerId: string, subjectId: string): Promise<boolean> {
  if (viewerId === subjectId) return true;
  const roles = await getRolesForGate(subjectId);
  if (!z.array(z.string()).min(1).safeParse(roles).success) return false;
  if (!roles!.includes('kid')) return true;
  const guardians = await getVerifiedGuardiansOfKid(subjectId);
  if (!z.array(z.string().uuid()).safeParse(guardians).success || !guardians?.length) return false;
  if (guardians.includes(viewerId)) return true;
  const viewerGuardians = await getVerifiedGuardiansOfKid(viewerId);
  if (z.array(z.string().uuid()).safeParse(viewerGuardians).success &&
    viewerGuardians?.some(id => guardians.includes(id))) return true;
  return hasCurrentSocialApproval(viewerId, subjectId);
}

export async function visibleSocialUsers(viewerId: string, users: ListedUser[]): Promise<ListedUser[]> {
  const visible = await Promise.all(users.map(user => mayDiscoverProfile(viewerId, user.userId)));
  return users.filter((_user, index) => visible[index]);
}
