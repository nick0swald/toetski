import { detectVakProfiel, plaatsMaatcilinders, plaatsPictogrammen, verzekerBronFiguren } from "./bron-figuren.ts";
import { vraagZonderFiguur } from "./figuren/fallback.ts";
import { legacySpecs } from "./figuren/spec.ts";
import { detecteerItemIssues, repareerItemsDeterministisch, type ItemIssue } from "./item-kwaliteit.ts";
import { groepeerDomeinen } from "./leerdoelen.ts";
import { finalizeVragen } from "./mc-balance.ts";
import { repareerPunten } from "./punten-rubric.ts";
import { bijschavenPayloadSchema } from "./schema.ts";
import { figuurNaarVerwijzing, zonderLegacyFiguren } from "./figuren/bevriezing.ts";
import type { ControleBevinding, ControleLog, NakijkItem, RttiVerdeling, Vraag } from "./types";
import { CONTROLE_SYSTEM, controleIssues, controlePrompt, parseControle, type ControleOordeel } from "./inhoud-controle.ts";
import { extractParagrafen, paragraafDekking, type Paragraaf } from "./leerdoelen.ts";
import { rttiHerschrijfPlan } from "./rtti-balans.ts";
import { groepIntro, herstelGroepen, type Volgorde } from "./context-groepen.ts";
import { labelRtti } from "./rtti-regels.ts";
import { kapPunten } from "./plan-schrijven.ts";
import { LIMIETEN, TIJD } from "./config.ts";
import { lesstofVoorVragen } from "./lesstof-selectie.ts";
import { controleerBerekeningen, gVoorToets } from "./reken-check.ts";
import { dubbelsWeg, kernbegrippen, ontbrekendeKern, samenhangIssues, type Kernbegrip } from "./samenhang.ts";
import { zetTekenvakken } from "./tekenvak.ts";
import { CACHE_GRENS } from "./llm.ts";

const REPAIR_SYSTEM = `Je verbetert ALLEEN de aangewezen VMBO-vragen. Antwoord met één JSON-object:
{ "vragen": [ volledige vraagobjecten van alleen de aangewezen nummers ], "nakijkmodel": [ bijbehorende nakijkregels ], "toelichting": "kort" }
Regels: precies één verdedigbaar antwoord, gecontroleerd met de lesstof en het antwoordenboek; nooit onveilig handelen als juiste keuze; afleider herhaalt niet wat de stam uitsluit; de stam verklapt het antwoord niet; vragen beantwoorden elkaar niet; uitkomsten niet gelijk aan boekvoorbeelden; geen 'rond af' als de uitkomst exact is; geen 'volgens de lesstof'; genderneutraal ('de leerling'); varieer situaties.
Oplosbaar: elk getal dat het modelantwoord gebruikt staat in de context, stam, tabel of figuurgegevens (of is een standaard Binas-waarde).
Realistisch (verplicht): getallen passen bij de situatie (afstanden, tijden, snelheden, massa's, temperaturen, prijzen, afmetingen), de situatie kan echt zo gebeuren en is herkenbaar voor een vmbo-leerling; context, figuur en antwoord spreken elkaar niet tegen. Reken het antwoord opnieuw uit na elke getalwijziging.
Helder: noem elk ding/apparaat eerst concreet voordat je 'de/dit/deze' gebruikt. Verwijs niet naar een figuur, tabel of pictogram dat er niet bij staat.
Contexten: alledaagse situaties of verzonnen bedrijven (mag grappig, passend bij 12–16-jarigen, bijv. 'Frituur De Vette Hap'). NOOIT een schoolnaam of 'leerbedrijf van school'. Personen: Nederlandse voornamen (Sanne, Daan, Lotte, Bram).
Juist/onjuist: opties precies "Juist" en "Onjuist". Meerkeuze: modelantwoord = letter + tekst.
Rekenvragen: 1 punt per stap: 2p = gebruik van de formule (grootheid benoemd) + rest van de berekening juist (uitkomst met eenheid); 3p = omrekenen/aflezen + formule + rest; geen punt voor 'gegevens en gevraagde'. Een reken- en eenheidsfout kosten samen hooguit 1 punt; doorrekenen met een eigen foute waarde telt; significantie kost geen punten.
Doorlopende context: houd contextTitel en bronvermelding zoals ze zijn; de gedeelde inleiding (gedeeldeContext) niet herhalen in de stam.
Rubriek: elk criterium is één los te scoren onderdeel (1 punt per gevraagd ding); geen criteria als 'maakt geen fouten'. Punten = aantal gevraagde onderdelen. Herhaal de context niet in de stam.
Vraag om een andere RTTI of een andere paragraaf: schrijf een nieuwe vraag die daar echt bij past en zet rtti/domein goed.
Pictogramvragen: veld pictogram (GHS-symbool of veiligheidsbord, bijv. gebod-gehoorbescherming) en beschrijf het symbool niet in de stam; de rubriek noemt hetzelfde soort pictogram. Een bestaande goedgekeurde figuur (figuurverwijzing) blijft; pas alleen de tekst aan zodat die klopt met de figuur.`;

