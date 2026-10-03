/**
 * Referentiewaarden voor realistische contexten (stap c). Alleen de regels waarvan het trefwoord in de lesstof staat,
 * gaan mee in de prompt (zuinig met tokens). Bronnen: CBS 85592NED (gemiddelde energietarieven consumenten, jan 2026,
 * variabel deel incl. btw en energiebelasting: stroom € 0,2547/kWh, gas € 1,3136/m³); de toetswaarde is afgerond
 * (beslissing Toetski: € 0,26 per kWh, € 1,30 per m³). Natuurkundige waarden zoals in de vmbo-Binas.
 */
import type { OpmaakVraag } from "./spec.ts";

export interface Referentiewaarde {
  naam: string;
  /** Zoals hij in een vraag hoort te staan. */
  tekst: string;
  waarde: number;
  trefwoord: RegExp;
}

export const REFERENTIEWAARDEN: Referentiewaarde[] = [
  { naam: "stroomprijs", tekst: "€ 0,26 per kWh (CBS 2026 gemiddeld € 0,2547)", waarde: 0.26, trefwoord: /kWh|energiekosten|stroomprijs|energierekening/i },
  { naam: "gasprijs", tekst: "€ 1,30 per m³ aardgas (CBS 2026 gemiddeld € 1,31)", waarde: 1.3, trefwoord: /aardgas|\bgas\b|gasprijs|cv-ketel/i },
  { naam: "verbrandingswarmte aardgas", tekst: "32 MJ per m³ (Binas)", waarde: 32, trefwoord: /aardgas|verbrandingswarmte|stookwaarde/i },
  { naam: "netspanning", tekst: "230 V, 50 Hz", waarde: 230, trefwoord: /netspanning|stopcontact|230|spanning/i },
  { naam: "groepszekering in huis", tekst: "16 A", waarde: 16, trefwoord: /zekering|groep/i },
  { naam: "zwaartekracht", tekst: "g = 9,8 N/kg", waarde: 9.8, trefwoord: /zwaartekracht|massa|gewicht/i },
  { naam: "geluidssnelheid in lucht", tekst: "343 m/s (bij 20 °C)", waarde: 343, trefwoord: /geluidssnelheid|echo|geluid/i },
  { naam: "lichtsnelheid", tekst: "3,0·10⁸ m/s", waarde: 3e8, trefwoord: /lichtsnelheid|bliksem|onweer/i },
  { naam: "dichtheid water", tekst: "1,0 g/cm³ (998 kg/m³)", waarde: 1, trefwoord: /dichtheid/i },
  { naam: "soortelijke warmte water", tekst: "4,2 J/(g·°C)", waarde: 4.2, trefwoord: /soortelijke warmte|opwarmen|waterkoker/i },
];

/** Promptregel met de referentiewaarden die bij deze lesstof horen ("" als geen enkele past). */
export function referentieRegel(bron: string, leerjaar: number): string {
  const l = REFERENTIEWAARDEN.filter((r) => r.trefwoord.test(bron));
  if (!l.length) return "";
  const rond = leerjaar >= 3 ? " Klas 3–4: kies gegevens zoals ze echt zijn (bijv. 1840 W, 0,36 kWh, 2,4 h), niet steeds ronde getallen." : "";
  return `REFERENTIEWAARDEN (gebruik deze als een vraag ze nodig heeft): ${l.map((r) => `${r.naam} ${r.tekst}`).join("; ")}.${rond}`;
}

/** Rond = één significant cijfer (2000, 500, 3, 0,5): typisch verzonnen, zelden gemeten. */
export function isRond(x: number): boolean {
  if (!Number.isFinite(x) || x === 0) return false;
  const s = String(Number(Math.abs(x).toPrecision(12))).replace(".", "").replace(/^0+/, "").replace(/0+$/, "");
  return s.length <= 1;
}

/**
 * Klas ≥ 3: als minstens 4 gegevens uit de tekst er zijn en 60 % of meer daarvan rond is (referentiewaarden tellen niet
 * mee), komt er een review-melding. Nooit een afkeuring: ook het CSE gebruikt ronde getallen.
 */
export function rondeGetallenMelding(vragen: Pick<OpmaakVraag, "parameters">[], leerjaar: number): string | null {
  if (leerjaar < 3) return null;
  const ref = new Set(REFERENTIEWAARDEN.map((r) => r.waarde));
  const gezien = new Set<string>();
  const waarden: number[] = [];
  for (const q of vragen)
    for (const p of q.parameters ?? []) {
      const sleutel = `${p.naam}=${p.waarde}`;
      if (p.bron !== "tekst" || ref.has(p.waarde) || gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      waarden.push(p.waarde);
    }
  const rond = waarden.filter(isRond);
  if (waarden.length < 4 || rond.length / waarden.length < 0.6) return null;
  return `${rond.length} van de ${waarden.length} gegevens zijn ronde getallen (bijv. ${rond.slice(0, 3).map((x) => String(x).replace(".", ",")).join(", ")}). Voor klas 3–4 zijn realistische waarden beter (bijv. 1840 W in plaats van 2000 W); controleer of dat hier past.`;
}
