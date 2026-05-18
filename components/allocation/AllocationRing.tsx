"use client";

import { useMemo, useState } from "react";
import type { AssetClass, AllocationWeight } from "@/lib/types/database";
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from "@/lib/constants/asset-classes";

export interface AllocationRingProps {
  allocation: AllocationWeight[];
  size?: number;
  interactive?: boolean;
  className?: string;
}

type Segment = {
  asset_class: AssetClass;
  actual_pct: number;
  target_pct: number;
  drift_pct: number;
  color: string;
  label: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.min(endAngle - startAngle, 359.99);
  const end = startAngle + sweep;
  const [ox1, oy1] = polar(cx, cy, outerR, startAngle);
  const [ox2, oy2] = polar(cx, cy, outerR, end);
  const [ix2, iy2] = polar(cx, cy, innerR, end);
  const [ix1, iy1] = polar(cx, cy, innerR, startAngle);
  const large = sweep > 180 ? 1 : 0;
  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}`,
    "Z",
  ].join(" ");
}

function buildSegments(allocation: AllocationWeight[]): Segment[] {
  return allocation
    .filter((a) => a.actual_pct > 0.05 || a.target_pct > 0.05)
    .map((a) => ({
      asset_class: a.asset_class,
      actual_pct: a.actual_pct,
      target_pct: a.target_pct,
      drift_pct: a.drift_pct,
      color: ASSET_CLASS_COLORS[a.asset_class] ?? "#6B7280",
      label: ASSET_CLASS_LABELS[a.asset_class] ?? a.asset_class,
    }));
}

export function AllocationRing({
  allocation,
  size = 120,
  interactive = true,
  className = "",
}: AllocationRingProps) {
  const [selected, setSelected] = useState<AssetClass | null>(null);
  const [hovered, setHovered] = useState<AssetClass | null>(null);

  const segments = useMemo(() => buildSegments(allocation), [allocation]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.28;
  const targetR = size * 0.35;

  let angle = 0;
  const active = hovered ?? selected;

  const actualArcs = segments.map((seg) => {
    const sweep = (seg.actual_pct / 100) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const dimmed = active != null && active !== seg.asset_class;
    return (
      <path
        key={`actual-${seg.asset_class}`}
        d={donutSlicePath(cx, cy, outerR, innerR, start, end)}
        fill={seg.color}
        fillOpacity={dimmed ? 0.25 : 0.9}
        stroke={active === seg.asset_class ? "#f8fafc" : "transparent"}
        strokeWidth={active === seg.asset_class ? 2 : 0}
        className={interactive ? "cursor-pointer transition-opacity" : undefined}
        onMouseEnter={interactive ? () => setHovered(seg.asset_class) : undefined}
        onMouseLeave={interactive ? () => setHovered(null) : undefined}
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation();
                setSelected((s) => (s === seg.asset_class ? null : seg.asset_class));
              }
            : undefined
        }
        role={interactive ? "button" : undefined}
        aria-label={`${seg.label}: ${seg.actual_pct.toFixed(1)}% actual, target ${seg.target_pct.toFixed(1)}%`}
      />
    );
  });

  let targetAngle = 0;
  const targetMarkers = segments.map((seg) => {
    const midPct = targetAngle + seg.target_pct / 2;
    targetAngle += seg.target_pct;
    const [tx, ty] = polar(cx, cy, targetR, (midPct / 100) * 360);
    const show = active == null || active === seg.asset_class;
    return (
      <circle
        key={`target-${seg.asset_class}`}
        cx={tx}
        cy={ty}
        r={3}
        fill={seg.color}
        stroke="#0f172a"
        strokeWidth={1}
        opacity={show ? 1 : 0.2}
      />
    );
  });

  const focus = segments.find((s) => s.asset_class === active);

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden={!interactive}>
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          {actualArcs}
          <circle
            cx={cx}
            cy={cy}
            r={targetR}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {targetMarkers}
          <circle cx={cx} cy={cy} r={innerR - 2} fill="#0A1628" />
          {focus ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">
                {focus.label.length > 12 ? `${focus.label.slice(0, 11)}…` : focus.label}
              </text>
              <text x={cx} y={cy + 8} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontWeight={600}>
                {focus.actual_pct.toFixed(1)}%
              </text>
            </>
          ) : (
            <text x={cx} y={cy + 4} textAnchor="middle" fill="#64748b" fontSize={9}>
              {interactive ? "tap ring" : "allocation"}
            </text>
          )}
        </svg>
        {interactive && segments.length > 0 ? (
          <ul className="w-full max-w-[200px] space-y-1 text-[10px] text-gray-500">
            {segments.map((seg) => (
              <li
                key={seg.asset_class}
                className={`flex justify-between gap-2 rounded px-1 py-0.5 ${
                  active === seg.asset_class ? "bg-white/5 text-gray-300" : ""
                }`}
              >
                <span className="truncate">
                  <span style={{ color: seg.color }}>●</span> {seg.label}
                </span>
                <span className="shrink-0 font-mono text-gray-400">
                  {seg.actual_pct.toFixed(1)}% / {seg.target_pct.toFixed(0)}%
                  {Math.abs(seg.drift_pct) >= 5 ? (
                    <span className={seg.drift_pct > 0 ? " text-amber-400" : " text-sky-400"}>
                      {" "}
                      {seg.drift_pct > 0 ? "+" : ""}
                      {seg.drift_pct.toFixed(1)}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
