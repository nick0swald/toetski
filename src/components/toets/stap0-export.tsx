import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { leesPilotCode } from "@/lib/toets/maak-toets-stap0";
import { stap0Bestand } from "@/lib/toets/stap0-server";
import type { GegenereerdeToets } from "@/lib/toets/types";

type Deel = "leerling" | "docent";
type Formaat = "pdf" | "docx";

/** Stap-0-export: leerlingdeel (één voorblad; op verzoek deel A/B) en docentdeel (sleutel, matrijs, cijfer) als PDF/Word. */
export function Stap0Export({ toets }: { toets: GegenereerdeToets }) {
  const [bezig, setBezig] = useState<string | null>(null);
  const [splitsen, setSplitsen] = useState(false);
  if (!toets.stap0) return null;
  const m = toets.stap0.monitoring as { usd?: number; totaalMs?: number; restFouten?: string[] };

  async function download(deel: Deel, formaat: Formaat) {
    const k = `${deel}-${formaat}`;
    setBezig(k);
    try {
      const r = await stap0Bestand({ data: { pilot: leesPilotCode(), gen: toets.stap0!.gen, inv: toets.stap0!.inv, deel, formaat, splitsen: deel === "leerling" && splitsen } });
      if (!r.ok) throw new Error(r.error);
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.naam;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download mislukt");
    } finally {
      setBezig(null);
    }
  }

  const knop = (deel: Deel, formaat: Formaat, label: string) => (
    <Button type="button" variant="secondary" disabled={bezig !== null} onClick={() => void download(deel, formaat)} data-testid={`stap0-${deel}-${formaat}`}>
      {bezig === `${deel}-${formaat}` ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
      {label}
    </Button>
  );

  return (
    <div className="mt-4 grid gap-3 rounded-[var(--radius-lg)] bg-surface p-4" data-testid="stap0-export">
      <div className="text-sm font-semibold text-brand">Stap-0-export (pilot)</div>
      <div className="flex flex-wrap gap-2">
        {knop("leerling", "pdf", "Leerlingdeel PDF")}
        {knop("leerling", "docx", "Leerlingdeel Word")}
        {knop("docent", "pdf", "Docentdeel PDF")}
        {knop("docent", "docx", "Docentdeel Word")}
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={splitsen} onChange={(e) => setSplitsen(e.target.checked)} />
        Leerlingdeel splitsen in deel A en B
      </label>
      <p className="text-xs text-muted">
        Docentdeel: antwoordsleutel, toetsmatrijs en cijferberekening met grafiek.
        {typeof m.usd === "number" ? ` Kosten $${m.usd.toFixed(2)}` : ""}
        {typeof m.totaalMs === "number" ? ` · ${Math.round(m.totaalMs / 1000)} s` : ""}
        {m.restFouten?.length ? ` · ${m.restFouten.length} open punt(en)` : " · alle checks gehaald"}
      </p>
    </div>
  );
}
