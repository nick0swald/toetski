import { RTTI_ORDER } from "./constants";
import type { GegenereerdeToets, Rtti, RttiVerdeling, Toetsmatrijs, Vraag } from "./types";

export function somVerdeling(v: RttiVerdeling): number {
  return v.R + v.T1 + v.T2 + v.I;
}

export function normaliseer(v: RttiVerdeling): RttiVerdeling {
  const s = somVerdeling(v);
  if (s <= 0) return { R: 25, T1: 25, T2: 25, I: 25 };
  return {
    R: Math.round((v.R / s) * 100),
    T1: Math.round((v.T1 / s) * 100),
    T2: Math.round((v.T2 / s) * 100),
    I: Math.round((v.I / s) * 100),
  };
}

export function totaalPunten(vragen: Vraag[]): number {
  return vragen.reduce((s, q) => s + (q.punten || 0), 0);
}

function emptyCel(): { vraagnummers: number[]; punten: number } {
  return { vraagnummers: [], punten: 0 };
}

export function bouwMatrijs(vragen: Vraag[], doel: RttiVerdeling): Toetsmatrijs {
  const domeinen = [...new Set(vragen.map((q) => q.domein || "Algemeen"))];
  const cellen: Toetsmatrijs["cellen"] = {};
  for (const d of domeinen) {
    cellen[d] = { R: emptyCel(), T1: emptyCel(), T2: emptyCel(), I: emptyCel() };
  }
  for (const q of vragen) {
    const d = q.domein || "Algemeen";
    if (!cellen[d]) cellen[d] = { R: emptyCel(), T1: emptyCel(), T2: emptyCel(), I: emptyCel() };
    const cel = cellen[d][q.rtti];
    cel.vraagnummers.push(q.nummer);
    cel.punten += q.punten;
  }
  const max = Math.max(1, totaalPunten(vragen));
  const totalen = {} as Toetsmatrijs["totalen"];
  for (const k of RTTI_ORDER) {
    const punten = vragen.filter((q) => q.rtti === k).reduce((s, q) => s + q.punten, 0);
    totalen[k] = { punten, percentage: Math.round((punten / max) * 100) };
  }
  return { domeinen, cellen, totalen, doelverdeling: normaliseer(doel) };
}

export function herbouwMatrijs(toets: GegenereerdeToets): GegenereerdeToets {
  return {
    ...toets,
    matrijs: bouwMatrijs(toets.vragen, toets.matrijs?.doelverdeling ?? { R: 25, T1: 25, T2: 25, I: 25 }),
  };
}

export function rttiAfwijking(matrijs: Toetsmatrijs): Record<Rtti, number> {
  const out = {} as Record<Rtti, number>;
  for (const k of RTTI_ORDER) {
    out[k] = (matrijs.totalen[k]?.percentage ?? 0) - (matrijs.doelverdeling[k] ?? 0);
  }
  return out;
}
