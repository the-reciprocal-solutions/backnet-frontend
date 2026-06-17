import { useState, useRef, useEffect } from "react";
import { copilotAsk } from "../services/api";


const OWUI_URL = import.meta.env.VITE_OWUI_URL || "https://ollamallm.tools.thefusionapps.com";
const OWUI_KEY = import.meta.env.VITE_OWUI_KEY || "";

// Detect a "DEVICE/Point" reference (e.g. AHU-01/SupplyAirTemp) to ground on.
const POINT_RE = /\b[A-Z0-9]+-\d+\/[A-Za-z0-9_]+\b/;

const MODELS = [
  { id: "llama3.1:8b",    label: "Llama 3.1 · 8B" },
  { id: "gemma3:12b",     label: "Gemma 3 · 12B" },
  { id: "gemma4:e4b",     label: "Gemma 4 · E4B" },
  { id: "qwen2.5vl:3b",   label: "Qwen 2.5VL · 3B" },
];

const SYSTEM_PROMPT =
  "You are a helpful assistant embedded in a BACnet building automation dashboard. " +
  "You help operators understand device readings, alarms, trends, and BACnet protocol concepts. " +
  "Be concise and technical when needed.";

// ─── STYLES (inline, no extra CSS file needed) ────────────────────────────────
const S = {
  // Floating toggle button (bottom-right corner)
  fab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 1000,
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
    transition: "transform 0.2s, box-shadow 0.2s",
    color: "#fff",
    fontSize: "22px",
  },
  // Panel container
  panel: (open) => ({
    position: "fixed",
    bottom: "88px",
    right: "24px",
    zIndex: 999,
    width: "380px",
    maxHeight: "560px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
    transform: open ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s",
    overflow: "hidden",
  }),
  // Header bar
  header: {
    padding: "12px 16px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 6px #22c55e",
  },
  title: {
    color: "#e2e8f0",
    fontWeight: 600,
    fontSize: "13px",
    letterSpacing: "0.03em",
    fontFamily: "system-ui, sans-serif",
  },
  // Model selector
  select: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    color: "#94a3b8",
    fontSize: "11px",
    padding: "3px 6px",
    cursor: "pointer",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
  },
  // Messages area
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    scrollbarWidth: "thin",
    scrollbarColor: "#1e293b transparent",
  },
  // Individual message bubble
  bubble: (role) => ({
    maxWidth: "88%",
    padding: "9px 13px",
    borderRadius: role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
    background: role === "user" ? "linear-gradient(135deg, #0ea5e9, #6366f1)" : "#1e293b",
    color: role === "user" ? "#fff" : "#cbd5e1",
    fontSize: "13px",
    lineHeight: "1.5",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    fontFamily: "system-ui, sans-serif",
    wordBreak: "break-word",
    border: role === "assistant" ? "1px solid #334155" : "none",
  }),
  // Role label above bubble
  roleLabel: (role) => ({
    fontSize: "10px",
    color: "#475569",
    marginBottom: "2px",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    fontFamily: "system-ui, sans-serif",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  }),
  msgWrapper: (role) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: role === "user" ? "flex-end" : "flex-start",
  }),
  // Typing indicator
  typingDots: {
    display: "flex",
    gap: "4px",
    padding: "10px 14px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px 12px 12px 2px",
    alignSelf: "flex-start",
  },
  dot_anim: (i) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#6366f1",
    animation: `bounce 1.1s ease-in-out ${i * 0.18}s infinite`,
  }),
  // Input row
  inputRow: {
    padding: "10px 12px",
    borderTop: "1px solid #1e293b",
    display: "flex",
    gap: "8px",
    background: "#0f172a",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "13px",
    padding: "8px 10px",
    resize: "none",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
    lineHeight: "1.4",
    maxHeight: "80px",
    overflowY: "auto",
  },
  sendBtn: (disabled) => ({
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    background: disabled ? "#1e293b" : "linear-gradient(135deg, #0ea5e9, #6366f1)",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    alignSelf: "flex-end",
    transition: "opacity 0.2s",
    opacity: disabled ? 0.4 : 1,
    color: "#fff",
    fontSize: "16px",
  }),
  // Clear button in header
  clearBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#475569",
    fontSize: "14px",
    padding: "2px 4px",
    borderRadius: "4px",
    lineHeight: 1,
  },
  emptyState: {
    margin: "auto",
    textAlign: "center",
    color: "#334155",
    fontSize: "12px",
    fontFamily: "system-ui, sans-serif",
    lineHeight: "1.6",
    padding: "20px",
  },
  errorBubble: {
    alignSelf: "flex-start",
    padding: "8px 12px",
    background: "#450a0a",
    border: "1px solid #7f1d1d",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "12px",
    fontFamily: "system-ui, sans-serif",
  },
};

