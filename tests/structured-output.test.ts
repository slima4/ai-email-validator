import { describe, expect, it } from "vitest";

import { StructuredOutputError, validateEmail } from "../src/index.js";
import { createFakeClient, makeResponse } from "./helpers/fake-client.js";

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

describe("structured output handling", () => {
  describe("accepts", () => {
    it.each([
      ['{"valid":true}', true],
      ['{"valid":false}', false],
      ['  { "valid" : true }  ', true],
      ['{\n  "valid": false\n}', false],
    ])("%s", async (outputText, expected) => {
      const { client } = createFakeClient(makeResponse({ output_text: outputText }));

      await expect(validateEmail("john@example.com", { client })).resolves.toMatchObject({
        valid: expected,
      });
    });
  });

  describe("rejects", () => {
    const CASES: { label: string; outputText: string; reason: StructuredOutputError["reason"] }[] =
      [
        {
          label: "prose",
          outputText: "Yes, that is a valid email address.",
          reason: "malformed_json",
        },
        {
          label: "prose around JSON",
          outputText: 'Sure! {"valid": true}',
          reason: "malformed_json",
        },
        {
          label: "a markdown fence",
          outputText: '```json\n{"valid":true}\n```',
          reason: "malformed_json",
        },
        { label: "truncated JSON", outputText: '{"valid": tr', reason: "malformed_json" },
        { label: "a bare boolean", outputText: "true", reason: "schema_mismatch" },
        { label: "a bare string", outputText: '"valid"', reason: "schema_mismatch" },
        { label: "null", outputText: "null", reason: "schema_mismatch" },
        { label: "an array", outputText: '[{"valid":true}]', reason: "schema_mismatch" },
        { label: "an empty object", outputText: "{}", reason: "schema_mismatch" },
        {
          label: "a string-typed verdict",
          outputText: '{"valid":"true"}',
          reason: "schema_mismatch",
        },
        { label: "a numeric verdict", outputText: '{"valid":1}', reason: "schema_mismatch" },
        { label: "a null verdict", outputText: '{"valid":null}', reason: "schema_mismatch" },
        { label: "a misspelt key", outputText: '{"isValid":true}', reason: "schema_mismatch" },
        {
          label: "extra keys",
          outputText: '{"valid":true,"reason":"looks fine"}',
          reason: "schema_mismatch",
        },
      ];

    it.each(CASES)("$label", async ({ outputText, reason }) => {
      const { client } = createFakeClient(makeResponse({ output_text: outputText }));

      const error = await captureError(validateEmail("john@example.com", { client }));

      expect(error).toBeInstanceOf(StructuredOutputError);
      expect((error as StructuredOutputError).reason).toBe(reason);
      expect((error as StructuredOutputError).rawOutput).toBe(outputText);
    });

    it("keeps the JSON parse error as the cause of a malformed_json failure", async () => {
      const { client } = createFakeClient(makeResponse({ output_text: "not json" }));

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error.cause).toBeInstanceOf(SyntaxError);
    });
  });

  describe("response state", () => {
    it("rejects an empty output", async () => {
      const { client } = createFakeClient(makeResponse({ output_text: "", output: [] }));

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error).toBeInstanceOf(StructuredOutputError);
      expect(error.reason).toBe("empty");
    });

    it("rejects a whitespace-only output", async () => {
      const { client } = createFakeClient(makeResponse({ output_text: "  \n " }));

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error.reason).toBe("empty");
    });

    it("rejects a refusal and includes the model's reason", async () => {
      const { client } = createFakeClient(
        makeResponse({
          output_text: "",
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "I cannot validate this address." }],
            },
          ],
        }),
      );

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error).toBeInstanceOf(StructuredOutputError);
      expect(error.reason).toBe("refusal");
      expect(error.message).toBe(
        "Model refused to validate the input: I cannot validate this address.",
      );
    });

    it("prefers a refusal over any accompanying text", async () => {
      const { client } = createFakeClient(
        makeResponse({
          output_text: '{"valid":true}',
          output: [
            { type: "message", content: [{ type: "refusal" }] },
            { type: "message", content: [{ type: "output_text", text: '{"valid":true}' }] },
          ],
        }),
      );

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error.reason).toBe("refusal");
      expect(error.message).toContain("(no reason given)");
    });

    it("ignores non-message output items and string content when looking for refusals", async () => {
      const { client } = createFakeClient(
        makeResponse({
          output: [
            { type: "reasoning", content: "thinking very hard" },
            { type: "message", content: "plain string content" },
            { type: "message", content: null },
            { type: "message", content: [{ type: "output_text", text: '{"valid":true}' }] },
          ],
        }),
      );

      await expect(validateEmail("john@example.com", { client })).resolves.toMatchObject({
        valid: true,
      });
    });

    it("rejects an incomplete response and reports why", async () => {
      const { client } = createFakeClient(
        makeResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text: "",
        }),
      );

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error).toBeInstanceOf(StructuredOutputError);
      expect(error.reason).toBe("incomplete");
      expect(error.message).toBe(
        'Model response finished with status "incomplete" (max_output_tokens).',
      );
    });

    it("rejects any non-completed status, even without details", async () => {
      const { client } = createFakeClient(makeResponse({ status: "cancelled" }));

      const error = (await captureError(
        validateEmail("john@example.com", { client }),
      )) as StructuredOutputError;

      expect(error.reason).toBe("incomplete");
      expect(error.message).toBe('Model response finished with status "cancelled".');
    });

    it("accepts a response with no status field", async () => {
      const { client } = createFakeClient(makeResponse({ status: undefined }));

      await expect(validateEmail("john@example.com", { client })).resolves.toMatchObject({
        valid: true,
      });
    });
  });
});
