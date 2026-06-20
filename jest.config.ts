import type { Config } from 'jest';

const config: Config = {
  displayName: 'unit',
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/tests/unit/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    // Enforce coverage on business logic: services, auth, db, utils, mcp, middleware
    'src/lib/**/*.{ts,tsx}',
    'src/middleware.ts',
    // Exclude generated / declaration files
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  clearMocks: true,
  restoreMocks: true,
};

export default config;
