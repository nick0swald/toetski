/** Gedeelde Word-pagina-instellingen (A4, marges, paginanummer onderaan) voor docx-export.ts en de stap-0-export. */
import { AlignmentType, Footer, Header, PageNumber, Paragraph, TextRun } from "docx";

const MUTED = "333333";
const FONT = "Arial";
const SMALL_SIZE = 20; // 10pt
export const PAGE_MARGINS = { top: 1418, right: 1418, bottom: 1134, left: 1418 };
export const PAGE_A4 = { width: 11906, height: 16838 };

export function pageNumberChrome() {
  return {
    headers: {
      default: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SMALL_SIZE, color: MUTED }),
            ],
          }),
        ],
      }),
    },
  };
}
