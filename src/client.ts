import OpenAI from "openai";
import { type ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { ConfigurationError } from "./errors.js";

/** Per-request options forwarded to the client. */
export interface EmailValidationRequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  maxRetries?: number;
}

/**
 * The subset of an OpenAI Responses API response that the library reads.
 *
 * The real `Response` type from the SDK satisfies this interface. Keeping our
 * own, narrower definition means a test double only has to supply the fields
 * that matter.
 */
export interface EmailValidationResponse {
  id: string;
  model: string;
  status?: string | undefined;
  output_text: string;
  output: readonly EmailValidationOutputItem[];
  error?: { code: string; message: string } | null | undefined;
  incomplete_details?: { reason?: string | undefined } | null | undefined;
  usage?:
    | {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        output_tokens_details?: { reasoning_tokens: number } | undefined;
      }
    | undefined;
}

/** A single item in the `output` array of a response. */
export interface EmailValidationOutputItem {
  type: string;
  content?: readonly EmailValidationOutputContent[] | string | null | undefined;
}

/** A single content part inside an output message. */
export interface EmailValidationOutputContent {
  type: string;
  text?: string | undefined;
  refusal?: string | undefined;
}

/**
 * Anything that can perform a Responses API call.
 *
 * An `OpenAI` instance satisfies this. So does a hand-written fake, which is
 * how the test suite avoids spending real tokens.
 */
export interface EmailValidationClient {
  responses: {
    create(
      params: ResponseCreateParamsNonStreaming,
      options?: EmailValidationRequestOptions,
    ): Promise<EmailValidationResponse>;
  };
}

// One default client per API key. Constructing an OpenAI instance is cheap,
// but not free, and a validator that is called in a loop should not build a
// new one every time.
const defaultClients = new Map<string, EmailValidationClient>();

/**
 * Returns the default client for an explicit key or `OPENAI_API_KEY`,
 * creating it on first use.
 *
 * @throws {ConfigurationError} when no key is available.
 */
export function getDefaultClient(apiKey?: string): EmailValidationClient {
  const resolvedKey = apiKey ?? process.env["OPENAI_API_KEY"];

  if (resolvedKey === undefined || resolvedKey.trim().length === 0) {
    throw new ConfigurationError(
      "No OpenAI API key found. Set the OPENAI_API_KEY environment variable or pass `apiKey` in the options.",
    );
  }

  let client = defaultClients.get(resolvedKey);
  if (client === undefined) {
    client = new OpenAI({ apiKey: resolvedKey });
    defaultClients.set(resolvedKey, client);
  }
  return client;
}

/** Drops cached default clients. Intended for tests. */
export function resetDefaultClients(): void {
  defaultClients.clear();
}
