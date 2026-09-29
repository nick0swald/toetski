import { detectVakProfiel, verzekerBronFiguren } from "./bron-figuren.ts";
import { detecteerItemIssues, repareerItemsDeterministisch, type ItemIssue } from "./item-kwaliteit.ts";
import { groepeerDomeinen } from "./leerdoelen.ts";
import { finalizeVragen } from "./mc-balance.ts";
import { repareerPunten } from "./punten-rubric.ts";
import { bijschavenPayloadSchema } from "./schema.ts";
import type { NakijkItem, Vraag } from "./types";

const REPAIR_SYSTEM = `Je verbetert ALLEEN de aangewezen VMBO-vragen. Antwoord met één JSON-object:
{ "vragen": [ volledige vraagobjecten van alleen de aangewezen nummers ], "nakijkmodel": [ bijbehorende nakijkregels ], "toelichting": "kort" }
Regels: precies één verdedigbaar antwoord; nooit onveilig handelen als juiste keuze; afleider herhaalt niet wat de stam uitsluit; de stam verklapt het antwoord niet; vragen beantwoorden elkaar niet; uitkomsten niet gelijk aan boekvoorbeelden; geen 'rond af' als de uitkomst exact is; geen 'volgens de lesstof'; genderneutraal ('de leerling'); context alleen als die iets toevoegt; varieer situaties. Meerkeuze: modelantwoord = letter + tekst. Pictogramvragen: veld pictogram (ontvlambaar|giftig|bijtend|milieu|schadelijk) en beschrijf het symbool niet in de stam.`;

function reparatiePrompt(vragen: Vraag[], nakijk: NakijkItem[], issues: ItemIssue[], bron: string): string {
  const nummers = [...new Set(issues.map((i) => i.nummer))];
  const blok = nummers
    .map((nr) => {
      const q = vragen.find((v) => v.nummer === nr);
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
    return vervanging ? { ...q, ...vervanging, nummer: q.nummer } : q;
  });
  const n = nakijk.map((item) => {
    if (!nummers.has(item.nummer)) return item;
    const vervanging = nieuwN.find((x) => x.nummer === item.nummer);
    return vervanging ? { ...item, ...vervanging, nummer: item.nummer } : item;
  });
  return { vragen: v, nakijkmodel: n };
}

/**
 * Deterministische nabewerking voor elk generatiepad.
 * Eén optionele LLM-reparatieronde als de heuristiek nog issues ziet.
 * MC-hussel + rubriek uit de sleutel gebeurt als laatste stap.
 */
export async function werkVragenAf(input: {
  vragen: Vraag[];
  nakijkmodel: NakijkItem[];
  bron: string;
  vak: string;
  skipOrder?: boolean;
  repair?: (prompt: string) => Promise<string | null>;
}): Promise<{ vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[] }> {
  const bron = input.bron ?? "";
  let stap = repareerItemsDeterministisch(input.vragen, input.nakijkmodel, bron);
  let vragen = stap.vragen;
  let nakijk = stap.nakijkmodel;

  if (stap.issues.length && input.repair) {
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
  vragen = verzekerBronFiguren(punten.vragen, bron, detectVakProfiel(input.vak, bron), punten.nakijkmodel);
  nakijk = punten.nakijkmodel;
  vragen = groepeerDomeinen(vragen, bron);
  const klaar = finalizeVragen(vragen, nakijk, { skipOrder: input.skipOrder });
  return {
    vragen: klaar.vragen,
    nakijkmodel: klaar.nakijkmodel,
    issues: detecteerItemIssues(klaar.vragen, klaar.nakijkmodel, bron),
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

export { REPAIR_SYSTEM };
