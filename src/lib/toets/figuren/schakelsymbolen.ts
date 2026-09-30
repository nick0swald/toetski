import type { FiguurSpec } from "../types.ts";

/**
 * Standaard schakelsymbolen (NL / VMBO, NEN-EN-IEC 60617 zoals in Nova).
 * De tekenaar zet om elk symbool een <g data-symbool="…">; deze module controleert
 * daarna in code dat élk onderdeel uit de spec met zijn eigen standaardsymbool in de SVG staat.
 */
export type SymboolSoort =
  | "batterij"
  | "spanningsbron"
  | "lamp"
  | "schakelaar-open"
  | "schakelaar-dicht"
  | "weerstand"
  | "variabele-weerstand"
  | "ldr"
  | "ntc"
  | "ampèremeter"
  | "voltmeter"
  | "motor"
  | "led"
  | "diode"
  | "zoemer"
  | "zekering"
  | "onbekend";

/** Onderdeelnaam uit de spec → standaardsymbool. Onbekend wordt NIET stilletjes een lampje. */
export function symboolSoort(naam: string): SymboolSoort {
  const s = naam
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (/schakel|switch|drukknop/.test(s)) return /dicht|gesloten|closed|\baan\b|ingedrukt/.test(s) ? "schakelaar-dicht" : "schakelaar-open";
  if (/^a$|^a-?meter|amp[e]?re|stroommeter|ammeter/.test(s)) return "ampèremeter";
  if (/^v$|^v-?meter|voltmeter|spanningsmeter/.test(s)) return "voltmeter";
  if (/\bldr\b|lichtgevoelige/.test(s)) return "ldr";
  if (/\bntc\b|temperatuurgevoelige|thermistor/.test(s)) return "ntc";
  if (/variabel|regelbare weerstand|schuifweerstand|potmeter|reostaat/.test(s)) return "variabele-weerstand";
  if (/weerstand|resistor|^r\d*$/.test(s)) return "weerstand";
  if (/\bled\b|light.?emitting/.test(s)) return "led";
  if (/diode/.test(s)) return "diode";
  if (/zekering|fuse/.test(s)) return "zekering";
  if (/zoemer|\bbel\b|buzzer/.test(s)) return "zoemer";
  if (/motor|^m$/.test(s)) return "motor";
  if (/lamp|gloeilamp|^l\d*$|bulb/.test(s)) return "lamp";
  if (/spanningsbron|voeding|adapter/.test(s)) return "spanningsbron";
  if (/batterij|accu|cel\b|battery/.test(s)) return "batterij";
  return "onbekend";
}

export const SYMBOOL_OMSCHRIJVING: Record<SymboolSoort, string> = {
  batterij: "batterij: lange dunne plaat (+) en korte dikke plaat (−)",
  spanningsbron: "spanningsbron: cirkel met + en −",
  lamp: "lampje: cirkel met een kruis erin",
  "schakelaar-open": "open schakelaar: twee contactpunten met een hendeltje dat schuin omhoog staat vanaf het ene punt richting het andere (niet verbonden)",
  "schakelaar-dicht": "gesloten schakelaar: twee contactpunten met een rechte lijn (hendel) ertussen",
  weerstand: "weerstand: rechthoek",
  "variabele-weerstand": "variabele weerstand: rechthoek met een schuine pijl erdoor",
  ldr: "LDR: rechthoek in een cirkel met twee pijlen die naar binnen wijzen",
  ntc: "NTC: rechthoek met een schuine lijn met knik en −t°",
  ampèremeter: "stroommeter: cirkel met A, in serie",
  voltmeter: "spanningsmeter: cirkel met V, parallel over het onderdeel",
  motor: "motor: cirkel met M",
  led: "led: driehoek met streep en twee pijlen naar buiten",
  diode: "diode: driehoek met streep",
  zoemer: "zoemer: halve cirkel",
  zekering: "zekering: rechthoek met een lijn door de lengte",
  onbekend: "onbekend onderdeel",
};

