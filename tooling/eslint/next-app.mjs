import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export function createNextAppEslintConfig(extraConfigs = [], extraIgnores = []) {
  return defineConfig([
    ...nextVitals,
    ...nextTs,
    ...extraConfigs,
    globalIgnores([
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ...extraIgnores,
    ]),
  ]);
}
