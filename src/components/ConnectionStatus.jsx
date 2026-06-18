import React, { useState, useEffect } from "react";
import { onStatusChange } from "../services/ws";

export default function ConnectionStatus() {
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    // Subscribe to WS status change hook
    const unsubscribe = onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const config = {
    connected: { color: "#16a34a", bg: "#e8f5e9", text: "Connected" },
    reconnecting: { color: "#ea580c", bg: "#fff7ed", text: "Reconnecting" },
    disconnected: { color: "#dc2626", bg: "#ffebee", text: "Disconnected" },
  };

  const current = config[status] || config.disconnected;

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "5px 12px",
      borderRadius: "20px",
      background: current.bg,
      border: `1px solid ${current.color}33`,
      fontFamily: "'DM Sans', sans-serif",
      fontSize: "11px",
      fontWeight: 700,
      color: current.color,
      transition: "all 0.3s ease",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
      userSelect: "none",
    }}>
      <span style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: current.color,
        display: "inline-block",
        animation: status === "reconnecting" ? "wsPulse 1s infinite alternate" : "none",
      }} />
      <span>{current.text}</span>

      {/* Inject animation styling */}
      <style>{`
        @keyframes wsPulse {
          0% { opacity: 0.3; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
