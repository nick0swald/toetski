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
Vraag om een andere RTTI of een andere paragraaf: schrijf een nieuwe vraag die daar echt bij past en zet rtti/domein goed.
Pictogramvragen: veld pictogram (GHS-symbool of veiligheidsbord, bijv. gebod-gehoorbescherming) en beschrijf het symbool niet in de stam; de rubriek noemt hetzelfde soort pictogram. Een bestaande goedgekeurde figuur (figuurverwijzing) blijft; pas alleen de tekst aan zodat die klopt met de figuur.`;

function reparatiePrompt(vragen: Vraag[], nakijk: NakijkItem[], issues: ItemIssue[], bron: string): string {
  const nummers = [...new Set(issues.map((i) => i.nummer))];
  const blok = nummers
    .map((nr) => {
      // Beelddata gaat nooit naar het model; een bevroren figuur is alleen een verwijzing.
      const gevonden = vragen.find((v) => v.nummer === nr);
      const q = gevonden ? figuurNaarVerwijzing(gevonden) : gevonden;
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

/** Onafhankelijke controle, parallel in stukjes van 4 vragen (sneller, minder lange uitvoer). */
async function controleerVragen(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  bron: { lesstof: string; antwoorden?: string },
  controleer: Repair,
): Promise<{ oordelen: ControleOordeel[]; gelukt: number }> {
  const stukken = inStukken(vragen, 4);
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
    inStukken(nummers, 4).map(async (st) => {
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
  let stap = repareerItemsDeterministisch(input.vragen, input.nakijkmodel, bron);
  let vragen = stap.vragen;
  let nakijk = stap.nakijkmodel;
  const paragrafen = extractParagrafen(bron, input.antwoorden);
  const bronW = { lesstof: bron, antwoorden: input.antwoorden };
  let controle: ControleLog | undefined;

  if (input.controleer && input.repair) {
    const gevonden: ControleBevinding[] = [];
    const vervangen: number[] = [];
    try {
      const eerste = await controleerVragen(vragen, nakijk, bronW, input.controleer);
      // Onafhankelijk RTTI-oordeel telt (eerlijk herlabelen), daarna pas balanceren.
      if (eerste.gelukt) {
        vragen = vragen.map((q) => {
          const o = eerste.oordelen.find((x) => x.nummer === q.nummer);
          return o?.rtti && o.rtti !== q.rtti ? { ...q, rtti: o.rtti } : q;
        });
      }
      const inhoud = controleIssues(vragen, nakijk, eerste.oordelen);
      const heur = stap.issues;
      const bezet = new Set([...inhoud, ...heur].map((i) => i.nummer));
      const dek = dekkingIssues(vragen, paragrafen, bezet);
      dek.forEach((i) => bezet.add(i.nummer));
      const rtti = input.rttiDoel ? rttiHerschrijfPlan(vragen, input.rttiDoel, { vermijd: bezet }) : [];
      const alle = [...heur, ...inhoud, ...dek, ...rtti];
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
        if (gewijzigd.length && rest() > 10_000) {
          const tweede = await controleerVragen(vragen.filter((q) => gewijzigd.includes(q.nummer)), nakijk, bronW, input.controleer);
          hercontrole = controleIssues(vragen, nakijk, tweede.oordelen);
        }
        const heurNa = det.issues.filter((i) => INHOUD.has(i.code));
        open = [...nietGerepareerd.filter((i) => INHOUD.has(i.code)), ...hercontrole, ...heurNa];
        const ernstig = open.filter((i) => ERNSTIG.has(i.code));
        if (ernstig.length && rest() > 8_000) {
          const r2 = await repareerRonde(vragen, nakijk, ernstig, bron, input.repair, true);
          const det2 = repareerItemsDeterministisch(r2.vragen, r2.nakijkmodel, bron);
          vragen = det2.vragen;
          nakijk = det2.nakijkmodel;
          stap = det2;
          vervangen.push(...r2.gewijzigd);
          open = open.filter((i) => !r2.gewijzigd.includes(i.nummer) || !ERNSTIG.has(i.code));
        }
      }
      const blijft = [...new Map(open.filter((i) => INHOUD.has(i.code)).map((i) => [`${i.nummer}:${i.code}`, i])).values()];
      const probleemNrs = new Set(gevonden.map((g) => g.nummer));
      controle = {
        gecontroleerd: eerste.gelukt,
        gevonden,
        opgelost: [...probleemNrs].filter((nr) => !blijft.some((b) => b.nummer === nr)),
        vervangen: [...new Set(vervangen)],
        blijft: blijft.map((i) => ({ nummer: i.nummer, code: i.code, uitleg: i.uitleg })),
        duurMs: nu() - t0,
        ...(eerste.gelukt ? {} : { fout: "controlemodel gaf geen oordeel" }),
      };
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
      ? punten.vragen.map((q) => {
          const spec = legacySpecs(q)[0];
          return spec ? vraagZonderFiguur(q, spec, { legacy: true, verwijst: true }).vraag : zonderLegacyFiguren(q);
        })
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
