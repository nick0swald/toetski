/**
 * PNG-vergelijking voor de snapshot-tests: TypeScript-render vs. Python-referentie (matplotlib). Twee renderers
 * geven nooit pixel-identieke beelden, dus we vergelijken de "inkt": bijsnijden tot de inkt, schalen naar een vaste
 * breedte, en tellen welk deel van de inkt van A binnen 2 px van inkt in B ligt (en omgekeerd).
 */
import { inflateSync } from "node:zlib";

export interface Beeld {
  w: number;
  h: number;
  /** Grijswaarden 0–255. */
  g: Uint8Array;
}

export function decodeerPng(buf: Uint8Array): Beeld {
  const b = Buffer.from(buf);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("geen PNG");
  let p = 8;
  let w = 0, h = 0, diepte = 0, kleur = 0, interlace = 0;
  const idat: Buffer[] = [];
  let palet: Buffer | null = null;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      diepte = data[8];
      kleur = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palet = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (diepte !== 8 || interlace) throw new Error(`PNG-variant niet ondersteund (diepte ${diepte}, interlace ${interlace})`);
  const kan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[kleur as 0 | 2 | 3 | 4 | 6];
  if (!kan) throw new Error(`kleurtype ${kleur}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * kan;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const rij = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= kan ? px[y * stride + x - kan] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= kan && y > 0 ? px[(y - 1) * stride + x - kan] : 0;
      let v = rij[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let r: number, gg: number, bb: number, al = 255;
    if (kleur === 3) {
      const k = px[i] * 3;
      r = palet![k]; gg = palet![k + 1]; bb = palet![k + 2];
    } else if (kan <= 2) {
      r = gg = bb = px[i * kan];
      if (kan === 2) al = px[i * 2 + 1];
    } else {
      r = px[i * kan]; gg = px[i * kan + 1]; bb = px[i * kan + 2];
      if (kan === 4) al = px[i * 4 + 3];
    }
    const lum = 0.299 * r + 0.587 * gg + 0.114 * bb;
    g[i] = Math.round((lum * al + 255 * (255 - al)) / 255);
  }
  return { w, h, g };
}

function inktKader(b: Beeld, drempel = 235) {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (b.g[y * b.w + x] < drempel) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

/** Bijsnijden tot de inkt en schalen (box-filter) naar breedte W; geeft een inktmasker. */
function masker(b: Beeld, W: number, H: number): Uint8Array {
  const k = inktKader(b);
  const cw = k.x1 - k.x0 + 1;
  const ch = k.y1 - k.y0 + 1;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx0 = k.x0 + Math.floor((x * cw) / W), sx1 = Math.max(sx0 + 1, k.x0 + Math.floor(((x + 1) * cw) / W));
      const sy0 = k.y0 + Math.floor((y * ch) / H), sy1 = Math.max(sy0 + 1, k.y0 + Math.floor(((y + 1) * ch) / H));
      let min = 255;
      for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++) min = Math.min(min, b.g[yy * b.w + xx]);
      m[y * W + x] = min < 200 ? 1 : 0;
    }
  return m;
}

function dekking(a: Uint8Array, b: Uint8Array, W: number, H: number, r: number): number {
  let n = 0, raak = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!a[y * W + x]) continue;
      n++;
      let ok = false;
      for (let dy = -r; dy <= r && !ok; dy++)
        for (let dx = -r; dx <= r && !ok; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W && b[yy * W + xx]) ok = true;
        }
      if (ok) raak++;
    }
  return n ? raak / n : 1;
}

export interface Vergelijking {
  /** Verhouding breedte/hoogte van de inkt: TS / referentie. */
  verhouding: number;
  /** Deel van de TS-inkt dat in de referentie terugkomt, en omgekeerd. */
  tsInRef: number;
  refInTs: number;
  score: number;
}

export function vergelijkInkt(ts: Beeld, ref: Beeld, W = 200, straal = 2): Vergelijking {
  const ka = inktKader(ts);
  const kb = inktKader(ref);
  const ra = (ka.x1 - ka.x0 + 1) / (ka.y1 - ka.y0 + 1);
  const rb = (kb.x1 - kb.x0 + 1) / (kb.y1 - kb.y0 + 1);
  const H = Math.max(8, Math.round(W / rb));
  const a = masker(ts, W, H);
  const b = masker(ref, W, H);
  const tsInRef = dekking(a, b, W, H, straal);
  const refInTs = dekking(b, a, W, H, straal);
  return { verhouding: ra / rb, tsInRef, refInTs, score: (2 * tsInRef * refInTs) / (tsInRef + refInTs || 1) };
}
