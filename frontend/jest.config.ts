import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterFramework: ["<rootDir>/jest.setup.ts"],
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

export default config;
