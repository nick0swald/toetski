/**
 * Plan-first, stap 3: parallel schrijven volgens het bouwplan. Elke schrijf-aanroep krijgt het volledige
 * toetsvoorvoegsel (gedeeld met de plan-aanroep → promptcache) plus het HELE bouwplan, en schrijft alleen
 * zijn eigen stuk. Zo kent elk stuk de personen, situaties, begrippen en antwoorden van alle andere vragen.
 */
import type { Bouwplan, PlanItem, PlanQuota, PlanVorm } from "./bouwplan.ts";
import { planRegel } from "./bouwplan.ts";
import { PLAN, VOORNAMEN } from "./config.ts";
import type { Rtti } from "./types";

export const VORM_TYPE: Record<PlanVorm, string> = {
  jn: "juist-onjuist",
  mc: "meerkeuze",
  kort: "open",
  invul: "invul",
  uitleg: "open",
  reken: "berekening",
  teken: "open",
};

/** Verdeel het plan in ~gelijke, aaneengesloten stukken; een groep (doorlopende context) blijft heel. */
export function planStukken(items: PlanItem[], grootte: number = PLAN.stukGrootte): PlanItem[][] {
  if (!items.length) return [];
  const blokken: PlanItem[][] = [];
  for (const it of items) {
    const laatste = blokken[blokken.length - 1];
    if (laatste && it.groep && laatste[0]!.groep === it.groep) laatste.push(it);
    else blokken.push([it]);
  }
  const aantal = Math.max(1, Math.ceil(items.length / grootte));
  const doel = items.length / aantal;
  const stukken: PlanItem[][] = [[]];
  let geteld = 0;
  for (const b of blokken) {
    const huidig = stukken[stukken.length - 1]!;
    if (huidig.length && geteld + b.length / 2 > doel * stukken.length && stukken.length < aantal) stukken.push([...b]);
    else huidig.push(...b);
    geteld += b.length;
  }
  return stukken.filter((s) => s.length);
}

/** Opdracht voor één schrijf-aanroep (komt ná het gedeelde, gecachete voorvoegsel). */
export function schrijfOpdracht(plan: Bouwplan, stuk: PlanItem[], q: PlanQuota): string {
  const a = stuk[0]!.n;
  const b = stuk[stuk.length - 1]!.n;
  const titel = (code: string) => q.paragrafen.find((p) => p.code === code)?.titel ?? "";
  const eigen = stuk
    .map((it) => `- vraag ${it.n}: type "${VORM_TYPE[it.vorm]}", rtti "${it.rtti}", punten ${it.punten}, domein "${it.par}${titel(it.par) ? ` ${titel(it.par)}` : ""}"${it.groep ? `, contextTitel "${it.groep}"` : ""}`)
    .join("\n");
  return `BOUWPLAN VAN DE HELE TOETS (vast; andere schrijvers maken tegelijk de overige vragen):
${plan.items.map(planRegel).join("\n")}

OPDRACHT NU (gaat vóór de totalen hierboven): schrijf ALLEEN de vragen ${a} t/m ${b} uit het bouwplan, precies volgens hun planregel, genummerd ${a}…${b}:
${eigen}
Regels:
- Personen: ALLEEN de persoon uit de planregel; staat er geen persoon, gebruik dan geen naam ("een leerling", "je").
- Volg per vraag het begrip, de situatie, de persoon en wat er gevraagd wordt; het verwachte antwoord staat in het plan. "LET OP" bij een regel is verplicht.
- "vraag" in de planregel is de bedoeling, niet de letterlijke tekst: maak er een volwaardige schooltoetsvraag van (concrete situatie met gegevens, dan een duidelijke opdracht zoals "Bereken …", "Leg uit …", "Noteer …").
- Tekenvraag (vorm tekenen): begin de opdracht met "Teken …"; de leerling tekent in een leeg rastervak (tekenvak, hokjes van 1 cm) dat de software onder de vraag zet. Zet de schaal in de stam (bijv. "1 cm ≙ 10 N") en alle gegevens in de tekst; verwijs niet naar een figuur of plaatje ("teken in het tekenvak" mag). Nakijkmodel: één tekencriterium per punt (aangrijpingspunt, richting, lengte volgens schaal).
- Vraagt een vraag om meerdere onderdelen (bijv. drie namen), dan is elk onderdeel één punt van de geplande punten; vraag niet meer onderdelen dan er punten zijn.
- Gebruik geen persoon, situatie of begrip van een andere planregel, en noem nooit het antwoord van een andere planregel in jouw vraagtekst (geen weggevers).
- "context" = alleen de situatie (1–3 korte zinnen) met de gegevens; de stam is daarna alleen de vraagzin en herhaalt niets uit de context. Staat er in de planregel geen situatie, dan geen context (gewoon een korte vraag).
- Een groep (contextTitel): de eerste vraag van die groep krijgt de inleiding in "context"${q.examen ? ` (examenstijl: ${q.examen.introWoorden[0]}–${q.examen.introWoorden[1]} woorden, een echte situatie met de gegevens die het hele blok nodig heeft)` : ""}; de volgende vragen alleen dezelfde contextTitel (eventueel één extra gegeven in hun eigen context). Gebruik de contextTitel precies zoals in het plan.
- Geen eigennamen uit de lesstof of het antwoordenboek (plaatsen, centrales, bedrijven) en geen merknamen; neem geen boekopdracht 1-op-1 over.
- RTTI "I": formuleer als redeneervraag in een nieuwe situatie ("Beredeneer …", "Voorspel … en leg uit", "Geef een advies en onderbouw het", "Leg uit of …").
- Meerkeuze: afleiders zijn echte misvattingen uit de lesstof, ongeveer even lang als het goede antwoord; geen "alle bovenstaande".
- Punten precies zoals gepland; de puntenverdeling in het nakijkmodel telt op tot die punten.
- Lever het gewone JSON-object (meta, vragen, nakijkmodel, cesuur, kwaliteit) met ALLEEN deze ${stuk.length} vragen; meta, cesuur en kwaliteit kort.`;
}

