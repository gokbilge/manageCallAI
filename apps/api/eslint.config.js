import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow non-null assertions in repository code where rows[0]! is guarded
      // by the surrounding query logic. Use sparingly.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Allow _-prefixed identifiers to be unused (intentional no-ops / future params).
      '@typescript-eslint/no-unused-vars': ['error', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
);
