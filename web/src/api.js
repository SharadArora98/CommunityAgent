// In local dev, "/api" is proxied to the backend by vite.config.js. In production,
// where the frontend and backend are typically deployed as separate services,
// set VITE_API_BASE_URL (at build time) to the backend's public URL + "/api".
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  listCommunities: () => request("/communities"),
  createRequest: (communityId) =>
    request("/requests", { method: "POST", body: JSON.stringify({ communityId }) }),
  getRequest: (id) => request(`/requests/${id}`),
  sendMessage: (id, text) =>
    request(`/requests/${id}/message`, { method: "POST", body: JSON.stringify({ text }) }),
  listAdminRequests: (communityId, status) =>
    request(`/admin/communities/${communityId}/requests${status ? `?status=${status}` : ""}`),
  getAdminRequest: (id) => request(`/admin/requests/${id}`),
  decide: (id, decision, note) =>
    request(`/admin/requests/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
};
