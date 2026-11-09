import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const iconButtonSizeMessage =
  'Use the IconButton size prop: size-* in className conflicts with its own size class.';
const iconButtonClassName =
  "JSXOpeningElement[name.name='IconButton'] > JSXAttribute[name.name='className']";
const sizeUtility = '/(^|\\s)size-/';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `${iconButtonClassName} Literal[value=${sizeUtility}]`,
          message: iconButtonSizeMessage,
        },
        {
          selector: `${iconButtonClassName} TemplateElement[value.raw=${sizeUtility}]`,
          message: iconButtonSizeMessage,
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'public/sw*.js',
    'public/swe-worker*.js',
  ]),
]);

export default eslintConfig;
