import type { CijferModel, CijferNorm, Moeilijkheid } from "./types";

export const DEFAULT_CIJFER: CijferNorm = {
  model: "lineair",
  cesuurPct: 55,
  exponent: 1,
};

export type VoldoendeStand = "makkelijker" | "normaal" | "moeilijker";

export const VOLDOENDE_PRESETS: Record<
  VoldoendeStand,
  Pick<CijferNorm, "cesuurPct" | "exponent">
> = {
  makkelijker: { cesuurPct: 45, exponent: 0.7 },
  normaal: { cesuurPct: 55, exponent: 1 },
  moeilijker: { cesuurPct: 65, exponent: 1.45 },
};

export const MOEILIJKHEID_CIJFER: Record<
  Moeilijkheid,
  Pick<CijferNorm, "cesuurPct" | "exponent">
> = {
  makkelijk: VOLDOENDE_PRESETS.makkelijker,
  normaal: VOLDOENDE_PRESETS.normaal,
  moeilijk: VOLDOENDE_PRESETS.moeilijker,
};

export function nlCijfer(n: number): string {
  return roundCijfer(n).toFixed(1).replace(".", ",");
}

export function roundCijfer(n: number): number {
  const clamped = Math.min(10, Math.max(1, n));
  return Math.round((clamped + Number.EPSILON) * 10) / 10;
}

export function cijferVanScoreRaw(
  score: number,
  max: number,
  norm: CijferNorm = DEFAULT_CIJFER,
): number {
  if (max <= 0) return 1;
  const p = Math.max(0, Math.min(max, score));
  const x = p / max;
  if (norm.model === "lineair") return 1 + 9 * x;
  if (norm.model === "exponentieel") {
    const k = Math.max(0.3, Math.min(3, norm.exponent || 1));
    return 1 + 9 * Math.pow(x, k);
  }
  const cesuurScore = (Math.max(5, Math.min(95, norm.cesuurPct)) / 100) * max;
  if (p <= cesuurScore) {
    if (cesuurScore <= 0) return 1;
    return 1 + 4.5 * (p / cesuurScore);
  }
  const rest = max - cesuurScore;
  if (rest <= 0) return 10;
  return 5.5 + 4.5 * ((p - cesuurScore) / rest);
}

export function cijferVanScore(
  score: number,
  max: number,
  norm: CijferNorm = DEFAULT_CIJFER,
): number {
  return roundCijfer(cijferVanScoreRaw(score, max, norm));
}

export function cesuurPunten(max: number, norm: CijferNorm): number {
  for (let s = 0; s <= max; s++) {
    if (cijferVanScore(s, max, norm) >= 5.5) return s;
  }
  return Math.round(0.5 * max);
}

export function formuleTekst(norm: CijferNorm, max: number): string {
  if (norm.model === "lineair") {
    return `cijfer = 1 + 9 × (score / ${max})   ·  elk punt telt even zwaar, 1,0–10,0`;
  }
  if (norm.model === "exponentieel") {
    return `cijfer = 1 + 9 × (score / ${max})^${norm.exponent.toFixed(2)}   ·  exponentieel`;
  }
  const c = cesuurPunten(max, { ...norm, model: "gebroken" });
  return `Gebroken grafiek: 0p → 1,0  ·  ${c}p → 5,5  ·  ${max}p → 10,0`;
}

export function modelLabel(model: CijferModel): string {
  if (model === "lineair") return "Lineair (1,0–10,0)";
  if (model === "gebroken") return "Gebroken grafiek";
  return "Exponentieel";
}

export function applyVoldoende(model: CijferModel, stand: VoldoendeStand): CijferNorm {
  if (model === "lineair") return { ...DEFAULT_CIJFER, model: "lineair" };
  const p = VOLDOENDE_PRESETS[stand];
  return { model, cesuurPct: p.cesuurPct, exponent: p.exponent };
}

export function huidigeVoldoende(norm: CijferNorm): VoldoendeStand | null {
  if (norm.model === "lineair") return null;
  if (norm.model === "gebroken") {
    if (norm.cesuurPct <= 48) return "makkelijker";
    if (norm.cesuurPct >= 62) return "moeilijker";
    return "normaal";
  }
  if (norm.exponent <= 0.85) return "makkelijker";
  if (norm.exponent >= 1.25) return "moeilijker";
  return "normaal";
}

export function voldoendeHint(norm: CijferNorm): string {
  if (norm.model === "lineair") {
    return "Bij lineair ligt een 5,5 altijd op 50% van de punten. Kies gebroken of exponentieel om de voldoende te verschuiven.";
  }
  if (norm.model === "gebroken") {
    const pct = Math.round(norm.cesuurPct);
    if (pct < 50) return `Voldoende is relatief makkelijk: 5,5 bij ${pct}% van de punten.`;
    if (pct > 58) return `Voldoende is relatief moeilijk: 5,5 bij ${pct}% van de punten.`;
    return `Voldoende rond de gebruikelijke cesuur: 5,5 bij ${pct}% van de punten.`;
  }
  const k = norm.exponent;
  if (k < 0.9) return "De kromme buigt omhoog: middelste scores krijgen een hoger cijfer.";
  if (k > 1.15) return "De kromme buigt omlaag: middelste scores krijgen een lager cijfer.";
  return "Bijna lineair. Schuif de exponent om de voldoende te verzwaren of te verlichten.";
}

export function omzetTabel(max: number, norm: CijferNorm): { punten: number; cijfer: number }[] {
  const out: { punten: number; cijfer: number }[] = [];
  const step = max > 50 ? 2 : 1;
  for (let p = 0; p <= max; p += step) {
    out.push({ punten: p, cijfer: cijferVanScore(p, max, norm) });
  }
  if (out[out.length - 1]?.punten !== max) {
    out.push({ punten: max, cijfer: cijferVanScore(max, max, norm) });
  }
  return out;
}

export function curvePunten(
  max: number,
  norm: CijferNorm,
): { p: number; cijfer: number }[] {
  if (norm.model === "lineair") {
    return [
      { p: 0, cijfer: 1 },
      { p: max, cijfer: 10 },
    ];
  }
  if (norm.model === "gebroken") {
    const ces = (Math.max(5, Math.min(95, norm.cesuurPct)) / 100) * max;
    return [
      { p: 0, cijfer: 1 },
      { p: ces, cijfer: 5.5 },
      { p: max, cijfer: 10 },
    ];
  }
  const n = 64;
  const out: { p: number; cijfer: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * max;
    out.push({ p, cijfer: cijferVanScoreRaw(p, max, norm) });
  }
  return out;
}
