import crypto from "node:crypto";
import { detectIntent } from "./agents/intentAgent.js";
import { extractAndValidate } from "./agents/fieldAgent.js";
import { reviewRequest } from "./agents/reviewAgent.js";

const MAX_INTENT_ATTEMPTS = 2;

function say(request, role, text) {
  request.history.push({ role, text, ts: new Date().toISOString() });
}

function fieldsFor(community, request) {
  return community.flows[request.type];
}

function recap(fields, answers) {
  return fields.map((f) => `- ${f.label}: ${answers[f.key]}`).join("\n");
}

function findEditTarget(fields, text) {
  const lower = text.toLowerCase();
  return fields.find(
    (f) => lower.includes(f.label.toLowerCase()) || lower.includes(f.key.replace(/_/g, " "))
  );
}

const CONFIRM_PATTERN = /\b(yes|yeah|yep|yup|confirm(ed)?|correct|submit|ok|okay|sure|fine)\b|looks good|all good|good to go|that'?s right/i;

function currentFieldFor(fields, request) {
  if (request.editField) return fields.find((f) => f.key === request.editField);
  return fields[request.currentFieldIndex];
}

export function createDraftRequest(community) {
  const request = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: null,
    state: "INTENT",
    currentFieldIndex: 0,
    editField: null,
    intentAttempts: 0,
    answers: {},
    status: "draft",
    agentReview: null,
    history: [],
    createdAt: new Date().toISOString(),
    submittedAt: null,
    decidedAt: null,
    decisionNote: null,
  };
  say(
    request,
    "agent",
    `Hi! Welcome to ${community.name}. Are you looking to move in or move out today?`
  );
  return request;
}

/** Advances the request's state machine by exactly one resident turn. Mutates and returns `request`. */
export async function handleMessage(community, request, text) {
  say(request, "resident", text);

  switch (request.state) {
    case "INTENT": {
      const intent = await detectIntent(text);
      if (intent === "unclear") {
        request.intentAttempts += 1;
        say(
          request,
          "agent",
          request.intentAttempts >= MAX_INTENT_ATTEMPTS
            ? "I still couldn't tell - please reply with just \"move in\" or \"move out\" so I can continue."
            : "I want to make sure I set this up correctly - are you looking to move in or move out?"
        );
        break;
      }
      request.type = intent;
      request.state = "COLLECTING";
      request.currentFieldIndex = 0;
      const fields = fieldsFor(community, request);
      say(
        request,
        "agent",
        `Great, let's get your ${intent === "move_in" ? "move-in" : "move-out"} request started for ${community.name}. ${fields[0].prompt}`
      );
      break;
    }

    case "COLLECTING": {
      const fields = fieldsFor(community, request);
      const currentField = currentFieldFor(fields, request);
      const result = await extractAndValidate(currentField, text);

      if (!result.valid) {
        say(request, "agent", `${result.reason} ${currentField.prompt}`);
        break;
      }

      request.answers[currentField.key] = result.value;

      if (request.editField) {
        request.editField = null;
        request.state = "REVIEWING";
        say(
          request,
          "agent",
          `Updated. Here's what I have now:\n${recap(fields, request.answers)}\n\nDoes this all look correct? Reply "yes" to submit, or tell me what else to change.`
        );
        break;
      }

      request.currentFieldIndex += 1;

      if (request.currentFieldIndex >= fields.length) {
        request.state = "REVIEWING";
        say(
          request,
          "agent",
          `Here's what I have:\n${recap(fields, request.answers)}\n\nDoes this all look correct? Reply "yes" to submit, or tell me what to change.`
        );
      } else {
        say(request, "agent", `Got it. ${fields[request.currentFieldIndex].prompt}`);
      }
      break;
    }

    case "REVIEWING": {
      const fields = fieldsFor(community, request);
      const confirmed = CONFIRM_PATTERN.test(text.trim());

      if (confirmed) {
        request.status = "pending";
        request.state = "SUBMITTED";
        request.editField = null;
        request.submittedAt = new Date().toISOString();
        request.agentReview = await reviewRequest(fields, request.answers);
        say(
          request,
          "agent",
          "Thanks! Your request has been submitted to the community admin for review. You'll see the decision here once it's made."
        );
        break;
      }

      const editTarget = findEditTarget(fields, text);
      if (editTarget) {
        request.editField = editTarget.key;
        request.state = "COLLECTING";
        say(request, "agent", `Sure, let's update that. ${editTarget.prompt}`);
      } else {
        say(
          request,
          "agent",
          'I didn\'t quite catch that. Reply "yes" to submit, or tell me which field to change (e.g. "change unit number").'
        );
      }
      break;
    }

    case "SUBMITTED":
      say(request, "agent", "Your request is still pending review by the community admin - I'll show the decision here as soon as it's made.");
      break;

    case "DECIDED": {
      const outcome = request.status === "approved" ? "approved" : "not approved";
      const noteLine = request.decisionNote ? ` ${request.status === "approved" ? "Note" : "Reason"}: ${request.decisionNote}` : "";
      say(request, "agent", `Your request was ${outcome} by the community admin.${noteLine}`);
      break;
    }

    default:
      break;
  }

  return request;
}
