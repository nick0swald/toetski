/**
 * Deterministische auto-fixes vóór een (betaalde) gerichte Grok-aanroep. Alleen wat eenduidig af te leiden is; de
 * keuring daarna blijft de baas (een fix die niet klopt, wordt gewoon opnieuw afgekeurd).
 *  1. meerkeuze zonder (geldige) juiste letter → letter uit het antwoordmodel (letter of de tekst van één optie);
 *  2. figuurcontrole met een onbekende parameter → de waarde die de figuur zelf heeft (gemeten);
 *  3. tekenvraag: controle op wat de leerling tekent uit de leerlingfiguur halen; een ontbrekende antwoordfiguur maken
 *     (krachten: pijl uit grootte + richting in de tekst; grafiek: de getoonde reeks wordt de rode antwoordreeks);
 *  4. getal-weggever binnen een vraagstuk → "Ga uit van …" met een andere waarde (en de berekening opnieuw);
 *  5. krachtenfiguur: kader passend om voorwerp + pijlen (niets afgesneden, geen lege ruimte), leerling- en
 *     antwoordfiguur even groot;
 *  6. namen: een persoonsnaam die niet op de westerse/Nederlandse namenlijst staat, wordt in het hele vraagstuk
 *     (ook antwoordmodel) vervangen door een naam van de lijst (stil; nooit een keuringsbevinding of aanroep).
 */
import type { Berekening, FiguurControle, FiguurSpec, KrachtenFiguur, Parameter, VraagstukSpec } from "./spec.ts";
import { figuurSvg, isTekenFiguur, meetFiguur } from "./figuren/index.ts";
import { getalInTekst, leesNl, nl, rekenUit } from "./reken.ts";
import { gebruikteNamen, vervangNamen } from "./namen.ts";

type Deelvraag = VraagstukSpec["deelvragen"][number];
type Letter = "A" | "B" | "C" | "D" | "E";
const letter = (i: number) => String.fromCharCode(65 + i) as Letter;
export interface AutoStap {
  id: string;
  wat: string;
}
const kaal = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const norm = (s: string) => kaal(s).toLowerCase().replace(/,(?!\d)/g, " ").replace(/[^a-zà-ÿ0-9,]+/g, " ").trim();
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── 1. juiste letter ─────────────────────────────────────────────────────────────────────────────
export function leidJuistAf(d: Pick<Deelvraag, "opties" | "antwoordmodel">): Letter | undefined {
  const opties = d.opties ?? [];
  if (opties.length < 2) return undefined;
  const geldig = (l?: string) => Boolean(l && /^[A-E]$/.test(l) && l.charCodeAt(0) - 65 < opties.length);
  if (geldig(d.antwoordmodel?.juist)) return undefined;
  const regels = (d.antwoordmodel?.regels ?? []).map(kaal);
  for (const r of regels) {
    const m = /^(?:(?:het\s+)?juist(?:e)?(?:\s+antwoord)?\s*[:=]?\s*|antwoord\s*[:=]?\s*)?\(?([A-E])\)?(?:\s*[).:,—–-]|\s*$|\s+(?:is|want)\b)/i.exec(r);
    if (m && geldig(m[1]!.toUpperCase()) && (m[1] === m[1]!.toUpperCase() || /juist|antwoord/i.test(r))) return m[1]!.toUpperCase() as Letter;
  }
  const on = opties.map(norm);
  for (const r of regels.map(norm)) {
    const gelijk = on.flatMap((o, i) => (o && o === r ? [i] : []));
    if (gelijk.length === 1) return letter(gelijk[0]!);
  }
  for (const r of regels.map(norm)) {
    const bevat = on.flatMap((o, i) => (o.length >= 3 && new RegExp(`(^| )${esc(o)}( |$)`).test(r) ? [i] : []));
    if (bevat.length === 1) return letter(bevat[0]!);
  }
  return undefined;
}

// ── 2. onbekende parameter in een figuurcontrole ──────────────────────────────────────────────────
function vulOnbekend(f: FiguurSpec | undefined, bekend: Set<string>): number {
  if (!f || f.type === "ai-afbeelding" || !f.controle?.some((c) => c.parameter !== undefined && !bekend.has(c.parameter))) return 0;
  let m: Record<string, number>;
  try {
    m = meetFiguur(f, figuurSvg(f));
  } catch {
    return 0;
  }
  let n = 0;
  f.controle = f.controle.map((c): FiguurControle => {
    if (c.parameter === undefined || bekend.has(c.parameter) || m[c.meting] === undefined || Number.isNaN(m[c.meting])) return c;
    n++;
    const { parameter: _p, ...rest } = c;
    return { ...rest, verwacht: m[c.meting] };
  });
  return n;
}

