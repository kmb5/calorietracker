import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // Globally ignored paths (replaces `ignorePatterns` in legacy config)
  { ignores: ["dist/**", "src/client/**"] },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended (flat/recommended sets up parser + plugin)
  ...tsPlugin.configs["flat/recommended"],

  // React-specific rules
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React Hooks rules (v7 flat-config key)
      ...reactHooks.configs["recommended-latest"].rules,
      // Warn when non-component exports appear in component files
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
