import { callLLMJson } from "./llmClient.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const FILE_RE = /^[\w\-. ()]{2,80}\.[A-Za-z0-9]{2,5}$/;
const NON_ANSWERS = new Set(["no", "none", "na", "n/a", "nil", "nothing", "not sure", "idk", "skip", "later", "tbd"]);

// A move-in/move-out date should be roughly "now-ish" - this catches obvious
// extraction/typo mistakes (e.g. a garbled "1191-02-23") without enforcing a
// business rule about past dates, which stays a human/admin judgment call.
const MIN_DATE_YEAR_OFFSET = -2;
const MAX_DATE_YEAR_OFFSET = 3;

function matchSelectOption(rawValue, options) {
  const text = rawValue.trim().toLowerCase();
  return options.find((opt) => opt.toLowerCase() === text || text.includes(opt.toLowerCase())) || null;
}

/** Deterministic format validation - this is the source of truth, independent of whether the LLM is available. */
function validateFormat(field, value) {
  if (!value || !value.trim()) {
    return { valid: false, reason: "I didn't catch a value for that - could you provide it explicitly?" };
  }
  const trimmed = value.trim();

  switch (field.inputType) {
    case "date": {
      if (!DATE_RE.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
        return { valid: false, reason: `Please provide the date in YYYY-MM-DD format for "${field.label}".` };
      }
      const year = Number(trimmed.slice(0, 4));
      const currentYear = new Date().getFullYear();
      if (year < currentYear + MIN_DATE_YEAR_OFFSET || year > currentYear + MAX_DATE_YEAR_OFFSET) {
        return { valid: false, reason: `"${trimmed}" doesn't look like a valid date for "${field.label}" - please double-check the year.` };
      }
      return { valid: true, value: trimmed };
    }
    case "number":
      if (!NUMBER_RE.test(trimmed)) {
        return { valid: false, reason: `"${field.label}" needs to be a number.` };
      }
      return { valid: true, value: trimmed };
    case "select": {
      const matched = matchSelectOption(trimmed, field.options);
      if (!matched) {
        return { valid: false, reason: `Please choose one of: ${field.options.join(", ")}.` };
      }
      return { valid: true, value: matched };
    }
    case "file": {
      const isNonAnswer = NON_ANSWERS.has(trimmed.toLowerCase());
      if (isNonAnswer || !FILE_RE.test(trimmed)) {
        return {
          valid: false,
          reason: `"${field.label}" is a required document - please reply with the actual file name, including its extension (e.g. "${field.key}.pdf").`,
        };
      }
      return { valid: true, value: trimmed };
    }
    case "text":
    default:
      if (trimmed.length < 1) {
        return { valid: false, reason: `"${field.label}" can't be empty.` };
      }
      return { valid: true, value: trimmed };
  }
}

/**
 * Extracts + validates the resident's answer for exactly one field. Never touches
 * other fields, never assumes a value that isn't format-valid - on failure it returns
 * a reason so the caller can re-prompt without advancing state.
 */
export async function extractAndValidate(field, message) {
  let candidate = message.trim();

  if (field.inputType !== "select") {
    const llmResult = await callLLMJson({
      system:
        `You extract exactly one field value from a resident's chat message in a move-in/move-out request.\n` +
        `Field: "${field.label}" (type: ${field.inputType}).\n` +
        (field.inputType === "date" ? "Normalize any date expression to YYYY-MM-DD if the message contains an absolute date.\n" : "") +
        `Respond with strict JSON: {"value": "<the extracted value as a string, or null if the message does not contain it>"}.`,
      prompt: message,
    });
    if (llmResult && typeof llmResult.value === "string" && llmResult.value.trim()) {
      candidate = llmResult.value.trim();
    }
  }

  return validateFormat(field, candidate);
}
