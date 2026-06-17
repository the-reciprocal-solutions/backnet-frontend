import React from 'react';

/**
 * Simple SVG donut chart.
 * segments: [{ value, color }]
 * total: number shown in the center
 * label: text below the number
 */
export default function DonutChart({ segments, total, label }) {
  const r = 70, cx = 90, cy = 90, strokeWidth = 22;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <svg viewBox="0 0 180 180" width="180" height="180">
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f5f2" strokeWidth={strokeWidth} />

      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circumference;
        const gap  = circumference - dash;
        const rotate = cumulative * 360 - 90;
        cumulative += pct;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
        );
      })}

      <text x={cx} y={cy - 8}  textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f2d1e">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#8aab9b">{label}</text>
    </svg>
  );
}
