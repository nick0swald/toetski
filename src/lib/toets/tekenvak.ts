import type { Tekenvak, Vraag } from "./types";

/**
 * Tekenvak (deterministisch): een open tekenvraag ("Teken de zwaartekracht …", geplande vorm "teken") krijgt een
 * leeg, door code getekend raster als antwoordkader in plaats van antwoordlijnen. Nooit een AI-beeld; een vraag met
 * een (bevroren) figuur of grafiek tekent in die figuur en krijgt geen tekenvak.
 */

export const TEKEN_OPDRACHT = /(?:^|[.!?:]\s*|\n)\s*(?:teken|schets)\b|\bteken\s+(?:de|een|het|in)\b/i;
const SCHAAL_RE = /1\s*cm\s*(?:≙|=|≡|komt overeen met|staat voor|is)\s*(\d+(?:[.,]\d+)?)\s*(N|newton|m\/s|m|km|kg)\b/i;

export function isTekenvraag(q: Vraag): boolean {
  if (q.opties?.length) return false;
  if (q.figuur || q.figuurId || q.grafiek || q.schemaFiguur) return false;
  if (TEKEN_OPDRACHT.test(q.stam)) return true;
  // Gepland als tekenvraag maar uitgeschreven als reken-/uitlegvraag (plan5 energie v21 "Bereken de nettokracht"): geen tekenvak.
  return q.vormPlan === "teken" && !/\b(bereken|noteer|noem|leg uit|verklaar|hoe groot|hoeveel)\b/i.test(q.stam);
}

/** Schaal uit de stam/context ("1 cm ≙ 10 N"), genormaliseerd. */
export function leesSchaal(t: string): { tekst: string; perCm: number; eenheid: string } | null {
  const m = t.match(SCHAAL_RE);
  if (!m) return null;
  const perCm = Number(m[1]!.replace(",", "."));
  const eenheid = /^newton$/i.test(m[2]!) ? "N" : m[2]!;
  return perCm > 0 ? { tekst: `1 cm ≙ ${m[1]} ${eenheid}`, perCm, eenheid } : null;
}

/** Volle tekstbreedte (16 hokjes van 1 cm, ≈ 16 cm); de hoogte past bij de tekening. */
export const TEKENVAK_KOLOMMEN = 16;

export function tekenvakVoor(q: Vraag, groepTekst = ""): Tekenvak {
  const tekst = `${groepTekst} ${q.context ?? ""} ${q.stam}`;
  const schaal = leesSchaal(tekst);
  const kolommen = TEKENVAK_KOLOMMEN;
  if (/schakelschema|schema\b/i.test(q.stam)) return { soort: "leeg", kolommen, rijen: 7 };
  if (/grafiek|diagram/i.test(q.stam)) {
    const [x, y] = q.tabel?.koppen ?? [];
    return { soort: "raster", kolommen, rijen: 10, ...(x ? { xLabel: x } : {}), ...(y ? { yLabel: y } : {}) };
  }
  if (/deeltjes|molecu|bolletjes/i.test(q.stam)) return { soort: "raster", kolommen, rijen: 6 };
  // Zijaanzicht/opstelling op schaal: hoog genoeg voor de hoogste maat op schaal (+ marge), minstens 6.
  let rijen = /parallellogram|samenstel|resulterende|twee krachten/i.test(tekst) ? 10 : 8;
  if (schaal && /zijaanzicht|hoog|hoogte|opstelling/i.test(tekst)) {
    const waarden = [...tekst.matchAll(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${schaal.eenheid.replace("/", "\\/")}\\b`, "g"))].map((m) => Number(m[1]!.replace(",", ".")));
    const hoogst = Math.max(0, ...waarden.filter((w) => w !== schaal.perCm).map((w) => w / schaal.perCm));
    if (hoogst > 0) rijen = Math.min(12, Math.max(6, Math.ceil(hoogst) + 3));
  }
  return { soort: "raster", kolommen, rijen, ...(schaal ? { schaal: schaal.tekst } : {}) };
}

/** Zet een tekenvak bij elke tekenvraag die er nog geen heeft; haalt het weg als de vraag geen tekenvraag meer is. */
/** Tekenopdracht voor een schakelschema/stroomkring: een figuur van de kring verklapt het antwoord. */
export function tekentSchakeling(q: Pick<Vraag, "stam">): boolean {
  return TEKEN_OPDRACHT.test(q.stam) && /schakel(?:schema|ing)|stroomkring|\bschema\b/i.test(q.stam);
}

export function zetTekenvakken(vragen: Vraag[]): Vraag[] {
  // Bij een doorlopende context staat de schaal vaak in de gedeelde inleiding (titel of eerste vraag).
  const groep = (q: Vraag) =>
    q.contextTitel?.trim() ? `${q.contextTitel} ${vragen.filter((x) => x.contextTitel === q.contextTitel && x.nummer <= q.nummer).map((x) => x.context ?? "").join(" ")}` : "";
  return vragen.map((q) => {
    if (isTekenvraag(q)) return q.tekenvak ? q : { ...q, tekenvak: tekenvakVoor(q, groep(q)) };
    // Ook een vraag die in afwerken is herschreven/vervangen en geen tekenopdracht meer is, verliest zijn oude tekenvak.
    if (q.tekenvak && (q.opties?.length || q.figuur || q.figuurId || !TEKEN_OPDRACHT.test(q.stam))) {
      const { tekenvak: _t, ...rest } = q;
      return rest;
    }
    return q;
  });
}
