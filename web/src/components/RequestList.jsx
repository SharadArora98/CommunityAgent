const TYPE_LABEL = { move_in: "Move In", move_out: "Move Out" };

export default function RequestList({ requests, selectedId, onSelect }) {
  if (requests.length === 0) {
    return <p className="muted">No requests found for this filter.</p>;
  }

  return (
    <ul className="request-list">
      {requests.map((r) => (
        <li
          key={r.id}
          className={r.id === selectedId ? "selected" : ""}
          onClick={() => onSelect(r.id)}
        >
          <div className="request-list-row">
            <span className="req-type-badge">{TYPE_LABEL[r.type] || "Pending intent"}</span>
            <span className={`status-badge status-${r.status}`}>{r.status}</span>
          </div>
          <div className="muted small">
            {r.answers.full_name || "Unnamed"} · Unit {r.answers.unit_number || "?"}
          </div>
          {r.agentReview && (
            <div className={`recommendation-chip rec-${r.agentReview.recommendation}`}>
              agent: {r.agentReview.recommendation}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
