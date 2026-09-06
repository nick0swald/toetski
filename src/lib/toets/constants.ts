import type {
  CijferNorm,
  Leerweg,
  Moeilijkheid,
  Rtti,
  RttiVerdeling,
  ToetsVersie,
  VakProfiel,
} from "./types";
import { DEFAULT_CIJFER, MOEILIJKHEID_CIJFER } from "./cijfer";

export const SCHOOL = "Aeres VMBO Leeuwarden";
export const APP_NAME = "Aeres Toetsmaker";

export const LEERWEGEN: { id: Leerweg; label: string; hint: string }[] = [
  { id: "BB", label: "BB", hint: "Basis" },
  { id: "KB", label: "KB", hint: "Kader" },
  { id: "GT", label: "GT", hint: "Gemengd/theoretisch — ook HGL" },
];

export const VERSIES: { id: ToetsVersie; label: string; hint: string }[] = [
  { id: "A", label: "A", hint: "Eerste afname" },
  { id: "B", label: "B", hint: "Parallel, andere getallen/context" },
];

export const MOEILIJKHEDEN: {
  id: Moeilijkheid;
  label: string;
  hint: string;
}[] = [
  { id: "makkelijk", label: "Makkelijk", hint: "Meer R/T1, eenvoudiger taal" },
  { id: "normaal", label: "Normaal", hint: "Passend bij leerjaar en leerweg" },
  { id: "moeilijk", label: "Moeilijk", hint: "Meer T2/I, grotere stappen" },
];

export const VAKPROFIELEN: { id: VakProfiel; label: string; hint: string }[] = [
  { id: "generiek", label: "Generiek", hint: "Alle vakken" },
  { id: "nask", label: "NaSk", hint: "Formules, eenheden, tabel/grafiek" },
];

export function normalizeLeerweg(raw: string | undefined | null): Leerweg {
  const u = (raw ?? "").trim().toUpperCase();
  if (u === "BB" || u.startsWith("BASIS")) return "BB";
  if (u === "KB" || u.startsWith("KADER")) return "KB";
  return "GT";
}

export const RTTI_META: Record<
  Rtti,
  { naam: string; kort: string; uitleg: string }
> = {
  R: {
    naam: "Reproductie",
    kort: "R",
    uitleg: "Kennis letterlijk weergeven: begrip, feit, formule, stappenplan.",
  },
  T1: {
    naam: "Toepassing (bekend)",
    kort: "T1",
    uitleg: "Getrainde procedure in een bekende, geoefende context.",
  },
  T2: {
    naam: "Toepassing (nieuw)",
    kort: "T2",
    uitleg: "Geleerde stof combineren in een nieuwe, niet-geoefende context.",
  },
  I: {
    naam: "Inzicht",
    kort: "I",
    uitleg: "Analyseren, verklaren, verbanden leggen, een oplossing construeren.",
  },
};

export const RTTI_PRESETS: Record<
  string,
  { label: string; hint: string; verdeling: RttiVerdeling }
> = {
  onderbouw: {
    label: "Onderbouw",
    hint: "Klas 1–2 · meer reproductie en training",
    verdeling: { R: 35, T1: 40, T2: 20, I: 5 },
  },
  bovenbouw: {
    label: "Bovenbouw",
    hint: "Klas 3–4 · meer transfer",
    verdeling: { R: 20, T1: 40, T2: 30, I: 10 },
  },
  examen: {
    label: "Examengericht",
    hint: "Dichter bij CSE/CSPE",
    verdeling: { R: 15, T1: 35, T2: 35, I: 15 },
  },
};

export const RTTI_PRESET_KEUZES: {
  id: keyof typeof RTTI_PRESETS;
  label: string;
  hint: string;
}[] = [
  { id: "onderbouw", label: "Onderbouw", hint: "Klas 1–2" },
  { id: "bovenbouw", label: "Bovenbouw", hint: "Klas 3–4" },
  { id: "examen", label: "Examengericht", hint: "CSE/CSPE" },
];

export const RTTI_ORDER: Rtti[] = ["R", "T1", "T2", "I"];

export function presetVoorLeerjaar(jaar: number): keyof typeof RTTI_PRESETS {
  return jaar <= 2 ? "onderbouw" : jaar === 4 ? "examen" : "bovenbouw";
}

export function rttiVoorMoeilijkheid(
  basis: RttiVerdeling,
  m: Moeilijkheid,
): RttiVerdeling {
  const raw: RttiVerdeling =
    m === "normaal"
      ? basis
      : m === "makkelijk"
        ? {
            R: Math.min(50, basis.R + 10),
            T1: basis.T1 + 5,
            T2: Math.max(5, basis.T2 - 10),
            I: Math.max(0, basis.I - 5),
          }
        : {
            R: Math.max(10, basis.R - 10),
            T1: Math.max(20, basis.T1 - 5),
            T2: basis.T2 + 10,
            I: basis.I + 5,
          };
  const som = raw.R + raw.T1 + raw.T2 + raw.I;
  if (som === 100) return raw;
  return {
    R: Math.round((raw.R / som) * 100),
    T1: Math.round((raw.T1 / som) * 100),
    T2: Math.round((raw.T2 / som) * 100),
    I: Math.round((raw.I / som) * 100),
  };
}

export function cijferVoorMoeilijkheid(
  m: Moeilijkheid,
  model: CijferNorm["model"] = "gebroken",
): CijferNorm {
  const extra = MOEILIJKHEID_CIJFER[m];
  if (model === "lineair") return { ...DEFAULT_CIJFER };
  return { model, cesuurPct: extra.cesuurPct, exponent: extra.exponent };
}
