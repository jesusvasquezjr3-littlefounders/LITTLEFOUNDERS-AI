import tseslint from 'typescript-eslint';

export default tseslint.config(
  // haraka/ is the Haraka engine's own config + plugins dir. Its plugins run in
  // Haraka's CommonJS runtime (require() is the mandated plugin API), not our
  // TS/ESM source, so it is out of scope for this service's linter.
  { ignores: ['dist/', 'haraka/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
