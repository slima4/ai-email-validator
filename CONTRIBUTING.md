# Contributing to ai-email-validator

Thank you for considering a contribution. This project is small on purpose, so most changes are quick to review. The workflow below keeps it that way.

## Before you start

- Check the [open issues](https://github.com/slima4/ai-email-validator/issues) and [pull requests](https://github.com/slima4/ai-email-validator/pulls) to avoid duplicating work.
- For anything larger than a bug fix, open an issue first so the approach can be agreed on before you spend time on it.
- Read the [Code of Conduct](./CODE_OF_CONDUCT.md). Participation in this project means agreeing to it.

## Development setup

You need Node.js 20 or later and npm.

```sh
git clone https://github.com/<your-username>/ai-email-validator.git
cd ai-email-validator
npm install
```

`npm install` also runs the build once (through the `prepare` script), so the `dist/` directory exists from the start.

Useful commands:

| Command                 | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `npm test`              | Run the test suite once.                            |
| `npm run test:watch`    | Run the tests in watch mode while you work.         |
| `npm run test:coverage` | Run the tests with a coverage report.               |
| `npm run typecheck`     | Type-check sources and tests without emitting.      |
| `npm run lint`          | Lint with ESLint. `npm run lint:fix` applies fixes. |
| `npm run format`        | Format everything with Prettier.                    |
| `npm run build`         | Build the package into `dist/`.                     |

No OpenAI API key is needed for any of these. The test suite never contacts the network.

## Making a change

1. **Fork the repository** on GitHub and clone your fork.

2. **Create a branch** from `main` with a descriptive name:

   ```sh
   git checkout -b fix/handle-empty-refusal
   ```

3. **Make your change.** Keep it focused; unrelated refactors belong in their own pull request. Match the surrounding style, which Prettier and ESLint will mostly enforce for you.

4. **Add tests.** Every behaviour change needs a test, and every bug fix needs a test that failed before the fix. Tests live in `tests/` and use the fake client in `tests/helpers/fake-client.ts`. Never add a test that makes a real API call.

5. **Run the checks locally** before pushing:

   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

   CI runs the same commands, so passing locally means passing in CI.

6. **Update the docs** if the public API or behaviour changed: the README, the JSDoc on the affected exports, and the `Unreleased` section of [CHANGELOG.md](./CHANGELOG.md).

7. **Commit** with a clear message that says what changed and why. Conventional prefixes (`fix:`, `feat:`, `docs:`, `test:`, `chore:`) are appreciated but not enforced.

8. **Open a pull request** against `main`. Fill in the template, link any related issue, and describe how you tested the change. Small, well-described pull requests get merged fastest.

## What makes a good contribution here

- Improvements to the prompt that make verdicts more accurate or more consistent, with test cases showing the intent.
- Better error messages and error types.
- Support for additional providers behind the existing `EmailValidationClient` interface.
- Documentation fixes of any size.

## What will be declined

- Adding a regular expression that validates email addresses. That is not what this project is for.
- New runtime dependencies without a strong reason. The package currently depends on the OpenAI SDK and nothing else.
- Changes that make the tests depend on network access or a real API key.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/slima4/ai-email-validator/issues/new/choose). For security issues, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## Releasing (maintainers)

1. Update `CHANGELOG.md`: move the `Unreleased` entries under a new version heading with today's date.
2. Bump the version: `npm version <patch|minor|major>`. This creates a commit and a tag.
3. Push the commit and the tag: `git push --follow-tags`.
4. The release workflow publishes to npm from the tag. Alternatively, run `npm publish` locally; `prepublishOnly` runs lint, typecheck, tests and the build first.
