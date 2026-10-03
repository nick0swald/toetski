/**
 * Docent-review (productie): ná de deterministische keuring één Grok-aanroep die de hele toets leest zoals een
 * ervaren docent/toetsconstructeur, met een strikte checklist voor wat code niet ziet:
 *   weggevers over alle vragen heen, eerlijke RTTI, examenniveau en meerstapsvragen, te dicht bij opgaven uit het boek,
 *   dubbelzinnige of onzinnige MC-opties, dekkingsgaten per paragraaf, en "zou deze toets beter worden met figuren of
 *   uitgewerkte voorbeelden?".
 * De bevindingen (met concrete fix per vraagstuk) gaan naar het bestaande gerichte herstel (max. 2 reviewrondes); daarna
 * draait de deterministische keuring opnieuw. De deterministische keuring blijft de harde poort: de review blokkeert
 * nooit zelf. Generiek opgezet (geen NaSk-specifieke figuurregels in de vraag), zodat het later ook voor andere vakken
 * werkt: een figuur wordt nooit afgedwongen.
 */
import { figuurTekst, type Generatie, type SpecInvoer } from "./grok-spec.ts";
import { extractParagrafen } from "../leerdoelen.ts";
import { relevanteDoelen, vraagtypeSpreiding } from "./doelen.ts";

export const REVIEW_SOORTEN = ["weggever", "rtti", "niveau", "boek", "mc", "doel", "vraagtype", "dekking", "figuur", "overig"] as const;
export type ReviewSoort = (typeof REVIEW_SOORTEN)[number];

export interface ReviewBevinding {
  /** Vraagstuk-id of deelvraag-id ("" = de hele toets). */
  id: string;
  soort: ReviewSoort;
  ernst: "hoog" | "laag";
  probleem: string;
  fix: string;
}

export interface ReviewUitslag {
  bevindingen: ReviewBevinding[];
  figurenBeter: boolean;
  /** Bij figurenBeter: welke figuur/figuren (1–2) de toets beter maken en bij welke stof. */
  figuurVoorstel?: string;
}

export const REVIEW = {
  maxRondes: 2,
  reserveUsd: 0.08,
  maxTokens: 3000,
  timeoutMs: 90_000,
  /** Zoveel tekens lesstof gaan mee (samenvatting + opgaven om overlap te zien). */
  lesstofTekens: 9000,
} as const;

export function reviewSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["bevindingen", "figurenBeter"],
    properties: {
      bevindingen: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "soort", "ernst", "probleem", "fix"],
          properties: {
            id: { type: "string" },
            soort: { enum: [...REVIEW_SOORTEN] },
            ernst: { enum: ["hoog", "laag"] },
            probleem: { type: "string" },
            fix: { type: "string" },
          },
        },
      },
      figurenBeter: { type: "boolean" },
      figuurVoorstel: { type: "string" },
    },
  };
}

const kaal = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** De toets als leesbare tekst voor de review (met antwoorden, RTTI, punten, leerdoel en figuurbeschrijving). */
export function toetsAlsTekst(gen: Generatie): string {
  let nr = 0;
  return gen.vraagstukken
    .map((v) => {
      const kop = `## ${v.id} — ${v.titel}${v.figuur ? `\n${figuurTekst(v.figuur)}` : ""}\n${kaal(v.context.join(" "))}`;
      const vr = v.deelvragen.map((d) => {
        nr++;
        const opties = d.opties?.length ? `\n  ${d.opties.map((o, i) => `${String.fromCharCode(65 + i)}. ${kaal(o)}`).join("\n  ")}` : "";
        const aw = d.opties?.length ? `juist: ${d.antwoordmodel.juist}` : kaal(d.antwoordmodel.regels.join(" / "));
        return `${nr}. [${d.id}; ${d.punten} p; RTTI ${d.rtti}; leerdoel: ${kaal(d.leerdoel ?? "")}${d.examendoel ? `; examendoel ${d.examendoel}` : ""}; vraagtype ${d.vraagtype?.nr ?? "?"} ${d.vraagtype?.naam ?? ""}]${d.figuur ? ` ${figuurTekst(d.figuur)}` : ""}${d.context?.length ? ` ${kaal(d.context.join(" "))}` : ""}\n  ${kaal(d.stam)}${opties}\n  → ${aw}`;
      });
      return [kop, ...vr].join("\n");
    })
    .join("\n\n");
}

