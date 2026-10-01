import type { Moeilijkheid, Rtti, RttiVerdeling } from "./types";

/**
 * ENIGE plek voor modellen, tijdsbudgetten en RTTI-doelen van Toetski (opgeschoond 1 okt 2026).
 *
 * Bewaakt door `config.test.ts`: een Grok.com-export die modellen, timeouts, het afwerkbudget of
 * Vercel maxDuration terugzet (eerder gebeurd met callGrok), laat `npm test` falen. Wijzig waarden
 * hier én in de test, met reden in de PR.
 *
 * Isomorf: geen process.env, geen node-API's (wordt ook in de browser geïmporteerd).
 */

// ── Modellen ────────────────────────────────────────────────────────────────────────────────────
/** Nick, 1 okt 2026: vragen SCHRIJVEN en REPAREREN op grok-4.5 (was grok-4.20-0309-non-reasoning). */
export const MODELLEN = {
  /** Bouwplan (plan-first): per vraag paragraaf, vorm, RTTI, punten, begrip, context, persoon. */
  plannen: "grok-4.5",
  /** Vragen schrijven (toets, extra vragen, bijschaven). */
  schrijven: "grok-4.5",
  /** Reparatieronde(s) na de inhoudscontrole. */
  repareren: "grok-4.5",
  /** Onafhankelijke inhoudscontrole (sleutel, oplosbaarheid, realisme, rubriek, RTTI). */
  controle: "grok-4.5",
  /** Snelle, niet-redenerende taken: figuurplanner/figuur-JSON en matrijs bij een bestaande toets. */
  snel: "grok-4.20-0309-non-reasoning",
  /** Sfeerplaten (Grok Imagine). */
  beeld: "grok-imagine-image-2.0",
  /** Go/no-go-keuring van figuren (tekst + beeld). */
  visie: "grok-4.5",
} as const;

export type ModelRol = keyof typeof MODELLEN;

/** Redeneerinspanning per rol (alleen voor redenerende modellen). */
export const REDENEREN: Partial<Record<ModelRol, "low" | "medium" | "high">> = {
  plannen: "low",
  schrijven: "low",
  repareren: "low",
  controle: "low",
};

/** Temperatuur per rol. */
export const TEMPERATUUR: Partial<Record<ModelRol, number>> = {
  plannen: 0.5,
  schrijven: 0.4,
  repareren: 0.3,
  controle: 0,
  snel: 0.4,
};

export const XAI_BASE = "https://api.x.ai/v1";

/** Prijzen (USD per 1M tokens, < 200k prompt; docs.x.ai, 1 okt 2026). Alleen terugval als de API geen kosten meldt. */
export const PRIJZEN: Record<string, { in: number; cache: number; uit: number }> = {
  "grok-4.5": { in: 2.0, cache: 0.3, uit: 6.0 },
  "grok-4.20-0309-non-reasoning": { in: 1.25, cache: 0.2, uit: 2.5 },
};

// ── Tijd (server-side) ──────────────────────────────────────────────────────────────────────────
/**
 * Elke server-functie-aanroep is een eigen Vercel-invocatie met maxDuration 180 s (vite.config.ts).
 * Stap 1 (vragen) en stap 2 (afwerken) krijgen dus elk een eigen budget binnen 180 s; de totale
 * wachttijd voor de docent is de som (± 3–4 min met grok-4.5). Kwaliteit gaat vóór snelheid:
 * het afwerkbudget garandeert de inhoudscontrole én minstens één reparatieronde.
 */
export const TIJD = {
  /** Vercel maxDuration per functie (moet gelijk zijn aan vite.config.ts; bewaakt door test). */
  vercelMaxMs: 180_000,
  /** Stap 1: harde deadline voor het schrijven (parallelle delen samen). */
  vragenDeadlineMs: 150_000,
  /** JSON-herkansing alleen als er nog zoveel tijd over is. */
  herkansingMinRestMs: 45_000,
  /** Stap 2: vast budget voor controle + reparatie (onafhankelijk van hoe lang stap 1 duurde). */
  afwerkBudgetMs: 140_000,
  /** Eén controle-aanroep (stukje van 3 vragen) duurt nooit langer dan dit. */
  controleTimeoutMs: 60_000,
  /** Eén reparatie-aanroep duurt nooit langer dan dit. */
  reparatieTimeoutMs: 60_000,
  /** Reparatieronde 1 start als er na de controle nog minstens zoveel over is (gegarandeerd: 140 − 60 = 80 s). */
  reparatieMinRestMs: 30_000,
  /** Hercontrole van gerepareerde vragen. */
  hercontroleMinRestMs: 15_000,
  /** Ronde 2 (ernstige vragen vervangen). */
  vervangMinRestMs: 20_000,
  /** Overige aanroepen (extra vragen, bijschaven, matrijs). */
  losseAanroepMs: 150_000,
} as const;

