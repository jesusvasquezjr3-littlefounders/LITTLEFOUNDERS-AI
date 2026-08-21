import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore marks a parameter that is deliberately unused but
      // part of an interface's contract — the silent voice provider, the
      // classifier's locale. Removing them would break the shape callers rely
      // on; renaming them is how the intent stays visible.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
);
