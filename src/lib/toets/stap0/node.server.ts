/** Node-afhankelijkheden voor de stap-0-export (fonts + resvg), los van de pure opmaakcode. */
import { FONT_BOLD_B64, FONT_REGULAR_B64 } from "../figuren/assets.generated.ts";
import { svgNaarPng } from "../figuren/png.server.ts";
import { SYMBOOL_FONT_B64 } from "./fonts.generated.ts";
import type { Fonts } from "./pdf-opmaak.ts";
import type { PngRender } from "./export-pdf.ts";

const b = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
let fonts: Fonts | null = null;
export function stap0Fonts(): Fonts {
  fonts ??= { regular: b(FONT_REGULAR_B64), bold: b(FONT_BOLD_B64), symbool: b(SYMBOOL_FONT_B64) };
  return fonts;
}
export const pngRender: PngRender = (svg, breedtePx) => svgNaarPng(svg, breedtePx, 1);