function reparatiePrompt(vragen: Vraag[], nakijk: NakijkItem[], issues: ItemIssue[], bron: string): string {
  const nummers = [...new Set(issues.map((i) => i.nummer))];
  const blok = nummers
    .map((nr) => {
      // Beelddata gaat nooit naar het model; een bevroren figuur is alleen een verwijzing.
      const gevonden = vragen.find((v) => v.nummer === nr);
      const q0 = gevonden ? figuurNaarVerwijzing(gevonden) : gevonden;
      const { tekstZonderFiguur: _t, rttiUitleg: _r, ...q } = q0 ?? ({} as Vraag);
      const n = nakijk.find((item) => item.nummer === nr);
      const waarom = issues.filter((i) => i.nummer === nr).map((i) => `- ${i.code}: ${i.uitleg}`).join("\n");
      const groep = gevonden ? groepIntro(vragen, gevonden) : undefined;
      return `Vraag ${nr}\n${waarom}\n${JSON.stringify({ vraag: q, nakijk: n, ...(groep ? { gedeeldeContext: `${groep.titel}: ${groep.intro}` } : {}) })}`;
    })
    .join("\n\n");
  // Lesstof vooraan als vast (gecachet) voorvoegsel; de vragen erna wisselen per stukje.
  return `Lesstof (kader, niet kopiëren):\n${lesstofVoorVragen(bron, vragen.filter((v) => nummers.includes(v.nummer)), LIMIETEN.reparatieLesstof)}${CACHE_GRENS}Verbeter alleen deze vragen. Houd het nummer. Lever ze compleet terug.\n\n${blok}`;
}

/**
 * Plan-first: reparatie en puntennormalisatie (1 punt per criterium) mogen de geplande punten niet
 * verhogen; anders groeit de toets voorbij het lengtedoel. Te veel criteria worden samengevoegd.
 */
export function houdPlanPunten(p: { vragen: Vraag[]; nakijkmodel: NakijkItem[] }): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const nakijkmodel = [...p.nakijkmodel];
  const vragen = p.vragen.map((q) => {
    if (!q.puntenPlan || q.punten <= q.puntenPlan) return q;
    const i = nakijkmodel.findIndex((n) => n.nummer === q.nummer);
    const r = kapPunten(q, i >= 0 ? nakijkmodel[i] : undefined, q.puntenPlan);
    if (r.n && i >= 0) nakijkmodel[i] = r.n;
    return r.v;
  });
  return { vragen, nakijkmodel };
}

/** Contexttitel, bronvermelding, vraagtype en plan-RTTI blijven bij een reparatie staan (het model laat ze vaak weg). */
function behoudGroep(oud: Vraag, nieuw: Vraag): Vraag {
  return {
    ...nieuw,
    contextTitel: oud.contextTitel ?? nieuw.contextTitel,
    bronvermelding: oud.bronvermelding ?? nieuw.bronvermelding,
    vraagtype: nieuw.vraagtype ?? oud.vraagtype,
    leerdoelId: nieuw.leerdoelId ?? oud.leerdoelId,
    rttiPlan: oud.rttiPlan ?? nieuw.rttiPlan,
    puntenPlan: oud.puntenPlan ?? nieuw.puntenPlan,
    vormPlan: oud.vormPlan ?? nieuw.vormPlan,
    tekenvak: nieuw.tekenvak ?? oud.tekenvak,
  };
}

