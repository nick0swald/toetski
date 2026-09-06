import type { Leerweg, Moeilijkheid, Rtti, RttiVerdeling, ToetsVersie } from "./types";

export const SCHOOL = "Ares058 VMBO Leeuwarden";
export const APP_NAME = "Ares058 Toetsmaker";

export const LEERWEGEN: { id: Leerweg; label: string; hint: string }[] = [
  { id: "BB", label: "BB", hint: "Basis" },
  { id: "KB", label: "KB", hint: "Kader" },
  { id: "GT", label: "GT", hint: "Gemengd/theoretisch — ook HGL" },
];

export const VERSIES: { id: ToetsVersie; label: string; hint: string }[] = [
  { id: "A", label: "A", hint: "Eerste afname" },
  { id: "B", label: "B", hint: "Parallel, andere getallen/context" },
];

export const MOEILIJKHEDEN: { id: Moeilijkheid; label: string; hint: string }[] = [
  { id: "makkelijk", label: "Makkelijk", hint: "Meer R/T1, kortere zinnen" },
  { id: "normaal", label: "Normaal", hint: "Passend bij leerjaar" },
  { id: "moeilijk", label: "Moeilijk", hint: "Meer T2/I" },
];

export const RTTI_ORDER: Rtti[] = ["R", "T1", "T2", "I"];

export const RTTI_META: Record<Rtti, { kort: string; naam: string; uitleg: string }> = {
  R: { kort: "R", naam: "Reproductie", uitleg: "Letterlijk kennen: begrip, feit, formule, stappenplan." },
  T1: { kort: "T1", naam: "Toepassing bekend", uitleg: "Getrainde procedure in een geoefende context." },
  T2: { kort: "T2", naam: "Toepassing nieuw", uitleg: "Combineren in een context die niet geoefend is." },
  I: { kort: "I", naam: "Inzicht", uitleg: "Analyseren, verklaren, verbanden, een oplossing construeren." },
};

export const RTTI_PRESETS: Record<string, { label: string; verdeling: RttiVerdeling }> = {
  onderbouw: { label: "Onderbouw (klas 1–2)", verdeling: { R: 35, T1: 40, T2: 20, I: 5 } },
  bovenbouw: { label: "Bovenbouw (klas 3–4)", verdeling: { R: 25, T1: 35, T2: 25, I: 15 } },
};

export function presetVoorLeerjaar(jaar: 1 | 2 | 3 | 4): keyof typeof RTTI_PRESETS {
  return jaar <= 2 ? "onderbouw" : "bovenbouw";
}

export function rttiVoorMoeilijkheid(basis: RttiVerdeling, m: Moeilijkheid): RttiVerdeling {
  if (m === "makkelijk") return { R: basis.R + 10, T1: basis.T1 + 5, T2: Math.max(5, basis.T2 - 10), I: Math.max(0, basis.I - 5) };
  if (m === "moeilijk") return { R: Math.max(10, basis.R - 10), T1: Math.max(15, basis.T1 - 5), T2: basis.T2 + 10, I: basis.I + 5 };
  return { ...basis };
}

export function normalizeLeerweg(s: string): Leerweg {
  const x = s.toUpperCase().trim();
  if (x === "BB" || x.includes("BASIS")) return "BB";
  if (x === "GT" || x === "TL" || x === "HGL" || x.includes("THEO")) return "GT";
  return "KB";
}
