# Security Policy

## Supported versions

Only the latest published minor version receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/slima4/ai-email-validator/security/advisories/new).
Include a description of the issue, steps to reproduce it, and the affected
version. You should receive an acknowledgement within a few days.

## What is in scope

- Leaking the API key through logs, errors or the published bundle.
- Sending data to any destination other than the configured OpenAI endpoint.
- Bypassing the local input checks in a way that causes unexpected requests.
- Flaws in the response handling that could turn malformed model output into a
  `true` verdict.

## What is out of scope

- The model returning an incorrect verdict for a well-formed request. That is
  a quality issue, not a security one, and the README already advises against
  using the verdict as a security control.
- Vulnerabilities in the OpenAI API or SDK. Report those to OpenAI.