interface SpecOnderdeel {
  soort: string;
  label?: string;
}

/** Welke symbolen (en hoeveel) de spec vraagt. Parallel: max. 3 onderdelen in de hoofdstroom. */
export function verwachteSymbolen(spec: FiguurSpec): { soort: SymboolSoort; naam: string }[] {
  const d = (spec.data ?? {}) as {
    schakeling?: string;
    bron?: { soort?: string };
    componenten?: SpecOnderdeel[];
    takken?: SpecOnderdeel[][];
    voltmeters?: unknown[];
  };
  const out: { soort: SymboolSoort; naam: string }[] = [];
  out.push({ soort: d.bron?.soort === "spanningsbron" ? "spanningsbron" : "batterij", naam: d.bron?.soort ?? "batterij" });
  const parallel = d.schakeling === "parallel" && (d.takken?.length ?? 0) > 0;
  const comps = d.componenten?.length ? d.componenten : parallel ? [] : [{ soort: "lampje" }];
  for (const c of comps) out.push({ soort: symboolSoort(c.soort), naam: c.soort });
  if (parallel) for (const tak of d.takken ?? []) for (const c of tak) out.push({ soort: symboolSoort(c.soort), naam: c.soort });
  for (const _ of d.voltmeters ?? []) out.push({ soort: "voltmeter", naam: "voltmeter" });
  return out;
}

function attr(tag: string, naam: string): number | null {
  const m = tag.match(new RegExp(`\\b${naam}="(-?[\\d.]+)"`));
  return m ? Number(m[1]) : null;
}

/** Controle van één schakelaar-groep: twee contactpunten + hendel in de juiste stand. */
function controleerSchakelaar(soort: "schakelaar-open" | "schakelaar-dicht", inhoud: string): string | null {
  const contacten = [...inhoud.matchAll(/<circle[^>]*data-contact[^>]*\/>/g)].map((m) => ({ x: attr(m[0], "cx")!, y: attr(m[0], "cy")! }));
  const hendels = [...inhoud.matchAll(/<line[^>]*data-hendel[^>]*\/>/g)].map((m) => ({
    x1: attr(m[0], "x1")!,
    y1: attr(m[0], "y1")!,
    x2: attr(m[0], "x2")!,
    y2: attr(m[0], "y2")!,
  }));
  if (contacten.length !== 2) return `${soort}: verwacht 2 contactpunten, gevonden ${contacten.length}`;
  if (hendels.length !== 1) return `${soort}: alleen losse stippen zonder hendel (geen schakelaarsymbool)`;
  const [a, b] = [...contacten].sort((p, q) => p.x - q.x) as [{ x: number; y: number }, { x: number; y: number }];
  const h = hendels[0]!;
  const lengte = Math.hypot(h.x2 - h.x1, h.y2 - h.y1);
  const afstand = Math.hypot(b.x - a.x, b.y - a.y);
  const hoek = (Math.abs(Math.atan2(h.y2 - h.y1, h.x2 - h.x1)) * 180) / Math.PI;
  const vanA = Math.hypot(h.x1 - a.x, h.y1 - a.y) < 1.5;
  if (!vanA) return `${soort}: hendel begint niet in een contactpunt`;
  if (lengte < afstand * 0.7) return `${soort}: hendel te kort`;
  if (soort === "schakelaar-open") {
    if (hoek < 20 || hoek > 60) return "schakelaar-open: hendel staat niet schuin omhoog";
    if (Math.hypot(h.x2 - b.x, h.y2 - b.y) < 6) return "schakelaar-open: hendel raakt het tweede contact (lijkt gesloten)";
  } else {
    if (hoek > 3) return "schakelaar-dicht: hendel is geen rechte lijn tussen de contactpunten";
    if (Math.hypot(h.x2 - b.x, h.y2 - b.y) > 1.5) return "schakelaar-dicht: hendel sluit niet aan op het tweede contact";
  }
  return null;
}