// ── 3. tekenvragen ───────────────────────────────────────────────────────────────────────────────
const KRACHTNAAM: [RegExp, string, number | undefined][] = [
  [/zwaartekracht/i, "Fz", 270],
  [/normaalkracht/i, "Fn", 90],
  [/spankracht/i, "Fs", undefined],
  [/veerkracht/i, "Fv", undefined],
  [/wrijvingskracht/i, "Fw", undefined],
  [/spierkracht|duwkracht|trekkracht/i, "Fspier", undefined],
  [/resulterende kracht/i, "Fres", undefined],
];
const RICHTING: [RegExp, number][] = [
  [/\b(recht\s+)?omhoog\b|\bnaar boven\b/i, 90],
  [/\b(recht\s+)?omlaag\b|\bnaar beneden\b|\bverticaal naar beneden\b/i, 270],
  [/\bnaar rechts\b|\bhorizontaal naar rechts\b/i, 0],
  [/\bnaar links\b|\bhorizontaal naar links\b/i, 180],
];

function teTekenenKracht(d: Deelvraag, v: VraagstukSpec, f: KrachtenFiguur): { naam: string; grootteN: number; hoek: number } | null {
  const stam = kaal(d.stam);
  const alles = kaal([...v.context, ...(d.context ?? []), d.stam, ...(d.antwoordmodel?.regels ?? [])].join(" "));
  const kn = KRACHTNAAM.find(([re]) => re.test(stam));
  if (!kn) return null;
  const naam = kn[1];
  const hoek = kn[2] ?? RICHTING.find(([re]) => re.test(alles))?.[1];
  if (hoek === undefined) return null;
  // Grootte: (a) "pijl van 4,0 cm" in het antwoordmodel × schaal; (b) een berekening/parameter in N; (c) "… is 40 N" in de tekst.
  const cm = /pijl\s+(?:van\s+)?(\d+(?:,\d+)?)\s*cm/i.exec(kaal((d.antwoordmodel?.regels ?? []).join(" ")));
  let N: number | undefined = cm ? leesNl(cm[1]!) * f.schaalN : undefined;
  if (N === undefined) {
    const inN = [...(d.berekeningen ?? []), ...(d.parameters ?? []), ...(v.parameters ?? [])].filter((x) => (x.eenheid ?? "").trim() === "N");
    if (inN.length === 1) N = inN[0]!.waarde;
  }
  if (N === undefined) {
    const getallen = [...alles.matchAll(/(\d+(?:,\d+)?)\s*N\b/g)].map((m) => leesNl(m[1]!));
    const uniek = [...new Set(getallen)];
    if (uniek.length === 1) N = uniek[0];
  }
  if (!N || !Number.isFinite(N) || N <= 0) return null;
  return { naam, grootteN: Math.round(N * 1000) / 1000, hoek };
}