/** Client-weergave en figuurvensters (de server bepaalt de echte budgetten hierboven). */
export const UX_TIJD = {
  /** Doel voor de hele toets inclusief figuren. */
  doelTotaalMs: 180_000,
  /** Hard maximum (figuurrondes stoppen hier). */
  maxTotaalMs: 330_000,
  /** Figuren krijgen minstens zoveel tijd na de vragen. */
  minFiguurvensterMs: 60_000,
  /** Eerste figuurronde bij "Met plaatjes" stopt niet vóór dit moment na de start. */
  metEersteRondeMs: 180_000,
  /** Typische duur figuren na de vragen. */
  typischFigurenMs: 30_000,
  /** Typische duur afwerken (controle grok-4.5 + reparatie + hercontrole). */
  typischAfwerkenMs: 90_000,
  /** Verwachte vragentijd: vast + per vraag (grok-4.5, low; gemeten ± 38 tokens/s). */
  vragenVastMs: 15_000,
  vragenPerVraagMs: 4_500,
} as const;

// ── Generatie-limieten ──────────────────────────────────────────────────────────────────────────
/** Plan-first (bouwplan → parallel schrijven). */
export const PLAN = {
  /** Aan/uit: plan-first voor NaSk-toetsen met kalibratie (anders de oude delen-route). */
  aan: true,
  /** Minimaal aantal vragen voor plan-first. */
  minVragen: 8,
  /** Reservevragen in het bouwplan (voor vervangen/aanvullen). */
  reserve: 3,
  /** Vragen per parallelle schrijf-aanroep. */
  stukGrootte: 5,
  /** Uitvoertokens per bouwplan-item (compacte rij) + vaste marge (incl. redeneren). */
  tokensPerItem: 70,
  tokensMarge: 2500,
  /** Bouwplan-aanroep duurt nooit langer dan dit (daarna oude route). Gemeten 25–45 s. */
  timeoutMs: 70_000,
} as const;

/**
 * Voornamen voor contexten (Nederlands/westers, kort, makkelijk leesbaar). Het bouwplan kiest hieruit;
 * elke naam hooguit één vraag of één context. Geen namen van bekende personen.
 */
export const VOORNAMEN = [
  "Sanne", "Daan", "Lotte", "Bram", "Emma", "Luuk", "Fenna", "Sem", "Julia", "Thijs", "Iris", "Ruben", "Noor", "Jesse",
  "Femke", "Lars", "Eva", "Milan", "Sophie", "Jasper", "Lisa", "Koen", "Anna", "Stijn", "Tess", "Niels", "Roos", "Finn",
  "Mila", "Gijs", "Floor", "Teun", "Isa", "Wouter", "Lieke", "Mees", "Nina", "Joep", "Vera", "Bas",
] as const;

export const LIMIETEN = {
  /** Lesstof die maximaal mee gaat naar het schrijven (tekens). */
  bronMax: 100_000,
  /** Lesstof per controle-aanroep (tekens; staat vooraan als gecachet voorvoegsel). */
  controleLesstof: 20_000,
  controleAntwoorden: 16_000,
  /** Lesstof per reparatie-aanroep. */
  reparatieLesstof: 4_000,
  /** Vragen per controle-/reparatie-aanroep (parallel). */
  stukGrootte: 3,
  /** Uitvoertokens voor het schrijven: basis + per vraag, begrensd. */
  tokensBasis: 3_000,
  tokensPerVraag: 450,
  tokensMin: 5_000,
  tokensMax: 16_000,
  /** Grok-4.5 redeneert ook binnen max_tokens: extra ruimte bovenop de JSON. */
  redeneerMarge: 2_000,
} as const;

export function tokensVoorAantalVragen(n: number): number {
  const aantal = Math.max(4, Math.min(80, Math.floor(n || 10)));
  return Math.min(LIMIETEN.tokensMax, Math.max(LIMIETEN.tokensMin, LIMIETEN.tokensBasis + aantal * LIMIETEN.tokensPerVraag)) + LIMIETEN.redeneerMarge;
}

