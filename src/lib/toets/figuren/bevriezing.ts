import type { FiguurKeuring, FiguurSpec, GoedgekeurdeFiguur, Vraag } from "../types.ts";
import { sha256Hex } from "./sha256.ts";

/**
 * HARDE REGEL: een figuur komt alleen na een "go" in de toets en wordt daarna nooit meer gewijzigd.
 * - Bij goedkeuring krijgt de figuur een sha256 over alle inhoud en wordt hij diep bevroren.
 * - Elke latere stap (store, bijschaven, extra vragen, reparatie, export) gaat via
 *   `bewaakFiguren` / `figuurIsGeldig`: gewijzigde of ongeldige figuren worden hersteld of geweigerd.
 */

function canoniek(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canoniek).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canoniek(o[k])}`)
    .join(",")}}`;
}

export function figuurHash(f: Omit<GoedgekeurdeFiguur, "hash">): string {
  const { id, soort, bron, mime, data, breedte, hoogte, alt, spec, pogingen, keuring } = f;
  return sha256Hex(canoniek({ id, soort, bron, mime, data, breedte, hoogte, alt, spec, pogingen, keuring }));
}

export function diepBevriezen<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v as object)) diepBevriezen((v as Record<string, unknown>)[k]);
  }
  return v;
}

/** Enige manier om een GoedgekeurdeFiguur te maken: vereist een go-keuring. */
export function bevriesGoedgekeurd(input: {
  id: string;
  soort: GoedgekeurdeFiguur["soort"];
  bron: GoedgekeurdeFiguur["bron"];
  mime: GoedgekeurdeFiguur["mime"];
  data: string;
  breedte: number;
  hoogte: number;
  alt: string;
  spec: FiguurSpec;
  pogingen: number;
  keuring: FiguurKeuring;
}): GoedgekeurdeFiguur {
  if (input.keuring?.besluit !== "go") throw new Error("Figuur zonder go-keuring kan niet worden geplaatst.");
  if (!input.data) throw new Error("Figuur zonder beelddata.");
  const zonderHash = { ...input, spec: JSON.parse(JSON.stringify(input.spec)) as FiguurSpec };
  return diepBevriezen({ ...zonderHash, hash: figuurHash(zonderHash) });
}

const geldigCache = new WeakMap<object, boolean>();

/** Klopt de hash nog en is er een go? Zo niet: niet tonen, niet exporteren. */
export function figuurIsGeldig(f: GoedgekeurdeFiguur | undefined | null): f is GoedgekeurdeFiguur {
  if (!f || typeof f !== "object") return false;
  // Alleen bevroren objecten cachen: die kunnen per definitie niet meer veranderen.
  const bevroren = Object.isFrozen(f) && Object.isFrozen(f.spec);
  if (bevroren && geldigCache.has(f)) return geldigCache.get(f)!;
  let ok = false;
  if (f.keuring?.besluit === "go" && f.data && f.hash) {
    try {
      const { hash, ...rest } = f;
      ok = figuurHash(rest) === hash;
    } catch {
      ok = false;
    }
  }
  if (bevroren) geldigCache.set(f, ok);
  return ok;
}

const LEGACY_VELDEN = ["grafiek", "schemaFiguur", "pictogram", "maatcilinder"] as const;

/** Een vraag met een goedgekeurde figuur krijgt nooit (opnieuw) ongekeurde figuurvelden. */
export function zonderLegacyFiguren(q: Vraag): Vraag {
  if (!LEGACY_VELDEN.some((k) => q[k] !== undefined)) return q;
  const copy = { ...q };
  for (const k of LEGACY_VELDEN) delete copy[k];
  return copy;
}

function normStam(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface BewaakResultaat {
  vragen: Vraag[];
  /** Figuren die een latere stap probeerde te wijzigen en die hersteld zijn. */
  hersteld: string[];
  /** Figuren die geweigerd zijn (ongeldige hash / geen go). */
  geweigerd: string[];
  /** Goedgekeurde figuren waarvan de vraag niet meer terug te vinden is. */
  losgeraakt: string[];
}

/**
 * Bewaakt bevroren figuren over een latere stap heen.
 * - Figuur met bekend id maar andere inhoud → origineel terugzetten.
 * - Alleen `figuurId` (bijv. na een modelronde zonder beelddata) → origineel terugzetten.
 * - Onbekende figuur zonder geldige go/hash → weigeren (weghalen).
 * - Vraag met figuur verliest altijd ongekeurde figuurvelden.
 * `opts.pijplijn`: toets draait de beeldpijplijn → ongekeurde figuurvelden altijd weg.
 */
export function bewaakFiguren(oud: Vraag[], nieuw: Vraag[], opts: { pijplijn?: boolean } = {}): BewaakResultaat {
  const origineel = new Map<string, GoedgekeurdeFiguur>();
  const perStam = new Map<string, GoedgekeurdeFiguur>();
  for (const q of oud) {
    if (q.figuur && figuurIsGeldig(q.figuur)) {
      origineel.set(q.figuur.id, q.figuur);
      perStam.set(normStam(q.stam), q.figuur);
    }
  }
  const hersteld: string[] = [];
  const geweigerd: string[] = [];
  const gebruikt = new Set<string>();
  const vragen = nieuw.map((q) => {
    let fig: GoedgekeurdeFiguur | undefined;
    const id = q.figuur?.id ?? q.figuurId;
    if (id && origineel.has(id)) {
      fig = origineel.get(id)!;
      if (q.figuur && q.figuur !== fig && (q.figuur.hash !== fig.hash || !figuurIsGeldig(q.figuur))) hersteld.push(id);
    } else if (q.figuur) {
      const kandidaat: GoedgekeurdeFiguur = q.figuur;
      if (figuurIsGeldig(kandidaat)) fig = kandidaat;
      else geweigerd.push(String((q.figuur as { id?: string }).id ?? "?"));
    } else if (!id) {
      const kandidaat = perStam.get(normStam(q.stam));
      if (kandidaat && !gebruikt.has(kandidaat.id)) fig = kandidaat;
    }
    if (fig && gebruikt.has(fig.id)) fig = undefined; // één figuur hoort bij één vraag
    if (fig) gebruikt.add(fig.id);
    const { figuur: _f, figuurId: _i, ...rest } = q;
    const basis = rest as Vraag;
    if (fig) return zonderLegacyFiguren({ ...basis, figuur: diepBevriezen(fig) });
    return opts.pijplijn ? zonderLegacyFiguren(basis) : basis;
  });
  const losgeraakt = [...origineel.keys()].filter((id) => !gebruikt.has(id));
  return { vragen, hersteld, geweigerd, losgeraakt };
}

/** Voor modelrondes: figuurdata eruit, alleen het id erin (het model ziet/wijzigt geen beeld). */
export function figuurNaarVerwijzing(q: Vraag): Vraag {
  if (!q.figuur) return q;
  const { figuur, ...rest } = q;
  return { ...rest, figuurId: figuur.id };
}