/** Controleert of een symboolgroep de kenmerkende onderdelen bevat. */
function controleerVorm(soort: SymboolSoort, inhoud: string): string | null {
  const heeft = (re: RegExp) => re.test(inhoud);
  switch (soort) {
    case "schakelaar-open":
    case "schakelaar-dicht":
      return controleerSchakelaar(soort, inhoud);
    case "lamp":
      return heeft(/<circle/) && (inhoud.match(/<line/g)?.length ?? 0) >= 4 ? null : "lampje: geen cirkel met kruis";
    case "batterij":
      return (inhoud.match(/data-plaat/g)?.length ?? 0) === 2 ? null : "batterij: geen lange + korte plaat";
    case "weerstand":
    case "zekering":
    case "variabele-weerstand":
    case "ntc":
    case "ldr":
      return heeft(/<rect/) ? null : `${soort}: geen rechthoek`;
    case "ampèremeter":
    case "voltmeter":
    case "motor":
      return heeft(/<circle/) && heeft(/data-letter="[AVM]"/) ? null : `${soort}: geen cirkel met letter`;
    case "led":
    case "diode":
      return heeft(/<polygon/) ? null : `${soort}: geen driehoek`;
    case "onbekend":
      return "onbekend onderdeel: geen standaardsymbool";
    default:
      return null;
  }
}

/**
 * Code-keuring stroomkring: elk onderdeel uit de spec staat er precies met zijn standaardsymbool in,
 * geen extra of ontbrekende symbolen, en schakelaars hebben een hendel in de juiste stand.
 * Lege lijst = in orde; anders is het een no_go (met feedback voor de volgende poging).
 */
export function controleerStroomkringSymbolen(spec: FiguurSpec, svg: string): string[] {
  const fouten: string[] = [];
  const groepen = [...svg.matchAll(/<g data-symbool="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)].map((m) => ({ soort: m[1] as SymboolSoort, inhoud: m[2]! }));
  const verwacht = verwachteSymbolen(spec);
  const tel = (lijst: { soort: string }[]) => lijst.reduce<Record<string, number>>((acc, x) => ((acc[x.soort] = (acc[x.soort] ?? 0) + 1), acc), {});
  const v = tel(verwacht);
  const g = tel(groepen);
  for (const [soort, n] of Object.entries(v)) {
    const namen = verwacht.filter((x) => x.soort === soort).map((x) => x.naam);
    if (soort === "onbekend") fouten.push(`geen standaardsymbool voor: ${namen.join(", ")}`);
    else if ((g[soort] ?? 0) < n) fouten.push(`${SYMBOOL_OMSCHRIJVING[soort as SymboolSoort].split(":")[0]} ontbreekt (${g[soort] ?? 0} van ${n} getekend)`);
  }
  for (const [soort, n] of Object.entries(g)) {
    if ((v[soort] ?? 0) < n && soort !== "onbekend") fouten.push(`extra symbool getekend dat niet in de spec staat: ${soort}`);
  }
  for (const gr of groepen) {
    const f = controleerVorm(gr.soort, gr.inhoud);
    if (f) fouten.push(f);
  }
  // Losse contactpunten buiten een schakelaarsymbool zijn verboden (lijken op een kapotte schakelaar).
  const buiten = svg.replace(/<g data-symbool="[^"]+"[^>]*>[\s\S]*?<\/g>/g, "");
  if (/data-contact/.test(buiten)) fouten.push("losse contactpunten zonder schakelaarsymbool");
  return [...new Set(fouten)];
}

/** Tekstregel voor de vision-keurder: welke symbolen er moeten staan. */
export function symboolLijstVoorKeuring(spec: FiguurSpec): string {
  const v = verwachteSymbolen(spec);
  const tel = new Map<SymboolSoort, number>();
  for (const x of v) tel.set(x.soort, (tel.get(x.soort) ?? 0) + 1);
  return [...tel.entries()].map(([s, n]) => `- ${n}× ${SYMBOOL_OMSCHRIJVING[s]}`).join("\n");
}