function fixTekenvraag(v: VraagstukSpec, d: Deelvraag, i: number, stappen: AutoStap[]): void {
  const opVraagstuk = !d.figuur && i === 0 && Boolean(v.figuur);
  const leer = d.figuur ?? (i === 0 ? v.figuur : undefined);
  if (!leer || leer.type === "ai-afbeelding") return;
  const teken = d.tekenvraag ?? (/\b(teken|schets)\b/i.test(kaal(d.stam)) || isTekenFiguur(leer));
  if (!teken) return;
  const zet = (f: FiguurSpec) => (opVraagstuk ? (v.figuur = f) : (d.figuur = f));
  if (leer.type === "krachten") {
    const namen = new Set(leer.pijlen.map((p) => p.naam));
    const verplaatst = (leer.controle ?? []).filter((c) => /^(.+)\.(N|hoek|lengteCm)$/.test(c.meting) && !namen.has(c.meting.split(".")[0]!));
    let leer2: KrachtenFiguur = leer;
    if (verplaatst.length) {
      const rest = (leer.controle ?? []).filter((c) => !verplaatst.includes(c));
      leer2 = { ...leer, controle: rest.length ? rest : [{ meting: "pijlen", verwacht: leer.pijlen.length }] };
      zet(leer2);
      stappen.push({ id: d.id, wat: `controle ${verplaatst.map((c) => c.meting).join(", ")} uit de leerlingfiguur (de leerling tekent die pijl)` });
    }
    if (!d.antwoordmodel.figuur) {
      const k = teTekenenKracht(d, v, leer2);
      if (!k) return;
      const naam = namen.has(k.naam) ? `${k.naam}2` : k.naam;
      d.antwoordmodel.figuur = {
        ...leer2,
        pijlen: [...leer2.pijlen, { naam, grootteN: k.grootteN, hoek: k.hoek, rood: true }],
        controle: [...(leer2.controle ?? []).filter((c) => c.meting !== "pijlen"), { meting: `${naam}.N`, verwacht: k.grootteN }, { meting: `${naam}.hoek`, verwacht: k.hoek }],
      };
      d.tekenvraag = true;
      stappen.push({ id: d.id, wat: `antwoordfiguur gemaakt: rode pijl ${naam} = ${nl(k.grootteN)} N, ${k.hoek}°` });
    }
    return;
  }
  if (leer.type === "grafiek" && !leer.panelen?.length) {
    const getoond = leer.reeksen.filter((r) => !r.rood && r.punten.length >= 2);
    if (!getoond.length || d.antwoordmodel.figuur) return;
    const yc = (leer.controle ?? []).filter((c) => /^y@/.test(c.meting));
    zet({ ...leer, reeksen: leer.reeksen.filter((r) => !getoond.includes(r)), controle: (leer.controle ?? []).filter((c) => !yc.includes(c)).length ? (leer.controle ?? []).filter((c) => !yc.includes(c)) : undefined });
    d.antwoordmodel.figuur = { ...leer, reeksen: getoond.map((r) => ({ ...r, rood: true })), controle: yc.length ? yc : undefined };
    d.tekenvraag = true;
    stappen.push({ id: d.id, wat: "getoonde grafiek verplaatst naar de antwoordfiguur (rood); leerling krijgt een leeg assenstelsel" });
  }
}

// ── 4. getal-weggever → "Ga uit van" ─────────────────────────────────────────────────────────────
function sigCijfers(s: string): number {
  const d = s.replace(/[^0-9]/g, "").replace(/^0+/, "");
  if (s.includes(",")) return Math.max(1, d.length);
  return Math.max(1, d.replace(/0+$/, "").length);
}
function formatZoals(x: number, voorbeeld: string): string {
  const dec = voorbeeld.includes(",") ? voorbeeld.split(",")[1]!.length : 0;
  if (dec > 0) return nl(x, dec);
  const sig = sigCijfers(voorbeeld);
  const r = Number(x.toPrecision(Math.max(sig, 1)));
  return nl(Math.round(r));
}
/** Een duidelijk andere, ronde waarde (≈ +20 %), in dezelfde notatie. */
export function andereWaarde(u: string): string {
  const x = leesNl(u);
  for (const f of [1.2, 1.25, 1.5, 0.8, 0.75]) {
    const s = formatZoals(x * f, u);
    if (s !== u && leesNl(s) > 0) return s;
  }
  return formatZoals(x * 2, u);
}

/** Vervang losse getallen (niet midden in een ander getal) in één keer, zodat vervangingen niet op elkaar doorwerken. */
function vervangGetallen(t: string, paren0: [string, string][]): string {
  const paren = paren0.slice(0, 26); // placeholders ⟦a⟧…⟦z⟧ (geen cijfers, die zouden zelf weer matchen)
  let uit = t;
  paren.forEach(([o], i) => {
    uit = uit.replace(new RegExp(`(^|[^0-9,])${esc(o)}(?![0-9]|,[0-9])`, "g"), `$1⟦${String.fromCharCode(97 + i)}⟧`);
  });
  return uit.replace(/⟦([a-z])⟧/g, (_, c: string) => paren[c.charCodeAt(0) - 97]![1]);
}

