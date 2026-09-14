import { type ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import {
  type EmailValidationClient,
  type EmailValidationRequestOptions,
  type EmailValidationResponse,
} from "../../src/client.js";

/** One recorded `responses.create` invocation. */
export interface RecordedCall {
  params: ResponseCreateParamsNonStreaming;
  options: EmailValidationRequestOptions | undefined;
}

/** A fake client plus the calls it has received. */
export interface FakeClient {
  client: EmailValidationClient;
  calls: RecordedCall[];
}

type Handler = (
  params: ResponseCreateParamsNonStreaming,
  options: EmailValidationRequestOptions | undefined,
) => Promise<EmailValidationResponse>;

/**
 * Builds a complete-looking Responses API response with sensible defaults.
 *
 * `output_text` defaults to a valid verdict; pass `output_text` (or any other
 * field) to override.
 */
export function makeResponse(
  overrides: Partial<EmailValidationResponse> = {},
): EmailValidationResponse {
  const outputText = overrides.output_text ?? JSON.stringify({ valid: true });

  return {
    id: "resp_test_0001",
    model: "gpt-5.6-sol",
    status: "completed",
    output_text: outputText,
    output: [
      { type: "reasoning" },
      { type: "message", content: [{ type: "output_text", text: outputText }] },
    ],
    error: null,
    incomplete_details: null,
    usage: {
      input_tokens: 120,
      output_tokens: 900,
      total_tokens: 1020,
      output_tokens_details: { reasoning_tokens: 890 },
    },
    ...overrides,
  };
}

/** A response whose verdict is exactly `{ valid }`. */
export function verdictResponse(valid: boolean): EmailValidationResponse {
  return makeResponse({ output_text: JSON.stringify({ valid }) });
}

/**
 * Creates a client that never touches the network.
 *
 * Pass a response to resolve with it, an error to reject with it, or a
 * handler for anything more elaborate.
 */
export function createFakeClient(
  behaviour: EmailValidationResponse | Error | Handler = verdictResponse(true),
): FakeClient {
  const calls: RecordedCall[] = [];

  const handler: Handler =
    typeof behaviour === "function"
      ? behaviour
      : behaviour instanceof Error
        ? () => Promise.reject(behaviour)
        : () => Promise.resolve(behaviour);

  const client: EmailValidationClient = {
    responses: {
      create(params, options) {
        calls.push({ params, options });
        return handler(params, options);
      },
    },
  };

  return { client, calls };
}
