import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function RequestDetail({ requestId, onDecided }) {
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setNote("");
    setError("");
    if (!requestId) return;
    api.getAdminRequest(requestId).then(setData).catch((e) => setError(e.message));
  }, [requestId]);

  if (!requestId) {
    return (
      <section className="request-detail">
        <p className="muted">Select a request from the list to review it.</p>
      </section>
    );
  }
  if (error) return <section className="request-detail error-banner">{error}</section>;
  if (!data) return <section className="request-detail">Loading...</section>;

  const { request, communityName, fields } = data;
  const review = request.agentReview;

  async function decide(decision) {
    setBusy(true);
    setError("");
    try {
      const result = await api.decide(request.id, decision, note);
      setData({ ...data, request: result.request });
      onDecided?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="request-detail">
      <h3>
        {request.type === "move_in" ? "Move-In" : "Move-Out"} Request - {communityName}
      </h3>
      <span className={`status-badge status-${request.status}`}>{request.status}</span>

      <h4>Submitted Information</h4>
      <table className="answers-table">
        <tbody>
          {(fields || []).map((f) => (
            <tr key={f.key}>
              <td className="answer-label">{f.label}</td>
              <td>{request.answers[f.key] || <span className="muted">-</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {review && (
        <div className={`agent-review rec-${review.recommendation}`}>
          <h4>Agent Assessment (recommendation only - final decision is yours)</h4>
          <p>
            <strong>Recommendation:</strong> {review.recommendation}
          </p>
          {review.missingFields.length > 0 && (
            <p>
              <strong>Missing:</strong> {review.missingFields.join(", ")}
            </p>
          )}
          {review.flaggedIssues.length > 0 && (
            <ul>
              {review.flaggedIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
          <p className="muted">{review.rationale}</p>
        </div>
      )}

      {request.status === "pending" ? (
        <div className="decision-panel">
          <textarea
            placeholder="Optional note to the resident..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="decision-buttons">
            <button className="approve" disabled={busy} onClick={() => decide("approved")}>
              Accept
            </button>
            <button className="reject" disabled={busy} onClick={() => decide("rejected")}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        request.decisionNote && (
          <p className="muted">
            <strong>Decision note:</strong> {request.decisionNote}
          </p>
        )
      )}
    </section>
  );
}