function mergeOpNummer(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  nieuwV: Vraag[],
  nieuwN: NakijkItem[],
  nummers: Set<number>,
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const v = vragen.map((q) => {
    if (!nummers.has(q.nummer)) return q;
    const vervanging = nieuwV.find((x) => x.nummer === q.nummer);
    if (!vervanging) return q;
    // Een goedgekeurde figuur blijft staan zoals hij is; de reparatie mag er niets aan veranderen.
    if (q.figuur || q.figuurId) {
      const { figuur: _f, figuurId: _i, ...rest } = vervanging;
      return behoudGroep(q, zonderLegacyFiguren({ ...q, ...rest, nummer: q.nummer, figuur: q.figuur, figuurId: q.figuurId }));
    }
    return behoudGroep(q, { ...q, ...vervanging, nummer: q.nummer });
  });
  const n = nakijk.map((item) => {
    if (!nummers.has(item.nummer)) return item;
    const vervanging = nieuwN.find((x) => x.nummer === item.nummer);
    return vervanging ? { ...item, ...vervanging, nummer: item.nummer } : item;
  });
  return { vragen: v, nakijkmodel: n };
}

type Repair = (prompt: string) => Promise<string | null>;

const INHOUD = new Set(["geen-juiste-optie", "meer-juiste-opties", "sleutel-fout", "gegeven-ontbreekt", "realisme", "onhelder", "rubriek", "vage-verwijzing", "figuur-ontbreekt", "schoolnaam"]);
const ERNSTIG = new Set(["geen-juiste-optie", "meer-juiste-opties", "sleutel-fout", "gegeven-ontbreekt", "realisme"]);

function inStukken<T>(lijst: T[], grootte: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lijst.length; i += grootte) out.push(lijst.slice(i, i + grootte));
  return out;
}

function zonderFiguurVelden(q: Vraag): Vraag {
  const spec = legacySpecs(q)[0];
  return spec ? vraagZonderFiguur(q, spec, { legacy: true, verwijst: true }).vraag : zonderLegacyFiguren(q);
}

/** Onafhankelijk RTTI-oordeel telt (eerlijk herlabelen). */
function herlabel(vragen: Vraag[], oordelen: ControleOordeel[]): Vraag[] {
  return vragen.map((q) => {
    const o = oordelen.find((x) => x.nummer === q.nummer);
    return o?.rtti && o.rtti !== q.rtti ? { ...q, rtti: o.rtti } : q;
  });
}

/** Codes waarbij een vraag niet op het blad mag blijven (geen/verkeerde sleutel, niet oplosbaar). */
export const ONBRUIKBAAR = new Set(["geen-juiste-optie", "meer-juiste-opties", "sleutel-fout", "gegeven-ontbreekt"]);

/** Onafhankelijke controle, parallel in stukjes van LIMIETEN.stukGrootte vragen. */
async function controleerVragen(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  bron: { lesstof: string; antwoorden?: string },
  controleer: Repair,
  alle: Vraag[] = vragen,
): Promise<{ oordelen: ControleOordeel[]; gelukt: number }> {
  const stukken = inStukken(vragen, LIMIETEN.stukGrootte);
  const res = await Promise.all(
    stukken.map(async (st) => {
      const raw = await controleer(controlePrompt(st.map(figuurNaarVerwijzing), nakijk.filter((n) => st.some((q) => q.nummer === n.nummer)), bron, alle)).catch(() => null);
      return parseControle(raw);
    }),
  );
  const oordelen = res.flat();
  return { oordelen, gelukt: new Set(oordelen.map((o) => o.nummer)).size };
}

/** Eén reparatieronde (parallel per stukje van LIMIETEN.stukGrootte vragen). */
async function repareerRonde(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  issues: ItemIssue[],
  bron: string,
  repair: Repair,
  vervang = false,
): Promise<{ vragen: Vraag[]; nakijkmodel: NakijkItem[]; gewijzigd: number[] }> {
  const nummers = [...new Set(issues.map((i) => i.nummer))];
  let v = vragen;
  let n = nakijk;
  const gewijzigd: number[] = [];
  const res = await Promise.all(
    inStukken(nummers, LIMIETEN.stukGrootte).map(async (st) => {
      const sub = issues.filter((i) => st.includes(i.nummer));
      const extra = vervang
        ? "\n\nDeze vragen bleven na een reparatie fout. VERVANG elke vraag door een NIEUWE, eenvoudige en eenduidige vraag over hetzelfde leerdoel (zelfde type, punten en rtti), met een realistische situatie en alle gegevens in de tekst."
        : "";
      const raw = await repair(reparatiePrompt(vragen, nakijk, sub, bron) + extra).catch(() => null);
      if (!raw) return null;
      try {
        return bijschavenPayloadSchema.parse(JSON.parse(stripJson(raw)));
      } catch {
        return null;
      }
    }),
  );
  for (const p of res) {
    if (!p) continue;
    const set = new Set(p.vragen.map((q) => q.nummer).filter((nr) => nummers.includes(nr)));
    const m = mergeOpNummer(v, n, p.vragen, p.nakijkmodel, set);
    v = m.vragen;
    n = m.nakijkmodel;
    gewijzigd.push(...set);
  }
  return { vragen: v, nakijkmodel: n, gewijzigd };
}

