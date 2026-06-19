import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/tests/integration/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/integration/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
};

export default config;
