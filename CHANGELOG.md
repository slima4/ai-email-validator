# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-14

### Changed

- Default model is now `gpt-6-astra`. `gpt-5.6-sol` remains usable through the
  `model` option or `AI_EMAIL_VALIDATOR_MODEL`.

## [1.0.0] - 2026-09-14

The public API (`isValidEmail`, `validateEmail`, the options object, the
result object and the error classes) is now considered stable and follows
semantic versioning.

### Added

- `maxRetries` option, forwarded to the OpenAI SDK's per-request retry limit.
- `npm run check:package`, which verifies the published `exports` map and type
  declarations with `publint` and `@arethetypeswrong/cli`. It also runs in CI
  and before every publish.
- Automated releases: pushing a `v*` tag publishes to npm through trusted
  publishing with provenance and creates a GitHub Release from the matching
  CHANGELOG section.
- Dependabot for npm and GitHub Actions, CODEOWNERS, and a production
  dependency audit in CI.

### Changed

- The default client is now created once per API key and reused across calls.
- `model` is validated and trimmed; an empty or non-string model throws a
  `ConfigurationError` before any request is made.

## [0.1.0] - 2026-09-14

### Added

- `isValidEmail(email, options?)`: resolves to a boolean verdict from the model.
- `validateEmail(email, options?)`: resolves to the full result, including the
  normalized address, the responding model, the response ID and token usage.
- Structured Outputs with a strict `{ "valid": boolean }` JSON schema, verified
  again at runtime. Natural-language output is never interpreted.
- Default model `gpt-5.6-sol` with reasoning effort `max`, both overridable per
  call; the model is also overridable through `AI_EMAIL_VALIDATOR_MODEL`.
- Local input checks before any API call: string type, non-empty after
  trimming, at most 254 characters, no control characters.
- Error classes: `AiEmailValidatorError`, `InvalidInputError`,
  `ConfigurationError`, `ApiError` and `StructuredOutputError`.
- `client` option for supplying a pre-configured OpenAI instance, a proxy or a
  test double; `signal` and `timeoutMs` options for cancellation.
- ESM and CommonJS builds with type declarations.
- Test suite with a fake client, 100% coverage and no network access.
- GitHub Actions CI across Node.js 20, 22 and 24, plus a tag-triggered release
  workflow.

[Unreleased]: https://github.com/slima4/ai-email-validator/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/slima4/ai-email-validator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/slima4/ai-email-validator/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/slima4/ai-email-validator/releases/tag/v0.1.0
