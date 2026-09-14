import { StructuredOutputError } from "./errors.js";

/** Name of the JSON schema sent to the API. */
export const EMAIL_VALIDATION_SCHEMA_NAME = "email_validation";

/**
 * The JSON schema the model must conform to.
 *
 * `strict: true` on the request makes the API guarantee this shape. We verify
 * it anyway, because "guarantee" is a strong word and `valid` is a boolean
 * that people will put in an `if`.
 */
export const EMAIL_VALIDATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    valid: {
      type: "boolean",
      description: "true if the input is a syntactically valid email address, otherwise false.",
    },
  },
  required: ["valid"],
  additionalProperties: false,
} as const;

/** The verdict object produced by the model. */
export interface EmailValidationVerdict {
  valid: boolean;
}

/**
 * Parses the model's text output as the verdict object.
 *
 * Accepts exactly `{ "valid": boolean }`. Anything else, including extra
 * keys, a non-boolean `valid`, or prose wrapped around the JSON, is rejected.
 * Natural language is never interpreted.
 *
 * @throws {StructuredOutputError} when the output is not the expected shape.
 */
export function parseVerdict(rawOutput: string): EmailValidationVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (error) {
    throw new StructuredOutputError("Model output is not valid JSON.", {
      reason: "malformed_json",
      rawOutput,
      cause: error,
    });
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StructuredOutputError("Model output is not a JSON object.", {
      reason: "schema_mismatch",
      rawOutput,
    });
  }

  const keys = Object.keys(parsed);
  const valid: unknown = (parsed as Record<string, unknown>)["valid"];

  if (keys.length !== 1 || keys[0] !== "valid" || typeof valid !== "boolean") {
    throw new StructuredOutputError(
      'Model output does not match the schema { "valid": boolean }.',
      {
        reason: "schema_mismatch",
        rawOutput,
      },
    );
  }

  return { valid };
}
