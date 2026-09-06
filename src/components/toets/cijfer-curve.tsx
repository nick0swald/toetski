import {
  cesuurPunten,
  cijferVanScore,
  curvePunten,
  nlCijfer,
} from "@/lib/toets/cijfer";
import type { CijferNorm } from "@/lib/toets/types";

function pathFromPoints(
  pts: { x: number; y: number }[],
  smooth: boolean,
): string {
  if (pts.length === 0) return "";
  const fmt = (n: number) => n.toFixed(2);
  if (!smooth || pts.length < 4) {
    return pts
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${fmt(pt.x)} ${fmt(pt.y)}`)
      .join(" ");
  }
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

export function CijferCurve({
  max,
  norm,
  score,
  height = 180,
}: {
  max: number;
  norm: CijferNorm;
  score?: number;
  height?: number;
}) {
  const W = 360;
  const H = 180;
  const pad = { l: 32, r: 10, t: 14, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const safeMax = Math.max(1, max);
  const pts = curvePunten(safeMax, norm);
  const xOf = (p: number) => pad.l + (p / safeMax) * innerW;
  const yOf = (c: number) => pad.t + (1 - (c - 1) / 9) * innerH;
  const xy = pts.map((pt) => ({ x: xOf(pt.p), y: yOf(pt.cijfer) }));
  const d = pathFromPoints(xy, norm.model === "exponentieel");
  const ces = cesuurPunten(safeMax, norm);
  const cesX = xOf(ces);
  const scoreC = score == null ? null : cijferVanScore(score, safeMax, norm);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full min-w-0 max-w-full"
      style={{ height }}
      role="img"
      aria-label={`Cijfercurve ${norm.model}, 5,5 bij ${ces} van ${safeMax} punten`}
    >
      <title>{`Cijfercurve: 0p = 1,0 · ${ces}p = 5,5 · ${safeMax}p = 10,0`}</title>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} stroke="currentColor" className="text-border" />
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={pad.l + innerW}
        y2={pad.t + innerH}
        stroke="currentColor"
        className="text-border"
      />
      {[1, 5.5, 10].map((tick) => (
        <g key={tick}>
          <line
            x1={pad.l - 3}
            y1={yOf(tick)}
            x2={pad.l + innerW}
            y2={yOf(tick)}
            stroke="currentColor"
            strokeDasharray={tick === 5.5 ? "4 4" : undefined}
            className={tick === 5.5 ? "text-primary/40" : "text-border"}
          />
          <text
            x={pad.l - 6}
            y={yOf(tick) + 3}
            textAnchor="end"
            className="fill-muted"
            fontSize="10"
          >
            {nlCijfer(tick)}
          </text>
        </g>
      ))}
      <line
        x1={cesX}
        y1={pad.t}
        x2={cesX}
        y2={pad.t + innerH}
        stroke="currentColor"
        strokeDasharray="4 4"
        className="text-primary/50"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {scoreC != null && score != null ? (
        <>
          <circle cx={xOf(score)} cy={yOf(scoreC)} r="5" fill="var(--color-primary)" />
          <text
            x={Math.min(xOf(score) + 8, pad.l + innerW - 4)}
            y={yOf(scoreC) - 8}
            className="fill-brand"
            fontSize="11"
            fontWeight="600"
          >
            {nlCijfer(scoreC)}
          </text>
        </>
      ) : null}
      <text x={pad.l} y={H - 6} className="fill-muted" fontSize="10">
        0p
      </text>
      <text x={cesX} y={H - 6} textAnchor="middle" className="fill-brand" fontSize="10">
        {ces}p → 5,5
      </text>
      <text x={pad.l + innerW} y={H - 6} textAnchor="end" className="fill-muted" fontSize="10">
        {safeMax}p
      </text>
    </svg>
  );
}
