import { Router } from "express";
import { getCommunity, listRequestsByCommunity, getRequest, updateRequest } from "../store.js";

const router = Router();

router.get("/communities/:communityId/requests", (req, res) => {
  const community = getCommunity(req.params.communityId);
  if (!community) return res.status(404).json({ error: "Unknown community" });
  const { status } = req.query;
  res.json({ requests: listRequestsByCommunity(community.id, status) });
});

router.get("/requests/:id", (req, res) => {
  const request = getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  const community = getCommunity(request.communityId);
  res.json({
    request,
    communityName: community.name,
    fields: request.type ? community.flows[request.type] : null,
  });
});

router.post("/requests/:id/decision", (req, res) => {
  const { decision, note } = req.body;
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  const request = getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending") {
    return res.status(409).json({ error: "Only pending requests can be decided" });
  }

  updateRequest(request.id, {
    status: decision,
    state: "DECIDED",
    decidedAt: new Date().toISOString(),
    decisionNote: note?.trim() || null,
  });

  res.json({ request: getRequest(request.id) });
});

export default router;
