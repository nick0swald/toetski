import { RTTI_ORDER } from "./constants";
import type {
  GegenereerdeToets,
  MatrijsCel,
  Rtti,
  RttiVerdeling,
  Toetsmatrijs,
  Vraag,
} from "./types";

export function somVerdeling(v: RttiVerdeling): number {
  return v.R + v.T1 + v.T2 + v.I;
}

export function normaliseer(v: RttiVerdeling): RttiVerdeling {
  const som = somVerdeling(v);
  if (som <= 0) return { R: 25, T1: 25, T2: 25, I: 25 };
  const raw = RTTI_ORDER.map((k) => (v[k] / som) * 100);
  const rounded = raw.map((n) => Math.round(n));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  rounded[0] += drift;
  return { R: rounded[0], T1: rounded[1], T2: rounded[2], I: rounded[3] };
}

export function totaalPunten(vragen: Vraag[]): number {
  return vragen.reduce((s, q) => s + (Number(q.punten) || 0), 0);
}

export function puntenPerRtti(vragen: Vraag[]): Record<Rtti, number> {
  const out: Record<Rtti, number> = { R: 0, T1: 0, T2: 0, I: 0 };
  for (const q of vragen) {
    if (out[q.rtti] !== undefined) out[q.rtti] += Number(q.punten) || 0;
  }
  return out;
}

export function percentagePerRtti(vragen: Vraag[]): Record<Rtti, number> {
  const totaal = totaalPunten(vragen);
  const p = puntenPerRtti(vragen);
  if (totaal <= 0) return { R: 0, T1: 0, T2: 0, I: 0 };
  const raw = RTTI_ORDER.map((k) => (p[k] / totaal) * 100);
  const rounded = raw.map((n) => Math.round(n));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  rounded[0] += drift;
  return { R: rounded[0], T1: rounded[1], T2: rounded[2], I: rounded[3] };
}

export function bouwMatrijs(
  vragen: Vraag[],
  doelverdeling: RttiVerdeling,
): Toetsmatrijs {
  const domeinen: string[] = [];
  const cellen: Toetsmatrijs["cellen"] = {};

  const emptyCel = (): MatrijsCel => ({ vraagnummers: [], punten: 0 });

  for (const q of vragen) {
    const domein = q.domein?.trim() || "Algemeen";
    if (!domeinen.includes(domein)) domeinen.push(domein);
    if (!cellen[domein]) {
      cellen[domein] = {
        R: emptyCel(),
        T1: emptyCel(),
        T2: emptyCel(),
        I: emptyCel(),
      };
    }
    const cel = cellen[domein][q.rtti];
    cel.vraagnummers.push(q.nummer);
    cel.punten += Number(q.punten) || 0;
  }

  const p = puntenPerRtti(vragen);
  const perc = percentagePerRtti(vragen);
  const totalen = {
    R: { punten: p.R, percentage: perc.R },
    T1: { punten: p.T1, percentage: perc.T1 },
    T2: { punten: p.T2, percentage: perc.T2 },
    I: { punten: p.I, percentage: perc.I },
  };

  return { domeinen, cellen, totalen, doelverdeling: normaliseer(doelverdeling) };
}

export function herbouwMatrijs(toets: GegenereerdeToets): GegenereerdeToets {
  return {
    ...toets,
    matrijs: bouwMatrijs(toets.vragen, toets.matrijs.doelverdeling),
  };
}

export function afwijking(
  actual: number,
  doel: number,
): "ok" | "ruim" | "krap" {
  const d = actual - doel;
  if (Math.abs(d) <= 5) return "ok";
  return d > 0 ? "ruim" : "krap";
}

export { cijferVanScore } from "./cijfer";
