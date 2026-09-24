import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Suites log in and register many times from one IP; security.e2e-spec.ts tightens these.
    env: {
      RATE_LIMIT_PER_MINUTE: '10000',
      RATE_LIMIT_LOGIN_PER_MINUTE: '10000',
      RATE_LIMIT_REGISTER_PER_MINUTE: '10000',
    },
  },
});
