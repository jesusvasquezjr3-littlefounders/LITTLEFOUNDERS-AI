import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Code copied in from the UI libraries' registries (docs/design/UI-LIBRARIES.md) is theirs, not ours.
  { ignores: ['dist/', 'tools/', 'src/components/ui/', 'src/components/charts/', 'src/lib/cojeev/', 'src/lib/cojeev-motion/'] },
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
