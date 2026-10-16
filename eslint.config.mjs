import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', 'scripts/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  { files: ['src/**/*.html'], extends: [...angular.configs.templateRecommended], rules: {} },
);