interface MiniPayload {
  vragen: { nummer: number; domein?: string; contextTitel?: string; punten?: number; rtti?: Rtti; rttiPlan?: Rtti; puntenPlan?: number; vormPlan?: string }[];
  nakijkmodel: { nummer: number; puntenverdeling?: { punt: number; criterium: string }[] }[];
}

/**
 * Punten van één vraag omlaag naar `max` (nooit omhoog: daar is geen nakijkcriterium voor). De
 * puntenverdeling krimpt mee: laatste criterium eerst een punt minder, anders samengevoegd met het vorige.
 */
export function kapPunten<V extends { punten?: number }, N extends { puntenverdeling?: { punt: number; criterium: string }[] }>(v: V, n: N | undefined, max: number): { v: V; n: N | undefined } {
  const doel = Math.max(1, Math.round(max));
  if ((v.punten ?? 1) <= doel) return { v, n };
  const pv = (n?.puntenverdeling ?? []).map((c) => ({ ...c }));
  let som = pv.reduce((s, c) => s + c.punt, 0);
  while (som > doel && pv.length) {
    const laatst = pv[pv.length - 1]!;
    if (laatst.punt > 1) laatst.punt -= 1;
    else if (pv.length > 1) {
      pv.pop();
      const vorige = pv[pv.length - 1]!;
      vorige.criterium = `${vorige.criterium}; ${laatst.criterium}`;
    } else break;
    som -= 1;
  }
  return { v: { ...v, punten: doel }, n: n && n.puntenverdeling?.length ? { ...n, puntenverdeling: pv } : n };
}

/**
 * Stukken samenvoegen in planvolgorde en doornummeren. Komt een stuk met precies het geplande aantal vragen
 * terug, dan krijgt elke vraag het domein (paragraaf), de groep en de RTTI uit het plan (`rttiPlan`, zodat
 * herlabelen het niet overschrijft) en nooit meer punten dan gepland. Daarna: totaal hoger dan het
 * puntendoel → de grootste open vragen (eerst die zonder planmatch) één punt omlaag tot het doel.
 */
export function voegStukkenSamen<P extends MiniPayload>(stukken: (P | null)[], plan: PlanItem[][], q: PlanQuota): P {
  const ok = stukken.map((p, i) => ({ p, s: plan[i]! })).filter((x): x is { p: P; s: PlanItem[] } => Boolean(x.p?.vragen.length));
  if (!ok.length) throw new Error("Geen enkel schrijfstuk gelukt");
  const titel = (code: string) => q.paragrafen.find((p) => p.code === code)?.titel ?? "";
  const vragen: P["vragen"] = [];
  const nakijk: P["nakijkmodel"] = [];
  const opPlanNrs = new Set<number>();
  for (const { p, s } of ok) {
    const opPlan = p.vragen.length === s.length;
    for (const [i, v] of p.vragen.entries()) {
      const nr = vragen.length + 1;
      const it = opPlan ? s[i]! : undefined;
      const n0 = p.nakijkmodel.find((x) => x.nummer === v.nummer) ?? p.nakijkmodel[i];
      const { v: v1, n: n1 } = it ? kapPunten(v, n0, it.punten) : { v, n: n0 };
      if (it) opPlanNrs.add(nr);
      vragen.push({
        ...v1,
        nummer: nr,
        ...(it ? { domein: `${it.par}${titel(it.par) ? ` ${titel(it.par)}` : ""}`, rtti: it.rtti, rttiPlan: it.rtti, puntenPlan: it.punten, ...(it.vorm === "teken" ? { vormPlan: "teken" } : {}), ...(it.groep ? { contextTitel: it.groep } : {}) } : {}),
      });
      if (n1) nakijk.push({ ...n1, nummer: nr });
    }
  }
  let over = vragen.reduce((t, v) => t + (v.punten ?? 1), 0) - q.punten;
  while (over > 0) {
    const kandidaat = vragen
      .filter((v) => (v.punten ?? 1) > 1)
      .sort((a, b) => Number(opPlanNrs.has(a.nummer)) - Number(opPlanNrs.has(b.nummer)) || (b.punten ?? 1) - (a.punten ?? 1))[0];
    if (!kandidaat) break;
    const i = vragen.indexOf(kandidaat);
    const ni = nakijk.findIndex((n) => n.nummer === kandidaat.nummer);
    const { v, n } = kapPunten(kandidaat, ni >= 0 ? nakijk[ni] : undefined, (kandidaat.punten ?? 1) - 1);
    vragen[i] = v;
    if (n && ni >= 0) nakijk[ni] = n;
    over -= 1;
  }
  return { ...ok[ok.length - 1]!.p, vragen, nakijkmodel: nakijk };
}