/** Herreken B; `invoer` = gewijzigde gegeven waarden [oud, nieuw] die ook in antwoordmodel en scorestappen veranderen. */
function herrekenDeelvraag(b: Deelvraag, extra: Parameter[], invoer: [string, string][] = []): boolean {
  const vars: Record<string, number> = {};
  for (const p of [...extra, ...(b.parameters ?? [])]) vars[p.naam] = p.waarde;
  const oudNieuw: [string, string][] = [];
  const nieuw: Berekening[] = [];
  for (const bk of b.berekeningen ?? []) {
    let w: number;
    try {
      w = rekenUit(bk.formule, vars);
    } catch {
      return false;
    }
    if (!Number.isFinite(w)) return false;
    vars[bk.naam] = w;
    const af = bk.afgerond ? formatZoals(w, bk.afgerond) : undefined;
    if (bk.afgerond && af && af !== bk.afgerond) oudNieuw.push([bk.afgerond, af]);
    nieuw.push({ ...bk, waarde: w, ...(af ? { afgerond: af } : {}) });
  }
  b.berekeningen = nieuw.length ? nieuw : b.berekeningen;
  const paren = [...invoer, ...oudNieuw];
  if (paren.length) {
    b.antwoordmodel.regels = b.antwoordmodel.regels.map((r) => vervangGetallen(r, paren));
    b.scorestappen = b.scorestappen.map((s) => ({ ...s, omschrijving: vervangGetallen(s.omschrijving, paren) }));
  }
  return true;
}

function gaUitVan(zin: string, oud: string, nieuw: string, eenheid: string): string {
  const re = new RegExp(`(^|[^0-9,])${esc(oud)}(\\s*${esc(eenheid)})`);
  const vervangen = zin.replace(re, `$1${nieuw}$2`);
  if (/\bga (er)?(van )?uit\b/i.test(vervangen)) return vervangen;
  const m = /^(.*?)\s+(is|was|wordt|bedraagt)\s+(.*?)\.?$/i.exec(vervangen);
  if (m && m[3]!.includes(nieuw)) return `Ga ervan uit dat ${m[1]!.charAt(0).toLowerCase()}${m[1]!.slice(1)} ${m[3]} ${m[2]!.toLowerCase()}.`;
  return `Ga uit van ${nieuw} ${eenheid}. ${vervangen}`;
}

/**
 * Getal-weggever binnen een vraagstuk: de afgeronde uitkomst van A staat (met eenheid) in de tekst van een andere
 * deelvraag B. Rekent B met die waarde verder (parameter met die weergave), dan wordt het "Ga uit van <andere waarde>"
 * en rekent B opnieuw. Gebruikt B de waarde niet, dan is de zin overbodig en verdwijnt hij (alleen een informatiezin,
 * nooit de vraagzin). In een optie: niet automatisch.
 */
function fixGetalWeggevers(v: VraagstukSpec, stappen: AutoStap[]): void {
  const weergave = (p: Parameter) => p.weergave ?? nl(p.waarde);
  v.deelvragen.forEach((a, ia) => {
    for (const bk of a.berekeningen ?? []) {
      const u = bk.afgerond;
      const eenheid = (bk.eenheid ?? "").trim();
      const gegeven = new Set([...(v.parameters ?? []), ...(a.parameters ?? [])].map(weergave));
      if (!u || !eenheid || gegeven.has(u) || u.replace(/[^0-9]/g, "").length < 2) continue;
      const re = new RegExp(`(^|[^0-9,])${esc(u)}\\s*${esc(eenheid)}(?![A-Za-z])`);
      v.deelvragen.forEach((b, ib) => {
        if (ib === ia) return;
        const b0 = v.deelvragen[ib]!;
        if ((b0.opties ?? []).some((o) => re.test(kaal(o)))) return;
        if (!re.test(kaal([...(b0.context ?? []), b0.stam].join(" ")))) return;
        const kopie: Deelvraag = structuredClone(b0);
        const pb = (kopie.parameters ?? []).find((p) => p.bron === "tekst" && weergave(p) === u);
        if (pb && ib > ia) {
          const nieuw = andereWaarde(u);
          kopie.context = (kopie.context ?? []).map((z) => (re.test(kaal(z)) ? gaUitVan(z, u, nieuw, eenheid) : z));
          kopie.stam = kopie.stam
            .split(/(?<=[.?!])\s+/)
            .map((z) => (re.test(kaal(z)) ? (/[?]\s*$/.test(z) ? z.replace(re, `$1${nieuw} ${eenheid}`) : gaUitVan(z, u, nieuw, eenheid)) : z))
            .join(" ");
          kopie.parameters = (kopie.parameters ?? []).map((p) => (p === pb ? { ...p, waarde: leesNl(nieuw), weergave: nieuw } : p));
          if (!herrekenDeelvraag(kopie, v.parameters ?? [], [[u, nieuw]])) return;
          if (!getalInTekst(nieuw, kaal([...(kopie.context ?? []), kopie.stam].join(" ")))) return;
          v.deelvragen[ib] = kopie;
          stappen.push({ id: b0.id, wat: `weggever: "${u} ${eenheid}" (uitkomst van ${a.id}) → "Ga uit van ${nieuw} ${eenheid}", ${b0.id} opnieuw doorgerekend` });
          return;
        }
        if (pb) return;
        // B rekent niet met de waarde: informatiezin weghalen.
        const ctx = (kopie.context ?? []).filter((z) => !re.test(kaal(z)));
        const zinnen = kopie.stam.split(/(?<=[.!])\s+(?=[A-ZÀ-Ý])/);
        const stamZinnen = zinnen.filter((z) => !(re.test(kaal(z)) && !/[?]\s*$/.test(z) && zinnen.length > 1));
        kopie.context = ctx.length ? ctx : undefined;
        kopie.stam = stamZinnen.join(" ");
        if (re.test(kaal([...(kopie.context ?? []), kopie.stam].join(" ")))) return;
        v.deelvragen[ib] = kopie;
        stappen.push({ id: b0.id, wat: `weggever: zin met "${u} ${eenheid}" (uitkomst van ${a.id}) weggehaald (${b0.id} rekent er niet mee)` });
      });
    }
  });
}

