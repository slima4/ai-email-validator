import { InvalidInputError } from "./errors.js";
import { MAX_EMAIL_LENGTH } from "./types.js";

// This is the only regular expression in the repository. It does not validate
// email addresses. It rejects control characters (including newlines), which
// have no business in an address and every business in a prompt injection.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Checks that the input is something we are willing to send to a language
 * model, and returns it trimmed.
 *
 * This is deliberately not email validation. It only guards the API call:
 * the input must be a non-empty string of reasonable length with no control
 * characters. Whether it is actually an email address is, of course, a
 * question for the model.
 *
 * @throws {InvalidInputError} when the input fails any of the checks above.
 */
export function assertEmailInput(input: unknown): string {
  if (typeof input !== "string") {
    throw new InvalidInputError(
      `Expected the email address to be a string, received ${describeType(input)}.`,
      input,
    );
  }

  const email = input.trim();

  if (email.length === 0) {
    throw new InvalidInputError("Expected a non-empty email address.", input);
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw new InvalidInputError(
      `Email address is ${String(email.length)} characters long; the maximum is ${String(MAX_EMAIL_LENGTH)}.`,
      input,
    );
  }

  if (CONTROL_CHARACTERS.test(email)) {
    throw new InvalidInputError("Email address must not contain control characters.", input);
  }

  return email;
}

function describeType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return "an array";
  }
  const type = typeof value;
  return type === "object" ? "an object" : `a ${type}`;
}
