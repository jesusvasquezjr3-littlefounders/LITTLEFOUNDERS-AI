import { AccountDeletionPreview } from '../../account/AccountDeletionPreview';
import { SocialTiersPreview } from '../../social/SocialTiersPreview';
import { AccountSettingsPreview, LookEditorPreview, OwnProfilePreview } from '../../account/ProfileScreensPreview';
import { standalone, type PreviewRegistry } from './types';

/*
 * Lane 5 (profile): profile, social, settings and the account.
 */
export const profilePreviewScreens: PreviewRegistry = {
  'social-tiers': standalone(({ locale, theme, params }) => <SocialTiersPreview locale={locale} theme={theme} state={params.get('state')} />),
  // W2P.1: the rebuilt own profile (P1), look editor (P2) and Settings (P3), every state by fixture.
  'own-profile': standalone(({ locale, theme, params }) => <OwnProfilePreview locale={locale} theme={theme} state={params.get('state')} />),
  'look-editor': standalone(({ locale, theme, params }) => <LookEditorPreview locale={locale} theme={theme} state={params.get('state')} />),
  'account-settings': standalone(({ locale, theme, params }) => <AccountSettingsPreview locale={locale} theme={theme} state={params.get('state')} />),
  'account-deletion': standalone(({ locale, theme, params }) => <AccountDeletionPreview locale={locale} theme={theme} state={params.get('state')} layout={params.get('layout')} />),
};
