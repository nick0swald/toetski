export const BRON_ACCEPT =
  ".pdf,.txt,.md,.csv,.json,.docx,.doc,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MAX_BRON_BYTES = 50 * 1024 * 1024;
export const MAX_BRON_TEKENS = 100_000;
export const MAX_ANTWOORD_TEKENS = 100_000;

export type BronSoort = "pdf" | "docx" | "tekst";

export type LeesVoortgang = {
  fase: "pdf" | "ocr";
  pagina: number;
  totaal: number;
};

export type BronLeesResultaat = {
  text: string;
  soort: BronSoort;
  paginaAantal?: number;
  afgekapt: boolean;
  scan?: boolean;
};

function isPdf(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf";
}

function isDocx(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function kappen(text: string, max: number): { text: string; afgekapt: boolean } {
  const trimmed = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (trimmed.length <= max) return { text: trimmed, afgekapt: false };
  return { text: trimmed.slice(0, max).trimEnd() + "\n\n[tekst ingekort]", afgekapt: true };
}

function tekstUitItems(items: Array<{ str?: unknown }>): string {
  return items
    .map((item) => ("str" in item ? String(item.str) : ""))
    .join(" ")
    .replace(/ +/g, " ")
    .trim();
}

async function leesPdf(
  file: File,
  onVoortgang?: (v: LeesVoortgang) => void,
): Promise<BronLeesResultaat> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  onVoortgang?.({ fase: "pdf", pagina: 0, totaal: 1 });
  const doc = await pdfjs.getDocument({ data }).promise;
  const paginaAantal = doc.numPages;
  const steekproef = Math.min(paginaAantal, 3);
  const delen: string[] = [];
  for (let i = 1; i <= steekproef; i++) {
    onVoortgang?.({ fase: "pdf", pagina: i, totaal: steekproef });
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const regel = tekstUitItems(content.items as Array<{ str?: unknown }>);
    if (regel) delen.push(`--- pagina ${i} ---\n${regel}`);
  }
  const steekproefTekst = delen.join("\n\n").trim();
  const scan = steekproefTekst.length < steekproef * 40;
  let raw = steekproefTekst;
  if (scan) {
    const { ocrPdfDocument } = await import("./ocr-pdf");
    raw = await ocrPdfDocument(doc as never, (v) => onVoortgang?.({ fase: "ocr", ...v }));
  } else if (paginaAantal > steekproef) {
    const maxPages = Math.min(paginaAantal, 80);
    for (let i = steekproef + 1; i <= maxPages; i++) {
      onVoortgang?.({ fase: "pdf", pagina: i, totaal: maxPages });
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const regel = tekstUitItems(content.items as Array<{ str?: unknown }>);
      if (regel) delen.push(`--- pagina ${i} ---\n${regel}`);
    }
    raw = delen.join("\n\n").trim();
  }
  if (!raw) {
    throw new Error(
      "Deze pdf is een scan zonder leesbare tekst. Probeer een scherpere pdf, of plak de lesstof.",
    );
  }
  const { text, afgekapt } = kappen(raw, MAX_BRON_TEKENS);
  return {
    text,
    soort: "pdf",
    paginaAantal,
    afgekapt: afgekapt || paginaAantal > (scan ? 50 : 80),
    scan,
  };
}

export async function leesBronBestand(
  file: File,
  maxTekens = MAX_BRON_TEKENS,
  onVoortgang?: (v: LeesVoortgang) => void,
): Promise<BronLeesResultaat> {
  if (file.size > MAX_BRON_BYTES) {
    throw new Error("Bestand is te groot (max. 50 MB).");
  }
  if (isPdf(file)) {
    const result = await leesPdf(file, onVoortgang);
    if (maxTekens < MAX_BRON_TEKENS) {
      const gekapt = kappen(result.text, maxTekens);
      return { ...result, ...gekapt };
    }
    return result;
  }
  if (isDocx(file)) {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const extracted = await mammoth.extractRawText({ arrayBuffer: buf });
    const { text, afgekapt } = kappen(extracted.value, maxTekens);
    if (!text) throw new Error("Geen tekst in dit Word-bestand.");
    return { text, soort: "docx", afgekapt };
  }
  const { text, afgekapt } = kappen(await file.text(), maxTekens);
  if (!text) throw new Error("Geen tekst in dit bestand.");
  return { text, soort: "tekst", afgekapt };
}

export function bestandTeGroot(file: File): boolean {
  return file.size > MAX_BRON_BYTES;
}
