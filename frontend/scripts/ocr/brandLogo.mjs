import { createHash } from 'node:crypto';

// OD-33 permits brand lettering only in the unchanged existing company logo.
export function isExistingBrandLogo(path, bytes) {
  return path === '/rebuild/brand/logo.png'
    && createHash('sha256').update(bytes).digest('hex') === '469259ffd19099a060b7cc3a97e0a421a71520e45dcbad6ed98c25acccb7e01c';
}
