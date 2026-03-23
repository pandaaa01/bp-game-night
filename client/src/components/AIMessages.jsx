import { useState, useEffect } from "react";

let msgId = 0;

export default function AIMessages({ messages }) {
  return (
    <div className="ai-messages">
      {messages.map(msg => (
        <div key={msg.id} className={`ai-message ${msg.type}`}>
          {msg.text}
        </div>
      ))}
    </div>
  );
}

export function createMessage(text, type = "info") {
  return { id: ++msgId, text, type, timestamp: Date.now() };
}
