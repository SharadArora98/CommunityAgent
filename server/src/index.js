import "dotenv/config";
import express from "express";
import cors from "cors";
import communitiesRouter from "./routes/communities.js";
import residentRequestsRouter from "./routes/residentRequests.js";
import adminRequestsRouter from "./routes/adminRequests.js";
import { llmAvailable } from "./agents/llmClient.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/communities", communitiesRouter);
app.use("/api/requests", residentRequestsRouter);
app.use("/api/admin", adminRequestsRouter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, llmAvailable });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ANACITY move-in/move-out server listening on http://localhost:${port}`);
  console.log(`Gemini LLM: ${llmAvailable ? "enabled" : "disabled (using rule-based fallback)"}`);
});
