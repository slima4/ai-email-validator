# ai-email-validator

**Email validation was a solved problem. So we unsolved it with AI.**

[![npm version](https://img.shields.io/npm/v/ai-email-validator.svg)](https://www.npmjs.com/package/ai-email-validator)
[![npm downloads](https://img.shields.io/npm/dm/ai-email-validator.svg)](https://www.npmjs.com/package/ai-email-validator)
[![CI](https://github.com/slima4/ai-email-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/slima4/ai-email-validator/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/ai-email-validator.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/npm/types/ai-email-validator.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/npm/l/ai-email-validator.svg)](./LICENSE)

`ai-email-validator` decides whether a string is a valid email address by asking a large language model. Each call sends the address to OpenAI's GPT-6 Astra at maximum reasoning effort, requires a strictly typed `{ "valid": boolean }` response through Structured Outputs, and resolves to a boolean.

It is small, fully typed, thoroughly tested, and several orders of magnitude slower than the alternative.

> **Disclaimer.** This project is partly satire. It works, and it is built the way a serious library should be built, but for normal applications you should almost always prefer deterministic syntax validation followed by actually sending the person an email. A regular expression costs nothing and answers in nanoseconds. This library costs money and answers in seconds, after thinking about it very hard.

## Why?

Because regex was too fast, too cheap, and too deterministic.

More seriously: this repository is a compact, production-shaped example of calling the OpenAI Responses API from TypeScript with Structured Outputs, strict runtime verification, useful error types, and a test suite that never touches the network. The problem it solves is deliberately trivial so that the plumbing is the point.

## Installation

```sh
npm install ai-email-validator
```

Requires Node.js 20 or later and an OpenAI API key.

## Quick start

```ts
import { isValidEmail } from "ai-email-validator";

const valid = await isValidEmail("john@example.com");
// true (eventually)
```

Set `OPENAI_API_KEY` in your environment and that is the whole integration.

## Configuration

The library reads two environment variables:

| Variable                   | Required | Description                                     |
| -------------------------- | -------- | ----------------------------------------------- |
| `OPENAI_API_KEY`           | Yes      | Your OpenAI API key.                            |
| `AI_EMAIL_VALIDATOR_MODEL` | No       | Overrides the model. Defaults to `gpt-6-astra`. |

Everything can also be set per call through the options object. Options take precedence over environment variables. See [`.env.example`](./.env.example).

The OpenAI SDK's own environment variables (`OPENAI_BASE_URL`, `OPENAI_ORG_ID`, and so on) are honoured by the default client.

## API reference

The public surface is two functions, a handful of error classes, and their types.

### `isValidEmail(email, options?)`

```ts
function isValidEmail(email: string, options?: ValidateEmailOptions): Promise<boolean>;
```

Resolves to `true` if the model judges `email` to be a syntactically valid address, `false` otherwise. This is the simple API and the one most callers want.

### `validateEmail(email, options?)`

```ts
function validateEmail(
  email: string,
  options?: ValidateEmailOptions,
): Promise<EmailValidationResult>;
```

The advanced API. Resolves to the full result:

```ts
interface EmailValidationResult {
  valid: boolean; // the verdict
  email: string; // the address, with surrounding whitespace removed
  model: string; // the model that answered, as reported by the API
  responseId: string; // OpenAI response ID, for tracing
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number; // tokens spent deciding whether there is an "@"
    totalTokens: number;
  };
}
```

### `ValidateEmailOptions`

Every option is optional.

| Option            | Type                    | Default                      | Description                                                                      |
| ----------------- | ----------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `apiKey`          | `string`                | `process.env.OPENAI_API_KEY` | API key for the default client. Ignored when `client` is set.                    |
| `model`           | `string`                | `"gpt-6-astra"`              | Model ID. Also settable through `AI_EMAIL_VALIDATOR_MODEL`.                      |
| `reasoningEffort` | `ReasoningEffort`       | `"max"`                      | One of `"none"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`. |
| `timeoutMs`       | `number`                | SDK default (10 minutes)     | Per-request timeout in milliseconds.                                             |
| `maxRetries`      | `number`                | SDK default (2)              | Retries for connection errors, 408, 409, 429 and 5xx responses.                  |
| `signal`          | `AbortSignal`           | –                            | Cancels the request. Surfaces as an `ApiError`.                                  |
| `client`          | `EmailValidationClient` | a new `OpenAI` instance      | Bring your own client: a configured `OpenAI`, a proxy, or a fake for tests.      |

### Errors

All errors extend `AiEmailValidatorError`, which extends `Error`. Catch the base class to handle everything, or a subclass to handle one failure mode.

| Class                   | When                                                                                                              | Notable fields                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `InvalidInputError`     | The input is not a string, is empty, exceeds 254 characters, or contains control characters. No API call is made. | `input`                                |
| `ConfigurationError`    | No API key is available, or an option such as `model`, `timeoutMs` or `maxRetries` is invalid.                    | –                                      |
| `ApiError`              | The OpenAI request failed: network, authentication, rate limit, server error, timeout, or abort.                  | `status`, `code`, `requestId`, `cause` |
| `StructuredOutputError` | The model did not return exactly `{ "valid": boolean }`, refused, or the response was incomplete.                 | `reason`, `rawOutput`                  |

`StructuredOutputError.reason` is one of `"empty"`, `"refusal"`, `"incomplete"`, `"malformed_json"`, or `"schema_mismatch"`.

### Constants

`DEFAULT_MODEL`, `DEFAULT_REASONING_EFFORT`, and `MAX_EMAIL_LENGTH` are exported for callers who want to reference the defaults rather than repeat them.

## Examples

### Handling errors

```ts
import {
  ApiError,
  InvalidInputError,
  StructuredOutputError,
  validateEmail,
} from "ai-email-validator";

try {
  const result = await validateEmail(userInput);
  console.log(result.valid, result.usage?.totalTokens);
} catch (error) {
  if (error instanceof InvalidInputError) {
    // Not even a string. Nothing was sent anywhere.
  } else if (error instanceof ApiError && error.status === 429) {
    // Rate limited. Perhaps validate fewer emails, or the same one less often.
  } else if (error instanceof StructuredOutputError) {
    // The model produced something other than { "valid": boolean }.
    console.error(error.reason, error.rawOutput);
  } else {
    throw error;
  }
}
```

### Tuning timeouts and retries

```ts
const valid = await isValidEmail("john@example.com", {
  timeoutMs: 60_000, // give up after a minute
  maxRetries: 0, // and do not try again
});
```

The OpenAI SDK retries connection errors, 408, 409, 429 and 5xx responses with exponential backoff. `maxRetries` caps that; `timeoutMs` applies to each attempt.

### Cancelling a slow validation

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const valid = await isValidEmail("john@example.com", { signal: controller.signal });
```

### Using a pre-configured client

```ts
import OpenAI from "openai";
import { isValidEmail } from "ai-email-validator";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://gateway.example.internal/v1",
  maxRetries: 5,
});

const valid = await isValidEmail("john@example.com", { client });
```

Anything with a compatible `responses.create` method satisfies `EmailValidationClient`, which is also how the test suite avoids spending real tokens. When no `client` is given, the library builds one `OpenAI` instance per API key and reuses it across calls.

### Lowering the reasoning effort

```ts
const valid = await isValidEmail("john@example.com", { reasoningEffort: "low" });
```

Supported, but not recommended. The address deserves your full attention.

A runnable version of the basics lives in [`examples/basic.mjs`](./examples/basic.mjs).

## How it works

1. The input is checked locally: it must be a string, non-empty after trimming, at most 254 characters (RFC 5321), and free of control characters. This is the only deterministic validation in the library, and it exists to guard the API call, not to judge the address.
2. A request is sent to the OpenAI Responses API with instructions describing RFC 5321/5322 syntax, `reasoning.effort` set to `max`, `store` set to `false`, and a strict JSON schema of `{ "valid": boolean }`.
3. The response is checked for API-level errors, an incomplete status, and refusals. The text output is then parsed as JSON and verified to be exactly one boolean `valid` key. Natural language is never interpreted; if the output is anything else, a `StructuredOutputError` is thrown.
4. The verdict is returned.

The repository contains exactly one regular expression. It rejects control characters and has no opinion about email addresses.

## Testing

```sh
npm test
```

The suite runs under [Vitest](https://vitest.dev) and never contacts OpenAI. Every call goes through a fake client (`tests/helpers/fake-client.ts`) that returns canned Responses API payloads, and `OPENAI_API_KEY` is blanked for the whole run so an accidental real request fails loudly instead of quietly. Coverage is enforced at 90% and currently sits at 100%.

Other useful scripts:

| Script                  | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run build`         | Bundles ESM, CJS and type declarations to `dist/`. |
| `npm run typecheck`     | `tsc --noEmit` over sources and tests.             |
| `npm run lint`          | ESLint with type-aware rules.                      |
| `npm run format`        | Prettier, in place.                                |
| `npm run test:coverage` | Tests with a V8 coverage report.                   |

## Contributing

Contributions are welcome, within reason. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for the expectations.

Ideas that fit the project: better prompts, better error reporting, support for additional providers behind the same `EmailValidationClient` interface. Ideas that do not fit the project: adding a regular expression.

## Security

- Releases are published from GitHub Actions through npm trusted publishing with [provenance attestations](https://docs.npmjs.com/generating-provenance-statements). No long-lived npm token exists for this package. You can verify a downloaded version with `npm audit signatures`.
- Your API key is read from the environment or the `apiKey` option and passed straight to the OpenAI SDK. It is never logged.
- Requests are sent with `store: false`, so OpenAI does not retain them beyond normal abuse monitoring.
- The address you validate is sent to a third party. Do not use this library on data you are not allowed to share with OpenAI.
- Inputs are treated as untrusted. Control characters are rejected before the request, the address is fenced inside the prompt, and the model is instructed to ignore any instructions it contains. Structured Outputs guarantee the response shape, but a sufficiently creative input could still influence the verdict. Do not use the verdict as a security control.

To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 Artem

## Contributors

Thanks to everyone who has helped make email validation slower.

<!-- CONTRIBUTORS:START -->

<a href="https://github.com/slima4/ai-email-validator/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=slima4/ai-email-validator" alt="Contributors" />
</a>

<!-- CONTRIBUTORS:END -->
