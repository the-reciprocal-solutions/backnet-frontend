import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fetchHistory } from "../services/api";
import { connect, subscribe } from "../services/ws";

/**
 * Custom Dot component to highlight anomalies on the line chart.
 */
const AnomalyDot = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || !payload.isAnomaly) return null;

  // Determine dot color by severity
  const severityColors = {
    high: "#dc2626",   // Red
    medium: "#ea580c", // Orange
    low: "#2563eb",    // Blue
  };
  const color = severityColors[payload.severity] || "#ea580c";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke="#fff"
      strokeWidth={2}
      style={{ cursor: "pointer" }}
    />
  );
};

/**
 * Custom Tooltip component displaying values and conditional AI Reasoning Overlay.
 */
const AnomalyTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isAnomaly = data.isAnomaly;
  const severity = data.severity;
  const reasoning = data.reasoning;

  const severityColors = {
    high: "#dc2626",
    medium: "#ea580c",
    low: "#2563eb",
  };
  const severityColor = severityColors[severity] || "#ea580c";
  const formattedTime = new Date(data.t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div style={{
      background: "rgba(17, 24, 39, 0.95)",
      backdropFilter: "blur(8px)",
      border: `1px solid ${isAnomaly ? severityColor : "#e2ede8"}`,
      padding: "16px",
      borderRadius: "12px",
      color: "#fff",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
      maxWidth: "320px",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formattedTime}</span>
        {isAnomaly && (
          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            background: `${severityColor}22`,
            color: severityColor,
            border: `1px solid ${severityColor}`,
            padding: "2px 6px",
            borderRadius: "4px"
          }}>
            {severity} Anomaly
          </span>
        )}
      </div>

      <div style={{ fontSize: "18px", fontWeight: 700, margin: "4px 0", display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span style={{ color: isAnomaly ? severityColor : "#3b82f6" }}>{data.value}</span>
        <span style={{ fontSize: "12px", fontWeight: 400, color: "#9ca3af" }}>mm/s</span>
      </div>

      {isAnomaly && reasoning && (
        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #374151",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
            🧠 AI Reasoning Overlay
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.05)", borderRadius: "8px", padding: "10px", fontSize: "12px" }}>
            <div style={{ marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9ca3af" }}>Component:</span>
              <span style={{ fontWeight: 600, color: "#e5e7eb" }}>{reasoning.component}</span>
            </div>
            <div style={{ marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9ca3af" }}>Prob. Failure:</span>
              <span style={{ fontWeight: 600, color: "#f87171" }}>
                {Math.round(reasoning.failure_prob * 100)}%
              </span>
            </div>
            <div style={{ marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#9ca3af" }}>ETA to Fail:</span>
              <span style={{ fontWeight: 600, color: "#fbbf24" }}>~{reasoning.eta_hours}h</span>
            </div>
            {reasoning.explanation && (
              <div style={{ fontSize: "11px", color: "#d1d5db", fontStyle: "italic", marginTop: "8px", lineHeight: "1.4" }}>
                "{reasoning.explanation}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function LiveAnomalyChart({ point = "AHU-1.vibration" }) {
  const [chartData, setChartData] = useState([]);
  const [latestAnomaly, setLatestAnomaly] = useState(null);
  const [loading, setLoading] = useState(true);

  // Time format for X-axis
  const formatTime = (ms) => new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // 1. Fetch historical points
    fetchHistory(point, { res: "1m", limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        const historyPoints = (res?.points || []).map((p) => ({
          t: new Date(p.time).getTime(),
          value: p.avg ?? p.last ?? p.value,
          isAnomaly: false,
          severity: null,
          reasoning: null,
        }));
        setChartData(historyPoints);
        setLoading(false);
      })
      .catch((err) => {
        console.error(`[Chart] Failed to load history for ${point}:`, err);
        setLoading(false);
      });

    // 2. Connect and Subscribe to WebSocket anomaly broadcast
    connect();
    const unsubscribe = subscribe("anomaly", (message) => {
      if (!isMounted) return;
      if (message.point !== point) return;

      const newPoint = {
        t: new Date(message.ts).getTime(),
        value: message.value,
        isAnomaly: true,
        severity: message.severity,
        anomaly: message.anomaly,
        reasoning: message.reasoning,
      };

      setChartData((prevData) => {
        // Guard against duplicate points at the exact same timestamp
        const last = prevData[prevData.length - 1];
        if (last && last.t === newPoint.t) {
          return prevData;
        }
        // Limit total points in buffer to 200 to maintain chart performance
        return [...prevData.slice(-199), newPoint];
      });

      // Update badge overlay state
      setLatestAnomaly(newPoint);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [point]);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>Live Anomaly Tracking</h3>
          <p style={subtitleStyle}>Monitoring point: <span style={{ fontWeight: 600 }}>{point}</span></p>
        </div>
        <div style={statusBadgeStyle(chartData.length > 0)}>
          {chartData.length > 0 ? "● LIVE STREAMING" : "● DISCONNECTED"}
        </div>
      </div>

      {/* Main UI Layout */}
      <div style={layoutGridStyle}>
        {/* Chart View */}
        <div style={chartCardStyle}>
          {loading ? (
            <div style={loaderStyle}>Loading historical data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f2" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 10, fill: "#8aab9b" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#8aab9b" }}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<AnomalyTooltip />} />
                <Line
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={<AnomalyDot />}
                  name="Value"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Reasoning Sidebar / Badge Overlay */}
        <div style={sidebarCardStyle}>
          <h4 style={sidebarTitleStyle}>Latest Anomaly Reasoning</h4>
          {latestAnomaly ? (
            <div>
              <div style={badgeContainerStyle}>
                <span style={anomalyBadgeStyle(latestAnomaly.severity)}>
                  {latestAnomaly.severity} severity
                </span>
                <span style={timeBadgeStyle}>
                  {formatTime(latestAnomaly.t)}
                </span>
              </div>

              <div style={valueDisplayStyle}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#0f2d1e" }}>{latestAnomaly.value}</span>
                <span style={{ fontSize: "14px", color: "#5a7d6b", marginLeft: "4px" }}>mm/s</span>
              </div>

              {latestAnomaly.reasoning ? (
                <div style={reasoningBoxStyle}>
                  <div style={reasoningHeadingStyle}>
                    🧠 AI Copilot Analysis
                  </div>
                  
                  <div style={reasoningRowStyle}>
                    <span style={reasoningLabelStyle}>Affected component:</span>
                    <span style={reasoningValueStyle}>{latestAnomaly.reasoning.component}</span>
                  </div>

                  <div style={reasoningRowStyle}>
                    <span style={reasoningLabelStyle}>Probability of failure:</span>
                    <span style={{ ...reasoningValueStyle, color: "#dc2626" }}>
                      {Math.round(latestAnomaly.reasoning.failure_prob * 100)}%
                    </span>
                  </div>

                  <div style={reasoningRowStyle}>
                    <span style={reasoningLabelStyle}>Estimated ETA:</span>
                    <span style={{ ...reasoningValueStyle, color: "#ea580c" }}>
                      ~{latestAnomaly.reasoning.eta_hours} hours
                    </span>
                  </div>

                  {latestAnomaly.reasoning.explanation && (
                    <div style={explanationStyle}>
                      {latestAnomaly.reasoning.explanation}
                    </div>
                  )}
                </div>
              ) : (
                <div style={noReasoningBoxStyle}>
                  <span style={{ fontSize: "16px", marginBottom: "4px" }}>⚠️</span>
                  <span>Anomaly detected, but the AI reasoning layer has not produced output yet.</span>
                </div>
              )}
            </div>
          ) : (
            <div style={emptySidebarStyle}>
              <span style={{ fontSize: "24px", marginBottom: "8px" }}>✓</span>
              <span>No anomalies detected yet in this session. Live stream is healthy.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styling Tokens (harmonious HSL and modern colors matching backnet design)
const containerStyle = {
  background: "#fff",
  border: "1px solid #e2ede8",
  borderRadius: "16px",
  padding: "24px",
  fontFamily: "'DM Sans', sans-serif",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  paddingBottom: "16px",
  borderBottom: "1px solid #f0f5f2",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 700,
  color: "#0f2d1e",
};

const subtitleStyle = {
  margin: "4px 0 0",
  fontSize: "13px",
  color: "#5a7d6b",
};

const statusBadgeStyle = (connected) => ({
  fontSize: "11px",
  fontWeight: 700,
  color: connected ? "#16a34a" : "#dc2626",
  background: connected ? "#e8f5e9" : "#ffebee",
  padding: "6px 12px",
  borderRadius: "20px",
  letterSpacing: "0.5px",
});

const layoutGridStyle = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "24px",
  alignItems: "start",
};

const chartCardStyle = {
  background: "#fafcfb",
  border: "1px solid #edf2f0",
  borderRadius: "12px",
  padding: "16px",
  minHeight: "320px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const loaderStyle = {
  fontSize: "14px",
  color: "#8aab9b",
};

const sidebarCardStyle = {
  background: "#fff",
  border: "1px solid #e2ede8",
  borderRadius: "12px",
  padding: "20px",
  minHeight: "320px",
  boxSizing: "border-box",
};

const sidebarTitleStyle = {
  margin: "0 0 16px",
  fontSize: "14px",
  fontWeight: 700,
  color: "#0f2d1e",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const badgeContainerStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "12px",
};

const anomalyBadgeStyle = (severity) => {
  const colors = {
    high: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
    medium: { bg: "#fff7ed", text: "#ea580c", border: "#ffedd5" },
    low: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  };
  const theme = colors[severity] || colors.medium;
  return {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    background: theme.bg,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    padding: "3px 8px",
    borderRadius: "4px",
  };
};

const timeBadgeStyle = {
  fontSize: "10px",
  fontWeight: 600,
  background: "#f3f4f6",
  color: "#4b5563",
  padding: "3px 8px",
  borderRadius: "4px",
};

const valueDisplayStyle = {
  display: "flex",
  alignItems: "baseline",
  marginBottom: "16px",
};

const reasoningBoxStyle = {
  background: "#fafcfb",
  border: "1px solid #e2ede8",
  borderRadius: "8px",
  padding: "14px",
};

const reasoningBoxStyleHover = {
  background: "#fff",
  border: "1px solid #c8ddd2",
  borderRadius: "8px",
  padding: "14px",
};

const reasoningHeadingStyle = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#166534",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "10px",
};

const reasoningRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "12px",
  marginBottom: "8px",
};

const reasoningLabelStyle = {
  color: "#5a7d6b",
};

const reasoningValueStyle = {
  fontWeight: 600,
  color: "#0f2d1e",
};

const explanationStyle = {
  fontSize: "11px",
  color: "#3d6b53",
  fontStyle: "italic",
  marginTop: "10px",
  paddingTop: "10px",
  borderTop: "1px solid #edf2f0",
  lineHeight: "1.4",
};

const noReasoningBoxStyle = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#b45309",
  borderRadius: "8px",
  padding: "14px",
  fontSize: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  lineHeight: "1.4",
};

const emptySidebarStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  height: "220px",
  fontSize: "12px",
  color: "#8aab9b",
  lineHeight: "1.5",
  padding: "0 10px",
};
