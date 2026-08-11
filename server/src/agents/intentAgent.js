import { callLLMJson } from "./llmClient.js";

const MOVE_IN_HINTS = ["move in", "moving in", "move-in", "movein", "joining", "new resident", "shifting in"];
const MOVE_OUT_HINTS = ["move out", "moving out", "move-out", "moveout", "leaving", "vacate", "vacating", "exit"];

function ruleBasedIntent(message) {
  const text = message.toLowerCase();
  const hasIn = MOVE_IN_HINTS.some((h) => text.includes(h));
  const hasOut = MOVE_OUT_HINTS.some((h) => text.includes(h));
  if (hasIn && !hasOut) return "move_in";
  if (hasOut && !hasIn) return "move_out";
  return "unclear";
}

/**
 * Classifies the resident's free-text opening message into move_in / move_out / unclear.
 * This is the only responsibility of this agent - it never writes anything besides
 * the request's `type` field, and never advances the conversation itself.
 */
export async function detectIntent(message) {
  const llmResult = await callLLMJson({
    system:
      "You classify a residential community message as one of exactly: move_in, move_out, unclear. " +
      'Respond with strict JSON: {"intent": "move_in" | "move_out" | "unclear"}. ' +
      "Only pick move_in or move_out if the resident's intent is reasonably clear; otherwise unclear.",
    prompt: message,
  });

  if (llmResult && ["move_in", "move_out", "unclear"].includes(llmResult.intent)) {
    return llmResult.intent;
  }
  return ruleBasedIntent(message);
}
