import { createNextAppEslintConfig } from "../../tooling/eslint/next-app.mjs";

const eslintConfig = createNextAppEslintConfig([
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**", "e2e/**", "k6/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    }
  },
  {
    rules: {
      "react-compiler/react-compiler": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
], [".agent/**", "coverage/**"]);

export default eslintConfig;
