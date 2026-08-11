import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import RequestList from "../components/RequestList.jsx";
import RequestDetail from "../components/RequestDetail.jsx";

export default function AdminPage() {
  const [communities, setCommunities] = useState([]);
  const [communityId, setCommunityId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listCommunities().then(setCommunities).catch((e) => setError(e.message));
  }, []);

  const loadRequests = useCallback(() => {
    if (!communityId) return;
    api
      .listAdminRequests(communityId, statusFilter === "all" ? undefined : statusFilter)
      .then((data) => setRequests(data.requests))
      .catch((e) => setError(e.message));
  }, [communityId, statusFilter]);

  useEffect(() => {
    setSelectedId(null);
    loadRequests();
  }, [loadRequests]);

  const currentCommunity = communities.find((c) => c.id === communityId);

  return (
    <div className="admin-page">
      <div className="community-select-row">
        <label htmlFor="admin-community-select">Signed in as admin of</label>
        <select
          id="admin-community-select"
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
        >
          <option value="">Select a community...</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {currentCommunity && <span className="muted">Admin: {currentCommunity.admin.name}</span>}

        <label htmlFor="status-filter">Status</label>
        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {communityId ? (
        <div className="admin-layout">
          <div className="admin-list-panel">
            <RequestList requests={requests} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <RequestDetail
            requestId={selectedId}
            onDecided={() => {
              loadRequests();
            }}
          />
        </div>
      ) : (
        <p className="muted">Select a community to review its move-in / move-out requests.</p>
      )}
    </div>
  );
}
