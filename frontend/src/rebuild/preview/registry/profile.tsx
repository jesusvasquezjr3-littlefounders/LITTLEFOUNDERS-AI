import { AccountDeletionPreview } from '../../account/AccountDeletionPreview';
import { SocialTiersPreview } from '../../social/SocialTiersPreview';
import { standalone, type PreviewRegistry } from './types';

/*
 * Lane 5 (profile): profile, social, settings and the account.
 */
export const profilePreviewScreens: PreviewRegistry = {
  'social-tiers': standalone(({ locale, theme, params }) => <SocialTiersPreview locale={locale} theme={theme} state={params.get('state')} />),
  'account-deletion': standalone(({ locale, theme, params }) => <AccountDeletionPreview locale={locale} theme={theme} state={params.get('state')} layout={params.get('layout')} />),
};