export function reviewPrompt(gen: Generatie, inv: SpecInvoer): { system: string; user: string } {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  const system = `Je bent een kritische, ervaren docent en toetsconstructeur. Je beoordeelt een kant-en-klare toets voordat hij naar de klas gaat. De software heeft rekenwerk, figuren, lengte en vorm al gecontroleerd; jij zoekt wat code niet ziet. Wees streng maar eerlijk: meld alleen echte problemen, met een concrete fix. Antwoord ALLEEN als JSON volgens het schema.

CHECKLIST
1. weggever: verklapt een context, stam, "Ga uit van …"-waarde, tabel of MC-optie (ook van een ánder vraagstuk) het antwoord op een andere vraag? Ook een gegeven dat (bijna) gelijk is aan een uitkomst die elders berekend moet worden.
2. rtti: is het RTTI-label eerlijk? Reproductie (feit, definitie, naam) is R, ook als het label T1 zegt. T1/T2 = toepassen of rekenen; I = inzicht in een nieuwe situatie.
3. niveau: past het bij het examenniveau van deze klas? Te veel losse 1-punts weetvragen? Ontbreken meerstapsvragen (eenheden omrekenen zoals W→kW en min→h, kosten per kWh, "slaat de zekering door?", een verband in meerdere stappen)?
4. boek: lijkt een vraag (bijna) letterlijk op een opgave of voorbeeld uit de lesstof hieronder (zelfde situatie of zelfde vraag in andere woorden)?
5. mc: zijn MC-opties eenduidig (precies één verdedigbaar juist antwoord), plausibel en niet onzinnig? Geen optie die half juist is.
6. doel: toetst elke vraag een examendoel (CvTE-eindterm, of in de onderbouw een SLO-kerndoel) dat echt in de lesstof staat, en klopt het opgegeven examendoel en vraagtype bij wat de vraag vraagt? Geen stof die niet in de lesstof staat.
7. vraagtype: zijn de vraagtypen gevarieerd genoeg voor deze klas (klas 4: als het CSE, minstens 6 typen en geen type met meer dan een kwart van de punten; klas 3: richting examen, iets milder; klas 1–2: losjes, wel afwisseling)? Zo niet: id "" en noem welke vraag een ander type kan krijgen.
8. dekking: wordt een paragraaf uit de lesstof niet of nauwelijks getoetst terwijl die belangrijk is?
9. figuur: zou deze toets beter worden met figuren of uitgewerkte voorbeelden (een schema, aflezing, grafiek, bron of uitgewerkt voorbeeld in de context)? Alleen ja als het de vragen echt beter maakt; nooit een figuur om er een te hebben.

Per bevinding: id = het vraagstuk-id of deelvraag-id (tussen [ ] in de toets), soort, ernst ("hoog" = moet aangepast; "laag" = kan beter), probleem (kort) en fix (concreet: wat moet er anders). Geen bevindingen? Lege lijst.`;
  const user = [
    `TOETS: "${inv.titel}" · ${inv.leerweg} klas ${inv.leerjaar} · ${inv.duurMinuten} minuten.`,
    (() => {
      const doelen = relevanteDoelen(`${inv.bronmateriaal}\n${inv.antwoordenmateriaal ?? ""}`, inv.leerjaar, inv.leerweg);
      const bron = inv.leerjaar <= 2 ? "SLO-KERNDOELEN (onderbouw; mild niveau)" : inv.leerjaar === 3 ? "CVTE-EINDTERMEN (klas 3: richting examen, iets milder)" : "CVTE-EINDTERMEN (klas 4: examenniveau)";
      return doelen.length ? `${bron} BIJ DEZE LESSTOF: ${doelen.map((d) => `${d.id} ${d.tekst}`).join("; ")}.` : "";
    })(),
    (() => {
      const s = vraagtypeSpreiding(gen.vraagstukken);
      return `SPREIDING VRAAGTYPEN (nummer uit de 62 CSE-vraagtypen): ${s.aantal} typen, grootste aandeel ${s.maxAandeel} % van de punten: ${s.perType.map((t) => `${t.nr} ${t.naam} (${t.punten} p)`).join("; ")}.`;
    })(),
    pars.length ? `PARAGRAFEN IN DE LESSTOF: ${pars.map((p) => `${p.code} ${p.titel}`).join("; ")}.` : "",
    `\nDE TOETS:\n${toetsAlsTekst(gen)}`,
    `\nLESSTOF (ingekort; voor dekking en overlap met opgaven uit het boek):\n${inv.bronmateriaal.slice(0, REVIEW.lesstofTekens)}`,
    `\nGeef je bevindingen als JSON.`,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** Controleert en ordent de review: per vraagstuk de bevindingen met ernst "hoog" (als herstelopdracht). */
export function verwerkReview(u: ReviewUitslag, gen: Generatie): { perVraagstuk: Record<string, string[]>; toets: ReviewBevinding[]; schoon: boolean; figurenBeter: boolean; figuurVoorstel?: string } {
  const vanDeel = new Map<string, string>();
  for (const v of gen.vraagstukken) {
    vanDeel.set(v.id, v.id);
    for (const d of v.deelvragen) vanDeel.set(d.id, v.id);
  }
  const perVraagstuk: Record<string, string[]> = {};
  const toets: ReviewBevinding[] = [];
  for (const b of Array.isArray(u?.bevindingen) ? u.bevindingen : []) {
    if (!b || typeof b.probleem !== "string" || !REVIEW_SOORTEN.includes(b.soort)) continue;
    const vid = vanDeel.get(String(b.id ?? "").replace(/^\[|\]$/g, "").split(";")[0]!.trim());
    if (!vid || b.soort === "dekking" || b.soort === "figuur" || b.soort === "vraagtype") {
      toets.push(b);
      continue;
    }
    if (b.ernst !== "hoog") continue;
    (perVraagstuk[vid] ??= []).push(`${b.soort}${b.id !== vid ? ` (${b.id})` : ""}: ${kaal(b.probleem)} → fix: ${kaal(b.fix)}`.slice(0, 400));
  }
  const hoog = Object.keys(perVraagstuk).length > 0 || toets.some((b) => b.ernst === "hoog" && b.soort !== "figuur");
  return { perVraagstuk, toets, schoon: !hoog && !u?.figurenBeter, figurenBeter: Boolean(u?.figurenBeter), figuurVoorstel: u?.figuurVoorstel?.trim() || undefined };
}
