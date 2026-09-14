import { describe, expect, it } from "vitest";

import { isValidEmail } from "../src/index.js";
import { createFakeClient, verdictResponse } from "./helpers/fake-client.js";

describe("isValidEmail", () => {
  it("returns true when the model says the address is valid", async () => {
    const { client } = createFakeClient(verdictResponse(true));

    await expect(isValidEmail("john@example.com", { client })).resolves.toBe(true);
  });

  it("returns false when the model says the address is invalid", async () => {
    const { client } = createFakeClient(verdictResponse(false));

    await expect(isValidEmail("definitely not an email", { client })).resolves.toBe(false);
  });

  it("returns a boolean and nothing else", async () => {
    const { client } = createFakeClient(verdictResponse(true));

    const result = await isValidEmail("john@example.com", { client });

    expect(typeof result).toBe("boolean");
  });

  it("makes exactly one API call per invocation", async () => {
    const { client, calls } = createFakeClient(verdictResponse(true));

    await isValidEmail("john@example.com", { client });
    await isValidEmail("jane@example.com", { client });

    expect(calls).toHaveLength(2);
  });

  it("forwards options to the underlying request", async () => {
    const { client, calls } = createFakeClient(verdictResponse(true));

    await isValidEmail("john@example.com", {
      client,
      model: "gpt-5.6-luna",
      reasoningEffort: "low",
    });

    expect(calls[0]?.params.model).toBe("gpt-5.6-luna");
    expect(calls[0]?.params.reasoning).toEqual({ effort: "low" });
  });
});