/**
 * Deterministische stap na elke (re)generatie: itemreparaties, tekenvakken en de rekencontrole (één g per toets;
 * kleine afrondfouten hersteld, grote afwijkingen → sleutel-fout voor de reparatie).
 */
export function deterministisch(vragen: Vraag[], nakijk: NakijkItem[], bron: string, g?: number): { vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[]; g: number } {
  // Tekenvak eerst: een tekenvraag met tekenvak verwijst niet naar een "ontbrekende figuur".
  const det = repareerItemsDeterministisch(zetTekenvakken(vragen), nakijk, bron);
  const v = zetTekenvakken(det.vragen);
  const gT = g ?? gVoorToets(bron, v, det.nakijkmodel);
  const rk = controleerBerekeningen(v, det.nakijkmodel, { g: gT });
  const al = new Set(det.issues.map((i) => `${i.nummer}:${i.code}`));
  return { vragen: v, nakijkmodel: rk.nakijkmodel, issues: [...det.issues, ...rk.issues.filter((i) => !al.has(`${i.nummer}:${i.code}`))], g: gT };
}

/** "Niet oplosbaar: staat niet in de lesstof" → meteen vervangen (scheelt een tweede reparatie- en controleronde). */
export function vervangBuitenLesstof(issues: ItemIssue[], ontbreekt: Kernbegrip[]): ItemIssue[] {
  const vrij = [...ontbreekt];
  return issues.map((i) => {
    if (i.code !== "gegeven-ontbreekt" || !/lesstof|antwoordenboek/i.test(i.uitleg) || !/nergens|niet in|staat niet|ontbreek|geen/i.test(i.uitleg)) return i;
    const k = vrij.shift();
    return {
      ...i,
      uitleg: `${i.uitleg} Staat de gevraagde kennis niet in de lesstof, VERVANG de vraag dan door een nieuwe vraag ${k ? `over "${k.term}"${k.par ? ` (paragraaf ${k.par}; zet domein op die paragraaf)` : ""}` : "over een ander kernbegrip uit de lesstof dat nog niet in de toets staat"}; zelfde vorm, punten en rtti; nooit een tweede vraag over iets wat al in de toets staat.`,
    };
  });
}

/**
 * Lengte: ligt het totaal ruim onder het doel (tijd van de toets), dan een paar 1-punts gesloten vragen
 * laten herschrijven tot open vragen van 2 punten (zelfde leerdoel en rtti) — geen extra vragen.
 */
export function lengteIssues(vragen: Vraag[], doelPunten: number | undefined, vermijd: Set<number>, minGesloten = 0.5): ItemIssue[] {
  if (!doelPunten) return [];
  const totaal = vragen.reduce((s, q) => s + (q.punten ?? 1), 0);
  if (totaal >= doelPunten - 2) return [];
  let tekort = doelPunten - totaal;
  const vrij = (q: Vraag) => !vermijd.has(q.nummer) && !q.figuur && !q.figuurId && !q.pictogram;
  const out: ItemIssue[] = [];
  const kop = `De toets is te kort (${totaal} van ${doelPunten} punten voor deze tijd).`;
  // 1) Open vragen van 1–2 punten krijgen een extra onderdeel (uitleg/berekening): MC-aandeel blijft gelijk.
  for (const q of vragen.filter((x) => vrij(x) && !x.opties?.length && (x.punten ?? 1) <= 2).sort((a, b) => (a.punten ?? 1) - (b.punten ?? 1))) {
    if (tekort <= 0 || out.length >= 5) break;
    const nieuw = (q.punten ?? 1) + 1;
    tekort -= 1;
    out.push({ nummer: q.nummer, code: "lengte", uitleg: `${kop} Breid deze open vraag uit met één extra onderdeel: liefst een extra reken- of noteerstap (Bereken/Noteer) met de gegevens in de tekst; 'leg uit' alleen als het niet anders kan en maak er ${nieuw} punten van, zelfde leerdoel en rtti ${q.rtti}. Rubriek: ${nieuw} criteria van elk 1 punt.` });
  }
  // 2) Pas daarna gesloten vragen omzetten, zolang het gesloten aandeel boven het doel blijft (standaard de helft).
  let gesloten = vragen.filter((q) => q.opties?.length).length;
  for (const q of vragen.filter((x) => vrij(x) && x.opties?.length && x.rtti !== "R")) {
    if (tekort <= 0 || out.length >= 5 || gesloten - 1 < minGesloten * vragen.length) break;
    gesloten -= 1;
    tekort -= 1;
    out.push({ nummer: q.nummer, code: "lengte", uitleg: `${kop} Herschrijf deze vraag tot een OPEN vraag van 2 punten over hetzelfde leerdoel (rtti ${q.rtti}), bijv. noem + leg uit. Rubriek: 2 criteria van elk 1 punt.` });
  }
  return out;
}