// ── 5. krachtenkader ─────────────────────────────────────────────────────────────────────────────
/** Omvang van het voorwerp rond het aangrijpingspunt (cm; dx links/rechts, dy onder/boven). */
const VOORWERP: Record<string, [number, number, number, number]> = {
  bloempot: [-2.5, 2.5, -1.2, 3.7],
  krat: [-2.0, 2.0, -1.2, 1.2],
  boomstam: [-1.0, 0.0, -0.4, 0.4],
};
export function pasKrachtenKader(figs: (KrachtenFiguur | undefined)[]): KrachtenFiguur[] | null {
  const fs = figs.filter((f): f is KrachtenFiguur => Boolean(f));
  if (!fs.length) return null;
  const f0 = fs[0]!;
  if (fs.some((f) => f.controle?.some((c) => c.meting === "breedteCm"))) return null;
  const [x0, x1, y0, y1] = VOORWERP[f0.voorwerp ?? ""] ?? [-0.3, 0.6, -0.3, 0.5];
  let minX = x0, maxX = x1, minY = y0, maxY = y1;
  for (const f of fs) {
    for (const p of f.pijlen) {
      const L = p.grootteN / f.schaalN;
      const tx = L * Math.cos((p.hoek * Math.PI) / 180);
      const ty = L * Math.sin((p.hoek * Math.PI) / 180);
      minX = Math.min(minX, tx - 0.3); maxX = Math.max(maxX, tx + (p.label ? 1.2 : 0.3));
      minY = Math.min(minY, ty - (p.label ? 0.8 : 0.3)); maxY = Math.max(maxY, ty + (p.label ? 0.8 : 0.3));
    }
  }
  maxX = Math.max(maxX, 0.9); // puntlabel
  const m = 0.4;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const breedte = r1(Math.min(14, Math.max(3, maxX - minX + 2 * m)));
  const hoogte = r1(Math.max(3, maxY - minY + 2 * m));
  const punt: [number, number] = [r1(-minX + m), r1(-minY + m)];
  if (fs.every((f) => f.breedteCm === breedte && f.hoogteCm === hoogte && f.punt[0] === punt[0] && f.punt[1] === punt[1])) return null;
  return fs.map((f) => ({ ...f, breedteCm: breedte, hoogteCm: hoogte, punt }));
}

