"use client";

import { useEffect, useRef, useState } from "react";

export interface PemabuLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

const CX = 50;
const CY = 50;
const R = 34;
const GAP_DEG = 3;
const BASE_PCTS = [38, 28, 22, 12];
const COLORS = ["#10b981", "#C9A84C", "#3B82F6", "#6B7280"];
const PHASES = [0, 2.5, 5, 7.5];
const CYCLE = 10;

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(startAngle: number, endAngle: number, r = R): string {
  const s = polarToCartesian(CX, CY, r, startAngle);
  const e = polarToCartesian(CX, CY, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x.toFixed(4)} ${s.y.toFixed(4)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(4)} ${e.y.toFixed(4)}`;
}

function segmentAngles(pcts: number[]): Array<{ start: number; end: number }> {
  const avail = 360 - GAP_DEG * pcts.length;
  const angles: Array<{ start: number; end: number }> = [];
  let cur = -90;
  for (const pct of pcts) {
    const span = (pct / 100) * avail;
    angles.push({ start: cur, end: cur + span });
    cur += span + GAP_DEG;
  }
  return angles;
}

interface RingProps {
  pcts: number[];
  strokeWidth: number;
  orbitAngle?: number;
}

function Ring({ pcts, strokeWidth, orbitAngle }: RingProps) {
  const segs = segmentAngles(pcts);
  const orbitPos =
    orbitAngle !== undefined
      ? polarToCartesian(CX, CY, R, orbitAngle)
      : null;

  return (
    <>
      <circle
        cx={CX}
        cy={CY}
        r={36}
        stroke="#10b981"
        strokeWidth={18}
        strokeOpacity={0.06}
        fill="none"
      />

      {segs.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.start, seg.end)}
          fill="none"
          stroke={COLORS[i]}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ))}

      <circle
        cx={CX}
        cy={CY}
        r={27}
        stroke="#0A1628"
        strokeWidth={3}
        strokeOpacity={0.6}
        fill="none"
      />

      {orbitPos && (
        <>
          <circle
            cx={orbitPos.x}
            cy={orbitPos.y}
            r={5}
            fill="#84cc16"
            opacity={0.35}
          />
          <circle
            cx={orbitPos.x}
            cy={orbitPos.y}
            r={2.8}
            fill="#ffffff"
            opacity={0.85}
          />
        </>
      )}
    </>
  );
}

function LetterP() {
  return (
    <path
      d="M 44 62 L 44 38 C 60 36 62 50 44 50"
      fill="none"
      stroke="#ffffff"
      strokeWidth={3}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    />
  );
}

export default function PemabuLogo({
  size = 64,
  animate = true,
  className,
}: PemabuLogoProps) {
  const [pcts, setPcts] = useState<number[]>([...BASE_PCTS]);
  const [orbitAngle, setOrbitAngle] = useState(-90);
  const rafRef = useRef<number | undefined>(undefined);
  const t0 = useRef(0);

  useEffect(() => {
    if (!animate) return;

    t0.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - t0.current) / 1000;

      const raw = BASE_PCTS.map((base, i) => {
        const delta =
          4 * Math.sin((2 * Math.PI * (elapsed - PHASES[i])) / CYCLE);
        return Math.max(6, base + delta);
      });

      const sum = raw.reduce((a, b) => a + b, 0);
      setPcts(raw.map((p) => (p / sum) * 100));
      setOrbitAngle(((elapsed / 12) % 1) * 360 - 90);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Ring
        pcts={pcts}
        strokeWidth={14}
        orbitAngle={animate ? orbitAngle : undefined}
      />
      <LetterP />
    </svg>
  );
}

export function PemabuLogoCompact({
  size = 32,
  className,
}: Omit<PemabuLogoProps, "animate">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Ring pcts={BASE_PCTS} strokeWidth={9} />
      <LetterP />
    </svg>
  );
}
