import { Router } from "express";
import { getCommunity, createRequest, getRequest, updateRequest } from "../store.js";
import { createDraftRequest, handleMessage } from "../stateMachine.js";

const router = Router();

function toResponse(request, community) {
  return {
    request,
    communityName: community.name,
    fields: request.type ? community.flows[request.type] : null,
  };
}

router.post("/", (req, res) => {
  const { communityId } = req.body;
  const community = getCommunity(communityId);
  if (!community) return res.status(404).json({ error: "Unknown community" });

  const request = createDraftRequest(community);
  createRequest(request);
  res.status(201).json(toResponse(request, community));
});

router.get("/:id", (req, res) => {
  const request = getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  const community = getCommunity(request.communityId);
  res.json(toResponse(request, community));
});

router.post("/:id/message", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required" });

  const request = getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  const community = getCommunity(request.communityId);

  await handleMessage(community, request, text.trim());
  updateRequest(request.id, request);

  res.json(toResponse(request, community));
});

export default router;
