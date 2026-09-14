import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests must never reach the network. Every OpenAI call is replaced by a
    // fake client (see tests/helpers/fake-client.ts). A real key in the shell
    // is scrubbed so an accidental default-client path fails loudly instead of
    // quietly spending tokens.
    env: {
      OPENAI_API_KEY: "",
      AI_EMAIL_VALIDATOR_MODEL: "",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
