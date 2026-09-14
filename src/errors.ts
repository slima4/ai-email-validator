/**
 * Base class for every error thrown by `ai-email-validator`.
 *
 * Catch this to handle all library errors uniformly, or catch one of the
 * subclasses to handle a specific failure mode.
 */
export class AiEmailValidatorError extends Error {
  override readonly name: string = "AiEmailValidatorError";
}

/**
 * Thrown when the input is rejected before any API call is made.
 *
 * This is the only deterministic validation in the library, and it exists so
 * that we never spend tokens on things that are not even strings.
 */
export class InvalidInputError extends AiEmailValidatorError {
  override readonly name = "InvalidInputError";

  /** The offending input, as received. */
  readonly input: unknown;

  constructor(message: string, input: unknown) {
    super(message);
    this.input = input;
  }
}

/**
 * Thrown when the library cannot be configured, for example when no API key
 * is available.
 */
export class ConfigurationError extends AiEmailValidatorError {
  override readonly name = "ConfigurationError";
}

/**
 * Thrown when the OpenAI API call fails: network errors, authentication
 * failures, rate limits, server errors, timeouts, or aborts.
 *
 * The original error from the OpenAI SDK is available as `cause`.
 */
export class ApiError extends AiEmailValidatorError {
  override readonly name = "ApiError";

  /** HTTP status code, when the failure came from an HTTP response. */
  readonly status: number | undefined;

  /** Machine-readable OpenAI error code, when one was provided. */
  readonly code: string | undefined;

  /** OpenAI request ID, useful when contacting support. */
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: {
      status?: number | undefined;
      code?: string | null | undefined;
      requestId?: string | null | undefined;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.status = options.status;
    this.code = options.code ?? undefined;
    this.requestId = options.requestId ?? undefined;
  }
}

/** Why a model response could not be turned into a verdict. */
export type StructuredOutputFailureReason =
  "empty" | "refusal" | "incomplete" | "malformed_json" | "schema_mismatch";

/**
 * Thrown when the model returned something other than the required
 * `{ "valid": boolean }` object.
 *
 * With Structured Outputs enabled this should be rare, but the library never
 * guesses: if the output is not exactly the schema, it is an error.
 */
export class StructuredOutputError extends AiEmailValidatorError {
  override readonly name = "StructuredOutputError";

  /** Categorises the failure so callers can branch without parsing messages. */
  readonly reason: StructuredOutputFailureReason;

  /** The raw text returned by the model, for logging and debugging. */
  readonly rawOutput: string;

  constructor(
    message: string,
    options: { reason: StructuredOutputFailureReason; rawOutput: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.reason = options.reason;
    this.rawOutput = options.rawOutput;
  }
}
