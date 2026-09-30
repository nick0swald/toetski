import type { FiguurKeuring, FiguurSpec, GoedgekeurdeFiguur } from "../types.ts";
import { bevriesGoedgekeurd, figuurHash } from "./bevriezing.ts";
import { sha256Hex } from "./sha256.ts";

/**
 * Figuurbank (gedeeld, server-side, onveranderlijk).
 * - Sleutel = sha256 over de canonieke spec zónder de vrije `doel`-tekst: dezelfde tekendata, labels,
 *   getallen, eenheden, verplichte elementen en `nietTonen` → dezelfde (al goedgekeurde) figuur.
 *   `nietTonen` zit in de sleutel, dus een figuur die voor de ene vraag het antwoord niet verklapt,
 *   wordt alleen hergebruikt waar precies hetzelfde verborgen moet blijven.
 * - Een bankitem bevat beeld, spec, hash, go-rapport en datum; het wordt nooit gewijzigd.
 * - Hergebruik plaatst exact dezelfde bytes (geen wijziging na go); alleen het id is nieuw
 *   (één figuur-id per vraag) en de keuring vermeldt de herkomst.
 */

export const BANK_VERSIE = 1;

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

function normTekst(s: unknown): unknown {
  return typeof s === "string" ? s.trim().replace(/\s+/g, " ") : s;
}

function normDiep(v: unknown): unknown {
  if (typeof v === "string") return normTekst(v);
  if (Array.isArray(v)) return v.map(normDiep);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, w] of Object.entries(v as Record<string, unknown>)) o[k] = normDiep(w);
    return o;
  }
  return v;
}

export function bankSleutel(spec: FiguurSpec): string {
  const { doel: _doel, ...rest } = spec;
  return sha256Hex(`figuurbank:v${BANK_VERSIE}:${canoniek(normDiep(rest))}`);
}

export interface BankItem {
  sleutel: string;
  figuurHash: string;
  figuurId: string;
  soort: GoedgekeurdeFiguur["soort"];
  bron: GoedgekeurdeFiguur["bron"];
  mime: GoedgekeurdeFiguur["mime"];
  data: string;
  breedte: number;
  hoogte: number;
  alt: string;
  spec: FiguurSpec;
  pogingen: number;
  goRapport: { keuring: FiguurKeuring; log?: unknown[] };
  /** ISO-datum van opslaan. */
  aangemaakt?: string;
}

export interface FiguurBank {
  zoek(sleutel: string): Promise<BankItem | null>;
  bewaar(item: BankItem): Promise<void>;
}

export function naarBankItem(sleutel: string, f: GoedgekeurdeFiguur, log: unknown[] = []): BankItem {
  return {
    sleutel,
    figuurHash: f.hash,
    figuurId: f.id,
    soort: f.soort,
    bron: f.bron,
    mime: f.mime,
    data: f.data,
    breedte: f.breedte,
    hoogte: f.hoogte,
    alt: f.alt,
    spec: JSON.parse(JSON.stringify(f.spec)) as FiguurSpec,
    pogingen: f.pogingen,
    goRapport: { keuring: JSON.parse(JSON.stringify(f.keuring)) as FiguurKeuring, log: JSON.parse(JSON.stringify(log)) as unknown[] },
  };
}

/** Het oorspronkelijk goedgekeurde object weer opbouwen en de hash controleren. */
export function bankItemIsIntact(item: BankItem): boolean {
  try {
    if (item.goRapport?.keuring?.besluit !== "go" || !item.data) return false;
    const { id, ...r } = {
      id: item.figuurId,
      soort: item.soort,
      bron: item.bron,
      mime: item.mime,
      data: item.data,
      breedte: item.breedte,
      hoogte: item.hoogte,
      alt: item.alt,
      spec: item.spec,
      pogingen: item.pogingen,
      keuring: item.goRapport.keuring,
    };
    return figuurHash({ id, ...r }) === item.figuurHash;
  } catch {
    return false;
  }
}

/**
 * Figuur uit de bank plaatsen: zelfde bytes/maten/spec/go, nieuw id, keuring met herkomst.
 * `null` als het item niet intact is of niet bij de gevraagde sleutel hoort.
 */
export function figuurUitBank(item: BankItem, sleutel: string, nieuwId: string): GoedgekeurdeFiguur | null {
  if (item.sleutel !== sleutel || !bankItemIsIntact(item)) return null;
  const k = item.goRapport.keuring;
  const datum = (item.aangemaakt ?? k.tijdstip ?? "").slice(0, 10);
  return bevriesGoedgekeurd({
    id: nieuwId,
    soort: item.soort,
    bron: item.bron,
    mime: item.mime,
    data: item.data,
    breedte: item.breedte,
    hoogte: item.hoogte,
    alt: item.alt,
    spec: item.spec,
    pogingen: item.pogingen,
    keuring: {
      besluit: "go",
      redenen: [...k.redenen, `Hergebruikt uit de figuurbank (go van ${datum || "eerder"}, figuur ${item.figuurHash.slice(0, 12)}).`],
      model: k.model,
      tijdstip: k.tijdstip,
      bank: { sleutel, figuurHash: item.figuurHash, datum: item.aangemaakt ?? k.tijdstip },
    },
  });
}
