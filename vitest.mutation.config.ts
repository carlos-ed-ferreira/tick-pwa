import { mergeConfig, defineConfig } from 'vitest/config';
import configuration from './vitest.config';

export default mergeConfig(
  configuration,
  defineConfig({
    test: {
      include: [
        'tests/unit/account-cache-baseline.test.ts',
        'tests/unit/task-completion.test.ts',
        'tests/unit/entity-metadata.test.ts',
        'tests/integration/account-cache-concurrency.test.ts',
      ],
      pool: 'forks',
    },
  }),
);