interface NaamVraag {
  nummer: number;
  contextTitel?: string;
  context?: string;
  stam: string;
  opties?: { letter: string; tekst: string }[];
}
interface NaamNakijk {
  nummer: number;
  modelantwoord: string;
  puntenverdeling?: { punt: number; criterium: string }[];
}

/**
 * Vangnet na het schrijven: een voornaam die al bij een andere vraag/context hoort, wordt in deze vraag
 * (inclusief nakijkmodel) vervangen door een ongebruikte naam uit VOORNAMEN. Zelfde contextTitel = zelfde persoon mag.
 */
export function ontdubbelNamen<V extends NaamVraag, N extends NaamNakijk>(vragen: V[], nakijk: N[]): { vragen: V[]; nakijkmodel: N[]; vervangen: string[] } {
  const bekend = new Set<string>(VOORNAMEN);
  const naamRe = /\b([A-Z][a-zëéï]{2,11})\b/g;
  const eigenaar = new Map<string, string>();
  const alleNamen = new Set<string>();
  for (const q of vragen) for (const m of `${q.context ?? ""} ${q.stam}`.matchAll(naamRe)) if (bekend.has(m[1]!) || EXTRA_NAMEN.has(m[1]!)) alleNamen.add(m[1]!);
  const vrij = () => VOORNAMEN.find((n) => !alleNamen.has(n) && !eigenaar.has(n));
  const vervangen: string[] = [];
  const binnenGroep = new Map<string, string>();
  const nieuwN = [...nakijk];
  const nieuwV = vragen.map((q) => {
    const sleutel = q.contextTitel?.trim() || `#${q.nummer}`;
    const namen = [...new Set([...`${q.context ?? ""} ${q.stam}`.matchAll(naamRe)].map((m) => m[1]!).filter((n) => bekend.has(n) || EXTRA_NAMEN.has(n)))];
    let uit = q;
    for (const naam of namen) {
      const van = eigenaar.get(naam);
      if (!van || van === sleutel) {
        eigenaar.set(naam, sleutel);
        continue;
      }
      const nieuw = binnenGroep.get(`${sleutel}|${naam}`) ?? vrij();
      if (!nieuw) continue;
      binnenGroep.set(`${sleutel}|${naam}`, nieuw);
      eigenaar.set(nieuw, sleutel);
      alleNamen.add(nieuw);
      const re = new RegExp(`\\b${naam}\\b`, "g");
      const r = (t: string | undefined) => (t ? t.replace(re, nieuw) : t);
      uit = { ...uit, context: r(uit.context), stam: r(uit.stam)!, ...(uit.opties ? { opties: uit.opties.map((o) => ({ ...o, tekst: r(o.tekst)! })) } : {}) };
      const ni = nieuwN.findIndex((n) => n.nummer === q.nummer);
      if (ni >= 0) {
        const n = nieuwN[ni]!;
        nieuwN[ni] = { ...n, modelantwoord: r(n.modelantwoord)!, ...(n.puntenverdeling ? { puntenverdeling: n.puntenverdeling.map((p) => ({ ...p, criterium: r(p.criterium)! })) } : {}) };
      }
      vervangen.push(`${q.nummer}: ${naam} → ${nieuw}`);
    }
    return uit;
  });
  return { vragen: nieuwV, nakijkmodel: nieuwN, vervangen };
}

/** Namen die schrijvers vaak zelf kiezen buiten de lijst (ook die mogen niet dubbel). */
const EXTRA_NAMEN = new Set(["Sara", "Tim", "Tom", "Max", "Kim", "Lucas", "Noah", "Liam", "Zoë", "Yara", "Mia", "Saar", "Ilse", "Pieter", "Jan", "Kees", "Hugo", "Jens", "Mats", "Lynn", "Puck", "Hanna", "Rosa", "Esmee", "Anouk", "Demi", "Romy", "Kevin", "Dylan", "Rick", "Mark", "Jip", "Siem", "Ward", "Olivier"]);
