export type OcrVoortgang = { pagina: number; totaal: number };

const MAX_OCR_PAGINAS = 50;

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPagina>;
};

type PdfPagina = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    intent?: string;
  }) => { promise: Promise<void> };
  cleanup?: () => void;
};

async function maakWorker() {
  const { createWorker } = await import("tesseract.js");
  const basis = {
    workerPath: "/tesseract/worker.min.js",
    langPath: "/tessdata",
    gzip: false as const,
  };
  try {
    return await createWorker("nld", 1, {
      ...basis,
      corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
    });
  } catch {
    return await createWorker("nld", 1, {
      ...basis,
      corePath: "/tesseract/tesseract-core-lstm.wasm.js",
    });
  }
}

async function ocrPagina(
  page: PdfPagina,
  canvas: HTMLCanvasElement,
  worker: Awaited<ReturnType<typeof maakWorker>>,
): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1.65, 1100 / Math.max(base.width, 1));
  const viewport = page.getViewport({ scale: Math.max(scale, 1.15) });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Kan de pagina niet tekenen.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport, intent: "display" }).promise;
  const { data } = await worker.recognize(canvas);
  return (data.text ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function ocrPdfDocument(
  doc: PdfDoc,
  onVoortgang?: (v: OcrVoortgang) => void,
): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error(
      "Deze pdf is een scan zonder tekstlaag. Open de maker in de browser; daar worden de pagina’s gelezen.",
    );
  }
  const totaal = Math.min(doc.numPages, MAX_OCR_PAGINAS);
  onVoortgang?.({ pagina: 0, totaal });
  const worker = await maakWorker();
  const canvas = document.createElement("canvas");
  const delen: string[] = [];
  try {
    for (let i = 1; i <= totaal; i++) {
      onVoortgang?.({ pagina: i, totaal });
      const page = await doc.getPage(i);
      const tekst = await ocrPagina(page, canvas, worker);
      if (tekst) delen.push(`--- pagina ${i} ---\n${tekst}`);
      page.cleanup?.();
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await worker.terminate();
  }
  const raw = delen.join("\n\n").trim();
  if (raw.length < 80) {
    throw new Error(
      "Deze scan leverde geen leesbare tekst op. Gebruik een scherpere pdf, of plak de lesstof.",
    );
  }
  return raw;
}
