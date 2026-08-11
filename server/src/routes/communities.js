import { Router } from "express";
import { listCommunities } from "../store.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(listCommunities());
});

export default router;
