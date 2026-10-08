/** Where a sign-in continues: the page that asked for it (router state `from`, an in-app path only), else `home`. */
export function continueAfterSignIn(from: unknown, home: string): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : home;
}
