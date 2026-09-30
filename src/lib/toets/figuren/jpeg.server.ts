/**
 * Verkleint een gegenereerde JPEG naar max. `maxBreedte` px (kleiner in localStorage en Word).
 * Dit gebeurt VÓÓR de keuring: de keuring ziet exact de bytes die geplaatst worden.
 */
import jpeg from "jpeg-js";

export function verkleinJpeg(bytes: Uint8Array, maxBreedte = 720, kwaliteit = 82): { bytes: Uint8Array; breedte: number; hoogte: number } {
  const src = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  if (src.width <= maxBreedte) return { bytes, breedte: src.width, hoogte: src.height };
  const f = maxBreedte / src.width;
  const W = maxBreedte;
  const H = Math.max(1, Math.round(src.height * f));
  const out = new Uint8Array(W * H * 4);
  // Box-filter: middel alle bronpixels die in de doelpixel vallen (geen aliasing).
  for (let y = 0; y < H; y++) {
    const sy0 = Math.floor(y / f);
    const sy1 = Math.min(src.height, Math.max(sy0 + 1, Math.floor((y + 1) / f)));
    for (let x = 0; x < W; x++) {
      const sx0 = Math.floor(x / f);
      const sx1 = Math.min(src.width, Math.max(sx0 + 1, Math.floor((x + 1) / f)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        let i = (sy * src.width + sx0) * 4;
        for (let sx = sx0; sx < sx1; sx++, i += 4) {
          r += src.data[i]!;
          g += src.data[i + 1]!;
          b += src.data[i + 2]!;
          n++;
        }
      }
      const o = (y * W + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  const enc = jpeg.encode({ data: out, width: W, height: H }, kwaliteit);
  return { bytes: new Uint8Array(enc.data), breedte: W, hoogte: H };
}
