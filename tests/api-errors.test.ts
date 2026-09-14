import { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";
import { describe, expect, it } from "vitest";

import {
  AiEmailValidatorError,
  ApiError,
  ConfigurationError,
  validateEmail,
} from "../src/index.js";
import { createFakeClient, makeResponse } from "./helpers/fake-client.js";

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

describe("API errors", () => {
  it("wraps HTTP errors from the SDK with status, code and request id", async () => {
    const sdkError = APIError.generate(
      429,
      { error: { message: "Rate limit exceeded", code: "rate_limit_exceeded", type: "requests" } },
      undefined,
      new Headers({ "x-request-id": "req_123" }),
    );
    const { client } = createFakeClient(sdkError);

    const error = await captureError(validateEmail("john@example.com", { client }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(AiEmailValidatorError);
    const apiError = error as ApiError;
    expect(apiError.message).toBe("OpenAI API request failed: 429 Rate limit exceeded");
    expect(apiError.status).toBe(429);
    expect(apiError.code).toBe("rate_limit_exceeded");
    expect(apiError.requestId).toBe("req_123");
    expect(apiError.cause).toBe(sdkError);
  });

  it("wraps authentication failures", async () => {
    const sdkError = APIError.generate(
      401,
      { error: { message: "Incorrect API key provided", code: "invalid_api_key" } },
      undefined,
      new Headers(),
    );
    const { client } = createFakeClient(sdkError);

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.code).toBe("invalid_api_key");
    expect(error.requestId).toBeUndefined();
  });

  it("wraps server errors", async () => {
    const sdkError = APIError.generate(
      503,
      { error: { message: "Overloaded" } },
      undefined,
      new Headers(),
    );
    const { client } = createFakeClient(sdkError);

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error.status).toBe(503);
    expect(error.code).toBeUndefined();
  });

  it("wraps timeouts", async () => {
    const { client } = createFakeClient(new APIConnectionTimeoutError());

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeUndefined();
    expect(error.message).toMatch(/timed out/i);
  });

  it("wraps aborts with a dedicated message", async () => {
    const { client } = createFakeClient(new APIUserAbortError());

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Request was aborted before the model answered.");
    expect(error.cause).toBeInstanceOf(APIUserAbortError);
  });

  it("wraps unknown Error instances thrown by the client", async () => {
    const cause = new TypeError("fetch failed");
    const { client } = createFakeClient(cause);

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Unexpected error while calling the OpenAI API: fetch failed");
    expect(error.cause).toBe(cause);
  });

  it("wraps non-Error values thrown by the client", async () => {
    // Rejecting with a non-Error is the point of this test.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const { client } = createFakeClient(() => Promise.reject("nope"));

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Unexpected error while calling the OpenAI API: nope");
    expect(error.cause).toBe("nope");
  });

  it("surfaces a failed response reported in the body as an ApiError", async () => {
    const { client } = createFakeClient(
      makeResponse({
        status: "failed",
        output_text: "",
        output: [],
        error: { code: "server_error", message: "The model failed to generate a response." },
      }),
    );

    const error = (await captureError(validateEmail("john@example.com", { client }))) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("server_error");
    expect(error.message).toBe(
      "OpenAI reported a failed response: The model failed to generate a response.",
    );
  });
});

describe("configuration errors", () => {
  it("throws a ConfigurationError when no API key is available", async () => {
    // vitest.config.ts blanks OPENAI_API_KEY for the whole suite.
    const error = await captureError(validateEmail("john@example.com"));

    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toMatch(/OPENAI_API_KEY/);
  });

  it("throws a ConfigurationError when the API key is blank", async () => {
    await expect(validateEmail("john@example.com", { apiKey: "   " })).rejects.toThrow(
      ConfigurationError,
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects timeoutMs = %s with a ConfigurationError",
    async (timeoutMs) => {
      const { client, calls } = createFakeClient();

      await expect(validateEmail("john@example.com", { client, timeoutMs })).rejects.toThrow(
        ConfigurationError,
      );
      expect(calls).toHaveLength(0);
    },
  );
});
