import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// communities.json is version-controlled config and always ships with the code.
// requests.json is runtime state - DATA_DIR lets it be redirected to a mounted
// persistent volume in production (Render/Railway/Fly.io reset local disk on
// every deploy/restart unless the data dir is on an attached volume).
const communitiesPath = path.join(__dirname, "data", "communities.json");
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const requestsPath = path.join(dataDir, "requests.json");

const communities = JSON.parse(fs.readFileSync(communitiesPath, "utf-8"));

if (!fs.existsSync(requestsPath)) {
  fs.mkdirSync(path.dirname(requestsPath), { recursive: true });
  fs.writeFileSync(requestsPath, "[]");
}
let requests = JSON.parse(fs.readFileSync(requestsPath, "utf-8"));

function persistRequests() {
  fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
}

export function listCommunities() {
  return communities.map(({ id, name, admin }) => ({ id, name, admin }));
}

export function getCommunity(communityId) {
  return communities.find((c) => c.id === communityId) || null;
}

export function createRequest(request) {
  requests.push(request);
  persistRequests();
  return request;
}

export function getRequest(id) {
  return requests.find((r) => r.id === id) || null;
}

export function updateRequest(id, updates) {
  const request = getRequest(id);
  if (!request) return null;
  Object.assign(request, updates);
  persistRequests();
  return request;
}

export function listRequestsByCommunity(communityId, status) {
  return requests
    .filter((r) => r.communityId === communityId)
    .filter((r) => (status ? r.status === status : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
