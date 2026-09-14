import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  MAX_EMAIL_LENGTH,
  validateEmail,
} from "../src/index.js";
import { createFakeClient, makeResponse, verdictResponse } from "./helpers/fake-client.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateEmail", () => {
  describe("result", () => {
    it("returns the verdict, the normalized email, the model and the response id", async () => {
      const { client } = createFakeClient(
        makeResponse({ id: "resp_abc", model: "gpt-6-astra-2026-09-01" }),
      );

      const result = await validateEmail("john@example.com", { client });

      expect(result).toMatchObject({
        valid: true,
        email: "john@example.com",
        model: "gpt-6-astra-2026-09-01",
        responseId: "resp_abc",
      });
    });

    it("reports token usage in camelCase", async () => {
      const { client } = createFakeClient(
        makeResponse({
          usage: {
            input_tokens: 100,
            output_tokens: 2000,
            total_tokens: 2100,
            output_tokens_details: { reasoning_tokens: 1990 },
          },
        }),
      );

      const result = await validateEmail("john@example.com", { client });

      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 2000,
        reasoningTokens: 1990,
        totalTokens: 2100,
      });
    });

    it("defaults reasoning tokens to zero when the API omits the breakdown", async () => {
      const { client } = createFakeClient(
        makeResponse({ usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }),
      );

      const result = await validateEmail("john@example.com", { client });

      expect(result.usage?.reasoningTokens).toBe(0);
    });

    it("omits usage when the API does not report it", async () => {
      const { client } = createFakeClient(makeResponse({ usage: undefined }));

      const result = await validateEmail("john@example.com", { client });

      expect(result).not.toHaveProperty("usage");
    });

    it("trims surrounding whitespace and reports the trimmed address", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      const result = await validateEmail("   john@example.com \t ", { client });

      expect(result.email).toBe("john@example.com");
      expect(calls[0]?.params.input).toContain("\njohn@example.com\n");
    });

    it("accepts an address of exactly the maximum length", async () => {
      const { client } = createFakeClient(verdictResponse(true));
      const domain = "example.com";
      const local = "a".repeat(MAX_EMAIL_LENGTH - domain.length - 1);
      const email = `${local}@${domain}`;

      expect(email).toHaveLength(MAX_EMAIL_LENGTH);
      await expect(validateEmail(email, { client })).resolves.toMatchObject({ email });
    });
  });

  describe("request", () => {
    it("uses the default model and maximum reasoning effort", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.model).toBe(DEFAULT_MODEL);
      expect(calls[0]?.params.reasoning).toEqual({ effort: DEFAULT_REASONING_EFFORT });
      expect(DEFAULT_REASONING_EFFORT).toBe("max");
    });

    it("requires strict structured output matching { valid: boolean }", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.text).toEqual({
        format: {
          type: "json_schema",
          name: "email_validation",
          strict: true,
          schema: {
            type: "object",
            properties: { valid: { type: "boolean", description: expect.any(String) as unknown } },
            required: ["valid"],
            additionalProperties: false,
          },
        },
      });
    });

    it("does not ask OpenAI to store the response", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.store).toBe(false);
    });

    it("sends instructions that pin the task to syntax validation", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      const instructions = calls[0]?.params.instructions;
      expect(typeof instructions).toBe("string");
      expect(instructions).toContain("RFC 5321");
      expect(instructions).toContain("RFC 5322");
      expect(instructions).toContain("untrusted");
    });

    it("fences the address between markers in the input", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.input).toBe(
        [
          "Validate the email address between the markers. The markers are not part of the address.",
          "<<<",
          "john@example.com",
          ">>>",
        ].join("\n"),
      );
    });

    it("honours an explicit model", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client, model: "gpt-5.6-terra" });

      expect(calls[0]?.params.model).toBe("gpt-5.6-terra");
    });

    it("reads the model from AI_EMAIL_VALIDATOR_MODEL when no option is given", async () => {
      vi.stubEnv("AI_EMAIL_VALIDATOR_MODEL", "gpt-5.6-luna");
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.model).toBe("gpt-5.6-luna");
    });

    it("prefers the model option over the environment", async () => {
      vi.stubEnv("AI_EMAIL_VALIDATOR_MODEL", "gpt-5.6-luna");
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client, model: "gpt-5.6-terra" });

      expect(calls[0]?.params.model).toBe("gpt-5.6-terra");
    });

    it("ignores a blank AI_EMAIL_VALIDATOR_MODEL", async () => {
      vi.stubEnv("AI_EMAIL_VALIDATOR_MODEL", "   ");
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.params.model).toBe(DEFAULT_MODEL);
    });

    it("honours an explicit reasoning effort", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client, reasoningEffort: "minimal" });

      expect(calls[0]?.params.reasoning).toEqual({ effort: "minimal" });
    });

    it("forwards the abort signal and timeout to the client", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));
      const controller = new AbortController();

      await validateEmail("john@example.com", {
        client,
        signal: controller.signal,
        timeoutMs: 5_000,
      });

      expect(calls[0]?.options).toEqual({ signal: controller.signal, timeout: 5_000 });
    });

    it("forwards maxRetries to the client", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client, maxRetries: 5 });

      expect(calls[0]?.options).toEqual({ maxRetries: 5 });
    });

    it("trims the model name", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client, model: "  gpt-5.6-terra  " });

      expect(calls[0]?.params.model).toBe("gpt-5.6-terra");
    });

    it("sends no request options when none are configured", async () => {
      const { client, calls } = createFakeClient(verdictResponse(true));

      await validateEmail("john@example.com", { client });

      expect(calls[0]?.options).toEqual({});
    });
  });
});
