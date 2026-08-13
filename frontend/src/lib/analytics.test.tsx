import { describe, expect, it } from 'vitest';
import { isMarketingPath, shouldTrackPublicAcquisition } from './analytics';

describe('public acquisition tracker boundary', () => {
  it('accepts only consented, identity-resolved guest marketing routes', () => {
    expect(shouldTrackPublicAcquisition('/', null, true, true)).toBe(true);
    expect(shouldTrackPublicAcquisition('/families', null, true, true)).toBe(true);
    expect(shouldTrackPublicAcquisition('/login', null, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/auth/callback', null, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/admin/content', null, true, true)).toBe(false);
  });

  it('fails closed while authentication restores or a user is identified', () => {
    expect(shouldTrackPublicAcquisition('/', null, false, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/', {}, true, true)).toBe(false);
    expect(shouldTrackPublicAcquisition('/', null, true, false)).toBe(false);
  });

  it('does not treat app and OAuth routes as marketing', () => {
    expect(isMarketingPath('/learn')).toBe(false);
    expect(isMarketingPath('/auth/callback')).toBe(false);
    expect(isMarketingPath('/admin')).toBe(false);
  });
});
