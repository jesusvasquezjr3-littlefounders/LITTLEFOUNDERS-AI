import { Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './socialTiers.css';

/*
 * E.13: a minor's username or name carries something that could let a
 * stranger find them outside LittleFounders (a contact, a link, another
 * platform's handle, a school, a street or postal code, a birth year). Until
 * it changes, nobody outside the family sees the profile. This says so, to
 * the right person:
 *   self      an independent teen, who can change both fields
 *   kidSelf   a child, who can change the name but asks its Tutor about the
 *             username (A.6 keeps a child's username fixed)
 *   guardian  the Tutor, in the Family panel, about a named child
 * Copy-only, no transport.
 */

export interface ProfileSafetyCopy {
  title: string; body: string; username: string; displayName: string; askTutor: string;
  kidTitle: string; kidBody: string; kidUsername: string; kidDisplayName: string;
}

export function ProfileSafetyNotice({ copy, locale, dark, audience, fields, name }: {
  copy: ProfileSafetyCopy;
  locale: string;
  dark: boolean;
  audience: 'self' | 'kidSelf' | 'guardian';
  fields: ('username' | 'displayName')[];
  name?: string;
}) {
  if (fields.length === 0) return null;
  const guardian = audience === 'guardian';
  const lines = fields.map((field) => field === 'displayName' ? (guardian ? copy.kidDisplayName : copy.displayName)
    : audience === 'self' ? copy.username : audience === 'kidSelf' ? copy.askTutor : copy.kidUsername);
  return <section aria-label={guardian ? copy.kidTitle.replace('{name}', name ?? '') : copy.title} className="lf-rebuild lf-social-tier-card lf-social-tier-notice" data-social-audit="profile-safety" lang={locale} data-theme={dark ? 'dark' : 'light'}>
    <Copy role="heading" as="h2">{guardian ? copy.kidTitle.replace('{name}', name ?? '') : copy.title}</Copy>
    <Copy role="body">{guardian ? copy.kidBody : copy.body}</Copy>
    {lines.map((line) => <Copy key={line} role="body">{line}</Copy>)}
  </section>;
}
