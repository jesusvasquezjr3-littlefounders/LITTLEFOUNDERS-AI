import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `public/basis/` holds the minified Basis Universal transcoder copied out of
  // `three` at build time (scripts/copy-3d-decoders.mjs) — vendor output we do
  // not author and cannot meaningfully lint.
  { ignores: ['dist/', 'public/basis/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
