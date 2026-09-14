// Run after `npm run build` with an API key in the environment:
//
//   OPENAI_API_KEY=sk-... node examples/basic.mjs
//
// Each call below costs real money and takes real time. That is the point.

import { AiEmailValidatorError, isValidEmail, validateEmail } from "ai-email-validator";

const candidates = ["john@example.com", "not an email", '"quoted local"@example.com'];

for (const candidate of candidates) {
  try {
    const result = await validateEmail(candidate);
    console.log(
      `${JSON.stringify(result.email)} -> ${String(result.valid)}` +
        ` (${result.model}, ${String(result.usage?.totalTokens ?? "?")} tokens)`,
    );
  } catch (error) {
    if (error instanceof AiEmailValidatorError) {
      console.error(`${JSON.stringify(candidate)} -> ${error.name}: ${error.message}`);
    } else {
      throw error;
    }
  }
}

// The simple API, for when you only want the boolean.
console.log(await isValidEmail("jane@example.org"));
