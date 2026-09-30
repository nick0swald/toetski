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

const REPAIR_SYSTEM = `Je verbetert ALLEEN de aangewezen VMBO-vragen. Antwoord met één JSON-object:
{ "vragen": [ volledige vraagobjecten van alleen de aangewezen nummers ], "nakijkmodel": [ bijbehorende nakijkregels ], "toelichting": "kort" }
Regels: precies één verdedigbaar antwoord, gecontroleerd met de lesstof en het antwoordenboek; nooit onveilig handelen als juiste keuze; afleider herhaalt niet wat de stam uitsluit; de stam verklapt het antwoord niet; vragen beantwoorden elkaar niet; uitkomsten niet gelijk aan boekvoorbeelden; geen 'rond af' als de uitkomst exact is; geen 'volgens de lesstof'; genderneutraal ('de leerling'); varieer situaties.
Oplosbaar: elk getal dat het modelantwoord gebruikt staat in de context, stam, tabel of figuurgegevens (of is een standaard Binas-waarde).
Realistisch (verplicht): getallen passen bij de situatie (afstanden, tijden, snelheden, massa's, temperaturen, prijzen, afmetingen), de situatie kan echt zo gebeuren en is herkenbaar voor een vmbo-leerling; context, figuur en antwoord spreken elkaar niet tegen. Reken het antwoord opnieuw uit na elke getalwijziging.
Helder: noem elk ding/apparaat eerst concreet voordat je 'de/dit/deze' gebruikt. Verwijs niet naar een figuur, tabel of pictogram dat er niet bij staat.
Contexten: alledaagse situaties of verzonnen bedrijven (mag grappig, passend bij 12–16-jarigen, bijv. 'Frituur De Vette Hap'). NOOIT een schoolnaam of 'leerbedrijf van school'. Personen: Nederlandse voornamen (Sanne, Daan, Lotte, Bram).
Juist/onjuist: opties precies "Juist" en "Onjuist". Meerkeuze: modelantwoord = letter + tekst.
Rekenvragen: rubriek in stappen (formule, invullen/berekenen, antwoord met eenheid), één fout kost 1 punt, doorrekenen met een eigen foute waarde telt.
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
      const { tekstZonderFiguur: _t, ...q } = q0 ?? ({} as Vraag);
      const n = nakijk.find((item) => item.nummer === nr);
      const waarom = issues.filter((i) => i.nummer === nr).map((i) => `- ${i.code}: ${i.uitleg}`).join("\n");
      return `Vraag ${nr}\n${waarom}\n${JSON.stringify({ vraag: q, nakijk: n })}`;
    })
    .join("\n\n");
  return `Verbeter alleen deze vragen. Houd het nummer. Lever ze compleet terug.\n\nLesstof (kader, niet kopiëren):\n${bron.slice(0, 4000)}\n\n${blok}`;
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
      return zonderLegacyFiguren({ ...q, ...rest, nummer: q.nummer, figuur: q.figuur, figuurId: q.figuurId });
    }
    return { ...q, ...vervanging, nummer: q.nummer };
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

/** Onafhankelijke controle, parallel in stukjes van 4 vragen (sneller, minder lange uitvoer). */
async function controleerVragen(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  bron: { lesstof: string; antwoorden?: string },
  controleer: Repair,
): Promise<{ oordelen: ControleOordeel[]; gelukt: number }> {
  const stukken = inStukken(vragen, 3);
  const res = await Promise.all(
    stukken.map(async (st) => {
      const raw = await controleer(controlePrompt(st.map(figuurNaarVerwijzing), nakijk.filter((n) => st.some((q) => q.nummer === n.nummer)), bron)).catch(() => null);
      return parseControle(raw);
    }),
  );
  const oordelen = res.flat();
  return { oordelen, gelukt: new Set(oordelen.map((o) => o.nummer)).size };
}

/** Eén reparatieronde (parallel per stukje van 4 vragen). */
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
    inStukken(nummers, 3).map(async (st) => {
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
 * Lengte: ligt het totaal ruim onder het doel (tijd van de toets), dan een paar 1-punts gesloten vragen
 * laten herschrijven tot open vragen van 2 punten (zelfde leerdoel en rtti) — geen extra vragen.
 */
export function lengteIssues(vragen: Vraag[], doelPunten: number | undefined, vermijd: Set<number>): ItemIssue[] {
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
    out.push({ nummer: q.nummer, code: "lengte", uitleg: `${kop} Breid deze open vraag uit met één extra onderdeel (bijv. 'leg uit waarom' of een rekenstap met gegevens in de tekst) en maak er ${nieuw} punten van, zelfde leerdoel en rtti ${q.rtti}. Rubriek: ${nieuw} criteria van elk 1 punt.` });
  }
  // 2) Pas daarna gesloten vragen omzetten, zolang minstens de helft gesloten blijft.
  let gesloten = vragen.filter((q) => q.opties?.length).length;
  for (const q of vragen.filter((x) => vrij(x) && x.opties?.length && x.rtti !== "R")) {
    if (tekort <= 0 || out.length >= 5 || (gesloten - 1) * 2 < vragen.length) break;
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
}): Promise<{ vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[]; controle?: ControleLog }> {
  const bron = input.bron ?? "";
  const nu = input.nu ?? (() => Date.now());
  const t0 = nu();
  const budget = input.budgetMs ?? 55_000;
  const rest = () => budget - (nu() - t0);
  // Elke modelaanroep krijgt hooguit het resterende budget (+6 s): het geheel blijft binnen ~100 s.
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
  let stap = repareerItemsDeterministisch(input.vragen, input.nakijkmodel, bron);
  let vragen = stap.vragen;
  let nakijk = stap.nakijkmodel;
  // Zonder plaatjes: figuurvelden er meteen uit, zodat controle en reparatie geen spookfiguren beoordelen.
  if (input.figuren === "geen") vragen = vragen.map(zonderFiguurVelden);
  const paragrafen = extractParagrafen(bron, input.antwoorden);
  const bronW = { lesstof: bron, antwoorden: input.antwoorden };
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
      const inhoud = controleIssues(vragen, nakijk, eerste.oordelen);
      const heur = stap.issues;
      const bezet = new Set([...inhoud, ...heur].map((i) => i.nummer));
      const dek = dekkingIssues(vragen, paragrafen, bezet);
      dek.forEach((i) => bezet.add(i.nummer));
      const rtti = input.rttiDoel ? rttiHerschrijfPlan(vragen, input.rttiDoel, { vermijd: bezet }) : [];
      rtti.forEach((i) => bezet.add(i.nummer));
      const lengte = lengteIssues(vragen, input.doelPunten, bezet);
      const alle = [...heur, ...inhoud, ...dek, ...rtti, ...lengte];
      gevonden.push(...alle.map((i) => ({ nummer: i.nummer, code: i.code, uitleg: i.uitleg })));
      let open = alle;
      if (alle.length && rest() > 12_000) {
        const r1 = await repareerRonde(vragen, nakijk, alle, bron, input.repair);
        const det = repareerItemsDeterministisch(r1.vragen, r1.nakijkmodel, bron);
        vragen = det.vragen;
        nakijk = det.nakijkmodel;
        stap = det;
        // Hercontrole van alles wat gewijzigd is.
        const gewijzigd = [...new Set(r1.gewijzigd)];
        const nietGerepareerd = alle.filter((i) => !gewijzigd.includes(i.nummer));
        let hercontrole: ItemIssue[] = [];
        if (gewijzigd.length && rest() > 6_000) {
          const tweede = await controleerVragen(vragen.filter((q) => gewijzigd.includes(q.nummer)), nakijk, bronW, input.controleer);
          vragen = herlabel(vragen, tweede.oordelen);
          hercontrole = controleIssues(vragen, nakijk, tweede.oordelen);
        } else if (gewijzigd.length) {
          nietHercontroleerd.push(...gewijzigd);
        }
        const heurNa = det.issues.filter((i) => INHOUD.has(i.code));
        open = [...nietGerepareerd.filter((i) => INHOUD.has(i.code)), ...hercontrole, ...heurNa];
        const ernstig = open.filter((i) => ERNSTIG.has(i.code));
        if (ernstig.length && rest() > 3_000) {
          const r2 = await repareerRonde(vragen, nakijk, ernstig, bron, input.repair, true);
          const det2 = repareerItemsDeterministisch(r2.vragen, r2.nakijkmodel, bron);
          vragen = det2.vragen;
          nakijk = det2.nakijkmodel;
          stap = det2;
          vervangen.push(...r2.gewijzigd);
          // Oude bevindingen van vervangen vragen gelden niet meer; de nieuwe vraag opnieuw controleren als er tijd is.
          open = open.filter((i) => !r2.gewijzigd.includes(i.nummer));
          const nieuw = [...new Set(r2.gewijzigd)];
          if (nieuw.length && rest() > -4_000) {
            const derde = await controleerVragen(vragen.filter((q) => nieuw.includes(q.nummer)), nakijk, bronW, input.controleer);
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
      const weg = [...new Set(blijft.filter((i) => ONBRUIKBAAR.has(i.code)).map((i) => i.nummer))].slice(0, Math.max(0, vragen.length - 8));
      if (weg.length) {
        vragen = vragen.filter((q) => !weg.includes(q.nummer));
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
        const opnieuw = repareerItemsDeterministisch(gemengd.vragen, gemengd.nakijkmodel, bron);
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

  const punten = repareerPunten(vragen, nakijk);
  const figMode = input.figuren ?? "nodig";
  vragen =
    figMode === "geen"
      ? punten.vragen.map(zonderFiguurVelden)
      : figMode === "minimaal"
        ? verzekerBronFiguren(punten.vragen, bron, detectVakProfiel(input.vak, bron), punten.nakijkmodel)
        : plaatsMaatcilinders(plaatsPictogrammen(punten.vragen, punten.nakijkmodel));
  nakijk = punten.nakijkmodel;
  vragen = groepeerDomeinen(vragen, bron);
  const klaar = finalizeVragen(vragen, nakijk, { skipOrder: input.skipOrder });
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
