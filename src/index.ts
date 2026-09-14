export { isValidEmail, validateEmail } from "./validate.js";

export {
  AiEmailValidatorError,
  ApiError,
  ConfigurationError,
  InvalidInputError,
  StructuredOutputError,
  type StructuredOutputFailureReason,
} from "./errors.js";

export {
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  MAX_EMAIL_LENGTH,
  type EmailValidationResult,
  type EmailValidationUsage,
  type ReasoningEffort,
  type ValidateEmailOptions,
} from "./types.js";

export {
  type EmailValidationClient,
  type EmailValidationRequestOptions,
  type EmailValidationResponse,
} from "./client.js";