// ── RTTI-doelen (enige bron) ────────────────────────────────────────────────────────────────────
/**
 * RTTI-doel per klas (punten %). Toetski-defaults: Nicks eigen toetsen en nakijkmodellen bevatten geen
 * RTTI (kalibratie.json: "RTTI staat in geen enkele toets/nakijkmodel → niet gekalibreerd"); de
 * leerlijn loopt van klas 1–2 naar de echte CSE-verdeling (RTTI_EXAMEN, berekend uit 2013–2026):
 * R daalt, T2 stijgt. Klas 3 = 25/40/27/8 (Nick).
 */
export const RTTI_PRESETS: Record<"onderbouw" | "bovenbouw" | "klas4" | "examen", { label: string; verdeling: RttiVerdeling }> = {
  onderbouw: { label: "Onderbouw (klas 1–2)", verdeling: { R: 35, T1: 40, T2: 20, I: 5 } },
  bovenbouw: { label: "Klas 3", verdeling: { R: 25, T1: 40, T2: 27, I: 8 } },
  klas4: { label: "Klas 4 (richting examen)", verdeling: { R: 15, T1: 45, T2: 34, I: 6 } },
  examen: { label: "CSE NaSk1 2013–2026 (referentie)", verdeling: { R: 8, T1: 58, T2: 32, I: 2 } },
};

/** RTTI-verdeling (punten %) van de echte CSE's NaSk1 2013–2026 (rtti-regels.ts, tools/examen-rtti.ts). */
export const RTTI_EXAMEN: Record<"BB" | "KB" | "GT" | "alle", RttiVerdeling> = {
  BB: { R: 8, T1: 75, T2: 17, I: 0 },
  KB: { R: 9, T1: 63, T2: 27, I: 1 },
  GT: { R: 8, T1: 53, T2: 37, I: 2 },
  alle: { R: 8, T1: 58, T2: 32, I: 2 },
};

const RTTI_SLEUTELS: Rtti[] = ["R", "T1", "T2", "I"];

export function presetVoorLeerjaar(jaar: 1 | 2 | 3 | 4): keyof typeof RTTI_PRESETS {
  return jaar <= 2 ? "onderbouw" : jaar === 3 ? "bovenbouw" : "klas4";
}

export function rttiVoorMoeilijkheid(basis: RttiVerdeling, m: Moeilijkheid): RttiVerdeling {
  if (m === "makkelijk") return { R: basis.R + 10, T1: basis.T1 + 5, T2: Math.max(5, basis.T2 - 10), I: Math.max(0, basis.I - 5) };
  if (m === "moeilijk") return { R: Math.max(10, basis.R - 10), T1: Math.max(15, basis.T1 - 5), T2: basis.T2 + 10, I: basis.I + 5 };
  return { ...basis };
}

function moeilijkheidVan(m?: string): Moeilijkheid {
  return m === "makkelijk" || m === "moeilijk" ? m : "normaal";
}

/** ENIGE bron van waarheid voor het RTTI-doel (formulier, generatie, matrijs, feedback, demo). */
export function rttiDoelVoor(leerjaar: number, moeilijkheid?: string): RttiVerdeling {
  const jaar = Math.min(4, Math.max(1, Math.round(leerjaar || 2))) as 1 | 2 | 3 | 4;
  return rttiVoorMoeilijkheid(RTTI_PRESETS[presetVoorLeerjaar(jaar)].verdeling, moeilijkheidVan(moeilijkheid));
}

/** Wijkt een verdeling af van het standaarddoel voor deze klas (docent schoof zelf)? */
export function isHandmatigRtti(v: RttiVerdeling, leerjaar: number, moeilijkheid?: string): boolean {
  const d = rttiDoelVoor(leerjaar, moeilijkheid);
  return RTTI_SLEUTELS.some((k) => Math.round(v[k] ?? 0) !== d[k]);
}

/** Server: het RTTI-doel komt uit rttiDoelVoor, tenzij de docent zelf schoof (rttiHandmatig). */
export function metRttiDoel<T extends { rttiDoel: RttiVerdeling; rttiHandmatig?: boolean; leerjaar: number; moeilijkheid?: string }>(data: T): T {
  if (data.rttiHandmatig) return data;
  return { ...data, rttiDoel: rttiDoelVoor(data.leerjaar, data.moeilijkheid) };
}
