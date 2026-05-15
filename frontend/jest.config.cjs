/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Path alias
    "^@/(.*)$": "<rootDir>/src/$1",
    // CSS modules → identity proxy
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Static assets
    "\\.(jpg|jpeg|png|gif|svg|webp|ico)$": "<rootDir>/__mocks__/fileMock.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          // Relax strict checks that don't apply to test files
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
  testPathPattern: "src/.*\\.test\\.tsx?$",
};
