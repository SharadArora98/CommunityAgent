import { useEffect, useRef, useState } from "react";

export default function ChatWindow({ history, onSend, disabled }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {history.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.text.split("\n").map((line, j) => (
              <div key={j}>{line}</div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Please wait..." : "Type your reply..."}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
