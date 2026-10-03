/**
 * Namenregel (Nick): personen in een toets hebben ALLEEN westerse/Nederlandse voornamen. Deterministische, stille
 * auto-fix: een persoonsnaam die niet op de namenlijst staat, wordt in het hele vraagstuk (context, deelvragen,
 * opties, antwoordmodel, scorestappen, figuurlabels) consequent vervangen door een naam van de lijst. Dit is GEEN
 * keuringsbevinding: een vraagstuk wordt er nooit om afgekeurd en er volgt nooit een (betaalde) Grok-aanroep.
 */
import { GEEN_PERSOON, JONGENS, MEISJES, NIET_WESTERS, WESTERSE_NAMEN } from "./namen-data.ts";

const TOEGESTAAN = new Set(WESTERSE_NAMEN);
const kaal = (s: string) => s.replace(/<[^>]+>/g, " ");
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const woordRe = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`, "gu");

/** Werkwoorden die op een persoon wijzen (3e persoon enkelvoud), ook op het zinsbegin. */
const PERSOON_WW = new Set(
  "zegt denkt vindt beweert woont koopt fietst loopt rent helpt vraagt kijkt luistert besluit onderzoekt speelt bouwt maakt meet sluit zet pakt neemt legt duwt trekt tilt schakelt laadt gebruikt draagt rijdt stapt springt klimt duikt zwemt kookt bakt verwarmt weegt giet hangt leest schrijft tekent noteert berekent ontdekt merkt ziet hoort voelt probeert test stelt houdt brengt haalt werkt oefent bedenkt kiest koopt vergelijkt".split(" "),
);
/** Extra werkwoorden die alleen midden in een zin als persoonssignaal tellen (op het zinsbegin te dubbelzinnig). */
const PERSOON_WW_MIDDEN = new Set(["heeft", "is", "had", "was", "wordt", "laat", "mag", "moet", "kan", "zou", "gaat", "doet", "wil"]);
/** Woorden vóór een naam (midden in een zin): "en Fatima", "met Youssef", "zus Lotte". */
const VOOR_NAAM = new Set("en met aan zus broer vriend vriendin moeder vader opa oma oom tante buurman buurvrouw juf meester neef nicht docent zegt vraagt helpt".split(" "));

const PLAATS_VOOR = new Set("in naar uit te bij vanuit richting via".split(" "));
const GEEN_NAAM_EIND = /(ig|lijk|heid|ing|door|om|ale|bond|auto|houd|ice|isch|baar|tje|daan|dien|toe|mee|ter|lang|weg|dag|nacht|avond|ochtend|middag|week|jaar|keer|maal|eens|toch|wel|niet|nog|ook|dus|daar|hier|waar|soms|vaak|nooit|altijd|later|eerst|samen|thuis|buiten|binnen)$/i;
const TOKEN = /(?<![\p{L}\p{N}])(\p{Lu}\p{Ll}+(?:-\p{Lu}\p{Ll}+)?)(['’]s?)?(?![\p{L}\p{N}])/gu;

/** Persoonsnamen in de teksten die niet op de westerse namenlijst staan. */
export function nietWesterseNamen(teksten: string[]): string[] {
  const gevonden = new Set<string>();
  const alles = teksten.map(kaal);
  const kleineWoorden = new Set(alles.join(" ").match(/(?<![\p{L}\p{N}])\p{Ll}\p{L}*/gu) ?? []);
  const middenHoofdletter = new Set<string>();
  const kandidaten: { t: string; bezit: boolean; begin: boolean; voor: string; na: string; naNa: string }[] = [];
  for (const tekst of alles) {
    for (const m of tekst.matchAll(TOKEN)) {
      const t = m[1]!;
      const i = m.index!;
      const ervoor = tekst.slice(0, i);
      const begin = /^\s*$|[.!?:;•"“'‘(→\n]\s*$/.test(ervoor);
      if (!begin) middenHoofdletter.add(t);
      const rest = tekst.slice(i + m[0].length);
      const volgende = /^\s*(\p{L}+)(?:\s+(\p{L}+))?/u.exec(rest);
      kandidaten.push({ t, bezit: Boolean(m[2]), begin, voor: (/(\p{L}+)\s*$/u.exec(ervoor)?.[1] ?? "").toLowerCase(), na: volgende?.[1] ?? "", naNa: volgende?.[2] ?? "" });
    }
  }
  for (const k of kandidaten) {
    const { t } = k;
    if (TOEGESTAAN.has(t) || GEEN_PERSOON.has(t)) continue;
    if (NIET_WESTERS[t]) {
      gevonden.add(t);
      continue;
    }
    if (t.length < 3) continue;
    // Een woord dat ook gewoon met kleine letter in de tekst staat ("Water kookt" / "het water"), is geen naam.
    if (kleineWoorden.has(t.toLowerCase())) continue;
    const ww = PERSOON_WW.has(k.na) || (!k.begin && PERSOON_WW_MIDDEN.has(k.na));
    const groep = k.na === "en" && /^\p{Lu}/u.test(k.naNa) && !GEEN_PERSOON.has(k.naNa); // "Fatima en Youssef bouwen …"
    const naVoorwoord = !k.begin && VOOR_NAAM.has(k.voor);
    if (!k.bezit && PLAATS_VOOR.has(k.voor)) continue; // "in Westdorp", "naar Zwolle": plaats, geen persoon
    // Een lang of samengesteld woord of een bijwoord ("Gelukkig", "Hierdoor", "Personenauto") is geen naam.
    if (t.length > 9 || GEEN_NAAM_EIND.test(t)) continue;
    if (k.bezit || ww || groep || naVoorwoord || (k.begin && middenHoofdletter.has(t) && PERSOON_WW_MIDDEN.has(k.na))) gevonden.add(t);
  }
  return [...gevonden];
}

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return h;
}

/** Geslacht: bekende lijst, anders het eerste voornaamwoord na de naam (hij/zijn/hem vs. zij/ze/haar). */
function geslacht(naam: string, teksten: string[]): "m" | "v" {
  if (NIET_WESTERS[naam]) return NIET_WESTERS[naam]!;
  for (const t of teksten.map(kaal)) {
    const i = t.search(woordRe(naam));
    if (i < 0) continue;
    const m = /\b(hij|hem|zij|haar)\b/i.exec(t.slice(i, i + 300));
    if (m) return /^(hij|hem)$/i.test(m[1]!) ? "m" : "v";
  }
  return hash(naam) % 2 ? "m" : "v";
}

/** Alle tekstvelden van een object (diep), behalve technische velden. */
const TECHNISCH = new Set(["id", "type", "formule", "eenheid", "naam", "parameter", "stijl", "juist"]);
export function alleTeksten(x: unknown, uit: string[] = []): string[] {
  if (typeof x === "string") uit.push(x);
  else if (Array.isArray(x)) for (const y of x) alleTeksten(y, uit);
  else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) if (!TECHNISCH.has(k)) alleTeksten(y, uit);
  return uit;
}
function vervangDiep<T>(x: T, f: (s: string) => string): T {
  if (typeof x === "string") return f(x) as T;
  if (Array.isArray(x)) return x.map((y) => vervangDiep(y, f)) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, TECHNISCH.has(k) ? y : vervangDiep(y, f)])) as T;
  return x;
}

/**
 * Vervangt niet-westerse persoonsnamen in één vraagstuk (inclusief antwoordmodel) consequent door westerse namen van
 * hetzelfde geslacht die nog niet in het vraagstuk (of in `vermijd`) voorkomen. Deterministisch.
 */
export function vervangNamen<T>(v: T, vermijd: Iterable<string> = []): { v: T; vervangen: [string, string][] } {
  const teksten = alleTeksten(v);
  const namen = nietWesterseNamen(teksten);
  if (!namen.length) return { v, vervangen: [] };
  const bezet = new Set<string>(vermijd);
  const plat = teksten.map(kaal).join(" ");
  for (const n of WESTERSE_NAMEN) if (woordRe(n).test(plat)) bezet.add(n);
  const paren: [string, string][] = [];
  for (const naam of namen) {
    const lijst: readonly string[] = geslacht(naam, teksten) === "m" ? JONGENS : MEISJES;
    const start = hash(naam) % lijst.length;
    let nieuw = "";
    for (let j = 0; j < lijst.length && !nieuw; j++) {
      const c = lijst[(start + j) % lijst.length]!;
      if (!bezet.has(c)) nieuw = c;
    }
    if (!nieuw) nieuw = lijst[start]!;
    bezet.add(nieuw);
    paren.push([naam, nieuw]);
  }
  // Langste naam eerst ("Youssef-Ali" vóór "Ali").
  const orde = [...paren].sort((a, b) => b[0].length - a[0].length);
  const uit = vervangDiep(v, (s) => orde.reduce((t, [a, b]) => t.replace(woordRe(a), b), s));
  return { v: uit, vervangen: paren };
}

/** Westerse namen die al in de toets voorkomen (om dubbele personen tussen vraagstukken te vermijden). */
export function gebruikteNamen(x: unknown): Set<string> {
  const plat = alleTeksten(x).map(kaal).join(" ");
  return new Set(WESTERSE_NAMEN.filter((n) => woordRe(n).test(plat)));
}
