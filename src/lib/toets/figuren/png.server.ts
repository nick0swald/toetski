/**
 * SVG → PNG op de server (resvg-wasm + meegeleverde Liberation Sans).
 * De PNG die hier ontstaat is precies het beeld dat de keuring ziet en dat
 * — na een go — bevroren in de toets komt. Er wordt later nooit opnieuw gerenderd.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { FONT_BOLD_B64, FONT_REGULAR_B64, RESVG_WASM_B64 } from "./assets.generated.ts";

let init: Promise<void> | null = null;
let fonts: Uint8Array[] | null = null;

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function klaar(): Promise<Uint8Array[]> {
  if (!init) {
    init = initWasm(b64ToBytes(RESVG_WASM_B64)).catch((err: unknown) => {
      // "Already initialized" is prima (warme lambda of tests).
      if (err instanceof Error && /already/i.test(err.message)) return;
      init = null;
      throw err;
    });
  }
  await init;
  if (!fonts) fonts = [b64ToBytes(FONT_REGULAR_B64), b64ToBytes(FONT_BOLD_B64)];
  return fonts;
}

/** Rendert op `schaal`× de logische breedte (scherp in Word en voor de keuring). */
export async function svgNaarPng(svg: string, breedte: number, schaal = 2): Promise<Uint8Array> {
  const fontBuffers = await klaar();
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(breedte * schaal) },
    background: "#ffffff",
    font: {
      fontBuffers,
      loadSystemFonts: false,
      defaultFontFamily: "Liberation Sans",
      sansSerifFamily: "Liberation Sans",
    },
  } as ConstructorParameters<typeof Resvg>[1]);
  const img = r.render();
  const png = img.asPng();
  img.free();
  r.free();
  return png;
}
