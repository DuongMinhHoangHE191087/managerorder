import { createVitestNodeConfig } from "../../tooling/vitest/base.mjs";

const srcAlias = `${process.cwd().replace(/\\/g, "/")}/src`;

const vitestConfig = {
  resolve: {
    alias: {
      "@": srcAlias,
    },
  },
  ...createVitestNodeConfig({
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-for-vitest",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-for-vitest",
      PREMIUM_PASSWORD_ENCRYPTION_KEY: "test-encryption-key-32chars-minimum!!",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/supabase/**",
        "src/lib/mock-data/**",
        "**/*.d.ts",
        "**/*.test.ts",
      ],
    },
  }),
};

export default vitestConfig;
