import type { ItemIssue } from "./item-kwaliteit.ts";
import type { NakijkItem, Vraag } from "./types";

/**
 * Checks op toetsniveau voor examenstijl-toetsen (SE4.2-proefrun, okt 2026):
 * - MC-opties na elke reparatie opnieuw valideren (geen dubbele opties, sleutel bestaat, ≥ 3 opties);
 * - weggevers tussen opeenvolgende (deel)vragen (uitkomst van vraag n staat in vraag n+1);
 * - lesstofgrens (geen filtreren e.d. als dat niet in de lesstof van deze toets staat);
 * - contexttitel past bij zijn vragen, en alleen blokken (≥ 2 vragen) hebben een titel.
 */

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").replace(/[.;:!?]+$/, "").trim();
const sleutel = (t?: string) => (t ?? "").trim().toLowerCase();

function sleutelLetter(n?: NakijkItem): string | undefined {
  return (n?.modelantwoord ?? "").trim().match(/^([A-F])(?:[.):\s]|$)/)?.[1];
}

/** Letters in modelantwoord en rubriek omzetten na hernummeren van de opties. */
function herletter(n: NakijkItem, kaart: Map<string, string>): NakijkItem {
  const vervang = (t: string) => t.replace(/^([A-F])(?=[.):\s]|$)/, (l) => kaart.get(l) ?? l).replace(/\b(keuze|antwoord|optie|letter)\s+([A-F])\b/gi, (m, w: string, l: string) => `${w} ${kaart.get(l) ?? l}`);
  return {
    ...n,
    modelantwoord: vervang(n.modelantwoord),
    puntenverdeling: n.puntenverdeling.map((p) => ({ ...p, criterium: vervang(p.criterium) })),
  };
}

/**
 * Dubbele MC-opties eruit (nooit de sleutel), opties opnieuw lettered en het nakijkmodel mee. Kan dat niet
 * (te weinig opties over, sleutel ontbreekt), dan een issue "mc-opties" voor de reparatie/vervanging.
 */
export function herstelMcOpties(vragen: Vraag[], nakijk: NakijkItem[]): { vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[] } {
  const issues: ItemIssue[] = [];
  let nk = nakijk;
  const uit = vragen.map((q) => {
    if (!q.opties?.length || q.type === "juist-onjuist") return q;
    const n = nk.find((x) => x.nummer === q.nummer);
    const letter = sleutelLetter(n);
    const sl = q.opties.find((o) => o.letter === letter);
    const gezien = new Set<string>();
    if (sl) gezien.add(norm(sl.tekst));
    const houd = q.opties.filter((o) => {
      if (o === sl) return true;
      const k = norm(o.tekst);
      if (!k || gezien.has(k)) return false;
      gezien.add(k);
      return true;
    });
    if (houd.length < q.opties.length && houd.length >= 3 && sl) {
      const kaart = new Map<string, string>();
      const opties = houd.map((o, i) => {
        const nieuw = String.fromCharCode(65 + i);
        kaart.set(o.letter, nieuw);
        return { ...o, letter: nieuw };
      });
      if (n) nk = nk.map((x) => (x.nummer === q.nummer ? herletter(x, kaart) : x));
      return { ...q, opties };
    }
    if (houd.length < q.opties.length || !sl || q.opties.length < 3) {
      issues.push({
        nummer: q.nummer,
        code: "mc-opties",
        uitleg: `Meerkeuzevraag is kapot (${!sl ? "sleutel bestaat niet" : houd.length < q.opties.length ? "twee opties zijn hetzelfde" : "te weinig opties"}). Geef 3–4 VERSCHILLENDE, zinnige opties met precies één juist antwoord en zet de sleutel in het modelantwoord ("A. …").`,
      });
    }
    return q;
  });
  return { vragen: uit, nakijkmodel: nk, issues };
}