// ─── KEYFRAME INJECTION ───────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("llm-chat-styles")) {
  const style = document.createElement("style");
  style.id = "llm-chat-styles";
  style.textContent = `
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    .llm-chat-messages::-webkit-scrollbar { width: 4px; }
    .llm-chat-messages::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
    .llm-chat-textarea:focus { border-color: #6366f1 !important; }
  `;
  document.head.appendChild(style);
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function LLMChat() {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [grounded, setGrounded] = useState(true);  // route via /api/copilot (Chronos+DB grounded)
  const [messages, setMessages] = useState([]);   // { role, content }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [open]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setStreamingText("");

    // ── Grounded path: backend copilot (Chronos forecast + DB evidence + LLM).
    // The answer cites real measured numbers; the LLM key stays server-side.
    if (grounded) {
      try {
        const m = text.match(POINT_RE);
        const data = await copilotAsk(text, m ? m[0] : null);
        const answer = data.answer || "(no grounded answer — is a point referenced, e.g. AHU-01/SupplyAirTemp?)";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      } catch (err) {
        setMessages((prev) => [...prev, { role: "error", content: err.message }]);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch(`${OWUI_URL}/api/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OWUI_KEY}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch (_) {
            // skip malformed chunks
          }
        }
      }

      // Commit streamed reply to messages
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: accumulated },
      ]);
      setStreamingText("");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: err.message },
      ]);
      setStreamingText("");
    } finally {
      setLoading(false);
    }
  };

  // Send on Enter (Shift+Enter = newline)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingText("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating action button */}
      <button
        style={S.fab}
        onClick={() => setOpen((v) => !v)}
        title="Toggle AI Assistant"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      <div style={S.panel(open)}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.dot} />
            <span style={S.title}>BACnet AI Assistant</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              style={{ ...S.select, cursor: "pointer",
                background: grounded ? "#0e7490" : "#1e293b",
                color: grounded ? "#e0f2fe" : "#94a3b8" }}
              onClick={() => setGrounded((v) => !v)}
              title={grounded ? "Grounded on live data (Chronos + DB)" : "General chat (no data)"}
            >
              {grounded ? "🔗 Data" : "💭 General"}
            </button>
            <select
              style={S.select}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={grounded}
              title={grounded ? "Model is chosen server-side in grounded mode" : "Pick a model"}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button style={S.clearBtn} onClick={clearChat} title="Clear chat">
              🗑
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          className="llm-chat-messages"
          style={S.messages}
        >
          {messages.length === 0 && !streamingText && (
            <div style={S.emptyState}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏢</div>
              Ask about device readings,
              <br />
              alarms, or BACnet concepts.
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "error") {
              return (
                <div key={i} style={S.errorBubble}>
                  ⚠ {msg.content}
                </div>
              );
            }
            return (
              <div key={i} style={S.msgWrapper(msg.role)}>
                <div style={S.roleLabel(msg.role)}>
                  {msg.role === "user" ? "You" : "Assistant"}
                </div>
                <div style={S.bubble(msg.role)}>
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* Streaming in-progress */}
          {streamingText && (
            <div style={S.msgWrapper("assistant")}>
              <div style={S.roleLabel("assistant")}>Assistant</div>
              <div style={S.bubble("assistant")}>{streamingText}</div>
            </div>
          )}

          {/* Typing dots (before first streamed token) */}
          {loading && !streamingText && (
            <div style={S.typingDots}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={S.dot_anim(i)} />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div style={S.inputRow}>
          <textarea
            ref={textareaRef}
            className="llm-chat-textarea"
            rows={1}
            placeholder="Ask about BACnet readings or alarms…"
            style={S.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            style={S.sendBtn(!input.trim() || loading)}
            onClick={send}
            disabled={!input.trim() || loading}
            title="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
