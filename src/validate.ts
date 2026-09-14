import { APIError, APIUserAbortError } from "openai";
import { type ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  type EmailValidationRequestOptions,
  type EmailValidationResponse,
  createDefaultClient,
} from "./client.js";
import { ApiError, ConfigurationError, StructuredOutputError } from "./errors.js";
import { assertEmailInput } from "./input.js";
import { INSTRUCTIONS, buildInput } from "./prompt.js";
import {
  EMAIL_VALIDATION_JSON_SCHEMA,
  EMAIL_VALIDATION_SCHEMA_NAME,
  type EmailValidationVerdict,
  parseVerdict,
} from "./schema.js";
import {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  type EmailValidationResult,
  type EmailValidationUsage,
  type ReasoningEffort,
  type ValidateEmailOptions,
} from "./types.js";

/**
 * Asks a language model whether `email` is a valid email address and returns
 * the full result.
 *
 * @example
 * ```ts
 * const result = await validateEmail("john@example.com");
 * // { valid: true, email: "john@example.com", model: "gpt-5.6-sol", responseId: "resp_…", usage: { … } }
 * ```
 *
 * @throws {InvalidInputError} if `email` is not a usable string. No API call is made.
 * @throws {ConfigurationError} if no API key is available.
 * @throws {ApiError} if the OpenAI API call fails.
 * @throws {StructuredOutputError} if the model does not return `{ "valid": boolean }`.
 */
export async function validateEmail(
  email: string,
  options: ValidateEmailOptions = {},
): Promise<EmailValidationResult> {
  const normalizedEmail = assertEmailInput(email);
  const client = options.client ?? createDefaultClient(options.apiKey);
  const model = options.model ?? modelFromEnvironment() ?? DEFAULT_MODEL;
  const reasoningEffort = options.reasoningEffort ?? DEFAULT_REASONING_EFFORT;

  const params = buildRequestParams(normalizedEmail, model, reasoningEffort);
  const requestOptions = buildRequestOptions(options);

  let response: EmailValidationResponse;
  try {
    response = await client.responses.create(params, requestOptions);
  } catch (error) {
    throw toApiError(error);
  }

  const verdict = extractVerdict(response);

  const result: EmailValidationResult = {
    valid: verdict.valid,
    email: normalizedEmail,
    model: response.model,
    responseId: response.id,
  };

  const usage = toUsage(response.usage);
  if (usage !== undefined) {
    result.usage = usage;
  }

  return result;
}

/**
 * Asks a language model whether `email` is a valid email address.
 *
 * This is the simple API. It is {@link validateEmail} with everything but the
 * verdict removed.
 *
 * @example
 * ```ts
 * const valid = await isValidEmail("john@example.com"); // true
 * ```
 *
 * @throws See {@link validateEmail}.
 */
export async function isValidEmail(
  email: string,
  options?: ValidateEmailOptions,
): Promise<boolean> {
  const result = await validateEmail(email, options);
  return result.valid;
}

function buildRequestParams(
  email: string,
  model: string,
  reasoningEffort: ReasoningEffort,
): ResponseCreateParamsNonStreaming {
  return {
    model,
    instructions: INSTRUCTIONS,
    input: buildInput(email),
    reasoning: { effort: reasoningEffort },
    text: {
      format: {
        type: "json_schema",
        name: EMAIL_VALIDATION_SCHEMA_NAME,
        schema: EMAIL_VALIDATION_JSON_SCHEMA,
        strict: true,
      },
    },
    // Nobody needs a permanent record of this.
    store: false,
  };
}

function buildRequestOptions(options: ValidateEmailOptions): EmailValidationRequestOptions {
  const requestOptions: EmailValidationRequestOptions = {};

  if (options.signal !== undefined) {
    requestOptions.signal = options.signal;
  }

  if (options.timeoutMs !== undefined) {
    if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new ConfigurationError(
        `timeoutMs must be a positive number of milliseconds, received ${String(options.timeoutMs)}.`,
      );
    }
    requestOptions.timeout = options.timeoutMs;
  }

  return requestOptions;
}

function modelFromEnvironment(): string | undefined {
  const model = process.env["AI_EMAIL_VALIDATOR_MODEL"]?.trim();
  return model === undefined || model.length === 0 ? undefined : model;
}

function extractVerdict(response: EmailValidationResponse): EmailValidationVerdict {
  if (response.error) {
    throw new ApiError(`OpenAI reported a failed response: ${response.error.message}`, {
      code: response.error.code,
    });
  }

  if (response.status !== undefined && response.status !== "completed") {
    const detail = response.incomplete_details?.reason;
    throw new StructuredOutputError(
      `Model response finished with status "${response.status}"${detail === undefined ? "" : ` (${detail})`}.`,
      { reason: "incomplete", rawOutput: response.output_text },
    );
  }

  const refusal = findRefusal(response);
  if (refusal !== undefined) {
    throw new StructuredOutputError(`Model refused to validate the input: ${refusal}`, {
      reason: "refusal",
      rawOutput: response.output_text,
    });
  }

  if (response.output_text.trim().length === 0) {
    throw new StructuredOutputError("Model returned no text output.", {
      reason: "empty",
      rawOutput: response.output_text,
    });
  }

  return parseVerdict(response.output_text);
}

function findRefusal(response: EmailValidationResponse): string | undefined {
  for (const item of response.output) {
    const content = item.content;
    if (item.type !== "message" || typeof content !== "object" || content === null) {
      continue;
    }
    for (const part of content) {
      if (part.type === "refusal") {
        return part.refusal ?? "(no reason given)";
      }
    }
  }
  return undefined;
}

function toUsage(usage: EmailValidationResponse["usage"]): EmailValidationUsage | undefined {
  if (usage === undefined) {
    return undefined;
  }
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage.total_tokens,
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof APIUserAbortError) {
    return new ApiError("Request was aborted before the model answered.", { cause: error });
  }

  if (error instanceof APIError) {
    // `instanceof` erases the generic parameters, so narrow the status by hand.
    const status: number | undefined = typeof error.status === "number" ? error.status : undefined;
    return new ApiError(`OpenAI API request failed: ${error.message}`, {
      status,
      code: error.code,
      requestId: error.requestID,
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(`Unexpected error while calling the OpenAI API: ${message}`, {
    cause: error,
  });
}
