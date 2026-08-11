import { useEffect, useState } from "react";
import { api } from "../api.js";
import ChatWindow from "../components/ChatWindow.jsx";
import RequirementsPanel from "../components/RequirementsPanel.jsx";

export default function ResidentPage() {
  const [communities, setCommunities] = useState([]);
  const [communityId, setCommunityId] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [request, setRequest] = useState(null);
  const [fields, setFields] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listCommunities().then(setCommunities).catch((e) => setError(e.message));
  }, []);

  async function startRequest(id) {
    setError("");
    setBusy(true);
    try {
      const data = await api.createRequest(id);
      setCommunityId(id);
      setCommunityName(data.communityName);
      setRequest(data.request);
      setFields(data.fields);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(text) {
    setError("");
    setBusy(true);
    try {
      const data = await api.sendMessage(request.id, text);
      setRequest(data.request);
      setFields(data.fields);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRequest(null);
    setFields(null);
    setCommunityId("");
    setCommunityName("");
    setError("");
  }

  return (
    <div className="resident-page">
      <div className="community-select-row">
        <label htmlFor="community-select">Community</label>
        <select
          id="community-select"
          value={communityId}
          disabled={Boolean(request)}
          onChange={(e) => e.target.value && startRequest(e.target.value)}
        >
          <option value="">Select a community...</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {request && (
          <button className="link-button" onClick={reset}>
            Start over
          </button>
        )}
        {communityName && <span className="muted">Community: {communityName}</span>}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {request ? (
        <div className="resident-layout">
          <ChatWindow history={request.history} onSend={handleSend} disabled={busy} />
          <RequirementsPanel request={request} fields={fields || []} />
        </div>
      ) : (
        <p className="muted">Select your community above to start a move-in or move-out request.</p>
      )}
    </div>
  );
}
