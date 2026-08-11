const INPUT_TYPE_LABEL = {
  text: "Text",
  date: "Date",
  number: "Number",
  select: "Choice",
  file: "Document",
};

export default function RequirementsPanel({ request, fields }) {
  if (!request || !request.type) {
    return (
      <aside className="requirements-panel">
        <h3>Required Information</h3>
        <p className="muted">Tell us whether you're moving in or moving out, and the checklist will appear here.</p>
      </aside>
    );
  }

  const currentKey =
    request.state === "COLLECTING"
      ? request.editField || (fields[request.currentFieldIndex] && fields[request.currentFieldIndex].key)
      : null;

  return (
    <aside className="requirements-panel">
      <h3>{request.type === "move_in" ? "Move-In Checklist" : "Move-Out Checklist"}</h3>
      <ul className="requirements-list">
        {fields.map((f) => {
          const collected = Boolean(request.answers[f.key]);
          const isCurrent = f.key === currentKey;
          return (
            <li key={f.key} className={collected ? "done" : isCurrent ? "current" : "pending"}>
              <span className="req-status">{collected ? "✓" : isCurrent ? "…" : "○"}</span>
              <span className="req-label">
                {f.label}
                <span className="req-type"> ({INPUT_TYPE_LABEL[f.inputType]})</span>
              </span>
              {collected && <span className="req-value">{request.answers[f.key]}</span>}
            </li>
          );
        })}
      </ul>
      {request.status !== "draft" && (
        <div className={`status-badge status-${request.status}`}>Status: {request.status}</div>
      )}
    </aside>
  );
}
