// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'src/types/database.types.ts', 'supabase/.temp/*'],
  },

  // AGENTS.md rule 2 / ADR 0004: only the data layer talks to Supabase.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/**', 'src/lib/supabase.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Only src/data/ may use the Supabase client — call a data-layer function instead.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },

  // AGENTS.md rule 4: the secret key never appears in app code.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/SECRET|SERVICE_ROLE/]",
          message: 'Secret/service-role keys must never be referenced from app code.',
        },
      ],
    },
  },
]);