/** Uitkomsten (getal + eenheid) uit een modelantwoord: na het laatste "=" per regel, of het hele antwoord als het kort is. */
export function uitkomsten(model: string): string[] {
  const out = new Set<string>();
  const re = /(\d+(?:[.,]\d+)?)\s*(kWh|MWh|kJ|MJ|GJ|TJ|J|kW|MW|W|Hz|kHz|ms|s|min|h|uur|m\/s|km\/h|km|cm³|cm3|dm³|dm3|m³|mL|ml|L|kg|g|°C|K|dB|%|g\/cm³|kg\/m³|m|cm|mm|€|euro)(?![\p{L}\d])/giu;
  for (const regel of model.split(/\n|;|→/)) {
    const na = regel.includes("=") ? regel.slice(regel.lastIndexOf("=") + 1) : regel;
    for (const m of na.matchAll(re)) out.add(`${m[1]!.replace(".", ",")} ${m[2]!.toLowerCase()}`);
  }
  return [...out];
}

const tekstVan = (q: Vraag) => `${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`;
const getallenIn = (t: string) => new Set([...t.replace(/(\d)\.(\d)/g, "$1,$2").matchAll(/(\d+(?:,\d+)?)\s*([\p{L}°%€/³]+)?/gu)].map((m) => `${m[1]} ${(m[2] ?? "").toLowerCase()}`.trim()));

/**
 * Weggever tussen opeenvolgende vragen: de uitkomst van vraag n (uit het nakijkmodel) staat letterlijk in de
 * context of stam van vraag n+1 (r SE4.2: "Het energieverbruik is daardoor 0,60 kWh" na "Bereken het verbruik").
 * Getallen die al in vraag n zelf gegeven waren tellen niet.
 */
export function vervolgWeggeverIssues(vragen: Vraag[], nakijk: NakijkItem[]): ItemIssue[] {
  const out: ItemIssue[] = [];
  for (let i = 0; i + 1 < vragen.length; i++) {
    const a = vragen[i]!;
    const b = vragen[i + 1]!;
    if (a.opties?.length) continue;
    const gegeven = getallenIn(tekstVan(a));
    const res = uitkomsten(nakijk.find((n) => n.nummer === a.nummer)?.modelantwoord ?? "").filter((u) => !gegeven.has(u) && !gegeven.has(u.split(" ")[0]!));
    if (!res.length) continue;
    const inB = getallenIn(tekstVan(b));
    const hit = res.find((u) => inB.has(u));
    if (!hit) continue;
    out.push({
      nummer: b.nummer,
      code: "weggever-vervolg",
      uitleg: `Noemt "${hit}", de uitkomst van vraag ${a.nummer}: dat verklapt het antwoord van de vorige vraag. Haal die uitkomst weg; laat de leerling verder rekenen met "je antwoord van vraag ${a.nummer}" of geef een ander, nieuw gegeven (bijv. "Stel dat het … is"). Verder niets veranderen.`,
    });
  }
  return out;
}

/**
 * Onderwerpen die vaak 'meeliften' maar buiten een toetsdeel kunnen vallen (stammen). Een term geldt alleen als
 * buiten de lesstof als hij nergens in de lesstof van deze toets voorkomt.
 */
export const BUITEN_TERMEN: [stam: string, woord: string][] = [
  ["filtre", "filtreren"], ["filtrat", "filtraat"], ["destill", "destilleren"], ["indamp", "indampen"], ["bezink", "bezinken"],
  ["extrah", "extraheren"], ["extract", "extractie"], ["chromatogra", "chromatografie"], ["scheidingsmethode", "scheidingsmethoden"], ["adsorb", "adsorberen"],
  ["krachtpijl", "krachtpijlen"], ["zwaartekracht", "zwaartekracht"], ["hefboom", "hefbomen"], ["momentenwet", "momentenwet"], ["katrol", "katrollen"],
  ["stroomsterkte", "stroomsterkte"], ["serieschakeling", "serieschakeling"], ["parallelschakeling", "parallelschakeling"], ["brandpunt", "lenzen/brandpunt"],
  ["lichtbreking", "lichtbreking"], ["versnelling", "versnelling"], ["remweg", "remweg"], ["stopafstand", "stopafstand"], ["reactieafstand", "reactieafstand"],
  ["elektromagneet", "elektromagneet"], ["transformator", "transformator"], ["halveringstijd", "halveringstijd"], ["radioactie", "radioactiviteit"],
  ["reactievergelijking", "reactievergelijkingen"], ["ontleding", "ontleding"], ["neutralis", "neutraliseren"], ["zuurgraad", "zuurgraad/pH"],
  ["corrosie", "corrosie"], ["gevarensymbo", "gevarensymbolen"],
];
export const BUITEN_STAMMEN = BUITEN_TERMEN.map(([s]) => s);
export const buitenWoord = (stam: string) => BUITEN_TERMEN.find(([s]) => s === stam)?.[1] ?? stam;

