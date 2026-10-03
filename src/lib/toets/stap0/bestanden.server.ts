/** Stap-0-export op de server: leerling- of docentdeel als PDF of Word (één bestand per aanroep, < 4,5 MB). */
import { maakDocxs } from "./export-docx.ts";
import { maakPdfs } from "./export-pdf.ts";
import { opmaakVoor, type Generatie, type SpecInvoer } from "./grok-spec.ts";
import { pngRender, stap0Fonts } from "./node.server.ts";

export type Stap0Deel = "leerling" | "docent";
export type Stap0Formaat = "pdf" | "docx";

export async function maakStap0Bestand(gen: Generatie, inv: SpecInvoer, o: { deel: Stap0Deel; formaat: Stap0Formaat; splitsen?: boolean }): Promise<{ naam: string; mime: string; bytes: Uint8Array }> {
  const { toets, res } = opmaakVoor(gen, inv, { splitsen: o.splitsen });
  const basis = (toets.titel || "toets").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 60) || "toets";
  const naam = `${basis} - ${o.deel === "leerling" ? "leerlingdeel" : "docentdeel"}.${o.formaat}`;
  if (o.formaat === "pdf") {
    const p = await maakPdfs(toets, res, stap0Fonts(), pngRender);
    return { naam, mime: "application/pdf", bytes: o.deel === "leerling" ? p.leerling : p.docent };
  }
  const d = await maakDocxs(toets, res, pngRender);
  return { naam, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: o.deel === "leerling" ? d.leerling : d.docent };
}