function fixKrachtenKader(v: VraagstukSpec, stappen: AutoStap[]): void {
  v.deelvragen.forEach((d, i) => {
    const opVraagstuk = !d.figuur && i === 0 && v.figuur?.type === "krachten";
    const leer = d.figuur ?? (i === 0 ? v.figuur : undefined);
    const antw = d.antwoordmodel?.figuur;
    const l = leer?.type === "krachten" ? leer : undefined;
    const a = antw?.type === "krachten" ? antw : undefined;
    if (!l && !a) return;
    if (l && a && (l.voorwerp !== a.voorwerp || l.schaalN !== a.schaalN)) return;
    const uit = pasKrachtenKader([l, a]);
    if (!uit) return;
    let k = 0;
    if (l) {
      if (opVraagstuk) v.figuur = uit[k++];
      else d.figuur = uit[k++];
    }
    if (a) d.antwoordmodel.figuur = uit[k];
    stappen.push({ id: d.id, wat: `krachtenfiguur passend gemaakt (${uit[0]!.breedteCm} × ${uit[0]!.hoogteCm} cm)` });
  });
}

// ── alles ────────────────────────────────────────────────────────────────────────────────────────
export function autoHerstelVraagstuk(v0: VraagstukSpec, vermijdNamen: Iterable<string> = []): { v: VraagstukSpec; stappen: AutoStap[] } {
  const stappen: AutoStap[] = [];
  const nm = vervangNamen(structuredClone(v0), vermijdNamen);
  const v = nm.v;
  if (nm.vervangen.length) stappen.push({ id: v.id, wat: `namen vervangen: ${nm.vervangen.map(([a, b]) => `${a} → ${b}`).join(", ")}` });
  if (!Array.isArray(v.deelvragen)) return { v, stappen };
  const bekend = new Set([...(v.parameters ?? []), ...v.deelvragen.flatMap((d) => d.parameters ?? [])].map((p) => p.naam));
  // Lege tekenfiguur op vraagstukniveau (hoort bij de eerste deelvraag) terwijl een latere deelvraag de tekenvraag is
  // (mét antwoordfiguur, zonder eigen figuur): de figuur verhuist naar die tekenvraag.
  if (v.figuur && isTekenFiguur(v.figuur)) {
    const d0 = v.deelvragen[0];
    const isTeken = (d: Deelvraag) => d.tekenvraag ?? /\b(teken|schets)\b/i.test(d.stam);
    const j = v.deelvragen.findIndex((d, i) => i > 0 && !d.figuur && d.antwoordmodel?.figuur?.type === v.figuur!.type && isTeken(d));
    if (d0 && j > 0 && !d0.figuur && !d0.antwoordmodel?.figuur && !isTeken(d0)) {
      v.deelvragen[j]!.figuur = v.figuur;
      v.figuur = undefined;
      stappen.push({ id: v.deelvragen[j]!.id, wat: `lege tekenfiguur van het vraagstuk verplaatst naar tekenvraag ${v.deelvragen[j]!.id}` });
    }
  }
  const nOnb = vulOnbekend(v.figuur, bekend);
  if (nOnb) stappen.push({ id: v.id, wat: `${nOnb} figuurcontrole(s) met onbekende parameter → waarde uit de figuur` });
  v.deelvragen.forEach((d, i) => {
    if (!d?.antwoordmodel) return;
    const l = leidJuistAf(d);
    if (l) {
      d.antwoordmodel.juist = l;
      stappen.push({ id: d.id, wat: `juiste letter ${l} afgeleid uit het antwoordmodel` });
    }
    const n = vulOnbekend(d.figuur, bekend) + vulOnbekend(d.antwoordmodel.figuur, bekend);
    if (n) stappen.push({ id: d.id, wat: `${n} figuurcontrole(s) met onbekende parameter → waarde uit de figuur` });
    try {
      fixTekenvraag(v, d, i, stappen);
    } catch {
      /* laat over aan de keuring */
    }
  });
  try {
    fixGetalWeggevers(v, stappen);
  } catch {
    /* idem */
  }
  fixKrachtenKader(v, stappen);
  return { v, stappen };
}

export function autoHerstel<G extends { vraagstukken: VraagstukSpec[] }>(gen: G): { gen: G; stappen: AutoStap[] } {
  const stappen: AutoStap[] = [];
  const lijst = gen.vraagstukken ?? [];
  const vs = lijst.map((v, i) => {
    const r = autoHerstelVraagstuk(v, gebruikteNamen(lijst.filter((_, j) => j !== i)));
    stappen.push(...r.stappen);
    return r.v;
  });
  return { gen: { ...gen, vraagstukken: vs }, stappen };
}
