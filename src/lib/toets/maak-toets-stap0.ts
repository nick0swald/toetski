/**
 * Client-kant van de stap-0-pilot: ketent de server-stappen (spec → herstel… → afronden), bewaart de ondertekende
 * toestand na elke stap in localStorage (hervatten na een time-out of herladen) en meldt de status.
 * Lukt het niet, dan `{ ok: false, fallback: true }`: de aanroeper valt terug op de huidige pijplijn.
 */
import type { Stap0StapAntwoord } from "./stap0-server";
import type { GegenereerdeToets, GenerateInput } from "./types";
import type { Stap0Voortgang } from "./stap0-voortgang";

const PILOT_SLEUTEL = "toetski:pilot";
const LOPEND_SLEUTEL = "toetski:stap0-lopend";
/** Ruim boven de servergrens (9 min): daarna stopt de client en valt terug. */
const MAX_CLIENT_MS = 12 * 60_000;
const MAX_STAPPEN = 60;
/** Een stap die (netwerk/time-out) mislukt, mag zo vaak opnieuw vanaf de laatst bewaarde toestand. */
const HERKANSINGEN = 2;

type Opslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const opslag = (): Opslag | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Pilotcode uit "#pilot=<code>" (één keer) naar localStorage; daarna uit de URL. */
export function leesPilotCode(loc: Pick<Location, "hash" | "pathname" | "search"> | undefined = globalThis.location, o: Opslag | null = opslag()): string | undefined {
  const m = /(?:^#|&)pilot=([A-Za-z0-9_-]{16,120})/.exec(loc?.hash ?? "");
  if (m) {
    o?.setItem(PILOT_SLEUTEL, m[1]!);
    try {
      globalThis.history?.replaceState(null, "", `${loc!.pathname}${loc!.search}`);
    } catch {
      /* geen history */
    }
    return m[1];
  }
  if ((loc?.hash ?? "") === "#pilot=uit") o?.removeItem(PILOT_SLEUTEL);
  return o?.getItem(PILOT_SLEUTEL) ?? undefined;
}

export async function stap0Status(pilot: string | undefined): Promise<{ aan: boolean }> {
  if (!pilot) return { aan: false };
  try {
    const { stap0Pilot } = await import("./stap0-server");
    // Alleen aan/uit doorgeven, ook als een (oudere) server meer terugstuurt.
    return { aan: Boolean((await stap0Pilot({ data: { pilot } })).aan) };
  } catch {
    return { aan: false };
  }
}

function hash(x: unknown): string {
  const s = JSON.stringify(x);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

type StapFn = (a: { data: { pilot?: string; input?: GenerateInput; staat?: unknown; mac?: string } }) => Promise<Stap0StapAntwoord>;

export async function maakToetsStap0(
  input: GenerateInput,
  opts: { pilot: string; onStatus?: (tekst: string) => void; onVoortgang?: (v: Stap0Voortgang) => void; stap?: StapFn; nu?: () => number; opslag?: Opslag | null },
): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string; fallback: boolean }> {
  const stap: StapFn = opts.stap ?? (async (a) => (await import("./stap0-server")).stap0Stap(a as never));
  const nu = opts.nu ?? (() => Date.now());
  const o = opts.opslag === undefined ? opslag() : opts.opslag;
  const t0 = nu();
  const sleutel = hash(input);
  let laatste: { staat: unknown; mac: string } | null = null;
  try {
    const bewaard = JSON.parse(o?.getItem(LOPEND_SLEUTEL) ?? "null") as { sleutel: string; t: number; staat: unknown; mac: string } | null;
    if (bewaard && bewaard.sleutel === sleutel && nu() - bewaard.t < 15 * 60_000) laatste = { staat: bewaard.staat, mac: bewaard.mac };
  } catch {
    /* kapotte opslag: opnieuw beginnen */
  }
  const bewaar = (a: { staat: unknown; mac: string }) => {
    try {
      o?.setItem(LOPEND_SLEUTEL, JSON.stringify({ sleutel, t: nu(), ...a }));
    } catch {
      /* vol: dan alleen in het geheugen */
    }
  };
  const meld = (v: Stap0Voortgang) => {
    opts.onStatus?.(v.tekst);
    opts.onVoortgang?.(v);
  };
  const vorige = laatste?.staat as { fase?: Stap0Voortgang["fase"]; rondes?: number } | undefined;
  meld(laatste ? { fase: vorige?.fase ?? "herstel", ronde: vorige?.rondes ?? 0, tekst: "Verder waar het gebleven was…" } : { fase: "spec", ronde: 0, tekst: "Toets schrijven (eerste versie, ± 1,5–2 minuten)…" });
  for (let n = 0; n < MAX_STAPPEN; n++) {
    if (nu() - t0 > MAX_CLIENT_MS) return { ok: false, error: "Stap 0 duurde te lang.", fallback: true };
    let r: Stap0StapAntwoord | null = null;
    for (let poging = 0; poging <= HERKANSINGEN && !r; poging++) {
      try {
        r = await stap({ data: laatste ? { pilot: opts.pilot, ...laatste } : { pilot: opts.pilot, input } });
      } catch (err) {
        // Time-out of netwerkfout: opnieuw vanaf de laatst bewaarde toestand.
        if (poging === HERKANSINGEN) return { ok: false, error: err instanceof Error ? err.message : "Stap mislukt", fallback: true };
        opts.onStatus?.("Verbinding haperde; deze stap opnieuw…");
      }
    }
    if (!r!.ok) {
      if (r!.fallback) o?.removeItem(LOPEND_SLEUTEL);
      return { ok: false, error: r!.error, fallback: r!.fallback };
    }
    const ok = r as Extract<Stap0StapAntwoord, { ok: true }>;
    laatste = { staat: ok.staat, mac: ok.mac };
    bewaar(laatste);
    if (ok.toets) {
      meld({ fase: "opslaan", ronde: ok.status.ronde ?? 0, open: 0, tekst: "Klaar; toets opslaan…" });
      o?.removeItem(LOPEND_SLEUTEL);
      return { ok: true, toets: ok.toets };
    }
    meld({ fase: (ok.status.fase as Stap0Voortgang["fase"]) ?? "herstel", ronde: ok.status.ronde ?? 0, open: ok.status.open, tekst: ok.status.tekst });
  }
  return { ok: false, error: "Te veel stappen.", fallback: true };
}
