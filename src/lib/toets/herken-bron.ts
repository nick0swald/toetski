export type BronRol = "lesstof" | "antwoorden" | "notities" | "url";

export type HerkenContext = {
  heeftLesstof: boolean;
  heeftAntwoorden: boolean;
};

export type HerkenResultaat = {
  rol: BronRol;
  reden: string;
};

const ANTWOORD_NAAM =
  /antwoord|correctie|nakijk|docent(en)?(boek|exemplaar)?|sleutel|uitwerk|mark.?scheme|answer.?key|\bantw\b/i;
const LES_NAAM =
  /leerling|lesboek|lesstof|hoofdstuk|methode|werkboek|theorie|paragraaf|reader|pupil|student.?book/i;
const NOTITIE_NAAM =
  /notitie|aanteken|wens|instruct|sturing|aansturing|feedback|wijzig|memo|\bnotes?\b/i;

const URL_RE = /^(https?:\/\/)[^\s]+$/i;

export function isUrlRegel(tekst: string): boolean {
  const t = tekst.trim();
  if (t.length < 12 || t.length > 500) return false;
  if (t.includes("\n")) return false;
  return URL_RE.test(t);
}

function treffers(re: RegExp, s: string): number {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...s.matchAll(new RegExp(re.source, flags))].length;
}

function lijktOpBoek(naam: string): boolean {
  return /\.(pdf|docx?|odt)$/i.test(naam) || /pagina/i.test(naam);
}

export function herkenBron(
  naam: string,
  tekst: string,
  ctx: HerkenContext,
): HerkenResultaat {
  const n = naam.toLowerCase();
  const t = tekst.toLowerCase();
  const len = tekst.trim().length;

  if (isUrlRegel(tekst)) {
    return { rol: "url", reden: "Dit is een openbare link." };
  }

  if (NOTITIE_NAAM.test(n) && len < 12_000) {
    return { rol: "notities", reden: "Bestandsnaam wijst op notities." };
  }
  if (ANTWOORD_NAAM.test(n)) {
    return { rol: "antwoorden", reden: "Bestandsnaam wijst op een antwoordenboek." };
  }
  if (LES_NAAM.test(n)) {
    return { rol: "lesstof", reden: "Bestandsnaam wijst op het leerlingboek." };
  }

  const antwoordHits = treffers(
    /\b(antwoord(en)?|modelantwoord|correctievoorschrift|nakijkmodel|puntenverdeling|niet toekennen|totaalscore|cesuur|uitwerking)\b/gi,
    t,
  );
  const lesHits = treffers(
    /\b(leerdoel|leerling|paragraaf|begrip|hoofdstuk|lesstof|theorie|opdracht|oefening|leerstof|taxonomie)\b/gi,
    t,
  );
  const sturingHits = treffers(
    /\b(geen meerkeuze|graag |let op|maak |versie [ab]\b|korter|andere context|niet te moeilijk|alleen open)\b/gi,
    t,
  );

  if (
    len > 0 &&
    len < 1400 &&
    antwoordHits < 3 &&
    (sturingHits >= 1 || /^(geen |maak |graag |let op\b|svb\b|rtti\b)/i.test(tekst.trim()))
  ) {
    return { rol: "notities", reden: "Korte aansturing van de docent." };
  }

  const lijktLesboek =
    lesHits >= 3 || /\b(leerdoel|paragraaf|hoofdstuk|leerstof|taxonomie)\b/.test(t);

  if (antwoordHits >= 4 && antwoordHits >= lesHits && !lijktLesboek) {
    return { rol: "antwoorden", reden: "Tekst lijkt een antwoordenboek." };
  }

  if (!ctx.heeftLesstof) {
    if (len < 900 && ctx.heeftAntwoorden && sturingHits >= 1) {
      return { rol: "notities", reden: "Korte extra notitie." };
    }
    return { rol: "lesstof", reden: "Eerste bron: leerlingboek / lesstof." };
  }

  if (!ctx.heeftAntwoorden && lijktOpBoek(naam) && (antwoordHits >= 2 || len > 1800)) {
    return { rol: "antwoorden", reden: "Tweede boek: antwoordenboek." };
  }

  if (len < 2500) {
    return { rol: "notities", reden: "Extra notitie bij de lesstof." };
  }

  return { rol: "lesstof", reden: "Aanvulling op de lesstof." };
}

export function isIngevuldWerkboek(tekst: string): boolean {
  const t = tekst.toLowerCase();
  const uit = treffers(/\buitwerking\b/g, t);
  const gegevens = treffers(/\bgegevens\b/g, t);
  const gevraagd = treffers(/\bgevraagd\b/g, t);
  const leerdoel = treffers(/\bleerdoel/g, t);
  return (uit >= 3 && gegevens + gevraagd >= 3) || (uit >= 5 && leerdoel >= 1);
}

export function herkenBatch(
  items: { naam: string; tekst: string }[],
  start: HerkenContext = { heeftLesstof: false, heeftAntwoorden: false },
): { naam: string; tekst: string; rol: BronRol; reden: string }[] {
  const ctx = { ...start };
  const out: { naam: string; tekst: string; rol: BronRol; reden: string }[] = [];
  for (const item of items) {
    const hit = herkenBron(item.naam, item.tekst, ctx);
    out.push({ ...item, ...hit });
    if (hit.rol === "lesstof") ctx.heeftLesstof = true;
    if (hit.rol === "antwoorden") ctx.heeftAntwoorden = true;
  }
  if (!out.some((x) => x.rol === "antwoorden")) {
    const boek = out.find((x) => x.rol === "lesstof" && isIngevuldWerkboek(x.tekst));
    if (boek) {
      out.push({
        ...boek,
        naam: `${boek.naam} · antwoorden in het boek`,
        rol: "antwoorden",
        reden: "Antwoorden staan in dit boek.",
      });
    }
  }
  return out;
}

export function rolLabel(rol: BronRol): string {
  if (rol === "lesstof") return "Leerlingboek";
  if (rol === "antwoorden") return "Antwoordenboek";
  if (rol === "notities") return "Notities";
  return "Link";
}
