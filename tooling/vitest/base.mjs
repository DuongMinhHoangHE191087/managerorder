export function createVitestNodeConfig(overrides = {}) {
  return {
    test: {
      environment: "node",
      globals: true,
      pool: "threads",
      ...overrides,
    },
  };
}
