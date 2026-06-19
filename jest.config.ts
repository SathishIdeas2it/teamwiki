import type { Config } from 'jest';

const config: Config = {
  displayName: 'unit',
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/tests/unit/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterFramework: ['<rootDir>/tests/unit/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  coverageDirectory: 'coverage/unit',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/app/**',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThresholds: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  clearMocks: true,
  restoreMocks: true,
};

export default config;
