module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.module$': '$1',    '^@vonage/jwt$': '<rootDir>/tests/mocks/vonage.jwt.mock.cjs',  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2020',
          target: 'ES2020',
          lib: ['ES2020'],
          types: ['jest', 'node'],
        },
      },
    ],
  },
  // Mock fs.readFileSync for private key path before any module loads
  setupFiles: ['<rootDir>/tests/setup.fs.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/sdd-proxy-work/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
};
