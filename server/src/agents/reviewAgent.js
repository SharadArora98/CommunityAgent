import { callLLMJson } from "./llmClient.js";

const PAST_DATE_FLAG_FIELDS = new Set(["move_in_date"]);
const NEGATIVE_ACK_FIELDS = new Set(["clearance_ack", "key_return_ack"]);

function isPastDate(value) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed < today.getTime();
}

/** Deterministic completeness + compliance check - this is what the recommendation is based on. */
function ruleBasedAssessment(fields, answers) {
  const missingFields = fields.filter((f) => f.required && !answers[f.key]).map((f) => f.label);
  const flaggedIssues = [];

  for (const field of fields) {
    const value = answers[field.key];
    if (!value) continue;
    if (PAST_DATE_FLAG_FIELDS.has(field.key) && isPastDate(value)) {
      flaggedIssues.push(`${field.label} ("${value}") is in the past.`);
    }
    if (NEGATIVE_ACK_FIELDS.has(field.key) && value.toLowerCase() === "no") {
      flaggedIssues.push(`Resident did not confirm: ${field.label}.`);
    }
    if (field.key === "pet_declaration" && value.toLowerCase() === "yes") {
      flaggedIssues.push("Resident declared pets - verify against community pet policy.");
    }
  }

  let recommendation = "approve";
  if (missingFields.length > 0) recommendation = "reject";
  else if (flaggedIssues.length > 0) recommendation = "review";

  return { complete: missingFields.length === 0, missingFields, flaggedIssues, recommendation };
}

/**
 * Admin-assist only: read-only evaluation of one submitted request against its
 * community's required fields. It never changes request status - it produces a
 * recommendation for the human admin, who makes the actual accept/reject call.
 */
export async function reviewRequest(fields, answers) {
  const assessment = ruleBasedAssessment(fields, answers);

  const llmResult = await callLLMJson({
    system:
      "You are an admin assistant for a residential community. Given a completeness/compliance " +
      "assessment of a move-in/move-out request, write a one to two sentence rationale for the " +
      "human admin, in plain, neutral language. Respond with strict JSON: {\"rationale\": \"...\"}.",
    prompt: JSON.stringify({ answers, ...assessment }),
  });

  const rationale =
    (llmResult && typeof llmResult.rationale === "string" && llmResult.rationale.trim()) ||
    fallbackRationale(assessment);

  return { ...assessment, rationale };
}

function fallbackRationale({ complete, missingFields, flaggedIssues, recommendation }) {
  if (!complete) {
    return `Missing required information: ${missingFields.join(", ")}. Recommend rejecting or asking the resident to complete the request.`;
  }
  if (flaggedIssues.length > 0) {
    return `All required fields are present, but ${flaggedIssues.length} item(s) need admin attention: ${flaggedIssues.join(" ")}`;
  }
  return "All required fields are present and no issues were detected. Recommend approving.";
}