/** Dekking per paragraaf: ontbrekende paragrafen → een vraag uit de drukste paragraaf vervangen. */
function dekkingIssues(vragen: Vraag[], paragrafen: Paragraaf[], vermijd: Set<number>): ItemIssue[] {
  if (paragrafen.length < 2) return [];
  const dekking = paragraafDekking(vragen, paragrafen);
  const leeg = dekking.filter((d) => !d.vragen.length);
  const issues: ItemIssue[] = [];
  const gebruikt = new Set(vermijd);
  for (const l of leeg.slice(0, 3)) {
    const druk = dekking
      .filter((d) => d.vragen.length >= 2)
      .sort((a, b) => b.vragen.length - a.vragen.length)[0];
    const donor = druk?.vragen.map((nr) => vragen.find((q) => q.nummer === nr)!).filter((q) => q && !gebruikt.has(q.nummer) && !q.figuur).pop();
    if (!donor || !druk) break;
    druk.vragen = druk.vragen.filter((nr) => nr !== donor.nummer);
    gebruikt.add(donor.nummer);
    issues.push({
      nummer: donor.nummer,
      code: "dekking",
      uitleg: `Paragraaf ${l.paragraaf.code} ${l.paragraaf.titel} heeft nog geen vraag. Vervang deze vraag door een nieuwe vraag over ${l.paragraaf.code} ${l.paragraaf.titel} (zelfde type, ${donor.punten} punt${donor.punten === 1 ? "" : "en"}, rtti ${donor.rtti}); domein = "${l.paragraaf.code} ${l.paragraaf.titel}".`,
    });
  }
  return issues;
}

/**
 * Deterministische nabewerking voor elk generatiepad.
 * Daarna de VERPLICHTE inhoudscontrole (als er een controlemodel is): onafhankelijk narekenen
 * (sleutel, oplosbaarheid, realisme, helderheid, rubriek), dekking per paragraaf en RTTI-balans;
 * afwijkingen → reparatie → hercontrole → zo nodig vervangen. MC-hussel + rubriek als laatste stap.
 */
