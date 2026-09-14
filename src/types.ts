import { type EmailValidationClient } from "./client.js";

/**
 * How hard the model should think about whether a string is an email address.
 *
 * Mirrors the OpenAI `reasoning.effort` parameter. Defaults to `"max"`,
 * because anything less would be irresponsible.
 */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Options accepted by {@link validateEmail} and {@link isValidEmail}.
 *
 * Every option is optional. With no options, the library reads
 * `OPENAI_API_KEY` from the environment and uses the defaults.
 */
export interface ValidateEmailOptions {
  /**
   * OpenAI API key. Defaults to `process.env.OPENAI_API_KEY`.
   *
   * Ignored when `client` is provided.
   */
  apiKey?: string;

  /**
   * Model to use. Defaults to `process.env.AI_EMAIL_VALIDATOR_MODEL`, then to
   * {@link DEFAULT_MODEL}.
   */
  model?: string;

  /** Reasoning effort. Defaults to {@link DEFAULT_REASONING_EFFORT}. */
  reasoningEffort?: ReasoningEffort;

  /**
   * Request timeout in milliseconds. Defaults to the OpenAI SDK default
   * (currently ten minutes, which at max reasoning effort is not a joke).
   */
  timeoutMs?: number;

  /**
   * How many times to retry a failed request (connection errors, 408, 409,
   * 429 and 5xx) before giving up. Defaults to the OpenAI SDK default of 2.
   */
  maxRetries?: number;

  /** Abort the request early. The rejection is surfaced as an {@link ApiError}. */
  signal?: AbortSignal;

  /**
   * Bring your own client.
   *
   * Anything with a compatible `responses.create` method works: a configured
   * `OpenAI` instance (custom base URL, custom fetch, retries), a proxy, or a
   * fake for tests. When set, `apiKey` is ignored.
   */
  client?: EmailValidationClient;
}

/** Token accounting for a single validation. */
export interface EmailValidationUsage {
  /** Tokens in the prompt. */
  inputTokens: number;
  /** Tokens in the answer, including reasoning. */
  outputTokens: number;
  /** Tokens spent reasoning about whether a string contains an `@`. */
  reasoningTokens: number;
  /** Total tokens billed. */
  totalTokens: number;
}

/** Result of {@link validateEmail}. */
export interface EmailValidationResult {
  /** The model's verdict. */
  valid: boolean;

  /** The email address that was validated, with surrounding whitespace removed. */
  email: string;

  /** The model that produced the verdict, as reported by the API. */
  model: string;

  /** OpenAI response ID, useful for tracing and support. */
  responseId: string;

  /** Token usage, when the API reported it. */
  usage?: EmailValidationUsage;
}

/** Default model. Override with `AI_EMAIL_VALIDATOR_MODEL` or the `model` option. */
export const DEFAULT_MODEL = "gpt-5.6-sol";

/** Default reasoning effort. */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "max";

/**
 * Maximum accepted input length in characters.
 *
 * RFC 5321 limits a forward-path to 256 octets including the angle brackets,
 * which leaves 254 for the address itself. Longer inputs are rejected before
 * any API call, partly out of respect for the RFC and partly so nobody can
 * make us reason about a novel.
 */
export const MAX_EMAIL_LENGTH = 254;
