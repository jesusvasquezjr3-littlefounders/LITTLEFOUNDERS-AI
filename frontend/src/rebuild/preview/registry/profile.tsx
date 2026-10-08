import { AccountDeletionPreview } from '../../account/AccountDeletionPreview';
import { SocialTiersPreview } from '../../social/SocialTiersPreview';
import { AccountSettingsPreview, LookEditorPreview, OwnProfilePreview } from '../../account/ProfileScreensPreview';
import { PeopleListPreview, PublicProfilePreview } from '../../social/SocialScreensPreview';
import { standalone, type PreviewRegistry } from './types';

/*
 * Profile: profile, social, settings and the account.
 */
export const profilePreviewScreens: PreviewRegistry = {
  'social-tiers': standalone(({ locale, theme, params }) => <SocialTiersPreview locale={locale} theme={theme} state={params.get('state')} />),
  // The rebuilt own profile, look editor and Settings, every state by fixture.
  'own-profile': standalone(({ locale, theme, params }) => <OwnProfilePreview locale={locale} theme={theme} state={params.get('state')} />),
  'look-editor': standalone(({ locale, theme, params }) => <LookEditorPreview locale={locale} theme={theme} state={params.get('state')} />),
  'account-settings': standalone(({ locale, theme, params }) => <AccountSettingsPreview locale={locale} theme={theme} state={params.get('state')} />),
  // Another person's profile and the four people lists, every state by fixture.
  'public-profile': standalone(({ locale, theme, params }) => <PublicProfilePreview locale={locale} theme={theme} state={params.get('state')} />),
  'people-list': standalone(({ locale, theme, params }) => <PeopleListPreview locale={locale} theme={theme} state={params.get('state')} />),
  'account-deletion': standalone(({ locale, theme, params }) => <AccountDeletionPreview locale={locale} theme={theme} state={params.get('state')} layout={params.get('layout')} />),
};
