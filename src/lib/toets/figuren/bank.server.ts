import { dbSource, getSql } from "@/lib/db";
import type { BankItem, FiguurBank } from "./bank";

/**
 * Figuurbank in Postgres (Neon via DATABASE_URL; tabel `figuur_bank`, zie migrations/0002_figuur_bank.sql).
 * Alleen actief op een gedeelde, blijvende database: zonder DATABASE_URL zou de PGLite-terugval
 * per serverinstantie in het geheugen leven (niet gedeeld, niet blijvend) → bank uit.
 * Lokaal testen met PGLite: FIGUURBANK_PGLITE=1.
 */
export function bankBron(): "neon" | "pglite-test" | "uit" {
  if (process.env.FIGUURBANK_UIT === "1") return "uit";
  if (dbSource === "neon") return "neon";
  if (process.env.FIGUURBANK_PGLITE === "1") return "pglite-test";
  return "uit";
}

type Rij = {
  sleutel: string;
  figuur_hash: string;
  figuur_id: string;
  soort: BankItem["soort"];
  bron: BankItem["bron"];
  mime: BankItem["mime"];
  data: string;
  breedte: number;
  hoogte: number;
  alt: string;
  spec: unknown;
  pogingen: number;
  go_rapport: unknown;
  aangemaakt: string | Date;
};

const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

export function maakServerBank(): FiguurBank | undefined {
  if (bankBron() === "uit") return undefined;
  return {
    async zoek(sleutel) {
      const sql = await getSql();
      const rijen = await sql<Rij>`select * from figuur_bank where sleutel = ${sleutel} limit 1`;
      const r = rijen[0];
      if (!r) return null;
      return {
        sleutel: r.sleutel,
        figuurHash: r.figuur_hash,
        figuurId: r.figuur_id,
        soort: r.soort,
        bron: r.bron,
        mime: r.mime,
        data: r.data,
        breedte: Number(r.breedte),
        hoogte: Number(r.hoogte),
        alt: r.alt,
        spec: json(r.spec),
        pogingen: Number(r.pogingen),
        goRapport: json(r.go_rapport),
        aangemaakt: r.aangemaakt instanceof Date ? r.aangemaakt.toISOString() : String(r.aangemaakt),
      };
    },
    async bewaar(i) {
      const sql = await getSql();
      // Onveranderlijk: bestaat de sleutel al, dan blijft het oude item staan.
      await sql`insert into figuur_bank
        (sleutel, figuur_hash, figuur_id, soort, bron, mime, data, breedte, hoogte, alt, spec, pogingen, go_rapport)
        values (${i.sleutel}, ${i.figuurHash}, ${i.figuurId}, ${i.soort}, ${i.bron}, ${i.mime}, ${i.data},
                ${i.breedte}, ${i.hoogte}, ${i.alt}, ${JSON.stringify(i.spec)}::jsonb, ${i.pogingen},
                ${JSON.stringify(i.goRapport)}::jsonb)
        on conflict (sleutel) do nothing`;
    },
  };
}

export async function bankStatus(): Promise<{ bron: ReturnType<typeof bankBron>; aantal: number | null; fout?: string }> {
  const bron = bankBron();
  if (bron === "uit") return { bron, aantal: null };
  try {
    const sql = await getSql();
    const r = await sql<{ n: number }>`select count(*)::int as n from figuur_bank`;
    return { bron, aantal: Number(r[0]?.n ?? 0) };
  } catch (err) {
    return { bron, aantal: null, fout: err instanceof Error ? err.message.slice(0, 160) : "onbekend" };
  }
}
