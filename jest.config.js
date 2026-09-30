/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // ── Unit + component tests ────────────────────────────────────────
    // Pure logic, hooks, components and routes. No network, no database:
    // the data layer is mocked at its module boundary.
    {
      displayName: 'unit',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
      // Rely on jest-expo's own transformIgnorePatterns — it tracks new Expo
      // dependencies (e.g. standard-navigation). Only extend it, never replace it.
    },

    // ── Integration tests ─────────────────────────────────────────────
    // Data-layer functions against the real local Supabase stack
    // (`npm run setup`). Must run serially: files share one database.
    // `npm run test:int` adds --forceExit: realtime-js leaves two 10s timers
    // (channel-leave ack, socket-close fallback) running after a clean
    // disconnect, and the socket one isn't configurable. See conventions.md.
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.int.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', types: ['jest', 'node'] } }],
      },
    },
  ],
};