export async function werkVragenAf(input: {
  vragen: Vraag[];
  nakijkmodel: NakijkItem[];
  bron: string;
  vak: string;
  skipOrder?: boolean;
  repair?: Repair;
  /** Onafhankelijk (redenerend) controlemodel; zonder dit alleen de heuristiek. */
  controleer?: Repair;
  antwoorden?: string;
  rttiDoel?: RttiVerdeling;
  /** Beoogd totaal punten (uit de toetsduur); ruim te weinig → vragen uitbreiden. */
  doelPunten?: number;
  /** Tijdsbudget voor controle + reparatie (ms). */
  budgetMs?: number;
  nu?: () => number;
  /**
   * "nodig" (standaard): alleen figuurvelden waar de vraag erom vraagt (pictogram-/maatcilindervraag);
   * geen verplichte minimumfiguur meer. "geen": Zonder plaatjes — alle figuurvelden eruit.
   * "minimaal": oud gedrag (minstens één figuur bij NaSk).
   */
  figuren?: "nodig" | "geen" | "minimaal";
  /** Volgorde: mc-eerst (standaard), blokken (BB: juist/onjuist → meerkeuze → open), behoud (contexten). */
  volgorde?: Volgorde;
  /** Paragrafen uit een herkend Nova-hoofdstuk als de bron zelf geen koppen heeft. */
  paragrafen?: Paragraaf[];
  /** Minimaal gesloten aandeel bij het verlengen (NaSk: gekalibreerd; anders 0,5). */
  minGesloten?: number;
}): Promise<{ vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[]; controle?: ControleLog }> {
  const bron = input.bron ?? "";
  const nu = input.nu ?? (() => Date.now());
  const t0 = nu();
  const budget = input.budgetMs ?? TIJD.afwerkBudgetMs;
  const rest = () => budget - (nu() - t0);
  // Elke modelaanroep krijgt hooguit het resterende budget (+6 s): het geheel blijft binnen de Vercel-limiet.
  const binnenTijd = (f?: Repair): Repair | undefined =>
    f &&
    ((p) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = new Promise<null>((res) => {
        timer = setTimeout(() => res(null), Math.max(4_000, rest() + 6_000));
      });
      return Promise.race([f(p).catch(() => null), stop]).finally(() => clearTimeout(timer));
    });
  input = { ...input, controleer: binnenTijd(input.controleer), repair: binnenTijd(input.repair) };
  let stap = deterministisch(input.vragen, input.nakijkmodel, bron);
  const g = stap.g;
  let vragen = stap.vragen;
  let nakijk = stap.nakijkmodel;
  // Zonder plaatjes: figuurvelden er meteen uit, zodat controle en reparatie geen spookfiguren beoordelen.
  if (input.figuren === "geen") vragen = vragen.map(zonderFiguurVelden);
  const eigen = extractParagrafen(bron, input.antwoorden);
  const paragrafen = eigen.length >= 2 ? eigen : (input.paragrafen ?? []);
  const bronW = { lesstof: bron, antwoorden: input.antwoorden };
  const kern = kernbegrippen(bron);
  let controle: ControleLog | undefined;

  if (input.controleer && input.repair) {
    const gevonden: ControleBevinding[] = [];
    const vervangen: number[] = [];
    const nietHercontroleerd: number[] = [];
    const verwijderd: number[] = [];
    try {
      const eerste = await controleerVragen(vragen, nakijk, bronW, input.controleer);
      // Onafhankelijk RTTI-oordeel telt (eerlijk herlabelen), daarna pas balanceren.
      if (eerste.gelukt) vragen = herlabel(vragen, eerste.oordelen);
      // Regel-RTTI (type → basis, bijgesteld op opdracht/stappen/context) is leidend voor de balans.
      vragen = labelRtti(vragen);
      const heur = stap.issues;
      const bezet0 = new Set([...controleIssues(vragen, nakijk, eerste.oordelen), ...heur].map((i) => i.nummer));
      // Herhaling en weggevers (deterministisch): de dubbele vraag wordt vervangen, liefst door een ontbrekend kernbegrip.
      const sam = samenhangIssues(vragen, nakijk, { kern, vermijd: bezet0 });
      const nieuwKern = new Set(sam.map((i) => i.uitleg.match(/NIEUWE vraag over "([^"]+)"/)?.[1]).filter(Boolean));
      const inhoud = vervangBuitenLesstof(controleIssues(vragen, nakijk, eerste.oordelen), ontbrekendeKern(vragen, nakijk, kern).filter((k) => !nieuwKern.has(k.term)));
      const bezet = new Set([...bezet0, ...sam.map((i) => i.nummer)]);
      const dek = dekkingIssues(vragen, paragrafen, bezet);
      dek.forEach((i) => bezet.add(i.nummer));
      const rtti = input.rttiDoel ? rttiHerschrijfPlan(vragen, input.rttiDoel, { vermijd: bezet }) : [];
      rtti.forEach((i) => bezet.add(i.nummer));
      const lengte = lengteIssues(vragen, input.doelPunten, bezet, input.minGesloten);
      const alle = [...heur, ...inhoud, ...sam, ...dek, ...rtti, ...lengte];
      gevonden.push(...alle.map((i) => ({ nummer: i.nummer, code: i.code, uitleg: i.uitleg })));
      let open = alle;
      // Gegarandeerd: controle ≤ TIJD.controleTimeoutMs, dus bij het standaardbudget is er altijd tijd voor ronde 1.
      if (alle.length && rest() > TIJD.reparatieMinRestMs) {
        const r1 = await repareerRonde(vragen, nakijk, alle, bron, input.repair);
        const det = deterministisch(r1.vragen, r1.nakijkmodel, bron, g);
        vragen = det.vragen;
        nakijk = det.nakijkmodel;
        stap = det;
        // Hercontrole van alles wat gewijzigd is.
        const gewijzigd = [...new Set(r1.gewijzigd)];
        const nietGerepareerd = alle.filter((i) => !gewijzigd.includes(i.nummer));
        let hercontrole: ItemIssue[] = [];
        if (gewijzigd.length && rest() > TIJD.hercontroleMinRestMs) {
          const tweede = await controleerVragen(vragen.filter((q) => gewijzigd.includes(q.nummer)), nakijk, bronW, input.controleer, vragen);
          vragen = herlabel(vragen, tweede.oordelen);
          hercontrole = controleIssues(vragen, nakijk, tweede.oordelen);
        } else if (gewijzigd.length) {
          nietHercontroleerd.push(...gewijzigd);
        }
        const heurNa = det.issues.filter((i) => INHOUD.has(i.code));
        open = [...nietGerepareerd.filter((i) => INHOUD.has(i.code)), ...hercontrole, ...heurNa];
        const ernstig = open.filter((i) => ERNSTIG.has(i.code));
        if (ernstig.length && rest() > TIJD.vervangMinRestMs) {
          const r2 = await repareerRonde(vragen, nakijk, ernstig, bron, input.repair, true);
          const det2 = deterministisch(r2.vragen, r2.nakijkmodel, bron, g);
          vragen = det2.vragen;
          nakijk = det2.nakijkmodel;
          stap = det2;
          vervangen.push(...r2.gewijzigd);
          // Oude bevindingen van vervangen vragen gelden niet meer; de nieuwe vraag opnieuw controleren als er tijd is.
          open = open.filter((i) => !r2.gewijzigd.includes(i.nummer));
          const nieuw = [...new Set(r2.gewijzigd)];
          if (nieuw.length && rest() > -4_000) {
            const derde = await controleerVragen(vragen.filter((q) => nieuw.includes(q.nummer)), nakijk, bronW, input.controleer, vragen);
            vragen = herlabel(vragen, derde.oordelen);
            open.push(...controleIssues(vragen, nakijk, derde.oordelen));
          } else {
            nietHercontroleerd.push(...nieuw);
          }
          open.push(...det2.issues.filter((i) => INHOUD.has(i.code) && nieuw.includes(i.nummer)));
        }
      }
      let blijft = [...new Map(open.filter((i) => INHOUD.has(i.code)).map((i) => [`${i.nummer}:${i.code}`, i])).values()];
      // Na reparatie én vervanging nog steeds onbruikbaar (geen juiste sleutel of niet oplosbaar): van het blad af,
      // zolang er genoeg vragen overblijven. Liever een vraag minder dan een foute vraag.
      const onbruikbaar = [...new Set(blijft.filter((i) => ONBRUIKBAAR.has(i.code)).map((i) => i.nummer))].slice(0, Math.max(0, vragen.length - 8));
      // Na de reparatie nog steeds twee keer hetzelfde (zelfde antwoord/begrippen)? Dan de losse 1-puntsvraag eraf
      // (hooguit 2, zolang er genoeg vragen en ≥ 90 % van de punten blijven).
      const over = vragen.filter((q) => !onbruikbaar.includes(q.nummer));
      const dubbel = dubbelsWeg(over, nakijk, {
        minVragen: Math.max(8, over.length - 2),
        minPunten: input.doelPunten ? Math.ceil(input.doelPunten * 0.9) : 0,
      });
      if (dubbel.length) gevonden.push(...dubbel.map((nr) => ({ nummer: nr, code: "herhaling", uitleg: "Na reparatie nog steeds dezelfde vraag als een andere: weggehaald." })));
      const weg = [...onbruikbaar, ...dubbel];
      if (weg.length) {
        const voor = vragen;
        vragen = herstelGroepen(vragen.filter((q) => !weg.includes(q.nummer)), voor);
        nakijk = nakijk.filter((n) => !weg.includes(n.nummer));
        blijft = blijft.filter((i) => !weg.includes(i.nummer));
        verwijderd.push(...weg);
      }
      const probleemNrs = new Set(gevonden.map((g) => g.nummer));
      controle = {
        gecontroleerd: eerste.gelukt,
        gevonden,
        opgelost: [...probleemNrs].filter((nr) => !blijft.some((b) => b.nummer === nr) && !verwijderd.includes(nr)),
        vervangen: [...new Set(vervangen)],
        ...(nietHercontroleerd.length ? { nietHercontroleerd: [...new Set(nietHercontroleerd)].filter((nr) => !verwijderd.includes(nr)) } : {}),
        ...(verwijderd.length ? { verwijderd } : {}),
        blijft: blijft.map((i) => ({ nummer: i.nummer, code: i.code, uitleg: i.uitleg })),
        duurMs: nu() - t0,
        ...(eerste.gelukt ? {} : { fout: "controlemodel gaf geen oordeel" }),
      };
      if (verwijderd.length) {
        // Doornummeren zonder gaten; het log volgt de nieuwe nummers.
        const nieuwNr = new Map(vragen.map((q, i) => [q.nummer, i + 1]));
        vragen = vragen.map((q, i) => ({ ...q, nummer: i + 1 }));
        nakijk = nakijk.map((n) => ({ ...n, nummer: nieuwNr.get(n.nummer) ?? n.nummer }));
        const nr = (x: number) => nieuwNr.get(x);
        const bev = (l: ControleBevinding[]) => l.filter((g) => nr(g.nummer) !== undefined).map((g) => ({ ...g, nummer: nr(g.nummer)! }));
        const lijst = (l: number[]) => l.map(nr).filter((x): x is number => x !== undefined);
        controle = {
          ...controle,
          gevonden: bev(controle.gevonden),
          blijft: bev(controle.blijft),
          opgelost: lijst(controle.opgelost),
          vervangen: lijst(controle.vervangen),
          ...(controle.nietHercontroleerd ? { nietHercontroleerd: lijst(controle.nietHercontroleerd) } : {}),
        };
      }
    } catch (err) {
      controle = { gecontroleerd: 0, gevonden, opgelost: [], vervangen, blijft: [], duurMs: nu() - t0, fout: err instanceof Error ? err.message.slice(0, 120) : "fout" };
    }
  } else if (stap.issues.length && input.repair) {
    try {
      const raw = await input.repair(reparatiePrompt(vragen, nakijk, stap.issues, bron));
      if (raw) {
        const parsed = bijschavenPayloadSchema.parse(JSON.parse(stripJson(raw)));
        const nummers = new Set(stap.issues.map((i) => i.nummer));
        const gemengd = mergeOpNummer(vragen, nakijk, parsed.vragen, parsed.nakijkmodel, nummers);
        const opnieuw = deterministisch(gemengd.vragen, gemengd.nakijkmodel, bron, g);
        if (opnieuw.issues.length <= stap.issues.length) {
          vragen = opnieuw.vragen;
          nakijk = opnieuw.nakijkmodel;
          stap = opnieuw;
        }
      }
    } catch {
      // Heuristiek blijft staan als de reparatieronde niets bruikbaars teruggeeft.
    }
  }

  const punten = houdPlanPunten(repareerPunten(zetTekenvakken(vragen), nakijk));
  const figMode = input.figuren ?? "nodig";
  vragen =
    figMode === "geen"
      ? punten.vragen.map(zonderFiguurVelden)
      : figMode === "minimaal"
        ? verzekerBronFiguren(punten.vragen, bron, detectVakProfiel(input.vak, bron), punten.nakijkmodel)
        : plaatsMaatcilinders(plaatsPictogrammen(punten.vragen, punten.nakijkmodel));
  nakijk = punten.nakijkmodel;
  vragen = labelRtti(herstelGroepen(groepeerDomeinen(vragen, bron)));
  const klaar = finalizeVragen(vragen, nakijk, { skipOrder: input.skipOrder, volgorde: input.volgorde });
  // Vragen met een bevroren figuur krijgen nooit (opnieuw) ongekeurde figuurvelden.
  const beschermd = klaar.vragen.map((q) => (q.figuur || q.figuurId ? zonderLegacyFiguren(q) : q));
  if (controle) {
    // Nummers in het log volgen de uiteindelijke volgorde (MC eerst hernummert).
    const kaart = new Map<number, number>();
    vragen.forEach((q) => {
      const na = klaar.vragen.find((x) => x.stam === q.stam) ?? klaar.vragen.find((x) => x.stam.slice(0, 40) === q.stam.slice(0, 40));
      if (na) kaart.set(q.nummer, na.nummer);
    });
    const his = (nr: number) => kaart.get(nr) ?? nr;
    const b = (x: ControleBevinding) => ({ ...x, nummer: his(x.nummer) });
    controle = {
      ...controle,
      gevonden: controle.gevonden.map(b),
      blijft: controle.blijft.map(b),
      opgelost: controle.opgelost.map(his),
      vervangen: controle.vervangen.map(his),
      ...(controle.nietHercontroleerd ? { nietHercontroleerd: controle.nietHercontroleerd.map(his) } : {}),
    };
  }
  if (controle && paragrafen.length >= 2) {
    controle.paragrafen = paragraafDekking(beschermd, paragrafen).map((d) => ({ code: d.paragraaf.code, titel: d.paragraaf.titel, vragen: d.vragen }));
  }
  return {
    vragen: beschermd,
    nakijkmodel: klaar.nakijkmodel,
    issues: detecteerItemIssues(klaar.vragen, klaar.nakijkmodel, bron),
    controle,
  };
}

function stripJson(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export { REPAIR_SYSTEM, CONTROLE_SYSTEM };
