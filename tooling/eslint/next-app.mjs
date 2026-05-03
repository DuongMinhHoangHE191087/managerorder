import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export function createNextAppEslintConfig(extraConfigs = [], extraIgnores = []) {
  return defineConfig([
    ...nextCoreWebVitals,
    ...nextTypescript,
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
