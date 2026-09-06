import type { VraagGrafiek, VraagTabel } from "@/lib/toets/types";

export function BronTabel({ tabel }: { tabel: VraagTabel }) {
  if (!tabel.koppen.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-bg/60">
      <table className="w-full min-w-[12rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {tabel.koppen.map((k) => (
              <th key={k} className="px-3 py-2 font-semibold text-brand">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabel.rijen.map((rij, i) => (
            <tr key={i} className="border-b border-border last:border-b-0">
              {rij.map((cel, j) => (
                <td key={j} className="px-3 py-1.5 tabular-nums">
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BronGrafiek({ grafiek }: { grafiek: VraagGrafiek }) {
  const pts = grafiek.punten;
  if (pts.length < 2) return null;
  const W = 320;
  const H = 180;
  const pad = { l: 40, r: 12, t: 18, b: 32 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const xOf = (x: number) => pad.l + ((x - minX) / spanX) * (W - pad.l - pad.r);
  const yOf = (y: number) => pad.t + (1 - (y - minY) / spanY) * (H - pad.t - pad.b);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.x).toFixed(1)} ${yOf(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <figure className="mt-3 rounded-[var(--radius-sm)] border border-border bg-bg/60 p-3">
      {grafiek.titel ? (
        <figcaption className="mb-1 text-sm font-semibold text-brand">
          {grafiek.titel}
        </figcaption>
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-md"
        role="img"
        aria-label={grafiek.titel || "Grafiek"}
      >
        <line
          x1={pad.l}
          y1={pad.t}
          x2={pad.l}
          y2={H - pad.b}
          stroke="currentColor"
          className="text-border"
        />
        <line
          x1={pad.l}
          y1={H - pad.b}
          x2={W - pad.r}
          y2={H - pad.b}
          stroke="currentColor"
          className="text-border"
        />
        <path
          d={d}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={xOf(p.x)}
            cy={yOf(p.y)}
            r="3.2"
            fill="var(--color-brand)"
          />
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-muted" fontSize="10">
          {grafiek.xLabel}
        </text>
        <text
          x={12}
          y={H / 2}
          textAnchor="middle"
          className="fill-muted"
          fontSize="10"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          {grafiek.yLabel}
        </text>
      </svg>
    </figure>
  );
}