/** Stammen uit BUITEN_STAMMEN die niet in de lesstof (en het antwoordenboek) staan. */
export function buitenStammenVoor(bron: string): string[] {
  const t = bron.toLowerCase();
  return BUITEN_STAMMEN.filter((s) => !t.includes(s));
}

export function buitenLesstofIssues(vragen: Vraag[], nakijk: NakijkItem[], buiten: string[]): ItemIssue[] {
  if (!buiten.length) return [];
  const out: ItemIssue[] = [];
  for (const q of vragen) {
    const t = `${tekstVan(q)} ${nakijk.find((n) => n.nummer === q.nummer)?.modelantwoord ?? ""}`.toLowerCase();
    const hit = buiten.find((s) => new RegExp(`(?<![\\p{L}])${s}`, "u").test(t));
    if (!hit) continue;
    out.push({
      nummer: q.nummer,
      code: "buiten-lesstof",
      uitleg: `Gaat over "${buitenWoord(hit)}", dat staat niet in de lesstof van deze toets. VERVANG de vraag door een nieuwe vraag over een begrip uit de lesstof van dezelfde paragraaf/context (zelfde vorm, punten en rtti); de contextTitel blijft, dus laat de vraag bij die situatie passen.`,
    });
  }
  return out;
}

const STOP = new Set("de het een en of van in op met voor naar bij aan uit door over als dat die dit deze is zijn wordt worden je jij hij zij ze we wat welke waarom hoe wie om te tot niet geen wel ook nog dan maar want noteer bereken leg uit geef noem bepaal laat zien hoeveel vraag deze".split(" "));
const woordenVan = (t: string) => (t.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w));

/** Groepen = aaneengesloten vragen met dezelfde contextTitel. */
export function contextGroepen(vragen: Vraag[]): { titel: string; idx: number[] }[] {
  const out: { titel: string; idx: number[] }[] = [];
  vragen.forEach((q, i) => {
    const k = sleutel(q.contextTitel);
    const vorige = out[out.length - 1];
    if (k && vorige && sleutel(vorige.titel) === k && vorige.idx[vorige.idx.length - 1] === i - 1) vorige.idx.push(i);
    else if (k) out.push({ titel: q.contextTitel!.trim(), idx: [i] });
  });
  return out;
}

/**
 * Titels alleen op blokken (≥ 2 vragen); een losse vraag krijgt geen titel (Nick: geen titel per MC-vraag).
 * De inleiding van een losse vraag blijft als context staan. Past een bloktitel niet bij zijn vragen (geen enkel
 * titelwoord komt in de tekst van het blok voor), dan een titel uit het meest gebruikte inhoudswoord van het blok.
 */
export function herstelTitels(vragen: Vraag[]): Vraag[] {
  const uit = vragen.map((q) => ({ ...q }));
  for (const g of contextGroepen(uit)) {
    if (g.idx.length < 2) {
      for (const i of g.idx) delete uit[i]!.contextTitel;
      continue;
    }
    const tekst = g.idx.map((i) => tekstVan(uit[i]!)).join(" ");
    const tw = woordenVan(g.titel);
    const inBlok = new Set(woordenVan(tekst).map((w) => w.slice(0, 5)));
    if (!tw.length || tw.some((w) => inBlok.has(w.slice(0, 5)))) continue;
    const tel = new Map<string, number>();
    for (const w of woordenVan(tekst)) if (w.length >= 5) tel.set(w, (tel.get(w) ?? 0) + 1);
    const best = [...tel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!best) continue;
    const nieuw = best.charAt(0).toUpperCase() + best.slice(1);
    for (const i of g.idx) uit[i]!.contextTitel = nieuw;
  }
  return uit;
}

/** "Met plaatjes" in examenstijl: streef naar ~1 figuur per blok waar dat zinvol is (min 3, max `max`). */
export function metDoelFiguren(vragen: Vraag[], basis: number, max: number): number {
  const blokken = contextGroepen(vragen).filter((g) => g.idx.length >= 2).length;
  return Math.max(basis, Math.min(max, Math.ceil(blokken * 0.7)));
}
