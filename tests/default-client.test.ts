import { afterEach, describe, expect, it, vi } from "vitest";

import type * as OpenAIModule from "openai";

import { validateEmail } from "../src/index.js";
import { makeResponse } from "./helpers/fake-client.js";

// Replace the OpenAI constructor so the default client path can be exercised
// without a network. Everything else exported by the SDK (the error classes in
// particular) stays real.
const mocks = vi.hoisted(() => ({
  constructorArgs: [] as unknown[],
  create: vi.fn(),
}));

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenAIModule>();

  class FakeOpenAI {
    responses = { create: mocks.create };

    constructor(options: unknown) {
      mocks.constructorArgs.push(options);
    }
  }

  return { ...actual, default: FakeOpenAI };
});

afterEach(() => {
  mocks.constructorArgs.length = 0;
  mocks.create.mockReset();
  vi.unstubAllEnvs();
});

describe("default client", () => {
  it("is built from OPENAI_API_KEY when no client is given", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-from-env");
    mocks.create.mockResolvedValue(makeResponse());

    const result = await validateEmail("john@example.com");

    expect(result.valid).toBe(true);
    expect(mocks.constructorArgs).toEqual([{ apiKey: "sk-from-env" }]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("prefers an explicit apiKey over the environment", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-from-env");
    mocks.create.mockResolvedValue(makeResponse());

    await validateEmail("john@example.com", { apiKey: "sk-from-options" });

    expect(mocks.constructorArgs).toEqual([{ apiKey: "sk-from-options" }]);
  });

  it("is not constructed when a client is supplied", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-from-env");
    const client = { responses: { create: vi.fn().mockResolvedValue(makeResponse()) } };

    await validateEmail("john@example.com", { client, apiKey: "sk-ignored" });

    expect(mocks.constructorArgs).toEqual([]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(client.responses.create).toHaveBeenCalledTimes(1);
  });

  it("passes the request parameters and options through unchanged", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-from-env");
    mocks.create.mockResolvedValue(makeResponse());
    const controller = new AbortController();

    await validateEmail("john@example.com", { signal: controller.signal, timeoutMs: 1_000 });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5.6-sol", reasoning: { effort: "max" } }),
      { signal: controller.signal, timeout: 1_000 },
    );
  });
});
